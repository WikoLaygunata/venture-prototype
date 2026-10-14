import { computed, ref } from 'vue'
import { isSupabaseConfigured } from './supabase'

const STORAGE_KEY = 'kenalan.dataMode'
const DEFAULT_MODE = isSupabaseConfigured ? 'production' : 'demo'

function readStoredMode() {
  try {
    const storedMode = localStorage.getItem(STORAGE_KEY)
    if (storedMode === 'demo' || (storedMode === 'production' && isSupabaseConfigured)) {
      return storedMode
    }
  } catch {
    // Fall back to the configured default when browser storage is unavailable.
  }
  return DEFAULT_MODE
}

export const dataMode = ref(readStoredMode())
export const isDemoMode = computed(() => dataMode.value === 'demo')

export function setDataMode(mode) {
  if (mode !== 'demo' && mode !== 'production') {
    throw new Error('Mode aplikasi tidak valid.')
  }
  if (mode === 'production' && !isSupabaseConfigured) {
    throw new Error('Mode production memerlukan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.')
  }

  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    throw new Error('Pilihan mode tidak dapat disimpan pada browser ini.')
  }

  dataMode.value = mode
}
