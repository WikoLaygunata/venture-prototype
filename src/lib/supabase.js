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
 * EXPECTED SCHEMA (for when you wire the real project)
 * ---------------------------------------------------------------------------
 * profiles
 *   id           uuid primary key references auth.users(id) on delete cascade
 *   username     text unique
 *   full_name    text
 *   avatar_url   text
 *   faculty      text
 *   major        text
 *   batch        text            -- angkatan, e.g. '2023'
 *   bio          text
 *   color_code   text default 'mint'   -- 'mint' | 'yellow' | 'grey' | 'red'
 *   instagram    text
 *   linkedin     text
 *   spotify      text
 *   created_at   timestamptz default now()
 *
 * nfc_tokens
 *   id           uuid primary key default gen_random_uuid()
 *   token        text unique not null          -- printed/encoded on the NFC keychain
 *   status       text default 'unclaimed'      -- 'unclaimed' | 'claimed'
 *   user_id      uuid references profiles(id)  -- null while unclaimed
 *   claimed_at   timestamptz
 *
 * pings
 *   id           uuid primary key default gen_random_uuid()
 *   sender_id    uuid references profiles(id)
 *   receiver_id  uuid references profiles(id)
 *   message      text
 *   status       text default 'pending'        -- 'pending' | 'accepted' | 'declined'
 *   created_at   timestamptz default now()
 *
 * mutuals
 *   id           uuid primary key default gen_random_uuid()
 *   user_a_id    uuid references profiles(id)
 *   user_b_id    uuid references profiles(id)
 *   created_at   timestamptz default now()
 *   unique (user_a_id, user_b_id)
 *
 * spots
 *   id           uuid primary key default gen_random_uuid()
 *   name         text           -- 'Perpustakaan', 'Kantin LT', 'Student Center'
 *   emoji        text
 *   category     text
 *   x            numeric        -- 0..100, position on the mock campus map
 *   y            numeric        -- 0..100
 *
 * location_stamps  (a "stamp" expires after 24h)
 *   id           uuid primary key default gen_random_uuid()
 *   user_id      uuid references profiles(id)
 *   spot_id      uuid references spots(id)
 *   message      text
 *   created_at   timestamptz default now()
 *   expires_at   timestamptz default now() + interval '24 hours'
 * ---------------------------------------------------------------------------
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

/** True when both env vars are present, so real network calls are possible. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.info(
    '[Kenalan] Running in DEMO MODE — no VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY found.\n' +
      'All data is served from src/lib/mockData.js. Copy .env.example to .env to connect Supabase.',
  )
}
