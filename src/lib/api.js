/**
 * Data-access layer for Kenalan.
 *
 * Every function has two implementations:
 *   1. a real Supabase query (used when env vars are configured)
 *   2. a demo-mode fallback backed by `mockData.js` + localStorage
 *
 * Views only ever import from here, so swapping the backend never touches UI code.
 */
import { supabase, isSupabaseConfigured } from './supabase'
import { demoDb, persistDemoDb, demoId, fakeDelay } from './mockData'
import { isoSince, isFresh } from './time'
import { DEFAULT_COLOR_CODE } from './colorCodes'

/* ------------------------------------------------------------------ helpers */

const byNewest = (a, b) => new Date(b.created_at) - new Date(a.created_at)

function findProfile(id) {
  return demoDb.profiles.find((p) => p.id === id) ?? null
}

function findSpot(id) {
  return demoDb.spots.find((s) => s.id === id) ?? null
}

/**
 * Our SQL functions raise errors shaped like `TOKEN_UNAVAILABLE: token sudah…`
 * so logs stay greppable. Strip the machine code before showing it to a human.
 */
function rpcMessage(error, fallback) {
  const raw = error?.message ?? ''
  const stripped = raw.replace(/^[A-Z][A-Z0-9_]+:\s*/, '').trim()
  return stripped || fallback
}

/* --------------------------------------------------------------- NFC tokens */

/**
 * Looks up a lanyard token.
 * @returns {Promise<{token:string,status:'unclaimed'|'claimed',user_id:string|null}|null>}
 *          null when the token does not exist at all (invalid/fake tag).
 */
export async function fetchNfcToken(token) {
  if (!token) return null

  if (!isSupabaseConfigured) {
    await fakeDelay()
    const row = demoDb.nfc_tokens.find(
      (t) => t.token.toLowerCase() === String(token).toLowerCase(),
    )
    return row ? { ...row } : null
  }

  // `nfc_tokens` has no RLS policy on purpose — reading it directly would let
  // anyone page through the table and harvest unclaimed tags. This RPC answers
  // for one exact token only.
  const { data, error } = await supabase.rpc('resolve_nfc_token', { p_token: token })

  if (error) throw new Error(rpcMessage(error, 'Gagal memeriksa token NFC.'))

  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null

  return {
    token: String(token).trim().toUpperCase(),
    status: row.status,
    user_id: row.owner_id ?? null,
  }
}

/**
 * Binds an unclaimed token to the caller's account.
 *
 * `userId` is only used by demo mode; against Supabase the RPC derives the owner
 * from `auth.uid()`, so a client cannot claim a lanyard on somebody else's behalf.
 */
export async function claimNfcToken(token, userId) {
  if (!isSupabaseConfigured) {
    const row = demoDb.nfc_tokens.find(
      (t) => t.token.toLowerCase() === String(token).toLowerCase(),
    )
    if (!row) throw new Error('Token NFC tidak ditemukan.')
    if (row.status === 'claimed') throw new Error('Token NFC ini sudah diklaim.')

    // Mirrors auth.uid() in the RPC: fall back to whoever is signed in.
    const owner = userId ?? demoDb.session_user_id
    if (!owner) throw new Error('Harus login dulu untuk mengklaim lanyard.')

    row.status = 'claimed'
    row.user_id = owner
    row.claimed_at = new Date().toISOString()
    persistDemoDb()
    return { ...row }
  }

  // The function does a compare-and-set on status='unclaimed', so two people
  // racing for the same tag means the loser gets an error, not a stolen tag.
  const { data, error } = await supabase.rpc('claim_nfc_token', { p_token: token })

  if (error) throw new Error(rpcMessage(error, 'Gagal mengklaim lanyard.'))
  return data
}

/* ------------------------------------------------------------------ profiles */

export async function fetchProfile(userId) {
  if (!userId) return null

  if (!isSupabaseConfigured) {
    await fakeDelay()
    const found = findProfile(userId)
    return found ? { ...found } : null
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(`Gagal memuat profil: ${error.message}`)
  return data
}

export async function createProfile(profile) {
  if (!isSupabaseConfigured) {
    const row = {
      color_code: DEFAULT_COLOR_CODE,
      interests: [],
      created_at: new Date().toISOString(),
      ...profile,
    }
    demoDb.profiles.push(row)
    persistDemoDb()
    return { ...row }
  }

  // Upsert, not insert: the `on_auth_user_created` trigger already created a
  // skeleton row, so this fills in the details the signup form collected.
  const { data, error } = await supabase
    .from('profiles')
    .upsert(profile, { onConflict: 'id' })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('Username ini sudah dipakai.')
    throw new Error(`Gagal membuat profil: ${error.message}`)
  }
  return data
}

export async function updateProfile(userId, patch) {
  if (!isSupabaseConfigured) {
    const row = findProfile(userId)
    if (!row) throw new Error('Profil tidak ditemukan.')
    Object.assign(row, patch)
    persistDemoDb()
    await fakeDelay(180)
    return { ...row }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('Username ini sudah dipakai.')
    if (error.code === '23514') throw new Error('Username hanya boleh huruf, angka, titik, dan underscore (3-24 karakter).')
    throw new Error(`Gagal menyimpan profil: ${error.message}`)
  }
  return data
}

/** Shortcut used by the color-code picker. */
export function updateColorCode(userId, colorCode) {
  return updateProfile(userId, { color_code: colorCode })
}

/** People you have not connected with yet — powers the "Rekomendasi" list. */
export async function fetchSuggestedProfiles(userId, limit = 6) {
  if (!isSupabaseConfigured) {
    await fakeDelay()
    const connected = new Set((await fetchMutuals(userId)).map((p) => p.id))
    return demoDb.profiles
      .filter((p) => p.id !== userId && !connected.has(p.id))
      .slice(0, limit)
      .map((p) => ({ ...p }))
  }

  const mutualIds = (await fetchMutuals(userId)).map((p) => p.id)
  const excluded = [userId, ...mutualIds].filter(Boolean)

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .not('id', 'in', `(${excluded.join(',')})`)
    .limit(limit)

  if (error) throw new Error(`Gagal memuat rekomendasi: ${error.message}`)
  return data ?? []
}

/* --------------------------------------------------------------------- spots */

export async function fetchSpots() {
  if (!isSupabaseConfigured) {
    await fakeDelay(160)
    return demoDb.spots.map((s) => ({ ...s }))
  }

  const { data, error } = await supabase.from('spots').select('*').order('name')
  if (error) throw new Error(`Gagal memuat spot: ${error.message}`)
  return data ?? []
}

/* ----------------------------------------------------------- location stamps */

/**
 * Stamps dropped in the last 24 hours, newest first, joined with author + spot.
 */
export async function fetchRecentStamps() {
  if (!isSupabaseConfigured) {
    await fakeDelay()
    return demoDb.location_stamps
      .filter((s) => isFresh(s.created_at))
      .sort(byNewest)
      .map((s) => ({
        ...s,
        profile: findProfile(s.user_id),
        spot: findSpot(s.spot_id),
      }))
  }

  const { data, error } = await supabase
    .from('location_stamps')
    .select('*, profile:profiles(*), spot:spots(*)')
    .gte('created_at', isoSince())
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Gagal memuat stamp: ${error.message}`)
  return data ?? []
}

export async function createStamp({ userId, spotId, message }) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  if (!isSupabaseConfigured) {
    const row = {
      id: demoId('st'),
      user_id: userId,
      spot_id: spotId,
      message,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    }
    demoDb.location_stamps.unshift(row)
    persistDemoDb()
    await fakeDelay(220)
    return { ...row, profile: findProfile(userId), spot: findSpot(spotId) }
  }

  const { data, error } = await supabase
    .from('location_stamps')
    .insert({
      user_id: userId,
      spot_id: spotId,
      message,
      expires_at: expiresAt.toISOString(),
    })
    .select('*, profile:profiles(*), spot:spots(*)')
    .single()

  if (error) throw new Error(`Gagal membuat stamp: ${error.message}`)
  return data
}

export async function deleteStamp(stampId, userId) {
  if (!isSupabaseConfigured) {
    const index = demoDb.location_stamps.findIndex(
      (s) => s.id === stampId && s.user_id === userId,
    )
    if (index !== -1) demoDb.location_stamps.splice(index, 1)
    persistDemoDb()
    return true
  }

  // user_id in the filter keeps this honest even if RLS is misconfigured.
  const { error } = await supabase
    .from('location_stamps')
    .delete()
    .eq('id', stampId)
    .eq('user_id', userId)

  if (error) throw new Error(`Gagal menghapus stamp: ${error.message}`)
  return true
}

/* --------------------------------------------------------------------- pings */

export async function fetchIncomingPings(userId) {
  if (!isSupabaseConfigured) {
    await fakeDelay()
    return demoDb.pings
      .filter((p) => p.receiver_id === userId)
      .sort(byNewest)
      .map((p) => ({ ...p, sender: findProfile(p.sender_id) }))
  }

  const { data, error } = await supabase
    .from('pings')
    .select('*, sender:profiles!pings_sender_id_fkey(*)')
    .eq('receiver_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Gagal memuat PING: ${error.message}`)
  return data ?? []
}

export async function fetchSentPings(userId) {
  if (!isSupabaseConfigured) {
    await fakeDelay(160)
    return demoDb.pings
      .filter((p) => p.sender_id === userId)
      .sort(byNewest)
      .map((p) => ({ ...p, receiver: findProfile(p.receiver_id) }))
  }

  const { data, error } = await supabase
    .from('pings')
    .select('*, receiver:profiles!pings_receiver_id_fkey(*)')
    .eq('sender_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Gagal memuat PING terkirim: ${error.message}`)
  return data ?? []
}

export async function sendPing({ senderId, receiverId, message }) {
  if (senderId === receiverId) throw new Error('Nggak bisa PING diri sendiri 😅')

  if (!isSupabaseConfigured) {
    const existing = demoDb.pings.find(
      (p) => p.sender_id === senderId && p.receiver_id === receiverId && p.status === 'pending',
    )
    if (existing) throw new Error('Kamu udah kirim PING ke orang ini, tunggu balasannya ya.')

    const row = {
      id: demoId('p'),
      sender_id: senderId,
      receiver_id: receiverId,
      message,
      status: 'pending',
      created_at: new Date().toISOString(),
    }
    demoDb.pings.unshift(row)
    persistDemoDb()
    await fakeDelay(260)
    return { ...row }
  }

  const { data, error } = await supabase
    .from('pings')
    .insert({ sender_id: senderId, receiver_id: receiverId, message, status: 'pending' })
    .select()
    .single()

  if (error) {
    // Hits the `pings_one_pending_per_pair` partial unique index.
    if (error.code === '23505') {
      throw new Error('Kamu udah kirim PING ke orang ini, tunggu balasannya ya.')
    }
    throw new Error(`Gagal mengirim PING: ${error.message}`)
  }
  return data
}

/** Whether the logged-in user already has a pending PING out to `receiverId`. */
export async function hasPendingPing(senderId, receiverId) {
  if (!senderId || !receiverId) return false

  if (!isSupabaseConfigured) {
    return demoDb.pings.some(
      (p) => p.sender_id === senderId && p.receiver_id === receiverId && p.status === 'pending',
    )
  }

  const { data, error } = await supabase
    .from('pings')
    .select('id')
    .eq('sender_id', senderId)
    .eq('receiver_id', receiverId)
    .eq('status', 'pending')
    .maybeSingle()

  if (error) return false
  return Boolean(data)
}

/**
 * Accept or decline a PING. Accepting promotes the pair to mutuals.
 *
 * Against Supabase this is a single RPC call rather than an UPDATE followed by
 * an INSERT: `pings` has no UPDATE policy and `mutuals` has no INSERT policy,
 * so both steps happen inside `respond_to_ping()` in one transaction. That is
 * what stops a client from accepting its own outgoing PING or fabricating a
 * connection that has no accepted request behind it.
 */
export async function respondToPing(pingId, status) {
  if (!['accepted', 'declined'].includes(status)) {
    throw new Error('Status PING tidak valid.')
  }

  if (!isSupabaseConfigured) {
    const ping = demoDb.pings.find((p) => p.id === pingId)
    if (!ping) throw new Error('PING tidak ditemukan.')
    ping.status = status
    ping.responded_at = new Date().toISOString()
    if (status === 'accepted') {
      linkMutualInDemo(ping.sender_id, ping.receiver_id)
    }
    persistDemoDb()
    await fakeDelay(200)
    return { ...ping }
  }

  const { data, error } = await supabase.rpc('respond_to_ping', {
    p_ping_id: pingId,
    p_status: status,
  })

  if (error) throw new Error(rpcMessage(error, 'Gagal memperbarui PING.'))
  return data
}

/* ------------------------------------------------------------------- mutuals */

/**
 * Demo-mode only. In Supabase mode connections are created exclusively by the
 * `respond_to_ping` RPC, so there is no client-side insert path.
 */
function linkMutualInDemo(userAId, userBId) {
  // Sort the pair so (a,b) and (b,a) never produce duplicate rows — the same
  // invariant the `mutuals_ordered_pair` check enforces in Postgres.
  const [a, b] = [userAId, userBId].sort()

  if (demoDb.mutuals.some((m) => m.user_a_id === a && m.user_b_id === b)) return null

  const row = { id: demoId('m'), user_a_id: a, user_b_id: b, created_at: new Date().toISOString() }
  demoDb.mutuals.push(row)
  return row
}

/**
 * Connection count for any profile.
 *
 * `mutuals` rows are only visible to the two people in them, so a visitor
 * cannot count somebody else's connections by querying the table. The
 * `count_mutuals` function exposes just the number.
 */
export async function fetchMutualCount(userId) {
  if (!userId) return 0

  if (!isSupabaseConfigured) {
    return demoDb.mutuals.filter((m) => m.user_a_id === userId || m.user_b_id === userId).length
  }

  const { data, error } = await supabase.rpc('count_mutuals', { p_user_id: userId })
  if (error) return 0
  return Number(data) || 0
}

export async function fetchMutuals(userId) {
  if (!userId) return []

  if (!isSupabaseConfigured) {
    return demoDb.mutuals
      .filter((m) => m.user_a_id === userId || m.user_b_id === userId)
      .sort(byNewest)
      .map((m) => {
        const otherId = m.user_a_id === userId ? m.user_b_id : m.user_a_id
        const profile = findProfile(otherId)
        return profile ? { ...profile, mutual_since: m.created_at } : null
      })
      .filter(Boolean)
  }

  const { data, error } = await supabase
    .from('mutuals')
    .select(
      'created_at, user_a_id, user_b_id, a:profiles!mutuals_user_a_id_fkey(*), b:profiles!mutuals_user_b_id_fkey(*)',
    )
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Gagal memuat mutualan: ${error.message}`)

  return (data ?? [])
    .map((row) => {
      const other = row.user_a_id === userId ? row.b : row.a
      return other ? { ...other, mutual_since: row.created_at } : null
    })
    .filter(Boolean)
}

export async function isMutualWith(userId, otherId) {
  if (!userId || !otherId) return false
  const [a, b] = [userId, otherId].sort()

  if (!isSupabaseConfigured) {
    return demoDb.mutuals.some((m) => m.user_a_id === a && m.user_b_id === b)
  }

  const { data, error } = await supabase
    .from('mutuals')
    .select('id')
    .eq('user_a_id', a)
    .eq('user_b_id', b)
    .maybeSingle()

  if (error) return false
  return Boolean(data)
}
