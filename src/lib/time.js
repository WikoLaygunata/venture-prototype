/** Small time helpers shared by the stamp feed and ping inbox. */

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export const STAMP_LIFETIME_MS = DAY

/** How far back the Stamp History screen looks (30 days). */
export const STAMP_HISTORY_MS = 30 * DAY

export function hoursAgo(n) {
  return new Date(Date.now() - n * HOUR).toISOString()
}

export function minutesAgo(n) {
  return new Date(Date.now() - n * MINUTE).toISOString()
}

/** ISO timestamp for the 24h cutoff used when querying stamps. */
export function isoSince(ms = STAMP_LIFETIME_MS) {
  return new Date(Date.now() - ms).toISOString()
}

/** "baru aja" / "12 menit lalu" / "3 jam lalu" / "2 hari lalu" */
export function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < MINUTE) return 'baru aja'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} menit lalu`
  if (diff < DAY) return `${Math.floor(diff / HOUR)} jam lalu`
  return `${Math.floor(diff / DAY)} hari lalu`
}

/** Remaining lifetime of a stamp, e.g. "hangus dalam 5j 12m". */
export function expiresIn(iso, lifetime = STAMP_LIFETIME_MS) {
  if (!iso) return ''
  const remaining = new Date(iso).getTime() + lifetime - Date.now()
  if (remaining <= 0) return 'sudah hangus'
  const h = Math.floor(remaining / HOUR)
  const m = Math.floor((remaining % HOUR) / MINUTE)
  return h > 0 ? `${h}j ${m}m` : `${m}m`
}

/** True while a stamp is still inside its 24h window. */
export function isFresh(iso, lifetime = STAMP_LIFETIME_MS) {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() < lifetime
}

/** True while a timestamp is within the given window (default 30 days). */
export function isWithin(iso, window = STAMP_HISTORY_MS) {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() < window
}

/** Short calendar-style date, e.g. "12 Sep". */
export function shortDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

/**
 * Great-circle distance between two {lat,lng} points, in metres (haversine).
 * Returns null if either point is missing a coordinate.
 */
export function haversineMeters(a, b) {
  if (a?.lat == null || a?.lng == null || b?.lat == null || b?.lng == null) return null
  const R = 6371000 // Earth radius (m)
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

/**
 * Human-friendly distance label.
 *
 * Pass the real distance in metres (e.g. from `haversineMeters`). When it's
 * null/unknown — e.g. the viewer hasn't shared their location — this says so
 * instead of inventing a number. Under 1 km shows metres, above that km.
 */
export function distanceLabel(metres) {
  if (metres == null || Number.isNaN(metres)) return 'jarak belum diketahui'
  if (metres < 15) return 'tepat di sekitarmu'
  if (metres < 1000) return `± ${Math.round(metres / 5) * 5} m dari kamu`
  return `± ${(metres / 1000).toFixed(1)} km dari kamu`
}

/**
 * Initial compass bearing (degrees, 0 = North, clockwise) from point a to b.
 * Returns null if either point lacks a coordinate.
 */
export function bearingDeg(a, b) {
  if (a?.lat == null || a?.lng == null || b?.lat == null || b?.lng == null) return null
  const toRad = (d) => (d * Math.PI) / 180
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const dLng = toRad(b.lng - a.lng)
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return (Math.atan2(y, x) * 180) / Math.PI // may be negative; compassLabel normalises
}

/**
 * Compass direction label from a bearing in degrees (0 = North, clockwise).
 * Returns e.g. "Utara", "Timur Laut", "Barat".
 */
export function compassLabel(deg) {
  if (deg == null || Number.isNaN(deg)) return ''
  const dirs = [
    'Utara',
    'Timur Laut',
    'Timur',
    'Tenggara',
    'Selatan',
    'Barat Daya',
    'Barat',
    'Barat Laut',
  ]
  const index = Math.round(((deg % 360) + 360) % 360 / 45) % 8
  return dirs[index]
}
