import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client for the Kenalan prototype.
 *
 * Credentials come from Vite env vars (see `.env.example`):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 *
 * If either is missing we stay in DEMO MODE: `supabase` is null and
 * `src/lib/api.js` transparently serves data from `src/lib/mockData.js`,
 * so `npm run dev` works before the backend exists.
 *
 * ---------------------------------------------------------------------------
 * EXPECTED SCHEMA (apply migrations in timestamp order)
 * ---------------------------------------------------------------------------
 * profiles + NFC + PING + mutuals are established by the initial migrations.
 * The dashboard migration adds reports/admin roles. Then
 * 20261011210000_app_api_contract_security.sql:
 *   - migrates location_stamps from spot_id to location_label/image_url/lat/lng/
 *     audience; coordinates are rounded server-side to four decimals.
 *   - adds stamp_replies and blocks with RLS.
 *   - limits profile table SELECT to public-safe columns; social handles are
 *     returned by get_profile_socials() and updated by save_profile_socials().
 *   - enforces audience/history visibility and PING block/quota rules server-side.
 * Distance and bearing are derived per viewer and are not stored in the database.
 * ---------------------------------------------------------------------------
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

/** True when both env vars are present, so real network calls are possible. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
export const isDashboardSupabaseRequested =
  import.meta.env.VITE_DASHBOARD_USE_SUPABASE?.trim().toLowerCase() === 'true'
export const isDashboardSupabaseEnabled =
  isSupabaseConfigured && isDashboardSupabaseRequested

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

/**
 * Dashboard auth uses its own persisted session so signing into the admin
 * panel never replaces a member's app session (or vice versa).
 */
export const dashboardSupabase = isDashboardSupabaseEnabled
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storageKey: 'kenalan.dashboard.auth',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.info(
    '[Kenalan] Running in DEMO MODE — no VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY found.\n' +
      'All data is served from src/lib/mockData.js. Copy .env.example to .env to connect Supabase.',
  )
}
