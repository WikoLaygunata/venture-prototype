import { computed, ref } from 'vue'
import {
  dashboardSupabase,
  isDashboardSupabaseEnabled,
  isDashboardSupabaseRequested,
} from '@/lib/supabase'

const DEMO_SESSION_KEY = 'kenalan.dashboard.session'
const DEMO_ADMIN = {
  email: 'admin@kenalan.id',
  password: 'kenalan123',
  id: 'demo-admin',
  name: 'Admin Kenalan',
  role: 'superadmin',
}

const initialized = ref(false)
const user = ref(null)
const role = ref(null)
const authError = ref('')

export const dashboardAuthReady = computed(() => initialized.value)
export const dashboardUser = computed(() => user.value)
export const dashboardRole = computed(() => role.value)
export const dashboardAuthMessage = computed(() => authError.value)
export const isDashboardAuthenticated = computed(() =>
  Boolean(user.value && ['admin', 'moderator', 'superadmin'].includes(role.value)),
)

async function loadDashboardRole(authUser) {
  if (!authUser) {
    user.value = null
    role.value = null
    return false
  }

  const { data, error } = await dashboardSupabase.rpc('dashboard_get_my_role')
  if (error) throw new Error(`Gagal memverifikasi akses admin: ${error.message}`)
  if (!data) {
    user.value = null
    role.value = null
    return false
  }

  user.value = authUser
  role.value = data
  return true
}

export async function initDashboardAuth() {
  if (initialized.value) return
  authError.value = ''

  try {
    if (!isDashboardSupabaseEnabled && isDashboardSupabaseRequested) {
      throw new Error('Dashboard Supabase diminta, tetapi VITE_SUPABASE_URL atau anon key belum diisi.')
    }
    if (!isDashboardSupabaseEnabled) {
      const stored = localStorage.getItem(DEMO_SESSION_KEY)
      if (stored === DEMO_ADMIN.id) {
        user.value = { id: DEMO_ADMIN.id, email: DEMO_ADMIN.email, name: DEMO_ADMIN.name }
        role.value = DEMO_ADMIN.role
      }
    } else {
      const { data, error } = await dashboardSupabase.auth.getSession()
      if (error) throw new Error(`Gagal memeriksa sesi admin: ${error.message}`)
      if (data.session?.user) await loadDashboardRole(data.session.user)

      dashboardSupabase.auth.onAuthStateChange((_event, session) => {
        if (!session?.user) {
          user.value = null
          role.value = null
        } else {
          loadDashboardRole(session.user).catch((error) => {
            authError.value = error.message
            console.error('[Kenalan Dashboard] Failed to verify admin role:', error)
          })
        }
      })
    }
  } catch (error) {
    authError.value = error.message
    console.error('[Kenalan Dashboard] Failed to initialize admin session:', error)
  } finally {
    initialized.value = true
  }
}

export async function signInDashboard({ email, password }) {
  authError.value = ''
  if (!isDashboardSupabaseEnabled && isDashboardSupabaseRequested) {
    throw new Error('Dashboard Supabase diminta, tetapi VITE_SUPABASE_URL atau anon key belum diisi.')
  }
  if (!isDashboardSupabaseEnabled) {
    if (
      String(email).trim().toLowerCase() !== DEMO_ADMIN.email ||
      password !== DEMO_ADMIN.password
    ) {
      throw new Error('Email atau password admin dummy tidak cocok.')
    }
    localStorage.setItem(DEMO_SESSION_KEY, DEMO_ADMIN.id)
    user.value = { id: DEMO_ADMIN.id, email: DEMO_ADMIN.email, name: DEMO_ADMIN.name }
    role.value = DEMO_ADMIN.role
    initialized.value = true
    return user.value
  }

  const { data, error } = await dashboardSupabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Login admin gagal: ${error.message}`)
  if (!data.user || !(await loadDashboardRole(data.user))) {
    await dashboardSupabase.auth.signOut()
    throw new Error('Akun ini belum memiliki akses dashboard.')
  }
  initialized.value = true
  return user.value
}

export async function signOutDashboard() {
  if (!isDashboardSupabaseEnabled) {
    localStorage.removeItem(DEMO_SESSION_KEY)
  } else {
    const { error } = await dashboardSupabase.auth.signOut()
    if (error) throw new Error(`Gagal keluar dari dashboard: ${error.message}`)
  }
  user.value = null
  role.value = null
}
