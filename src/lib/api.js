/**
 * Data-access layer for Kenalan.
 *
 * Every function has two implementations:
 *   1. a real Supabase query (used when env vars are configured)
 *   2. a demo-mode fallback backed by `mockData.js` + localStorage
 *
 * Views only ever import from here, so swapping the backend never touches UI code.
 */
import { supabase } from './supabase'
import { isDemoMode } from './dataMode'
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
const PROFILE_COLUMNS =
  'id,username,full_name,avatar_url,faculty,major,batch,bio,color_code,interests,is_discoverable,stamp_history_public,created_at,updated_at'
const PROFILE_EMBED =
  'id,username,full_name,avatar_url,faculty,major,batch,bio,color_code,interests,created_at'
const STAMP_COLUMNS =
  'id,user_id,location_label,image_url,lat,lng,audience,message,created_at,expires_at'
const PING_COLUMNS = 'id,sender_id,receiver_id,message,status,created_at,responded_at'
const SOCIAL_KEYS = ['instagram', 'linkedin', 'spotify', 'whatsapp', 'line']
const PROFILE_WRITE_KEYS = [
  'username',
  'full_name',
  'avatar_url',
  'faculty',
  'major',
  'batch',
  'bio',
  'color_code',
  'interests',
  'is_discoverable',
  'stamp_history_public',
]

function splitProfilePayload(payload) {
  const profile = {}
  const socials = {}
  let hasSocials = false

  for (const [key, value] of Object.entries(payload ?? {})) {
    if (key === 'id' && typeof value === 'string') {
      profile.id = value
    } else if (PROFILE_WRITE_KEYS.includes(key)) {
      profile[key] = value
    } else if (SOCIAL_KEYS.includes(key)) {
      socials[key] = String(value ?? '').trim()
      hasSocials = true
    } else if (key === 'social_visibility') {
      socials.social_visibility = value
      hasSocials = true
    } else {
      throw new Error(`Field profil tidak didukung: ${key}`)
    }
  }

  return { profile, socials, hasSocials }
}

async function saveProfileSocials(socials) {
  const values = Object.fromEntries(SOCIAL_KEYS.map((key) => [key, String(socials[key] ?? '').trim()]))
  const limits = { instagram: 300, linkedin: 300, spotify: 300, whatsapp: 64, line: 300 }
  for (const [key, limit] of Object.entries(limits)) {
    if (values[key].length > limit) throw new Error(`Kontak ${key} maksimal ${limit} karakter.`)
  }
  const visibility = { ...defaultSocialVisibility(), ...(socials.social_visibility ?? {}) }
  const { data, error } = await supabase.rpc('save_profile_socials', {
    p_socials: values,
    p_visibility: visibility,
  })
  if (error) throw new Error(`Gagal menyimpan kontak profil: ${rpcMessage(error, error.message)}`)
  return data
}

async function attachProfileSocials(profile) {
  if (!profile) return null
  const { data, error } = await supabase.rpc('get_profile_socials', {
    p_profile_id: profile.id,
  })
  if (error) throw new Error(`Gagal memuat kontak profil: ${error.message}`)

  const socials = data ?? {}
  return {
    ...profile,
    ...Object.fromEntries(SOCIAL_KEYS.map((key) => [key, socials[key] ?? ''])),
    ...(socials.social_visibility ? { social_visibility: socials.social_visibility } : {}),
  }
}

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

  if (isDemoMode.value) {
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
  if (isDemoMode.value) {
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

  if (isDemoMode.value) {
    await fakeDelay()
    const found = findProfile(userId)
    return found ? { ...found } : null
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(`Gagal memuat profil: ${error.message}`)
  return attachProfileSocials(data)
}

export async function createProfile(profile) {
  if (isDemoMode.value) {
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

  const { profile: profileFields, socials } = splitProfilePayload(profile)
  const { data, error } = await supabase
    .from('profiles')
    .upsert(profileFields, { onConflict: 'id' })
    .select(PROFILE_COLUMNS)
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('Username ini sudah dipakai.')
    throw new Error(`Gagal membuat profil: ${error.message}`)
  }
  const savedSocials = await saveProfileSocials(socials)
  return { ...data, ...savedSocials }
}

export async function updateProfile(userId, patch) {
  if (isDemoMode.value) {
    const row = findProfile(userId)
    if (!row) throw new Error('Profil tidak ditemukan.')
    Object.assign(row, patch)
    persistDemoDb()
    await fakeDelay(180)
    return { ...row }
  }

  const { profile: profilePatch, socials, hasSocials } = splitProfilePayload(patch)
  delete profilePatch.id

  let data = null
  if (Object.keys(profilePatch).length > 0) {
    const result = await supabase
      .from('profiles')
      .update(profilePatch)
      .eq('id', userId)
      .select(PROFILE_COLUMNS)
      .maybeSingle()
    data = result.data
    if (result.error) {
      if (result.error.code === '23505') throw new Error('Username ini sudah dipakai.')
      if (result.error.code === '23514') throw new Error('Username hanya boleh huruf, angka, titik, dan underscore (3-24 karakter).')
      throw new Error(`Gagal menyimpan profil: ${result.error.message}`)
    }
  }

  if (!data) {
    const result = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle()
    if (result.error) throw new Error(`Gagal memuat profil: ${result.error.message}`)
    data = result.data
  }
  if (!data) throw new Error('Profil tidak ditemukan.')
  if (!hasSocials) return attachProfileSocials(data)

  const savedSocials = await saveProfileSocials(socials)
  return { ...data, ...savedSocials }
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
  if (isDemoMode.value) {
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

  const [mutuals, blockRows] = await Promise.all([
    fetchMutuals(userId),
    supabase
      .from('blocks')
      .select('blocker_id,blocked_id')
      .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`),
  ])
  if (blockRows.error) throw new Error(`Gagal memuat blokir: ${blockRows.error.message}`)
  const mutualIds = mutuals.map((p) => p.id)
  const blockedIds = (blockRows.data ?? []).map((row) =>
    row.blocker_id === userId ? row.blocked_id : row.blocker_id,
  )
  const excluded = [...new Set([userId, ...mutualIds, ...blockedIds])].filter(Boolean)

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
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
 * The physical place is approximate; distance and bearing are computed
 * dynamically from rounded coordinates on the viewer's device.
 */
export async function fetchRecentStamps(viewerId = null) {
  if (isDemoMode.value) {
    await fakeDelay()
    const mutualSet = mutualIdsFor(viewerId)
    return demoDb.location_stamps
      .filter((s) => isFresh(s.created_at) && canViewStamp(s, viewerId, mutualSet))
      .sort(byNewest)
      .map(decorateStamp)
  }

  const { data, error } = await supabase
    .from('location_stamps')
    .select(`${STAMP_COLUMNS}, profile:profiles(${PROFILE_EMBED}), reply_count:stamp_replies(count)`)
    .gte('created_at', isoSince())
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Gagal memuat stamp: ${error.message}`)
  return (data ?? []).map((s) => ({
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

  if (isDemoMode.value) {
    await fakeDelay(160)
    const found = demoDb.location_stamps.find((s) => s.id === stampId)
    if (!found) return null
    if (!canViewStamp(found, viewerId, mutualIdsFor(viewerId))) return { restricted: true }
    return decorateStamp(found)
  }

  const { data, error } = await supabase
    .from('location_stamps')
    .select(`${STAMP_COLUMNS}, profile:profiles(${PROFILE_EMBED})`)
    .eq('id', stampId)
    .maybeSingle()

  if (error) throw new Error(`Gagal memuat stamp: ${error.message}`)
  return data
}

/**
 * The caller's own stamps from the last 30 days — powers Stamp History.
 * Unlike the live feed this includes expired stamps (anything < 30 days old).
 */
export async function fetchStampHistory(userId, windowMs = STAMP_HISTORY_MS) {
  if (!userId) return []

  if (isDemoMode.value) {
    await fakeDelay()
    return demoDb.location_stamps
      .filter((s) => s.user_id === userId && isWithin(s.created_at, windowMs))
      .sort(byNewest)
      .map(decorateStamp)
  }

  const since = new Date(Date.now() - windowMs).toISOString()
  const { data, error } = await supabase
    .from('location_stamps')
    .select(`${STAMP_COLUMNS}, profile:profiles(${PROFILE_EMBED}), reply_count:stamp_replies(count)`)
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
  audience = 'public',
  lat = null,
  lng = null,
}) {
  if (!userId) throw new Error('Harus login untuk membuat stamp.')
  const trimmedMessage = String(message ?? '').trim()
  if (trimmedMessage.length < 4 || trimmedMessage.length > 180) {
    throw new Error('Pesan stamp harus berisi 4 sampai 180 karakter.')
  }
  const safeLocationLabel = String(locationLabel ?? '').trim()
  if (safeLocationLabel.length > 120) throw new Error('Keterangan lokasi maksimal 120 karakter.')
  const safeImageUrl = String(imageUrl ?? '')
  if (safeImageUrl.length > 7_000_000) throw new Error('Ukuran gambar maksimal 5MB.')
  if ((lat == null) !== (lng == null)) throw new Error('Koordinat lokasi tidak lengkap.')
  if (
    (lat != null && (!Number.isFinite(Number(lat)) || Number(lat) < -90 || Number(lat) > 90)) ||
    (lng != null && (!Number.isFinite(Number(lng)) || Number(lng) < -180 || Number(lng) > 180))
  ) {
    throw new Error('Koordinat lokasi tidak valid.')
  }
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const safeAudience = audience === 'mutual' ? 'mutual' : 'public'

  // Use the user's real coords when geolocation gave us some; otherwise fan the
  // stamp out a little around the campus center so the map isn't a single pile.
  const coords =
    lat != null && lng != null
      ? { lat: Number(lat), lng: Number(lng) }
      : {
          lat: CAMPUS_CENTER.lat + (Math.random() - 0.5) * 0.004,
          lng: CAMPUS_CENTER.lng + (Math.random() - 0.5) * 0.004,
        }

  if (isDemoMode.value) {
    const row = {
      id: demoId('st'),
      user_id: userId,
      location_label: safeLocationLabel,
      image_url: safeImageUrl,
      lat: Number(coords.lat.toFixed(4)),
      lng: Number(coords.lng.toFixed(4)),
      audience: safeAudience,
      message: trimmedMessage,
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
      message: trimmedMessage,
      location_label: safeLocationLabel,
      image_url: safeImageUrl || null,
      lat: coords.lat,
      lng: coords.lng,
      audience: safeAudience,
    })
    .select(`${STAMP_COLUMNS}, profile:profiles(${PROFILE_EMBED})`)
    .single()

  if (error) throw new Error(`Gagal membuat stamp: ${error.message}`)
  return { ...data, reply_count: 0 }
}

export async function deleteStamp(stampId, userId) {
  if (isDemoMode.value) {
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

  if (isDemoMode.value) {
    await fakeDelay(160)
    return demoDb.stamp_replies
      .filter((r) => r.stamp_id === stampId)
      .sort(byOldest)
      .map((r) => ({ ...r, profile: findProfile(r.user_id) }))
  }

  const { data, error } = await supabase
    .from('stamp_replies')
    .select(`id,stamp_id,user_id,message,created_at,profile:profiles(${PROFILE_EMBED})`)
    .eq('stamp_id', stampId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Gagal memuat balasan: ${error.message}`)
  return data ?? []
}

export async function createStampReply({ stampId, userId, message }) {
  const trimmed = String(message ?? '').trim()
  if (!stampId || !userId) throw new Error('Data balasan tidak lengkap.')
  if (trimmed.length < 1 || trimmed.length > 500) {
    throw new Error('Balasan harus berisi 1 sampai 500 karakter.')
  }

  if (isDemoMode.value) {
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
    .select(`id,stamp_id,user_id,message,created_at,profile:profiles(${PROFILE_EMBED})`)
    .single()

  if (error) throw new Error(`Gagal mengirim balasan: ${error.message}`)
  return data
}

/* --------------------------------------------------------------------- pings */

export async function fetchIncomingPings(userId) {
  if (isDemoMode.value) {
    await fakeDelay()
    const blocked = blockedIdsFor(userId)
    return demoDb.pings
      .filter((p) => p.receiver_id === userId && !blocked.has(p.sender_id))
      .sort(byNewest)
      .map((p) => ({ ...p, sender: findProfile(p.sender_id) }))
  }

  const { data, error } = await supabase
    .from('pings')
    .select(`${PING_COLUMNS}, sender:profiles!pings_sender_id_fkey(${PROFILE_EMBED})`)
    .eq('receiver_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Gagal memuat PING: ${error.message}`)
  const { data: blockRows, error: blockError } = await supabase
    .from('blocks')
    .select('blocker_id,blocked_id')
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)
  if (blockError) throw new Error(`Gagal memuat blokir: ${blockError.message}`)
  const blockedIds = new Set(
    (blockRows ?? []).map((row) => (row.blocker_id === userId ? row.blocked_id : row.blocker_id)),
  )
  return (data ?? []).filter((ping) => !blockedIds.has(ping.sender_id))
}

export async function fetchSentPings(userId) {
  if (isDemoMode.value) {
    await fakeDelay(160)
    return demoDb.pings
      .filter((p) => p.sender_id === userId)
      .sort(byNewest)
      .map((p) => ({ ...p, receiver: findProfile(p.receiver_id) }))
  }

  const { data, error } = await supabase
    .from('pings')
    .select(`${PING_COLUMNS}, receiver:profiles!pings_receiver_id_fkey(${PROFILE_EMBED})`)
    .eq('sender_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Gagal memuat PING terkirim: ${error.message}`)
  return data ?? []
}

/** How many outgoing PINGs are still waiting for a reply. */
export async function countPendingSentPings(userId) {
  if (!userId) return 0

  if (isDemoMode.value) {
    return demoDb.pings.filter((p) => p.sender_id === userId && p.status === 'pending').length
  }

  const { count, error } = await supabase
    .from('pings')
    .select('id', { count: 'exact', head: true })
    .eq('sender_id', userId)
    .eq('status', 'pending')

  if (error) throw new Error(`Gagal menghitung PING: ${error.message}`)
  return count ?? 0
}

export async function sendPing({ senderId, receiverId, message }) {
  const trimmedMessage = String(message ?? '').trim()
  if (!senderId || !receiverId) throw new Error('Data penerima PING tidak lengkap.')
  if (senderId === receiverId) throw new Error('Nggak bisa PING diri sendiri 😅')
  if (trimmedMessage.length < 1 || trimmedMessage.length > 220) {
    throw new Error('Pesan PING harus berisi 1 sampai 220 karakter.')
  }

  if (isDemoMode.value) {
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
      message: trimmedMessage,
      status: 'pending',
      created_at: new Date().toISOString(),
    }
    demoDb.pings.unshift(row)
    persistDemoDb()
    await fakeDelay(260)
    return { ...row }
  }

  // The database trigger serializes concurrent requests and enforces the
  // authoritative limit; this check provides quicker feedback in the UI.
  const pendingCount = await countPendingSentPings(senderId)
  if (pendingCount >= MAX_PENDING_PINGS) {
    throw new Error(
      `Batas PING tercapai (maks ${MAX_PENDING_PINGS} yang belum dibalas). Tunggu balasan dulu ya.`,
    )
  }

  const { data, error } = await supabase
    .from('pings')
    .insert({ sender_id: senderId, receiver_id: receiverId, message: trimmedMessage, status: 'pending' })
    .select(PING_COLUMNS)
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('Kamu udah kirim PING ke orang ini, tunggu balasannya ya.')
    }
    if (error.message?.includes('PING_QUOTA_REACHED')) {
      throw new Error(`Batas PING tercapai (maks ${MAX_PENDING_PINGS} yang belum dibalas). Tunggu balasan dulu ya.`)
    }
    if (error.message?.includes('USER_BLOCKED')) {
      throw new Error('Kamu nggak bisa kirim PING ke orang ini.')
    }
    throw new Error(rpcMessage(error, `Gagal mengirim PING: ${error.message}`))
  }
  return data
}

/** Whether the logged-in user already has a pending PING out to `receiverId`. */
export async function hasPendingPing(senderId, receiverId) {
  if (!senderId || !receiverId) return false

  if (isDemoMode.value) {
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

  if (error) throw new Error(`Gagal memeriksa PING: ${error.message}`)
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

  if (isDemoMode.value) {
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
  if (!blockerId || !blockedId || blockerId === blockedId) {
    throw new Error('Pengguna tujuan blokir tidak valid.')
  }

  if (isDemoMode.value) {
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

  const { error } = await supabase.rpc('block_user', { p_blocked_id: blockedId })

  if (error) throw new Error(`Gagal memblokir: ${error.message}`)
  return true
}

export async function unblockUser(blockerId, blockedId) {
  if (isDemoMode.value) {
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

  if (isDemoMode.value) {
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
    .select(`created_at, blocked:profiles!blocks_blocked_id_fkey(${PROFILE_EMBED})`)
    .eq('blocker_id', blockerId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Gagal memuat daftar blokir: ${error.message}`)

  return (data ?? [])
    .map((row) => (row.blocked ? { ...row.blocked, blocked_at: row.created_at } : null))
    .filter(Boolean)
}

export async function isBlocked(blockerId, blockedId) {
  if (!blockerId || !blockedId) return false

  if (isDemoMode.value) {
    return demoDb.blocks.some((b) => b.blocker_id === blockerId && b.blocked_id === blockedId)
  }

  const { data, error } = await supabase
    .from('blocks')
    .select('id')
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
    .maybeSingle()

  if (error) throw new Error(`Gagal memeriksa blokir: ${error.message}`)
  return Boolean(data)
}

export async function reportUser({ reporterId, reportedId, reason }) {
  if (!reporterId || !reportedId) throw new Error('Data laporan tidak lengkap.')
  const trimmedReason = String(reason ?? '').trim()
  if (trimmedReason.length < 1 || trimmedReason.length > 1000) {
    throw new Error('Alasan laporan harus berisi 1 sampai 1000 karakter.')
  }

  if (isDemoMode.value) {
    demoDb.reports.push({
      id: demoId('rp'),
      reporter_id: reporterId,
      reported_id: reportedId,
      report_type: 'user',
      reason: trimmedReason,
      status: 'pending',
      created_at: new Date().toISOString(),
      reviewed_at: null,
      reviewed_by: null,
    })
    persistDemoDb()
    await fakeDelay(200)
    return true
  }

  const { error } = await supabase
    .from('reports')
    .insert({ reporter_id: reporterId, reported_id: reportedId, reason: trimmedReason })

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

  if (isDemoMode.value) {
    return demoDb.mutuals.filter((m) => m.user_a_id === userId || m.user_b_id === userId).length
  }

  const { data, error } = await supabase.rpc('count_mutuals', { p_user_id: userId })
  if (error) throw new Error(`Gagal menghitung mutual: ${error.message}`)
  return Number(data) || 0
}

export async function fetchMutuals(userId) {
  if (!userId) return []

  if (isDemoMode.value) {
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
      `created_at, user_a_id, user_b_id, a:profiles!mutuals_user_a_id_fkey(${PROFILE_EMBED}), b:profiles!mutuals_user_b_id_fkey(${PROFILE_EMBED})`,
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

  if (isDemoMode.value) {
    return demoDb.mutuals.some((m) => m.user_a_id === a && m.user_b_id === b)
  }

  const { data, error } = await supabase
    .from('mutuals')
    .select('id')
    .eq('user_a_id', a)
    .eq('user_b_id', b)
    .maybeSingle()

  if (error) throw new Error(`Gagal memeriksa mutual: ${error.message}`)
  return Boolean(data)
}

/** End a mutual connection. Either side may do this (mutuals RLS allows delete). */
export async function removeMutual(userId, otherId) {
  if (!userId || !otherId) return false
  const [a, b] = [userId, otherId].sort()

  if (isDemoMode.value) {
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
