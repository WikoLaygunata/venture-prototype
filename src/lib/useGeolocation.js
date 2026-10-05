/**
 * useGeolocation — thin wrapper over the browser Geolocation API.
 *
 * The prototype doesn't have real coordinates for stamps (they carry a
 * precomputed distance + bearing instead), so this is used purely to tell
 * whether the viewer has location turned on. When active, the mini map can
 * render a live "you" dot and the UI can hint at direction.
 *
 * State:
 *   status  'idle' | 'prompting' | 'active' | 'denied' | 'unsupported'
 *   coords  { lat, lng, accuracy } | null
 *   error   human-readable string | ''
 */
import { readonly, ref } from 'vue'

export function useGeolocation() {
  const status = ref('idle')
  const coords = ref(null)
  const error = ref('')

  function request() {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      status.value = 'unsupported'
      error.value = 'Browser kamu tidak mendukung lokasi.'
      return
    }

    status.value = 'prompting'
    error.value = ''

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        coords.value = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }
        status.value = 'active'
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          status.value = 'denied'
          error.value = 'Izin lokasi ditolak. Aktifkan di pengaturan browser.'
        } else {
          status.value = 'idle'
          error.value = 'Gagal mendapatkan lokasi. Coba lagi.'
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    )
  }

  return {
    status: readonly(status),
    coords: readonly(coords),
    error: readonly(error),
    request,
  }
}
