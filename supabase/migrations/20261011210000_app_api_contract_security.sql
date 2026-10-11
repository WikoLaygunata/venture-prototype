-- =============================================================================
-- Kenalan — synchronize the member API schema and enforce its privacy rules.
-- Apply after 20261011090000_dashboard_admin.sql.
-- =============================================================================

-- Profiles: member preferences used by the current app and dashboard.
alter table public.profiles
  add column if not exists is_discoverable boolean not null default true,
  add column if not exists stamp_history_public boolean not null default false,
  add column if not exists whatsapp text not null default '',
  add column if not exists line text not null default '',
  add column if not exists social_visibility jsonb not null default
    '{"instagram":"public","linkedin":"public","spotify":"public","whatsapp":"off","line":"off"}'::jsonb;

alter table public.reports
  drop constraint if exists reports_reason_length,
  add constraint reports_reason_length check (char_length(btrim(reason)) between 1 and 1000);

alter table public.profiles
  drop constraint if exists profiles_social_visibility_check,
  add constraint profiles_social_visibility_check check (
    jsonb_typeof(social_visibility) = 'object'
    and (social_visibility - 'instagram' - 'linkedin' - 'spotify' - 'whatsapp' - 'line') = '{}'::jsonb
    and coalesce(social_visibility ->> 'instagram', 'public') in ('public', 'mutual', 'off')
    and coalesce(social_visibility ->> 'linkedin', 'public') in ('public', 'mutual', 'off')
    and coalesce(social_visibility ->> 'spotify', 'public') in ('public', 'mutual', 'off')
    and coalesce(social_visibility ->> 'whatsapp', 'off') in ('public', 'mutual', 'off')
    and coalesce(social_visibility ->> 'line', 'off') in ('public', 'mutual', 'off')
  ),
  drop constraint if exists profiles_social_length_check,
  add constraint profiles_social_length_check check (
    char_length(instagram) <= 300
    and char_length(linkedin) <= 300
    and char_length(spotify) <= 300
    and char_length(whatsapp) <= 64
    and char_length(line) <= 300
  );

-- Social handles are returned only by get_profile_socials(), which applies the
-- profile owner's public/mutual/off choices using the authenticated viewer.
revoke all on table public.profiles from public, anon, authenticated;
grant select (
  id, username, full_name, avatar_url, faculty, major, batch, bio, color_code,
  interests, is_discoverable, stamp_history_public, created_at, updated_at
) on public.profiles to anon, authenticated;
grant insert (
  id, username, full_name, avatar_url, faculty, major, batch, bio, color_code,
  interests, instagram, linkedin, spotify, whatsapp, line, social_visibility,
  is_discoverable, stamp_history_public
) on public.profiles to authenticated;
grant update (
  id, username, full_name, avatar_url, faculty, major, batch, bio, color_code,
  interests, is_discoverable, stamp_history_public
) on public.profiles to authenticated;

-- Location stamps: retire the stale spot_id model and match current member UI.
alter table public.location_stamps
  add column if not exists location_label text not null default '';

update public.location_stamps s
   set location_label = coalesce(nullif(btrim(sp.name), ''), '')
  from public.spots sp
 where s.spot_id = sp.id;

alter table public.location_stamps
  drop column if exists spot_id,
  add column if not exists image_url text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists audience text not null default 'public',
  drop column if exists bearing_deg,
  drop column if exists distance_m;

update public.location_stamps
   set location_label = left(btrim(location_label), 120),
       image_url = case when char_length(image_url) > 7000000 then null else image_url end,
       audience = case when audience in ('public', 'mutual') then audience else 'public' end,
       lat = case
         when lat between -90 and 90 and lng between -180 and 180
           then round(lat::numeric, 4)::double precision
         else null
       end,
       lng = case
         when lat between -90 and 90 and lng between -180 and 180
           then round(lng::numeric, 4)::double precision
         else null
       end;

alter table public.location_stamps
  drop constraint if exists location_stamps_audience_check,
  add constraint location_stamps_audience_check check (audience in ('public', 'mutual')),
  drop constraint if exists location_stamps_location_label_length_check,
  add constraint location_stamps_location_label_length_check check (char_length(location_label) <= 120),
  drop constraint if exists location_stamps_image_url_length_check,
  add constraint location_stamps_image_url_length_check check (image_url is null or char_length(image_url) <= 7000000),
  drop constraint if exists location_stamps_coordinates_check,
  add constraint location_stamps_coordinates_check check (
    (lat is null and lng is null)
    or (
      lat is not null and lng is not null
      and lat between -90 and 90
      and lng between -180 and 180
    )
  );

create index if not exists location_stamps_audience_created_at_idx
  on public.location_stamps (audience, created_at desc);
create index if not exists location_stamps_user_created_at_idx
  on public.location_stamps (user_id, created_at desc);

-- Location is intentionally approximate. Never persist the browser's exact
-- geolocation, and never store viewer-relative distance or bearing.
create or replace function public.enforce_stamp_lifetime()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := coalesce(new.created_at, now());
  new.expires_at := new.created_at + interval '24 hours';
  new.message := btrim(new.message);
  new.location_label := btrim(coalesce(new.location_label, ''));
  if new.lat is not null then
    new.lat := round(new.lat::numeric, 4)::double precision;
    new.lng := round(new.lng::numeric, 4)::double precision;
  end if;
  return new;
end;
$$;

drop trigger if exists location_stamps_lifetime on public.location_stamps;
create trigger location_stamps_lifetime
  before insert or update on public.location_stamps
  for each row execute function public.enforce_stamp_lifetime();

-- Replies and blocks used by the member API.
create table if not exists public.stamp_replies (
  id         uuid primary key default gen_random_uuid(),
  stamp_id   uuid not null references public.location_stamps (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  message    text not null,
  created_at timestamptz not null default now(),
  constraint stamp_replies_message_length check (char_length(message) between 1 and 500)
);

create index if not exists stamp_replies_stamp_created_at_idx
  on public.stamp_replies (stamp_id, created_at);

create table if not exists public.blocks (
  id         uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null,
  created_at timestamptz not null default now(),
  constraint blocks_pair_unique unique (blocker_id, blocked_id),
  constraint blocks_no_self_block check (blocker_id <> blocked_id),
  constraint blocks_blocked_id_fkey foreign key (blocked_id)
    references public.profiles (id) on delete cascade
);

create index if not exists blocks_blocked_id_idx on public.blocks (blocked_id);

alter table public.stamp_replies enable row level security;
alter table public.blocks enable row level security;

drop policy if exists location_stamps_select_authenticated on public.location_stamps;
create policy location_stamps_select_authenticated
  on public.location_stamps for select
  to authenticated
  using (
    auth.uid() = user_id
    or (
      created_at >= now() - interval '30 days'
      and (
        (
          audience = 'public'
          and (
            expires_at > now()
            or exists (
              select 1 from public.profiles p
              where p.id = user_id and p.stamp_history_public
            )
          )
        )
        or (
          audience = 'mutual'
          and exists (
            select 1
            from public.mutuals m
            where (m.user_a_id = least(auth.uid(), user_id)
               and m.user_b_id = greatest(auth.uid(), user_id))
          )
          and (
            expires_at > now()
            or exists (
              select 1 from public.profiles p
              where p.id = user_id and p.stamp_history_public
            )
          )
        )
      )
    )
  );

drop policy if exists location_stamps_insert_own on public.location_stamps;
create policy location_stamps_insert_own
  on public.location_stamps for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists location_stamps_delete_own on public.location_stamps;
create policy location_stamps_delete_own
  on public.location_stamps for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists location_stamps_select_dashboard_admin on public.location_stamps;
create policy location_stamps_select_dashboard_admin
  on public.location_stamps for select
  to authenticated
  using (public.dashboard_has_role(array['admin', 'moderator', 'superadmin']));

drop policy if exists stamp_replies_select_visible_stamp on public.stamp_replies;
create policy stamp_replies_select_visible_stamp
  on public.stamp_replies for select
  to authenticated
  using (exists (
    select 1 from public.location_stamps s where s.id = stamp_id
  ));

drop policy if exists stamp_replies_insert_visible_stamp on public.stamp_replies;
create policy stamp_replies_insert_visible_stamp
  on public.stamp_replies for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.location_stamps s where s.id = stamp_id
    )
  );

drop policy if exists blocks_select_participant on public.blocks;
create policy blocks_select_participant
  on public.blocks for select
  to authenticated
  using (auth.uid() = blocker_id or auth.uid() = blocked_id);

drop policy if exists blocks_delete_owner on public.blocks;
create policy blocks_delete_owner
  on public.blocks for delete
  to authenticated
  using (auth.uid() = blocker_id);

revoke all on table public.location_stamps, public.stamp_replies, public.blocks
  from public, anon, authenticated;
grant select, delete on public.location_stamps to authenticated;
grant insert (user_id, message, location_label, image_url, lat, lng, audience)
  on public.location_stamps to authenticated;
grant select on public.stamp_replies to authenticated;
grant insert (stamp_id, user_id, message) on public.stamp_replies to authenticated;
grant select (id, blocker_id, blocked_id, created_at), delete
  on public.blocks to authenticated;

-- Social values never appear in profile table SELECTs, including profile(*) embeds.
-- Mutual-only values require an actual mutual relation.
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

create or replace function public.save_profile_socials(p_socials jsonb, p_visibility jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED: harus login untuk mengubah kontak profil'
      using errcode = '42501';
  end if;
  if jsonb_typeof(p_socials) <> 'object' or jsonb_typeof(p_visibility) <> 'object' then
    raise exception 'INVALID_SOCIALS: data kontak profil tidak valid'
      using errcode = '22023';
  end if;
  if (p_socials - 'instagram' - 'linkedin' - 'spotify' - 'whatsapp' - 'line') <> '{}'::jsonb
     or (p_visibility - 'instagram' - 'linkedin' - 'spotify' - 'whatsapp' - 'line') <> '{}'::jsonb
     or coalesce(p_visibility ->> 'instagram', 'public') not in ('public', 'mutual', 'off')
     or coalesce(p_visibility ->> 'linkedin', 'public') not in ('public', 'mutual', 'off')
     or coalesce(p_visibility ->> 'spotify', 'public') not in ('public', 'mutual', 'off')
     or coalesce(p_visibility ->> 'whatsapp', 'off') not in ('public', 'mutual', 'off')
     or coalesce(p_visibility ->> 'line', 'off') not in ('public', 'mutual', 'off') then
    raise exception 'INVALID_SOCIALS: pengaturan visibilitas kontak tidak valid'
      using errcode = '22023';
  end if;
  if char_length(coalesce(p_socials ->> 'instagram', '')) > 300
     or char_length(coalesce(p_socials ->> 'linkedin', '')) > 300
     or char_length(coalesce(p_socials ->> 'spotify', '')) > 300
     or char_length(coalesce(p_socials ->> 'whatsapp', '')) > 64
     or char_length(coalesce(p_socials ->> 'line', '')) > 300 then
    raise exception 'INVALID_SOCIALS: panjang kontak profil melebihi batas'
      using errcode = '22023';
  end if;

  update public.profiles p
     set instagram = coalesce(p_socials ->> 'instagram', ''),
         linkedin = coalesce(p_socials ->> 'linkedin', ''),
         spotify = coalesce(p_socials ->> 'spotify', ''),
         whatsapp = coalesce(p_socials ->> 'whatsapp', ''),
         line = coalesce(p_socials ->> 'line', ''),
         social_visibility = p_visibility
   where p.id = v_uid
  returning p.* into v_profile;
  if not found then
    raise exception 'PROFILE_NOT_FOUND: profil tidak ditemukan'
      using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'instagram', v_profile.instagram,
    'linkedin', v_profile.linkedin,
    'spotify', v_profile.spotify,
    'whatsapp', v_profile.whatsapp,
    'line', v_profile.line,
    'social_visibility', v_profile.social_visibility
  );
end;
$$;

revoke all on function public.save_profile_socials(jsonb, jsonb) from public, anon;
grant execute on function public.save_profile_socials(jsonb, jsonb) to authenticated;

create or replace function public.normalize_stamp_reply()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.message := btrim(new.message);
  return new;
end;
$$;

drop trigger if exists stamp_replies_normalize_message on public.stamp_replies;
create trigger stamp_replies_normalize_message
  before insert or update on public.stamp_replies
  for each row execute function public.normalize_stamp_reply();
revoke all on function public.normalize_stamp_reply() from public, anon, authenticated;

-- PING restrictions: block both directions and enforce the five-pending limit
-- with a sender-row lock so simultaneous requests cannot overshoot the quota.
create or replace function public.enforce_pending_ping_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pending_count integer;
begin
  if new.status <> 'pending' then return new; end if;
  new.message := btrim(new.message);

  perform 1 from public.profiles p where p.id = new.sender_id for update;
  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = new.sender_id and b.blocked_id = new.receiver_id)
       or (b.blocker_id = new.receiver_id and b.blocked_id = new.sender_id)
  ) then
    raise exception 'USER_BLOCKED: pengguna ini tidak dapat menerima PING'
      using errcode = '42501';
  end if;

  select count(*) into v_pending_count
  from public.pings p
  where p.sender_id = new.sender_id and p.status = 'pending';
  if v_pending_count >= 5 then
    raise exception 'PING_QUOTA_REACHED: batas lima PING pending tercapai'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_pending_ping_rules() from public, anon, authenticated;
drop trigger if exists pings_pending_quota on public.pings;
create trigger pings_pending_quota
  before insert on public.pings
  for each row execute function public.enforce_pending_ping_rules();

drop policy if exists pings_select_participant on public.pings;
create policy pings_select_participant
  on public.pings for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists pings_insert_as_sender on public.pings;
create policy pings_insert_as_sender
  on public.pings for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and status = 'pending'
    and sender_id <> receiver_id
  );

-- Serialize block/response operations on both users before changing PING rows.
create or replace function public.block_user(p_blocked_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_blocker_id uuid := auth.uid();
begin
  if v_blocker_id is null then
    raise exception 'AUTH_REQUIRED: harus login untuk memblokir pengguna'
      using errcode = '42501';
  end if;
  if p_blocked_id is null or p_blocked_id = v_blocker_id then
    raise exception 'INVALID_BLOCK: pengguna tujuan tidak valid'
      using errcode = '22023';
  end if;

  perform p.id
  from public.profiles p
  where p.id in (v_blocker_id, p_blocked_id)
  order by p.id
  for update;
  if (select count(*) from public.profiles p where p.id in (v_blocker_id, p_blocked_id)) <> 2 then
    raise exception 'PROFILE_NOT_FOUND: profil pengguna tidak ditemukan'
      using errcode = 'P0002';
  end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (v_blocker_id, p_blocked_id)
  on conflict (blocker_id, blocked_id) do nothing;

  delete from public.pings p
  where p.status = 'pending'
    and (
      (p.sender_id = v_blocker_id and p.receiver_id = p_blocked_id)
      or (p.sender_id = p_blocked_id and p.receiver_id = v_blocker_id)
    );
  return true;
end;
$$;

revoke all on function public.block_user(uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;

create or replace function public.respond_to_ping(p_ping_id uuid, p_status text)
returns public.pings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ping public.pings;
  v_a uuid;
  v_b uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED: harus login dulu' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('accepted', 'declined') then
    raise exception 'INVALID_STATUS: status harus accepted atau declined'
      using errcode = '22023';
  end if;

  select p.* into v_ping
  from public.pings p
  where p.id = p_ping_id and p.receiver_id = v_uid and p.status = 'pending';
  if not found then
    raise exception 'PING_NOT_ACTIONABLE: PING tidak ditemukan, bukan untukmu, atau sudah dibalas'
      using errcode = 'P0001';
  end if;

  perform p.id
  from public.profiles p
  where p.id in (v_ping.sender_id, v_ping.receiver_id)
  order by p.id
  for update;

  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = v_ping.sender_id and b.blocked_id = v_ping.receiver_id)
       or (b.blocker_id = v_ping.receiver_id and b.blocked_id = v_ping.sender_id)
  ) then
    raise exception 'USER_BLOCKED: PING tidak dapat dibalas karena ada blokir'
      using errcode = '42501';
  end if;

  update public.pings p
     set status = p_status, responded_at = now()
   where p.id = p_ping_id and p.receiver_id = v_uid and p.status = 'pending'
  returning p.* into v_ping;
  if not found then
    raise exception 'PING_NOT_ACTIONABLE: PING sudah dibalas atau dibatalkan'
      using errcode = 'P0001';
  end if;

  if p_status = 'accepted' then
    v_a := least(v_ping.sender_id, v_ping.receiver_id);
    v_b := greatest(v_ping.sender_id, v_ping.receiver_id);
    insert into public.mutuals (user_a_id, user_b_id)
    values (v_a, v_b)
    on conflict (user_a_id, user_b_id) do nothing;
  end if;
  return v_ping;
end;
$$;

revoke all on function public.respond_to_ping(uuid, text) from public;
grant execute on function public.respond_to_ping(uuid, text) to authenticated;

-- Keep default table grants explicit and least-privileged.
revoke all on table public.pings, public.mutuals from public, anon, authenticated;
grant select, insert, delete on public.pings to authenticated;
grant select, delete on public.mutuals to authenticated;

comment on column public.location_stamps.lat is
  'Approximate latitude rounded server-side to four decimal places; null when location is unavailable.';
comment on column public.location_stamps.lng is
  'Approximate longitude rounded server-side to four decimal places; null when location is unavailable.';
comment on column public.location_stamps.audience is
  'public or mutual; SELECT access is enforced by RLS before rows leave Postgres.';
