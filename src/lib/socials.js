/**
 * Social media networks shown on a profile.
 *
 * Each profile stores a handle per network (e.g. `profile.instagram`) plus a
 * visibility map `profile.social_visibility[network]` with one of:
 *   'public'  — anyone (incl. guests) can see & tap the link
 *   'mutual'  — only people you've mutualan with
 *   'off'     — hidden from everyone but you
 *
 * `baseUrl` turns a bare handle into a link; a full URL pasted by the user is
 * passed through untouched (handled in SocialLinks.vue).
 */
export const SOCIAL_NETWORKS = [
  {
    key: 'instagram',
    label: 'Instagram',
    baseUrl: 'https://instagram.com/',
    placeholder: 'username atau link',
    brandClass: 'bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400',
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    baseUrl: 'https://linkedin.com/in/',
    placeholder: 'nama-kamu atau link',
    brandClass: 'bg-[#0a66c2]',
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    // wa.me expects digits only; SocialLinks normalises 08.. -> 628..
    baseUrl: 'https://wa.me/',
    placeholder: '08xxx atau +62xxx',
    brandClass: 'bg-[#25d366]',
  },
  {
    key: 'line',
    label: 'LINE',
    baseUrl: 'https://line.me/ti/p/~',
    placeholder: 'LINE ID',
    brandClass: 'bg-[#06c755]',
  },
  {
    key: 'spotify',
    label: 'Spotify',
    baseUrl: 'https://open.spotify.com/user/',
    placeholder: 'user id atau link',
    brandClass: 'bg-[#1db954]',
  },
]

export const SOCIAL_VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Publik', hint: 'Siapa saja bisa lihat' },
  { value: 'mutual', label: 'Mutual aja', hint: 'Hanya yang sudah mutualan' },
  { value: 'off', label: 'Off', hint: 'Disembunyikan' },
]

export const DEFAULT_SOCIAL_VISIBILITY = 'public'

/** A fresh visibility map with every network defaulting to public. */
export function defaultSocialVisibility() {
  return SOCIAL_NETWORKS.reduce((acc, net) => {
    acc[net.key] = DEFAULT_SOCIAL_VISIBILITY
    return acc
  }, {})
}
