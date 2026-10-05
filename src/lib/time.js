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
 * Human-friendly distance label.
 *
 * The prototype has no real geolocation, so stamps carry a precomputed
 * `distance_m` (metres) and this formats it. Under 1 km shows metres, above
 * that shows one decimal of km.
 */
export function distanceLabel(metres) {
  if (metres == null || Number.isNaN(metres)) return 'di sekitar sini'
  if (metres < 15) return 'tepat di sekitarmu'
  if (metres < 1000) return `± ${Math.round(metres / 5) * 5} m dari kamu`
  return `± ${(metres / 1000).toFixed(1)} km dari kamu`
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
