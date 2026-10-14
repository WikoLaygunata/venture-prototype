-- =============================================================================
-- Kenalan — seed data
--
-- Run automatically by `supabase db reset`. Idempotent, so it is safe to apply
-- to an existing project too (paste it into the SQL editor).
--
-- Only reference data and blank lanyards live here. Profiles are NOT seeded
-- because every profile row needs a matching auth.users record — create test
-- accounts through the app's own registration flow (or the snippet at the
-- bottom of this file) and the handle_new_user trigger will do the rest.
-- =============================================================================

-- ------------------------------------------------------------------- spots ---
-- x/y are percentage coordinates on the mock campus map in MapView.vue and
-- match the demo dataset in src/lib/mockData.js, so the visual stays identical
-- whether you run against Supabase or in demo mode.


-- insert into public.spots (name, emoji, category, x, y) values
--   ('Perpustakaan Pusat', '📚', 'Belajar',    26, 24),
--   ('Kantin LT 1',        '🍜', 'Makan',      68, 38),
--   ('Student Center',     '🎪', 'Nongkrong',  44, 58),
--   ('Coffee Corner',      '☕', 'Ngopi',      76, 70),
--   ('GOR Kampus',         '🏀', 'Olahraga',   18, 72),
--   ('Taman Fakultas',     '🌳', 'Santai',     54, 16)
-- on conflict (name) do update
--   set emoji    = excluded.emoji,
--       category = excluded.category,
--       x        = excluded.x,
--       y        = excluded.y;

-- -------------------------------------------------------------- nfc_tokens ---
-- Readable tokens for local testing. Hit them at /activate?token=KNL-NEW-01.
--
-- Do NOT ship predictable tokens like these to real lanyards: anyone who can
-- guess a token can claim the tag. Use the provisioning helper instead:
--
--   select * from public.generate_nfc_tokens(100, 'KNL', 'batch-2026-01');


-- insert into public.nfc_tokens (token, status, batch_label) values
--   ('KNL-NEW-01', 'unclaimed', 'dev-samples'),
--   ('KNL-NEW-02', 'unclaimed', 'dev-samples'),
--   ('KNL-NEW-03', 'unclaimed', 'dev-samples'),
--   ('KNL-NEW-04', 'unclaimed', 'dev-samples'),
--   ('KNL-NEW-05', 'unclaimed', 'dev-samples')
-- on conflict (token) do nothing;

-- =============================================================================
-- Admin Account Seed (Dashboard Superadmin)
--
-- Email    : wikolaygunata@gmail.com
-- Password : admin
-- Role     : superadmin
-- =============================================================================

do $$
declare
  v_admin_id uuid;
  v_email text := 'wikolaygunata@gmail.com';
  v_password text := 'admin123';
  v_encrypted_pw text;
  v_has_provider_id boolean;
begin
  create extension if not exists pgcrypto with schema extensions;
  v_encrypted_pw := extensions.crypt(v_password, extensions.gen_salt('bf'));

  -- 1. Siapkan token NFC khusus admin agar trigger handle_new_user tidak menolak pendaftaran
  insert into public.nfc_tokens (token, status, batch_label)
  values ('KNL-ADMIN-01', 'unclaimed', 'admin-seed')
  on conflict (token) do update
    set status = 'unclaimed', user_id = null, claimed_at = null;

  -- 2. Cek apakah user admin sudah ada di auth.users
  select id into v_admin_id from auth.users where email = v_email;

  if v_admin_id is null then
    v_admin_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change_token_current,
      email_change,
      phone_change,
      phone_change_token,
      reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_admin_id,
      'authenticated',
      'authenticated',
      v_email,
      v_encrypted_pw,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'full_name', 'Admin Kenalan',
        'username', 'adminkenalan',
        'nfc_token', 'KNL-ADMIN-01'
      ),
      now(),
      now(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    );

    -- 3. Tambahkan ke auth.identities untuk dukungan login password Supabase GoTrue
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'auth' and table_name = 'identities' and column_name = 'provider_id'
    ) into v_has_provider_id;

    if v_has_provider_id then
      execute format(
        'insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
         values (%L, %L, %L, %L, %L, now(), now(), now())
         on conflict do nothing',
        gen_random_uuid(),
        v_admin_id,
        jsonb_build_object('sub', v_admin_id::text, 'email', v_email),
        'email',
        v_admin_id::text
      );
    else
      execute format(
        'insert into auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
         values (%L, %L, %L, %L, now(), now(), now())
         on conflict do nothing',
        v_admin_id::text,
        v_admin_id,
        jsonb_build_object('sub', v_admin_id::text, 'email', v_email),
        'email'
      );
    end if;

  else
    -- Jika user sudah ada, sinkronkan password & status konfirmasi email
    update auth.users
    set encrypted_password = v_encrypted_pw,
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = v_admin_id;
  end if;

  -- 4. Pastikan data profil dibuat di public.profiles
  insert into public.profiles (id, username, full_name, bio)
  values (v_admin_id, 'adminkenalan', 'Admin Kenalan', 'Akun Administrator Kenalan')
  on conflict (id) do update
    set full_name = excluded.full_name;

  -- 5. Berikan hak akses superadmin ke dashboard
  insert into public.dashboard_admins (user_id, role)
  values (v_admin_id, 'superadmin')
  on conflict (user_id) do update
    set role = 'superadmin';

end;
$$;
