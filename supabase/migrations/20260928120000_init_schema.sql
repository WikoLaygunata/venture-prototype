-- =============================================================================
-- Kenalan — 01. Schema
--
-- Tables: profiles, nfc_tokens, spots, location_stamps, pings, mutuals
--
-- Two things in here are load-bearing for the frontend, do not rename them:
--   * the foreign key constraint names `pings_sender_id_fkey`,
--     `pings_receiver_id_fkey`, `mutuals_user_a_id_fkey`, `mutuals_user_b_id_fkey`
--     are referenced verbatim by the PostgREST embeds in src/lib/api.js
--     (e.g. `sender:profiles!pings_sender_id_fkey(*)`).
--   * the `mutuals` ordered-pair check mirrors the client sorting the uuid pair
--     before writing, so (a,b) and (b,a) can never both exist.
-- =============================================================================

-- ---------------------------------------------------------------- profiles ---
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text        not null,
  full_name   text        not null default '',
  avatar_url  text,
  faculty     text        not null default '',
  major       text        not null default '',
  batch       text        not null default '',
  bio         text        not null default '',
  color_code  text        not null default 'mint',
  interests   text[]      not null default '{}',
  instagram   text        not null default '',
  linkedin    text        not null default '',
  spotify     text        not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint profiles_username_unique unique (username),
  -- the four Color Codes the UI knows how to render
  constraint profiles_color_code_check check (color_code in ('mint', 'yellow', 'grey', 'red')),
  constraint profiles_username_format check (username ~ '^[a-z0-9_.]{3,24}$'),
  constraint profiles_bio_length check (char_length(bio) <= 160),
  constraint profiles_full_name_length check (char_length(full_name) <= 80)
);

comment on table public.profiles is
  'Public campus profile. Readable by anyone (including anon) because a scanned '
  'lanyard must show its owner before the visitor signs up — never put private '
  'data such as phone numbers or email in this table.';
comment on column public.profiles.color_code is
  'Social availability signal: mint=Open to Chat, yellow=Focus Mode, grey=Do Not Disturb, red=Looking for Connection.';

-- -------------------------------------------------------------- nfc_tokens ---
create table if not exists public.nfc_tokens (
  id          uuid primary key default gen_random_uuid(),
  token       text        not null,
  status      text        not null default 'unclaimed',
  user_id     uuid references public.profiles (id) on delete set null,
  batch_label text,
  created_at  timestamptz not null default now(),
  claimed_at  timestamptz,

  constraint nfc_tokens_token_unique unique (token),
  constraint nfc_tokens_status_check check (status in ('unclaimed', 'claimed')),
  -- An unclaimed tag must be completely unbound. A claimed tag keeps its
  -- claimed_at even if the owner account is later deleted; the BEFORE DELETE
  -- trigger on profiles recycles the tag before that can happen.
  constraint nfc_tokens_state_consistency check (
    (status = 'claimed' and claimed_at is not null)
    or (status = 'unclaimed' and user_id is null and claimed_at is null)
  )
);

comment on table public.nfc_tokens is
  'Lanyard tags. No RLS policy grants direct access: reads go through '
  'resolve_nfc_token() and writes through claim_nfc_token(), which prevents '
  'anyone from listing unclaimed tokens and stealing lanyards.';

-- ------------------------------------------------------------------- spots ---
create table if not exists public.spots (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null,
  emoji      text        not null default '📍',
  category   text        not null default '',
  -- Percentage coordinates on the mock campus map rendered in MapView.vue.
  x          numeric(5, 2) not null default 50,
  y          numeric(5, 2) not null default 50,
  is_active  boolean     not null default true,
  created_at timestamptz not null default now(),

  constraint spots_name_unique unique (name),
  constraint spots_x_range check (x >= 0 and x <= 100),
  constraint spots_y_range check (y >= 0 and y <= 100)
);

-- -------------------------------------------------------- location_stamps ---
create table if not exists public.location_stamps (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  spot_id    uuid        not null references public.spots (id) on delete cascade,
  message    text        not null,
  created_at timestamptz not null default now(),
  -- Always recomputed by the enforce_stamp_lifetime trigger; a client cannot
  -- give its own stamp a longer life than 24 hours.
  expires_at timestamptz not null default (now() + interval '24 hours'),

  constraint location_stamps_message_length check (char_length(message) between 4 and 180)
);

comment on table public.location_stamps is
  'Short "I am here right now" notes pinned to a campus spot. Expire after 24h.';

-- ------------------------------------------------------------------- pings ---
create table if not exists public.pings (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid        not null,
  receiver_id  uuid        not null,
  message      text        not null,
  status       text        not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,

  -- Named explicitly: src/lib/api.js embeds these by name.
  constraint pings_sender_id_fkey foreign key (sender_id)
    references public.profiles (id) on delete cascade,
  constraint pings_receiver_id_fkey foreign key (receiver_id)
    references public.profiles (id) on delete cascade,

  constraint pings_status_check check (status in ('pending', 'accepted', 'declined')),
  constraint pings_no_self_ping check (sender_id <> receiver_id),
  constraint pings_message_length check (char_length(message) between 1 and 220)
);

-- One outstanding request per direction, matching the client-side guard.
create unique index if not exists pings_one_pending_per_pair
  on public.pings (sender_id, receiver_id)
  where status = 'pending';

-- ----------------------------------------------------------------- mutuals ---
create table if not exists public.mutuals (
  id         uuid primary key default gen_random_uuid(),
  user_a_id  uuid        not null,
  user_b_id  uuid        not null,
  created_at timestamptz not null default now(),

  -- Named explicitly: src/lib/api.js embeds these by name.
  constraint mutuals_user_a_id_fkey foreign key (user_a_id)
    references public.profiles (id) on delete cascade,
  constraint mutuals_user_b_id_fkey foreign key (user_b_id)
    references public.profiles (id) on delete cascade,

  constraint mutuals_pair_unique unique (user_a_id, user_b_id),
  -- Canonical ordering makes the pair unique regardless of who accepted.
  constraint mutuals_ordered_pair check (user_a_id < user_b_id)
);

-- =============================================================================
-- Indexes
-- =============================================================================
create index if not exists nfc_tokens_user_id_idx
  on public.nfc_tokens (user_id);

create index if not exists location_stamps_created_at_idx
  on public.location_stamps (created_at desc);
create index if not exists location_stamps_expires_at_idx
  on public.location_stamps (expires_at);
create index if not exists location_stamps_user_id_idx
  on public.location_stamps (user_id);
create index if not exists location_stamps_spot_id_idx
  on public.location_stamps (spot_id);

create index if not exists pings_receiver_idx
  on public.pings (receiver_id, status, created_at desc);
create index if not exists pings_sender_idx
  on public.pings (sender_id, status, created_at desc);

create index if not exists mutuals_user_a_idx on public.mutuals (user_a_id);
create index if not exists mutuals_user_b_idx on public.mutuals (user_b_id);

-- =============================================================================
-- Normalisation triggers
--
-- These keep the data canonical no matter which client wrote it, so the app
-- code stays free of defensive casing logic.
-- =============================================================================

-- profiles: lowercase the username, keep updated_at honest -------------------
create or replace function public.normalize_profile()
returns trigger
language plpgsql
as $$
begin
  new.username := lower(btrim(new.username));
  new.full_name := btrim(new.full_name);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_normalize on public.profiles;
create trigger profiles_normalize
  before insert or update on public.profiles
  for each row execute function public.normalize_profile();

-- nfc_tokens: tokens are always stored upper-case ---------------------------
create or replace function public.normalize_nfc_token()
returns trigger
language plpgsql
as $$
begin
  new.token := upper(btrim(new.token));
  return new;
end;
$$;

drop trigger if exists nfc_tokens_normalize on public.nfc_tokens;
create trigger nfc_tokens_normalize
  before insert or update on public.nfc_tokens
  for each row execute function public.normalize_nfc_token();

-- location_stamps: expiry is server-authoritative ---------------------------
create or replace function public.enforce_stamp_lifetime()
returns trigger
language plpgsql
as $$
begin
  -- Ignore whatever expires_at the client sent; 24h from creation, always.
  new.expires_at := new.created_at + interval '24 hours';
  new.message := btrim(new.message);
  return new;
end;
$$;

drop trigger if exists location_stamps_lifetime on public.location_stamps;
create trigger location_stamps_lifetime
  before insert or update on public.location_stamps
  for each row execute function public.enforce_stamp_lifetime();

-- profiles: recycle lanyards when an account is deleted ---------------------
-- Runs BEFORE the delete so the tags are still linked and can be reset to
-- 'unclaimed' instead of being left in a claimed-but-ownerless state.
create or replace function public.release_nfc_tokens()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.nfc_tokens
     set status = 'unclaimed',
         user_id = null,
         claimed_at = null
   where user_id = old.id;
  return old;
end;
$$;

drop trigger if exists profiles_release_tokens on public.profiles;
create trigger profiles_release_tokens
  before delete on public.profiles
  for each row execute function public.release_nfc_tokens();
