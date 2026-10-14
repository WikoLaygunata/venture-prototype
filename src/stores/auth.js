/**
 * Lightweight auth store — a plain reactive module, no Pinia needed for a prototype.
 *
 * Exposes the logged-in user id + their profile row, and works in both
 * Supabase mode and demo mode. `initAuth()` is awaited in `main.js` before the
 * app mounts so router guards never see a half-resolved session.
 */
import { computed, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { isDemoMode } from '@/lib/dataMode'
import {
  demoDb,
  persistDemoDb,
  DEMO_CREDENTIALS,
  getDemoPassword,
  setDemoPassword,
  resetDemoDb,
} from '@/lib/mockData'
import { claimNfcToken, fetchProfile, createProfile, fetchNfcToken } from '@/lib/api'
import { DEFAULT_COLOR_CODE } from '@/lib/colorCodes'
import { defaultAvatarFor } from '@/lib/avatars'

const userId = ref(null)
const profile = ref(null)
const ready = ref(false)
let demoResetEmail = ''

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
    if (isDemoMode.value) {
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
  if (isDemoMode.value) {
    const normalized = String(email).trim().toLowerCase()

    // Demo mode accepts the seeded credentials, or any @kenalan.id address
    // that matches a seeded username (e.g. nadiakirana@kenalan.id).
    const demoProfile = demoDb.profiles.find((p) => p.id === 'u-raka')
    const isDemoAccount =
      normalized === (demoProfile?.admin_email ?? DEMO_CREDENTIALS.email) &&
      password === getDemoPassword()
    const matchByUsername = demoDb.profiles.find(
      (p) =>
        (`${p.username}@kenalan.id` === normalized || p.admin_email === normalized) &&
        password === getDemoPassword(),
    )

    if (!isDemoAccount && !matchByUsername) {
      throw new Error(
        `Demo mode: pakai ${DEMO_CREDENTIALS.email} / ${DEMO_CREDENTIALS.password}`,
      )
    }

    const id = isDemoAccount ? 'u-raka' : matchByUsername.id
    const matchedProfile = demoDb.profiles.find((item) => item.id === id)
    if (matchedProfile?.is_banned) throw new Error('Akun ini sedang dinonaktifkan.')
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
  token,
  email,
  password,
  fullName,
  username,
  faculty = '',
  major = '',
  bio = '',
}) {
  const normalizedToken = String(token ?? '').trim().toUpperCase()
  if (!normalizedToken) throw new Error('Aktivasi akun memerlukan token NFC yang valid.')
  if (!/^[a-z0-9_.]{3,24}$/.test(String(username ?? ''))) {
    throw new Error('Username harus 3–24 karakter: huruf kecil, angka, titik, atau garis bawah.')
  }
  if (String(fullName ?? '').trim().length < 3 || String(fullName).length > 80) {
    throw new Error('Nama lengkap harus berisi 3–80 karakter.')
  }
  const tokenRecord = await fetchNfcToken(normalizedToken)
  if (!tokenRecord || tokenRecord.status !== 'unclaimed') {
    throw new Error('Token NFC tidak valid atau sudah diklaim.')
  }

  if (isDemoMode.value) {
    const normalized = String(email).trim().toLowerCase()
    if (demoDb.profiles.some((p) => p.username === username)) {
      throw new Error('Username ini sudah dipakai.')
    }

    const id = `u-${username || Date.now().toString(36)}`
    await createProfile({
      id,
      username,
      full_name: fullName,
      // Pre-pick one of the gallery avatars so a new profile is never blank.
      avatar_url: defaultAvatarFor(username || fullName || normalized),
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
    try {
      await claimNfcToken(normalizedToken, id)
    } catch (error) {
      demoDb.profiles = demoDb.profiles.filter((profile) => profile.id !== id)
      persistDemoDb()
      throw error
    }

    demoDb.session_user_id = id
    persistDemoDb()
    userId.value = id
    await loadProfile(id)
    return { userId: id, needsEmailConfirmation: false }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        username,
        nfc_token: normalizedToken,
        faculty,
        major,
        bio,
      },
    },
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
      avatar_url: defaultAvatarFor(username || fullName || email),
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

export async function requestPasswordReset(email) {
  const normalized = String(email ?? '').trim().toLowerCase()
  if (!/\S+@\S+\.\S+/.test(normalized)) throw new Error('Masukkan alamat email yang valid.')

  if (isDemoMode.value) {
    demoResetEmail = normalized
    return
  }

  const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw new Error(translateAuthError(error.message))
}

export async function changePassword({ currentPassword, newPassword }) {
  if (String(newPassword ?? '').length < 8) {
    throw new Error('Password baru minimal 8 karakter.')
  }

  if (isDemoMode.value) {
    if (!userId.value) throw new Error('Silakan masuk terlebih dahulu.')
    if (currentPassword !== getDemoPassword()) throw new Error('Password saat ini tidak cocok.')
    setDemoPassword(newPassword)
    return
  }

  const { data: currentUser, error: userError } = await supabase.auth.getUser()
  if (userError) throw new Error(`Gagal memverifikasi akun: ${translateAuthError(userError.message)}`)
  if (!currentUser.user?.email) throw new Error('Email akun tidak tersedia untuk verifikasi password.')
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: currentUser.user.email,
    password: currentPassword,
  })
  if (verifyError) throw new Error('Password saat ini tidak cocok.')
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(translateAuthError(error.message))
}

export async function completePasswordReset(newPassword) {
  if (String(newPassword ?? '').length < 8) {
    throw new Error('Password baru minimal 8 karakter.')
  }

  if (isDemoMode.value) {
    if (!demoResetEmail) throw new Error('Simulasi pemulihan tidak dimulai. Minta link reset terlebih dahulu.')
    setDemoPassword(newPassword)
    demoResetEmail = ''
    return
  }

  const { data, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw new Error(`Gagal memverifikasi sesi pemulihan: ${sessionError.message}`)
  if (!data.session) throw new Error('Sesi pemulihan tidak valid atau sudah kedaluwarsa.')
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(translateAuthError(error.message))
}

export async function signOut() {
  if (isDemoMode.value) {
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
  if (m.includes('nfc_token_required')) return 'Pendaftaran harus dimulai dari token NFC yang valid.'
  if (m.includes('nfc_token_invalid')) return 'Token NFC sudah digunakan atau tidak valid.'
  if (m.includes('username_taken')) return 'Username ini sudah dipakai.'
  if (m.includes('invalid login credentials')) return 'Email atau password salah.'
  if (m.includes('email not confirmed')) return 'Email belum diverifikasi. Silakan periksa inbox atau spam email Anda untuk mengonfirmasi akun.'
  if (m.includes('already registered')) return 'Email ini sudah terdaftar. Coba login.'
  if (m.includes('password should be at least')) return 'Password belum memenuhi panjang minimum.'
  if (m.includes('email rate limit')) return 'Terlalu banyak percobaan. Tunggu sebentar ya.'
  if (m.includes('unable to validate email')) return 'Format email tidak valid.'
  return message
}
