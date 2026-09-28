/** Small time helpers shared by the stamp feed and ping inbox. */

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export const STAMP_LIFETIME_MS = DAY

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
