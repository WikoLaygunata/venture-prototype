/**
 * The four Kenalan "Color Codes" — a physical/social signal shown on the lanyard
 * and mirrored in the app so people know how approachable you are right now.
 *
 * Keys are stored in `profiles.color_code`.
 */
export const COLOR_CODES = {
  mint: {
    key: 'mint',
    emoji: '🟢',
    label: 'Mint',
    title: 'Open to Chat',
    description: 'Sapa aku! Aku lagi santai dan terbuka buat ngobrol.',
    dot: 'bg-mint',
    ring: 'ring-mint/40',
    text: 'text-mint-deep',
    bg: 'bg-mint-soft',
    border: 'border-mint/40',
    gradient: 'from-emerald-300 to-teal-400',
  },
  yellow: {
    key: 'yellow',
    emoji: '🟡',
    label: 'Yellow',
    title: 'Focus Mode',
    description: 'Lagi fokus ngerjain sesuatu. Sapa singkat aja ya.',
    dot: 'bg-sunny',
    ring: 'ring-sunny/40',
    text: 'text-sunny-deep',
    bg: 'bg-sunny-soft',
    border: 'border-sunny/40',
    gradient: 'from-amber-300 to-orange-400',
  },
  grey: {
    key: 'grey',
    emoji: '🔘',
    label: 'Grey',
    title: 'Do Not Disturb',
    description: 'Sedang butuh waktu sendiri. Nanti aku balik lagi.',
    dot: 'bg-smoke',
    ring: 'ring-smoke/40',
    text: 'text-smoke-deep',
    bg: 'bg-smoke-soft',
    border: 'border-smoke/40',
    gradient: 'from-slate-300 to-slate-400',
  },
  red: {
    key: 'red',
    emoji: '🔴',
    label: 'Red',
    title: 'Looking for Connection',
    description: 'Aktif nyari kenalan baru — jangan ragu kirim PING!',
    dot: 'bg-blush',
    ring: 'ring-blush/40',
    text: 'text-blush-deep',
    bg: 'bg-blush-soft',
    border: 'border-blush/40',
    gradient: 'from-rose-300 to-pink-400',
  },
}

/** Stable order used by pickers and legends. */
export const COLOR_CODE_LIST = [
  COLOR_CODES.mint,
  COLOR_CODES.yellow,
  COLOR_CODES.grey,
  COLOR_CODES.red,
]

export const DEFAULT_COLOR_CODE = 'mint'

/** Safe lookup — always returns a valid config, falling back to Mint. */
export function getColorCode(key) {
  return COLOR_CODES[key] ?? COLOR_CODES[DEFAULT_COLOR_CODE]
}
