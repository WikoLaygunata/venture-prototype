/**
 * Lightweight auth store — a plain reactive module, no Pinia needed for a prototype.
 *
 * Exposes the logged-in user id + their profile row, and works in both
 * Supabase mode and demo mode. `initAuth()` is awaited in `main.js` before the
 * app mounts so router guards never see a half-resolved session.
 */
import { computed, ref } from 'vue'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { demoDb, persistDemoDb, DEMO_CREDENTIALS, resetDemoDb } from '@/lib/mockData'
import { fetchProfile, createProfile } from '@/lib/api'
import { DEFAULT_COLOR_CODE } from '@/lib/colorCodes'

const userId = ref(null)
const profile = ref(null)
const ready = ref(false)

export const isLoggedIn = computed(() => Boolean(userId.value))
export const currentUserId = computed(() => userId.value)
export const currentProfile = computed(() => profile.value)
export const authReady = computed(() => ready.value)

/** True when this id belongs to the person currently holding the phone. */
export function isMe(id) {
  return Boolean(id) && userId.value === id
}

async function loadProfile(id) {
  profile.value = id ? await fetchProfile(id) : null
  return profile.value
}

/** Re-reads the profile row, e.g. after editing it elsewhere. */
export async function refreshProfile() {
  if (!userId.value) return null
  return loadProfile(userId.value)
}

/** Lets a view push an updated row into the store without an extra round trip. */
export function setProfile(next) {
  profile.value = next
}

/* ------------------------------------------------------------------ bootstrap */

export async function initAuth() {
  if (ready.value) return

  try {
    if (!isSupabaseConfigured) {
      userId.value = demoDb.session_user_id ?? null
      await loadProfile(userId.value)
    } else {
      const { data } = await supabase.auth.getSession()
      userId.value = data.session?.user?.id ?? null
      await loadProfile(userId.value)

      supabase.auth.onAuthStateChange(async (_event, session) => {
        const nextId = session?.user?.id ?? null
        if (nextId === userId.value) return
        userId.value = nextId
        await loadProfile(nextId)
      })
    }
  } catch (error) {
    console.error('[Kenalan] initAuth failed:', error)
    userId.value = null
    profile.value = null
  } finally {
    ready.value = true
  }
}

/* ----------------------------------------------------------------- mutations */

export async function signIn({ email, password }) {
  if (!isSupabaseConfigured) {
    const normalized = String(email).trim().toLowerCase()

    // Demo mode accepts the seeded credentials, or any @kenalan.id address
    // that matches a seeded username (e.g. nadiakirana@kenalan.id).
    const isDemoAccount =
      normalized === DEMO_CREDENTIALS.email && password === DEMO_CREDENTIALS.password
    const matchByUsername = demoDb.profiles.find(
      (p) => `${p.username}@kenalan.id` === normalized && password === DEMO_CREDENTIALS.password,
    )

    if (!isDemoAccount && !matchByUsername) {
      throw new Error(
        `Demo mode: pakai ${DEMO_CREDENTIALS.email} / ${DEMO_CREDENTIALS.password}`,
      )
    }

    const id = isDemoAccount ? 'u-raka' : matchByUsername.id
    demoDb.session_user_id = id
    persistDemoDb()
    userId.value = id
    await loadProfile(id)
    return { id }
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(translateAuthError(error.message))

  userId.value = data.user?.id ?? null
  await loadProfile(userId.value)
  return data.user
}

/**
 * Registers an account and creates its profile row.
 * @param {object} payload  { email, password, fullName, username, faculty, major, bio }
 * @returns {Promise<{userId:string, needsEmailConfirmation:boolean}>}
 */
export async function signUp({
  email,
  password,
  fullName,
  username,
  faculty = '',
  major = '',
  bio = '',
}) {
  if (!isSupabaseConfigured) {
    const normalized = String(email).trim().toLowerCase()
    if (demoDb.profiles.some((p) => p.username === username)) {
      throw new Error('Username ini sudah dipakai.')
    }

    const id = `u-${username || Date.now().toString(36)}`
    await createProfile({
      id,
      username,
      full_name: fullName,
      avatar_url: `https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${encodeURIComponent(
        fullName || normalized,
      )}&backgroundColor=ddd6fe,fce7f3,d1fae5,fef3c7&radius=50`,
      faculty,
      major,
      batch: String(new Date().getFullYear()),
      bio,
      color_code: DEFAULT_COLOR_CODE,
      interests: [],
      instagram: '',
      linkedin: '',
      spotify: '',
    })

    demoDb.session_user_id = id
    persistDemoDb()
    userId.value = id
    await loadProfile(id)
    return { userId: id, needsEmailConfirmation: false }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, username } },
  })
  if (error) throw new Error(translateAuthError(error.message))

  const newUserId = data.user?.id
  if (!newUserId) throw new Error('Registrasi gagal: user id tidak diterima.')

  // With email confirmation ON there is no session yet, so the insert would be
  // blocked by RLS. In that case a `on auth.users` trigger should create the
  // profile row server-side; we only insert when we already have a session.
  if (data.session) {
    await createProfile({
      id: newUserId,
      username,
      full_name: fullName,
      faculty,
      major,
      bio,
      color_code: DEFAULT_COLOR_CODE,
    })
    userId.value = newUserId
    await loadProfile(newUserId)
  }

  return { userId: newUserId, needsEmailConfirmation: !data.session }
}

export async function signOut() {
  if (!isSupabaseConfigured) {
    demoDb.session_user_id = null
    persistDemoDb()
  } else {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(`Gagal logout: ${error.message}`)
  }

  userId.value = null
  profile.value = null
}

/** Demo-only helper wired to the "Reset Demo" button in Settings. */
export function resetDemo() {
  resetDemoDb()
  userId.value = null
  profile.value = null
}

/* -------------------------------------------------------------------- errors */

function translateAuthError(message = '') {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email atau password salah.'
  if (m.includes('already registered')) return 'Email ini sudah terdaftar. Coba login.'
  if (m.includes('password should be at least')) return 'Password minimal 6 karakter.'
  if (m.includes('email rate limit')) return 'Terlalu banyak percobaan. Tunggu sebentar ya.'
  if (m.includes('unable to validate email')) return 'Format email tidak valid.'
  return message
}
