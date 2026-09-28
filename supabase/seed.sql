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
insert into public.spots (name, emoji, category, x, y) values
  ('Perpustakaan Pusat', '📚', 'Belajar',    26, 24),
  ('Kantin LT 1',        '🍜', 'Makan',      68, 38),
  ('Student Center',     '🎪', 'Nongkrong',  44, 58),
  ('Coffee Corner',      '☕', 'Ngopi',      76, 70),
  ('GOR Kampus',         '🏀', 'Olahraga',   18, 72),
  ('Taman Fakultas',     '🌳', 'Santai',     54, 16)
on conflict (name) do update
  set emoji    = excluded.emoji,
      category = excluded.category,
      x        = excluded.x,
      y        = excluded.y;

-- -------------------------------------------------------------- nfc_tokens ---
-- Readable tokens for local testing. Hit them at /activate?token=KNL-NEW-01.
--
-- Do NOT ship predictable tokens like these to real lanyards: anyone who can
-- guess a token can claim the tag. Use the provisioning helper instead:
--
--   select * from public.generate_nfc_tokens(100, 'KNL', 'batch-2026-01');
insert into public.nfc_tokens (token, status, batch_label) values
  ('KNL-NEW-01', 'unclaimed', 'dev-samples'),
  ('KNL-NEW-02', 'unclaimed', 'dev-samples'),
  ('KNL-NEW-03', 'unclaimed', 'dev-samples'),
  ('KNL-NEW-04', 'unclaimed', 'dev-samples'),
  ('KNL-NEW-05', 'unclaimed', 'dev-samples')
on conflict (token) do nothing;

-- =============================================================================
-- Creating test accounts
-- =============================================================================
--
-- Easiest path: run the app and register through /activate?token=KNL-NEW-01.
--
-- If you would rather script it, use the Admin API with your service_role key
-- (never the anon key, and never from frontend code):
--
--   curl -X POST "$SUPABASE_URL/auth/v1/admin/users" \
--     -H "apikey: $SERVICE_ROLE_KEY" \
--     -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
--     -H "Content-Type: application/json" \
--     -d '{
--           "email": "raka@kampus.ac.id",
--           "password": "kenalan123",
--           "email_confirm": true,
--           "user_metadata": { "full_name": "Raka Pratama", "username": "rakaprtm" }
--         }'
--
-- The on_auth_user_created trigger creates the profile row; then flesh it out:
--
--   update public.profiles
--      set faculty = 'Fakultas Ilmu Komputer',
--          major   = 'Sistem Informasi',
--          batch   = '2023',
--          bio     = 'Suka ngoprek side project sambil ngopi.',
--          color_code = 'mint',
--          interests  = array['UI design', 'kopi manual brew', 'basket'],
--          instagram  = 'rakaprtm'
--    where username = 'rakaprtm';
