-- =============================================================================
-- Kenalan — 03. RPC surface + auth bootstrap
--
-- Everything the client cannot be trusted to do directly lives here. Each
-- function is SECURITY DEFINER with `search_path = ''` (so every identifier is
-- fully qualified and cannot be hijacked by a rogue search_path) and has its
-- default PUBLIC execute grant revoked before being granted to specific roles.
-- =============================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- =============================================================================
-- resolve_nfc_token(token) -> (status, owner_id)
--
-- The only way to read nfc_tokens. Callable by anon because a guest tapping a
-- lanyard has no session yet. Returns zero rows when the token does not exist,
-- which the frontend renders as "Token tidak dikenali".
--
-- Note it answers only for an exact token match, so there is no way to page
-- through the table and harvest unclaimed tags.
-- =============================================================================
create or replace function public.resolve_nfc_token(p_token text)
returns table (status text, owner_id uuid)
language sql
security definer
stable
set search_path = ''
as $$
  select t.status, t.user_id
  from public.nfc_tokens t
  where t.token = upper(btrim(p_token))
  limit 1;
$$;

revoke all on function public.resolve_nfc_token(text) from public;
grant execute on function public.resolve_nfc_token(text) to anon, authenticated;

comment on function public.resolve_nfc_token(text) is
  'Resolve a lanyard token to its claim status and owner. Exact match only.';

-- =============================================================================
-- claim_nfc_token(token) -> nfc_tokens
--
-- Binds an unclaimed tag to the caller. The `status = ''unclaimed''` predicate
-- inside the UPDATE makes this a compare-and-set: two people racing for the
-- same tag means the loser updates zero rows and gets an error rather than
-- silently stealing it.
-- =============================================================================
create or replace function public.claim_nfc_token(p_token text)
returns public.nfc_tokens
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.nfc_tokens;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED: harus login dulu untuk mengklaim lanyard'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'PROFILE_MISSING: profil belum terbentuk, lengkapi profil dulu'
      using errcode = 'P0002';
  end if;

  update public.nfc_tokens t
     set status     = 'claimed',
         user_id    = v_uid,
         claimed_at = now()
   where t.token = upper(btrim(p_token))
     and t.status = 'unclaimed'
  returning t.* into v_row;

  if v_row.id is null then
    raise exception 'TOKEN_UNAVAILABLE: token tidak ditemukan atau sudah diklaim orang lain'
      using errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

revoke all on function public.claim_nfc_token(text) from public;
grant execute on function public.claim_nfc_token(text) to authenticated;

-- =============================================================================
-- respond_to_ping(ping_id, status) -> pings
--
-- Accept or decline a PING addressed to the caller, and on acceptance create
-- the mutual row in the same transaction. This is why `pings` has no UPDATE
-- policy and `mutuals` has no INSERT policy: routing both through here means a
-- connection can never exist without a real accepted PING behind it, and
-- nobody can accept their own outgoing request.
-- =============================================================================
create or replace function public.respond_to_ping(p_ping_id uuid, p_status text)
returns public.pings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_ping public.pings;
  v_a    uuid;
  v_b    uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED: harus login dulu' using errcode = '42501';
  end if;

  if p_status not in ('accepted', 'declined') then
    raise exception 'INVALID_STATUS: status harus accepted atau declined'
      using errcode = '22023';
  end if;

  -- receiver_id = caller is the authorisation check; status = 'pending' makes
  -- the response idempotent (a double tap updates nothing the second time).
  update public.pings p
     set status       = p_status,
         responded_at = now()
   where p.id = p_ping_id
     and p.receiver_id = v_uid
     and p.status = 'pending'
  returning p.* into v_ping;

  if v_ping.id is null then
    raise exception 'PING_NOT_ACTIONABLE: PING tidak ditemukan, bukan untukmu, atau sudah dibalas'
      using errcode = 'P0001';
  end if;

  if p_status = 'accepted' then
    -- Canonical pair ordering, same rule as the mutuals_ordered_pair check.
    if v_ping.sender_id < v_ping.receiver_id then
      v_a := v_ping.sender_id;
      v_b := v_ping.receiver_id;
    else
      v_a := v_ping.receiver_id;
      v_b := v_ping.sender_id;
    end if;

    insert into public.mutuals (user_a_id, user_b_id)
    values (v_a, v_b)
    on conflict (user_a_id, user_b_id) do nothing;
  end if;

  return v_ping;
end;
$$;

revoke all on function public.respond_to_ping(uuid, text) from public;
grant execute on function public.respond_to_ping(uuid, text) to authenticated;

-- =============================================================================
-- count_mutuals(user_id) -> integer
--
-- `mutuals` is only visible to the two people in it, but the profile screen
-- shows a connection count for anyone. This exposes just the number.
-- =============================================================================
create or replace function public.count_mutuals(p_user_id uuid)
returns integer
language sql
security definer
stable
set search_path = ''
as $$
  select count(*)::int
  from public.mutuals m
  where m.user_a_id = p_user_id
     or m.user_b_id = p_user_id;
$$;

revoke all on function public.count_mutuals(uuid) from public;
grant execute on function public.count_mutuals(uuid) to anon, authenticated;

-- =============================================================================
-- purge_expired_stamps() -> integer
--
-- Stamps are filtered by expires_at at read time, so this is only housekeeping.
-- Service role only; see the pg_cron snippet at the bottom of this file.
-- =============================================================================
create or replace function public.purge_expired_stamps()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.location_stamps where expires_at <= now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_expired_stamps() from public;
grant execute on function public.purge_expired_stamps() to service_role;

-- =============================================================================
-- generate_nfc_tokens(count, prefix) -> setof text
--
-- Provisioning helper for a batch of physical lanyards. Uses gen_random_bytes
-- rather than random(), because a guessable token means a stealable lanyard.
-- Service role only — run it from the SQL editor or a trusted backend.
--
--   select * from public.generate_nfc_tokens(50, 'KNL');
-- =============================================================================
create or replace function public.generate_nfc_tokens(
  p_count  integer,
  p_prefix text default 'KNL',
  p_batch_label text default null
)
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  i integer;
begin
  if p_count is null or p_count < 1 or p_count > 5000 then
    raise exception 'COUNT_OUT_OF_RANGE: jumlah harus 1..5000' using errcode = '22023';
  end if;

  for i in 1..p_count loop
    -- 16 hex chars ≈ 64 bits of entropy, e.g. KNL-3F9A1C07B2D45E68
    v_token := upper(btrim(p_prefix)) || '-' ||
               upper(encode(extensions.gen_random_bytes(8), 'hex'));

    insert into public.nfc_tokens (token, batch_label)
    values (v_token, p_batch_label)
    on conflict (token) do nothing;

    return next v_token;
  end loop;
end;
$$;

revoke all on function public.generate_nfc_tokens(integer, text, text) from public;
grant execute on function public.generate_nfc_tokens(integer, text, text) to service_role;

-- =============================================================================
-- handle_new_user() — bootstrap a profile row for every new auth user
--
-- Needed because with email confirmation ON there is no session right after
-- signUp(), so the client cannot insert its own profile (RLS would reject it).
-- The frontend still upserts the full profile once a session exists; this
-- trigger just guarantees the row is never missing.
--
-- It deliberately swallows errors: a failure here must not block registration.
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base     text;
  v_username text;
  v_suffix   integer := 0;
begin
  -- Prefer the username the client sent in options.data, else the email local part.
  v_base := regexp_replace(
    lower(coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'kenalan'
    )),
    '[^a-z0-9_.]', '', 'g'
  );

  if char_length(v_base) < 3 then
    v_base := v_base || 'user';
  end if;
  v_base := left(v_base, 20);

  v_username := v_base;
  while exists (select 1 from public.profiles p where p.username = v_username) loop
    v_suffix := v_suffix + 1;
    v_username := left(v_base, 18) || v_suffix::text;
    if v_suffix >= 99 then
      v_username := left(v_base, 14) || floor(random() * 1000000)::text;
      exit;
    end if;
  end loop;

  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    v_username,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 80),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  return new;
exception
  when others then
    raise warning '[Kenalan] handle_new_user failed for %: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- Optional extras — uncomment if you want them
-- =============================================================================

-- Hourly cleanup of expired stamps (requires the pg_cron extension):
--
--   create extension if not exists pg_cron;
--   select cron.schedule(
--     'kenalan-purge-expired-stamps',
--     '0 * * * *',
--     $cron$ select public.purge_expired_stamps(); $cron$
--   );

-- Realtime updates for the stamp feed and PING inbox:
--
--   alter publication supabase_realtime add table public.location_stamps;
--   alter publication supabase_realtime add table public.pings;
