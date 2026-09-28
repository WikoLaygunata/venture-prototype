-- =============================================================================
-- Kenalan — 02. Row Level Security
--
-- Access model, in one paragraph:
--
--   profiles          world-readable (a scanned lanyard must render for a guest),
--                     writable only by the owner.
--   spots             world-readable reference data.
--   location_stamps   readable by signed-in users, writable/deletable by author.
--   pings             visible only to the two participants; only the sender may
--                     create one; responding happens through respond_to_ping().
--   mutuals           visible only to the two participants; rows are created
--                     exclusively by respond_to_ping(), never by a client.
--   nfc_tokens        NO direct access at all. Reads go through
--                     resolve_nfc_token(), claims through claim_nfc_token().
--
-- The nfc_tokens lockdown is the important one: if anon could SELECT that table
-- it could list every unclaimed token and claim other people's lanyards.
-- =============================================================================

alter table public.profiles        enable row level security;
alter table public.nfc_tokens      enable row level security;
alter table public.spots           enable row level security;
alter table public.location_stamps enable row level security;
alter table public.pings           enable row level security;
alter table public.mutuals         enable row level security;

-- ---------------------------------------------------------------- profiles ---
drop policy if exists profiles_select_public on public.profiles;
create policy profiles_select_public
  on public.profiles for select
  to anon, authenticated
  using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists profiles_delete_self on public.profiles;
create policy profiles_delete_self
  on public.profiles for delete
  to authenticated
  using (auth.uid() = id);

-- ------------------------------------------------------------------- spots ---
-- Reference data curated by admins through the dashboard / service role.
drop policy if exists spots_select_public on public.spots;
create policy spots_select_public
  on public.spots for select
  to anon, authenticated
  using (is_active);

-- -------------------------------------------------------- location_stamps ---
-- The feed is a members-only feature, so anon gets nothing here.
drop policy if exists location_stamps_select_authenticated on public.location_stamps;
create policy location_stamps_select_authenticated
  on public.location_stamps for select
  to authenticated
  using (true);

drop policy if exists location_stamps_insert_own on public.location_stamps;
create policy location_stamps_insert_own
  on public.location_stamps for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists location_stamps_update_own on public.location_stamps;
create policy location_stamps_update_own
  on public.location_stamps for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists location_stamps_delete_own on public.location_stamps;
create policy location_stamps_delete_own
  on public.location_stamps for delete
  to authenticated
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------- pings ---
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
    and status = 'pending'          -- cannot open a PING that is already accepted
    and sender_id <> receiver_id
  );

-- Deliberately no UPDATE policy. Accepting/declining goes through
-- respond_to_ping(), which also creates the mutual row atomically. Letting a
-- client flip the status directly would let it accept its own outgoing PING.

drop policy if exists pings_delete_as_sender on public.pings;
create policy pings_delete_as_sender
  on public.pings for delete
  to authenticated
  using (auth.uid() = sender_id and status = 'pending');

-- ----------------------------------------------------------------- mutuals ---
drop policy if exists mutuals_select_participant on public.mutuals;
create policy mutuals_select_participant
  on public.mutuals for select
  to authenticated
  using (auth.uid() = user_a_id or auth.uid() = user_b_id);

-- Either side can walk away from the connection.
drop policy if exists mutuals_delete_participant on public.mutuals;
create policy mutuals_delete_participant
  on public.mutuals for delete
  to authenticated
  using (auth.uid() = user_a_id or auth.uid() = user_b_id);

-- No INSERT policy: only respond_to_ping() writes here, so a connection always
-- has a real accepted PING behind it. Public mutual counts are served by
-- count_mutuals(), which is SECURITY DEFINER.

-- -------------------------------------------------------------- nfc_tokens ---
-- No policies at all. RLS with zero policies denies everything, but Supabase
-- also grants table privileges to anon/authenticated by default, so revoke
-- those too — belt and braces.
revoke all on table public.nfc_tokens from anon, authenticated;
