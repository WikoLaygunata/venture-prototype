-- Admin-only user account recovery and bounded batch keychain creation.
-- Apply after 20261011210000_app_api_contract_security.sql.

alter table public.profiles
  add column if not exists is_banned boolean not null default false;

create or replace function public.app_member_is_active()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select auth.uid() is not null and not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_banned
  );
$$;

revoke all on function public.app_member_is_active() from public, anon;
grant execute on function public.app_member_is_active() to authenticated;

-- Restrictive policies are ANDed with existing policies: banning a member
-- blocks their authenticated reads even while an already-issued JWT exists.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'profiles', 'nfc_tokens', 'spots', 'location_stamps', 'pings', 'mutuals',
    'stamp_replies', 'blocks', 'reports', 'dashboard_admins', 'dashboard_audit_logs'
  ] loop
    execute format('drop policy if exists active_member_required on public.%I', v_table);
    execute format(
      'create policy active_member_required on public.%I as restrictive for all to authenticated using (public.app_member_is_active()) with check (public.app_member_is_active())',
      v_table
    );
  end loop;
end;
$$;

create or replace function public.reject_inactive_member_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.app_member_is_active() then
    raise exception 'ACCOUNT_DISABLED: akun ini sedang dinonaktifkan'
      using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'profiles', 'nfc_tokens', 'location_stamps', 'pings', 'mutuals',
    'stamp_replies', 'blocks', 'reports'
  ] loop
    execute format('drop trigger if exists active_member_required on public.%I', v_table);
    execute format(
      'create trigger active_member_required before insert or update or delete on public.%I for each row execute function public.reject_inactive_member_mutation()',
      v_table
    );
  end loop;
end;
$$;

create or replace function public.dashboard_has_role(p_roles text[])
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select public.app_member_is_active() and exists (
    select 1 from public.dashboard_admins a
    where a.user_id = auth.uid() and a.role = any (p_roles)
  );
$$;

create or replace function public.dashboard_get_my_role()
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select a.role
  from public.dashboard_admins a
  where a.user_id = auth.uid()
    and public.app_member_is_active();
$$;

revoke all on function public.dashboard_has_role(text[]) from public, anon;
grant execute on function public.dashboard_has_role(text[]) to authenticated;
revoke all on function public.dashboard_get_my_role() from public, anon;
grant execute on function public.dashboard_get_my_role() to authenticated;

create or replace function public.get_profile_socials(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_viewer uuid := auth.uid();
  v_mutual boolean := false;
  v_result jsonb := '{}'::jsonb;
  v_key text;
  v_visibility text;
begin
  if v_viewer is not null and not public.app_member_is_active() then
    return '{}'::jsonb;
  end if;

  select p.* into v_profile
  from public.profiles p
  where p.id = p_profile_id;
  if not found then return null; end if;

  if v_viewer is not null and v_viewer <> p_profile_id then
    select exists (
      select 1 from public.mutuals m
      where m.user_a_id = least(v_viewer, p_profile_id)
        and m.user_b_id = greatest(v_viewer, p_profile_id)
    ) into v_mutual;
  end if;

  foreach v_key in array array['instagram', 'linkedin', 'spotify', 'whatsapp', 'line'] loop
    v_visibility := coalesce(v_profile.social_visibility ->> v_key,
      case when v_key in ('whatsapp', 'line') then 'off' else 'public' end);
    if v_viewer = p_profile_id
       or v_visibility = 'public'
       or (v_visibility = 'mutual' and v_mutual) then
      v_result := v_result || jsonb_build_object(v_key, to_jsonb(
        case v_key
          when 'instagram' then v_profile.instagram
          when 'linkedin' then v_profile.linkedin
          when 'spotify' then v_profile.spotify
          when 'whatsapp' then v_profile.whatsapp
          when 'line' then v_profile.line
        end
      ));
    end if;
  end loop;

  if v_viewer = p_profile_id then
    v_result := v_result || jsonb_build_object('social_visibility', v_profile.social_visibility);
  end if;
  return v_result;
end;
$$;

revoke all on function public.get_profile_socials(uuid) from public;
grant execute on function public.get_profile_socials(uuid) to anon, authenticated;

create or replace function public.dashboard_get_stamp_thread(p_stamp_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_thread jsonb;
begin
  if auth.uid() is null
     or not public.dashboard_has_role(array['admin', 'moderator', 'superadmin']) then
    raise exception 'DASHBOARD_FORBIDDEN: akses dashboard diperlukan'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', s.id,
    'user_id', s.user_id,
    'message', s.message,
    'location_label', s.location_label,
    'image_url', s.image_url,
    'lat', s.lat,
    'lng', s.lng,
    'audience', s.audience,
    'created_at', s.created_at,
    'expires_at', s.expires_at,
    'author', jsonb_build_object(
      'id', p.id,
      'username', p.username,
      'full_name', p.full_name,
      'avatar_url', p.avatar_url,
      'color_code', p.color_code
    ),
    'replies', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'stamp_id', r.stamp_id,
          'user_id', r.user_id,
          'message', r.message,
          'created_at', r.created_at,
          'author', jsonb_build_object(
            'id', rp.id,
            'username', rp.username,
            'full_name', rp.full_name,
            'avatar_url', rp.avatar_url
          )
        ) order by r.created_at asc
      )
      from public.stamp_replies r
      join public.profiles rp on rp.id = r.user_id
      where r.stamp_id = s.id
    ), '[]'::jsonb)
  )
  into v_thread
  from public.location_stamps s
  join public.profiles p on p.id = s.user_id
  where s.id = p_stamp_id;

  return v_thread;
end;
$$;

revoke all on function public.dashboard_get_stamp_thread(uuid) from public, anon;
grant execute on function public.dashboard_get_stamp_thread(uuid) to authenticated;

drop function if exists public.dashboard_user_activity_counts(uuid);
create function public.dashboard_user_activity_counts(p_user_id uuid)
returns table (mutual_count bigint, stamp_count bigint, report_count bigint)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not public.dashboard_has_role(array['admin', 'moderator', 'superadmin']) then
    raise exception 'DASHBOARD_FORBIDDEN: akses dashboard diperlukan'
      using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from public.mutuals m
      where m.user_a_id = p_user_id or m.user_b_id = p_user_id),
    (select count(*) from public.location_stamps s where s.user_id = p_user_id),
    (select count(*) from public.reports r where r.reported_id = p_user_id);
end;
$$;

revoke all on function public.dashboard_user_activity_counts(uuid) from public, anon;
grant execute on function public.dashboard_user_activity_counts(uuid) to authenticated;

create or replace function public.dashboard_user_contact_details(p_user_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_details jsonb;
begin
  if auth.uid() is null
     or not public.dashboard_has_role(array['admin', 'superadmin']) then
    raise exception 'DASHBOARD_FORBIDDEN: akses admin diperlukan'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'email', u.email,
    'instagram', p.instagram,
    'linkedin', p.linkedin,
    'spotify', p.spotify,
    'whatsapp', p.whatsapp,
    'line', p.line,
    'is_banned', p.is_banned
  )
  into v_details
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = p_user_id;

  return v_details;
end;
$$;

revoke all on function public.dashboard_user_contact_details(uuid) from public, anon;
grant execute on function public.dashboard_user_contact_details(uuid) to authenticated;

drop function if exists public.dashboard_create_nfc_token(text);

create function public.dashboard_create_nfc_token(
  p_batch_label text default null,
  p_count integer default 1
)
returns setof public.nfc_tokens
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_token text;
  v_row public.nfc_tokens;
  v_index integer;
begin
  if v_actor is null or not public.dashboard_has_role(array['admin', 'superadmin']) then
    raise exception 'DASHBOARD_FORBIDDEN: akses admin diperlukan'
      using errcode = '42501';
  end if;

  if p_count is null or p_count < 1 or p_count > 20 then
    raise exception 'INVALID_COUNT: jumlah token harus antara 1 dan 20'
      using errcode = '22023';
  end if;

  for v_index in 1..p_count loop
    loop
      v_token := 'KNL-' || upper(encode(extensions.gen_random_bytes(12), 'hex'));
      exit when not exists (
        select 1 from public.nfc_tokens t where t.token = v_token
      );
    end loop;

    insert into public.nfc_tokens (token, status, batch_label)
    values (v_token, 'unclaimed', nullif(left(btrim(p_batch_label), 80), ''))
    returning * into v_row;

    insert into public.dashboard_audit_logs (actor_id, action, target_type, target_id, details)
    values (
      v_actor,
      'nfc_token.created',
      'nfc_token',
      v_row.id::text,
      jsonb_build_object('batch_label', v_row.batch_label, 'batch_count', p_count)
    );

    return next v_row;
  end loop;
end;
$$;

revoke all on function public.dashboard_create_nfc_token(text, integer) from public, anon;
grant execute on function public.dashboard_create_nfc_token(text, integer) to authenticated;

-- Signup is not open registration: an NFC token is atomically bound inside
-- the auth.users trigger. This also protects against clients bypassing Vue.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_base text;
  v_username text;
  v_suffix integer := 0;
begin
  v_token := upper(btrim(coalesce(new.raw_user_meta_data ->> 'nfc_token', '')));

  v_base := regexp_replace(
    lower(coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'kenalan'
    )),
    '[^a-z0-9_.]', '', 'g'
  );
  if char_length(v_base) < 3 then v_base := v_base || 'user'; end if;
  v_base := left(v_base, 24);
  v_username := v_base;

  while exists (select 1 from public.profiles p where p.username = v_username) loop
    v_suffix := v_suffix + 1;
    v_username := left(v_base, 20) || v_suffix::text;
    if v_suffix >= 99 then
      v_username := left(v_base, 16) || floor(random() * 1000000)::text;
      exit;
    end if;
  end loop;

  insert into public.profiles (id, username, full_name, avatar_url, faculty, major, bio)
  values (
    new.id,
    v_username,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 80),
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    left(coalesce(new.raw_user_meta_data ->> 'faculty', ''), 120),
    left(coalesce(new.raw_user_meta_data ->> 'major', ''), 120),
    left(coalesce(new.raw_user_meta_data ->> 'bio', ''), 160)
  )
  on conflict (id) do nothing;

  -- Jika registrasi menyertakan token NFC, klaim tokennya
  if v_token <> '' then
    update public.nfc_tokens t
       set status = 'claimed',
           user_id = new.id,
           claimed_at = now()
     where t.token = v_token
       and t.status = 'unclaimed'
    returning t.token into v_token;

    if not found then
      raise exception 'NFC_TOKEN_INVALID: token tidak valid atau sudah digunakan'
        using errcode = '22023';
    end if;
  end if;

  return new;
exception
  when others then
    if sqlerrm like '%NFC_TOKEN%' then
      raise;
    end if;
    raise warning '[Kenalan] handle_new_user error for %: %', new.id, sqlerrm;
    return new;
end;
$$;
