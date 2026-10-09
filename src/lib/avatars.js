/**
 * Avatar presets — a small gallery of ready-made avatars a user can pick when
 * they'd rather not upload a personal photo.
 *
 * Everything is a DiceBear SVG URL (no API key, cached by their CDN). Each entry
 * uses a fixed style + seed so the picked avatar is deterministic: the same
 * `avatar_url` always renders the same face. That URL is what we store on
 * `profiles.avatar_url`, so an avatar chosen here is indistinguishable from an
 * uploaded photo everywhere else in the app (UserAvatar just renders the URL).
 */

/** Soft pastel backgrounds shared by every preset so they feel like one set. */
const BG = 'ddd6fe,fce7f3,d1fae5,fef3c7,bfdbfe'

function dicebear(style, seed) {
  return (
    `https://api.dicebear.com/9.x/${style}/svg` +
    `?seed=${encodeURIComponent(seed)}` +
    `&backgroundColor=${BG}` +
    `&radius=50`
  )
}

/**
 * The curated gallery shown in the picker. Mixing a few DiceBear styles keeps
 * the choices visually distinct (illustrated people, bold characters, playful
 * blobs) instead of 12 near-identical faces.
 */
export const AVATAR_PRESETS = [
  { id: 'notionists-1', url: dicebear('notionists-neutral', 'Kenalan Mint') },
  { id: 'notionists-2', url: dicebear('notionists-neutral', 'Kenalan Coral') },
  { id: 'notionists-3', url: dicebear('notionists-neutral', 'Kenalan Sage') },
  { id: 'adventurer-1', url: dicebear('adventurer-neutral', 'Kenalan Nova') },
  { id: 'adventurer-2', url: dicebear('adventurer-neutral', 'Kenalan Pixel') },
  { id: 'adventurer-3', url: dicebear('adventurer-neutral', 'Kenalan Dawn') },
  { id: 'lorelei-1', url: dicebear('lorelei-neutral', 'Kenalan Bloom') },
  { id: 'lorelei-2', url: dicebear('lorelei-neutral', 'Kenalan Luna') },
  { id: 'bottts-1', url: dicebear('bottts-neutral', 'Kenalan Robo') },
  { id: 'bottts-2', url: dicebear('bottts-neutral', 'Kenalan Byte') },
  { id: 'fun-emoji-1', url: dicebear('fun-emoji', 'Kenalan Spark') },
  { id: 'fun-emoji-2', url: dicebear('fun-emoji', 'Kenalan Joy') },
]

/** The URLs only, handy for membership checks. */
export const AVATAR_PRESET_URLS = AVATAR_PRESETS.map((a) => a.url)

/** Is this avatar_url one of our presets (vs. an uploaded photo)? */
export function isPresetAvatar(url) {
  return AVATAR_PRESET_URLS.includes(url)
}

/**
 * A default avatar for a brand-new account. Deterministic per-user so two people
 * signing up don't collide: we hash the seed (name/username/email) into the
 * preset list, then everyone still lands on one of the curated faces.
 */
export function defaultAvatarFor(seed = '') {
  const key = String(seed)
  let hash = 0
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  }
  const index = key.length ? hash % AVATAR_PRESETS.length : 0
  return AVATAR_PRESETS[index].url
}

/** A random preset avatar — used by the "acak" shortcut in the picker. */
export function randomAvatar() {
  const index = Math.floor(Math.random() * AVATAR_PRESETS.length)
  return AVATAR_PRESETS[index].url
}
