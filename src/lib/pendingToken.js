/**
 * Legacy deferred keychain claims.
 *
 * Older builds created the account before claiming its keychain and persisted
 * the token until first login. New signup requests atomically claim the token
 * from the auth.users trigger; this helper remains only to finish old pending
 * claims already stored in a browser.
 *
 * Only the token string is stored, never credentials.
 */
import { claimNfcToken } from './api'

const KEY = 'kenalan.pendingToken'

export function setPendingToken(token) {
  if (typeof localStorage === 'undefined' || !token) return
  try {
    localStorage.setItem(KEY, String(token).trim().toUpperCase())
  } catch {
    /* storage blocked — the user can re-scan the tag instead */
  }
}

export function getPendingToken() {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function clearPendingToken() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing we can do */
  }
}

/**
 * Attempts the deferred claim. Always clears the stored token afterwards so a
 * tag that somebody else already claimed cannot cause a retry loop.
 *
 * @returns {Promise<{token:string, ok:boolean, error?:string}|null>}
 *          null when there was nothing pending.
 */
export async function claimPendingToken() {
  const token = getPendingToken()
  if (!token) return null

  try {
    await claimNfcToken(token)
    clearPendingToken()
    return { token, ok: true }
  } catch (error) {
    clearPendingToken()
    return { token, ok: false, error: error.message }
  }
}
