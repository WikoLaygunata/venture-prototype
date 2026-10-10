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
import {
  demoDb,
  persistDemoDb,
  demoId,
  fakeDelay,
  CAMPUS_CENTER,
  MAX_PENDING_PINGS,
} from './mockData'
import { isoSince, isFresh, isWithin, STAMP_HISTORY_MS } from './time'
import { DEFAULT_COLOR_CODE } from './colorCodes'
import { defaultSocialVisibility } from './socials'

export { MAX_PENDING_PINGS }

/* ------------------------------------------------------------------ helpers */

const byNewest = (a, b) => new Date(b.created_at) - new Date(a.created_at)
const byOldest = (a, b) => new Date(a.created_at) - new Date(b.created_at)

function findProfile(id) {
  return demoDb.profiles.find((p) => p.id === id) ?? null
}

/** Ids the given user has blocked, or who have blocked them (demo mode). */
function blockedIdsFor(userId) {
  const set = new Set()
  for (const b of demoDb.blocks) {
    if (b.blocker_id === userId) set.add(b.blocked_id)
    if (b.blocked_id === userId) set.add(b.blocker_id)
  }
  return set
}

/** Ids the given user has mutualan with (demo mode). */
function mutualIdsFor(userId) {
  const set = new Set()
  for (const m of demoDb.mutuals) {
    if (m.user_a_id === userId) set.add(m.user_b_id)
    if (m.user_b_id === userId) set.add(m.user_a_id)
  }
  return set
}

/**
 * Can `viewerId` see a stamp given its audience?
 *   public  -> everyone
 *   mutual  -> only the author or someone the author has mutualan with
 */
function canViewStamp(stamp, viewerId, mutualSet) {
  if ((stamp.audience ?? 'public') === 'public') return true
  if (!viewerId) return false
  if (stamp.user_id === viewerId) return true
  return mutualSet.has(stamp.user_id)
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
 * Looks up an NFC keychain token.
 * @returns {Promise<{token:string,status:'unclaimed'|'claimed',user_id:string|null}|null>}
 *          null when the token does not exist at all (invalid/fake keychain).
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
 * from `auth.uid()`, so a client cannot claim a keychain on someone else's behalf.
 */
export async function claimNfcToken(token, userId) {
  if (!isSupabaseConfigured) {
    const row = demoDb.nfc_tokens.find(
      (t) => t.token.toLowerCase() === String(token).toLowerCase(),
    )
    if (!row) throw new Error('Token NFC tidak ditemukan.')
    if (row.status === 'claimed') throw new Error('Keychain NFC ini sudah diklaim.')

    // Mirrors auth.uid() in the RPC: fall back to whoever is signed in.
    const owner = userId ?? demoDb.session_user_id
    if (!owner) throw new Error('Harus login dulu untuk mengklaim keychain.')

    row.status = 'claimed'
    row.user_id = owner
    row.claimed_at = new Date().toISOString()
    persistDemoDb()
    return { ...row }
  }

  // The function does a compare-and-set on status='unclaimed', so two people
  // racing for the same tag means the loser gets an error, not a stolen tag.
  const { data, error } = await supabase.rpc('claim_nfc_token', { p_token: token })

  if (error) throw new Error(rpcMessage(error, 'Gagal mengklaim keychain.'))
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
      is_discoverable: true,
      stamp_history_public: false,
      whatsapp: '',
      line: '',
      social_visibility: defaultSocialVisibility(),
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

/** Toggle whether this profile appears in other people's Explore list. */
export function setDiscoverable(userId, isDiscoverable) {
  return updateProfile(userId, { is_discoverable: isDiscoverable })
}

/** Toggle whether this profile's 30-day stamp history is visible to others. */
export function setStampHistoryPublic(userId, isPublic) {
  return updateProfile(userId, { stamp_history_public: isPublic })
}

/**
 * Recommended people to mutualan with — powers the Explore tab.
 *
 * Only returns profiles that opted in (`is_discoverable`), are not already a
 * mutual, and are not blocked in either direction.
 */
export async function fetchRecommendedProfiles(userId, limit = 12) {
  if (!isSupabaseConfigured) {
    await fakeDelay()
    const connected = new Set((await fetchMutuals(userId)).map((p) => p.id))
    const blocked = blockedIdsFor(userId)
    return demoDb.profiles
      .filter(
        (p) =>
          p.id !== userId &&
          p.is_discoverable !== false &&
          !connected.has(p.id) &&
          !blocked.has(p.id),
      )
      .sort(byNewest)
      .slice(0, limit)
      .map((p) => ({ ...p }))
  }

  const mutualIds = (await fetchMutuals(userId)).map((p) => p.id)
  const excluded = [userId, ...mutualIds].filter(Boolean)

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_discoverable', true)
    .not('id', 'in', `(${excluded.join(',')})`)
    .limit(limit)

  if (error) throw new Error(`Gagal memuat rekomendasi: ${error.message}`)
  return data ?? []
}

/* ----------------------------------------------------------- location stamps */

/** Attach author + live reply count to a demo stamp row. */
function decorateStamp(s) {
  return {
    ...s,
    profile: findProfile(s.user_id),
    reply_count: demoDb.stamp_replies.filter((r) => r.stamp_id === s.id).length,
  }
}

/**
 * Stamps dropped in the last 24 hours, newest first, with author + reply count.
 * The physical place is never exposed — only the author's `location_label` and
 * a `distance_m` from the viewer.
 */
export async function fetchRecentStamps(viewerId = null) {
  if (!isSupabaseConfigured) {
    await fakeDelay()
    const mutualSet = mutualIdsFor(viewerId)
    return demoDb.location_stamps
      .filter((s) => isFresh(s.created_at) && canViewStamp(s, viewerId, mutualSet))
      .sort(byNewest)
      .map(decorateStamp)
  }

  const { data, error } = await supabase
    .from('location_stamps')
    .select('*, profile:profiles(*), reply_count:stamp_replies(count)')
    .gte('created_at', isoSince())
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Gagal memuat stamp: ${error.message}`)

  // Mutual-only stamps are filtered client-side here; a production backend
  // should enforce this with RLS/RPC so hidden rows never leave the server.
  const mutualIds = viewerId ? new Set((await fetchMutuals(viewerId)).map((p) => p.id)) : new Set()

  return (data ?? [])
    .filter((s) => canViewStamp(s, viewerId, mutualIds))
    .map((s) => ({
      ...s,
      reply_count: Array.isArray(s.reply_count) ? (s.reply_count[0]?.count ?? 0) : s.reply_count,
    }))
}

/**
 * A single stamp (for its thread). Returns `{ restricted: true }` instead of the
 * row when the stamp is mutual-only and the viewer isn't allowed to see it.
 */
export async function fetchStamp(stampId, viewerId = null) {
  if (!stampId) return null

  if (!isSupabaseConfigured) {
    await fakeDelay(160)
    const found = demoDb.location_stamps.find((s) => s.id === stampId)
    if (!found) return null
    if (!canViewStamp(found, viewerId, mutualIdsFor(viewerId))) return { restricted: true }
    return decorateStamp(found)
  }

  const { data, error } = await supabase
    .from('location_stamps')
    .select('*, profile:profiles(*)')
    .eq('id', stampId)
    .maybeSingle()

  if (error) throw new Error(`Gagal memuat stamp: ${error.message}`)
  if (!data) return null

  if ((data.audience ?? 'public') === 'mutual' && viewerId && data.user_id !== viewerId) {
    const allowed = await isMutualWith(viewerId, data.user_id)
    if (!allowed) return { restricted: true }
  }
  return data
}

/**
 * The caller's own stamps from the last 30 days — powers Stamp History.
 * Unlike the live feed this includes expired stamps (anything < 30 days old).
 */
export async function fetchStampHistory(userId, windowMs = STAMP_HISTORY_MS) {
  if (!userId) return []

  if (!isSupabaseConfigured) {
    await fakeDelay()
    return demoDb.location_stamps
      .filter((s) => s.user_id === userId && isWithin(s.created_at, windowMs))
      .sort(byNewest)
      .map(decorateStamp)
  }

  const since = new Date(Date.now() - windowMs).toISOString()
  const { data, error } = await supabase
    .from('location_stamps')
    .select('*, profile:profiles(*), reply_count:stamp_replies(count)')
    .eq('user_id', userId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Gagal memuat history stamp: ${error.message}`)
  return (data ?? []).map((s) => ({
    ...s,
    reply_count: Array.isArray(s.reply_count) ? (s.reply_count[0]?.count ?? 0) : s.reply_count,
  }))
}

export async function createStamp({
  userId,
  message,
  locationLabel = '',
  imageUrl = '',
  distanceM = 0,
  audience = 'public',
  lat = null,
  lng = null,
}) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const safeAudience = audience === 'mutual' ? 'mutual' : 'public'

  // Use the user's real coords when geolocation gave us some; otherwise fan the
  // stamp out a little around the campus center so the map isn't a single pile.
  const coords =
    lat != null && lng != null
      ? { lat, lng }
      : {
          lat: CAMPUS_CENTER.lat + (Math.random() - 0.5) * 0.004,
          lng: CAMPUS_CENTER.lng + (Math.random() - 0.5) * 0.004,
        }

  if (!isSupabaseConfigured) {
    const row = {
      id: demoId('st'),
      user_id: userId,
      location_label: locationLabel,
      image_url: imageUrl,
      distance_m: 0, // it's your own stamp -> zero distance from you
      bearing_deg: 0,
      lat: coords.lat,
      lng: coords.lng,
      audience: safeAudience,
      message,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    }
    demoDb.location_stamps.unshift(row)
    persistDemoDb()
    await fakeDelay(220)
    return decorateStamp(row)
  }

  const { data, error } = await supabase
    .from('location_stamps')
    .insert({
      user_id: userId,
      message,
      location_label: locationLabel,
      image_url: imageUrl || null,
      distance_m: distanceM,
      lat: coords.lat,
      lng: coords.lng,
      audience: safeAudience,
      expires_at: expiresAt.toISOString(),
    })
    .select('*, profile:profiles(*)')
    .single()

  if (error) throw new Error(`Gagal membuat stamp: ${error.message}`)
  return { ...data, reply_count: 0 }
}

export async function deleteStamp(stampId, userId) {
  if (!isSupabaseConfigured) {
    demoDb.location_stamps = demoDb.location_stamps.filter(
      (s) => !(s.id === stampId && s.user_id === userId),
    )
    // Replies die with their thread.
    demoDb.stamp_replies = demoDb.stamp_replies.filter((r) => r.stamp_id !== stampId)
    persistDemoDb()
    return true
  }

  const { error } = await supabase
    .from('location_stamps')
    .delete()
    .eq('id', stampId)
    .eq('user_id', userId)

  if (error) throw new Error(`Gagal menghapus stamp: ${error.message}`)
  return true
}

/* ------------------------------------------------------ stamp replies (thread) */

export async function fetchStampReplies(stampId) {
  if (!stampId) return []

  if (!isSupabaseConfigured) {
    await fakeDelay(160)
    return demoDb.stamp_replies
      .filter((r) => r.stamp_id === stampId)
      .sort(byOldest)
      .map((r) => ({ ...r, profile: findProfile(r.user_id) }))
  }

  const { data, error } = await supabase
    .from('stamp_replies')
    .select('*, profile:profiles(*)')
    .eq('stamp_id', stampId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Gagal memuat balasan: ${error.message}`)
  return data ?? []
}

export async function createStampReply({ stampId, userId, message }) {
  const trimmed = String(message).trim()
  if (!trimmed) throw new Error('Balasan tidak boleh kosong.')

  if (!isSupabaseConfigured) {
    const row = {
      id: demoId('sr'),
      stamp_id: stampId,
      user_id: userId,
      message: trimmed,
      created_at: new Date().toISOString(),
    }
    demoDb.stamp_replies.push(row)
    persistDemoDb()
    await fakeDelay(200)
    return { ...row, profile: findProfile(userId) }
  }

  const { data, error } = await supabase
    .from('stamp_replies')
    .insert({ stamp_id: stampId, user_id: userId, message: trimmed })
    .select('*, profile:profiles(*)')
    .single()

  if (error) throw new Error(`Gagal mengirim balasan: ${error.message}`)
  return data
}

/* --------------------------------------------------------------------- pings */

export async function fetchIncomingPings(userId) {
  if (!isSupabaseConfigured) {
    await fakeDelay()
    const blocked = blockedIdsFor(userId)
    return demoDb.pings
      .filter((p) => p.receiver_id === userId && !blocked.has(p.sender_id))
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

/** How many outgoing PINGs are still waiting for a reply. */
export async function countPendingSentPings(userId) {
  if (!userId) return 0

  if (!isSupabaseConfigured) {
    return demoDb.pings.filter((p) => p.sender_id === userId && p.status === 'pending').length
  }

  const { count, error } = await supabase
    .from('pings')
    .select('id', { count: 'exact', head: true })
    .eq('sender_id', userId)
    .eq('status', 'pending')

  if (error) return 0
  return count ?? 0
}

export async function sendPing({ senderId, receiverId, message }) {
  if (senderId === receiverId) throw new Error('Nggak bisa PING diri sendiri 😅')

  if (!isSupabaseConfigured) {
    if (blockedIdsFor(senderId).has(receiverId)) {
      throw new Error('Kamu nggak bisa kirim PING ke orang ini.')
    }

    const pending = demoDb.pings.filter(
      (p) => p.sender_id === senderId && p.status === 'pending',
    )
    if (pending.length >= MAX_PENDING_PINGS) {
      throw new Error(
        `Batas PING tercapai (maks ${MAX_PENDING_PINGS} yang belum dibalas). Tunggu balasan dulu ya.`,
      )
    }

    const existing = pending.find((p) => p.receiver_id === receiverId)
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

  // Enforce the client-side ceiling too; the DB has the final say via the
  // `pings_pending_quota` trigger (migration 03).
  const pendingCount = await countPendingSentPings(senderId)
  if (pendingCount >= MAX_PENDING_PINGS) {
    throw new Error(
      `Batas PING tercapai (maks ${MAX_PENDING_PINGS} yang belum dibalas). Tunggu balasan dulu ya.`,
    )
  }

  const { data, error } = await supabase
    .from('pings')
    .insert({ sender_id: senderId, receiver_id: receiverId, message, status: 'pending' })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('Kamu udah kirim PING ke orang ini, tunggu balasannya ya.')
    }
    throw new Error(rpcMessage(error, `Gagal mengirim PING: ${error.message}`))
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
 * so both steps happen inside `respond_to_ping()` in one transaction.
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

/* ----------------------------------------------------------- block & report */

export async function blockUser(blockerId, blockedId) {
  if (!blockerId || !blockedId || blockerId === blockedId) return false

  if (!isSupabaseConfigured) {
    if (!demoDb.blocks.some((b) => b.blocker_id === blockerId && b.blocked_id === blockedId)) {
      demoDb.blocks.push({
        id: demoId('bl'),
        blocker_id: blockerId,
        blocked_id: blockedId,
        created_at: new Date().toISOString(),
      })
    }
    // Blocking cancels any pending PINGs between the two, either direction.
    demoDb.pings = demoDb.pings.filter(
      (p) =>
        !(
          p.status === 'pending' &&
          ((p.sender_id === blockerId && p.receiver_id === blockedId) ||
            (p.sender_id === blockedId && p.receiver_id === blockerId))
        ),
    )
    persistDemoDb()
    await fakeDelay(180)
    return true
  }

  const { error } = await supabase
    .from('blocks')
    .upsert(
      { blocker_id: blockerId, blocked_id: blockedId },
      { onConflict: 'blocker_id,blocked_id' },
    )

  if (error) throw new Error(`Gagal memblokir: ${error.message}`)
  return true
}

export async function unblockUser(blockerId, blockedId) {
  if (!isSupabaseConfigured) {
    demoDb.blocks = demoDb.blocks.filter(
      (b) => !(b.blocker_id === blockerId && b.blocked_id === blockedId),
    )
    persistDemoDb()
    return true
  }

  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)

  if (error) throw new Error(`Gagal membuka blokir: ${error.message}`)
  return true
}

/**
 * Everyone the given user has blocked, newest first, decorated with the blocked
 * person's profile so Settings can render a list with an "unblock" action.
 */
export async function fetchBlockedUsers(blockerId) {
  if (!blockerId) return []

  if (!isSupabaseConfigured) {
    await fakeDelay()
    return demoDb.blocks
      .filter((b) => b.blocker_id === blockerId)
      .sort(byNewest)
      .map((b) => {
        const profile = findProfile(b.blocked_id)
        return profile ? { ...profile, blocked_at: b.created_at } : null
      })
      .filter(Boolean)
  }

  const { data, error } = await supabase
    .from('blocks')
    .select('created_at, blocked:profiles!blocks_blocked_id_fkey(*)')
    .eq('blocker_id', blockerId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Gagal memuat daftar blokir: ${error.message}`)

  return (data ?? [])
    .map((row) => (row.blocked ? { ...row.blocked, blocked_at: row.created_at } : null))
    .filter(Boolean)
}

export async function isBlocked(blockerId, blockedId) {
  if (!blockerId || !blockedId) return false

  if (!isSupabaseConfigured) {
    return demoDb.blocks.some((b) => b.blocker_id === blockerId && b.blocked_id === blockedId)
  }

  const { data, error } = await supabase
    .from('blocks')
    .select('id')
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
    .maybeSingle()

  if (error) return false
  return Boolean(data)
}

export async function reportUser({ reporterId, reportedId, reason }) {
  if (!reporterId || !reportedId) throw new Error('Data laporan tidak lengkap.')

  if (!isSupabaseConfigured) {
    demoDb.reports.push({
      id: demoId('rp'),
      reporter_id: reporterId,
      reported_id: reportedId,
      reason: String(reason ?? '').trim(),
      created_at: new Date().toISOString(),
    })
    persistDemoDb()
    await fakeDelay(200)
    return true
  }

  const { error } = await supabase
    .from('reports')
    .insert({ reporter_id: reporterId, reported_id: reportedId, reason: String(reason ?? '').trim() })

  if (error) throw new Error(`Gagal mengirim laporan: ${error.message}`)
  return true
}

/* ------------------------------------------------------------------- mutuals */

/**
 * Demo-mode only. In Supabase mode connections are created exclusively by the
 * `respond_to_ping` RPC, so there is no client-side insert path.
 */
function linkMutualInDemo(userAId, userBId) {
  const [a, b] = [userAId, userBId].sort()
  if (demoDb.mutuals.some((m) => m.user_a_id === a && m.user_b_id === b)) return null
  const row = { id: demoId('m'), user_a_id: a, user_b_id: b, created_at: new Date().toISOString() }
  demoDb.mutuals.push(row)
  return row
}

/**
 * Connection count for any profile. `mutuals` rows are only visible to the two
 * people in them, so this goes through the `count_mutuals` RPC.
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

/** End a mutual connection. Either side may do this (mutuals RLS allows delete). */
export async function removeMutual(userId, otherId) {
  if (!userId || !otherId) return false
  const [a, b] = [userId, otherId].sort()

  if (!isSupabaseConfigured) {
    demoDb.mutuals = demoDb.mutuals.filter((m) => !(m.user_a_id === a && m.user_b_id === b))
    persistDemoDb()
    await fakeDelay(180)
    return true
  }

  const { error } = await supabase
    .from('mutuals')
    .delete()
    .eq('user_a_id', a)
    .eq('user_b_id', b)

  if (error) throw new Error(`Gagal memutuskan mutual: ${error.message}`)
  return true
}
