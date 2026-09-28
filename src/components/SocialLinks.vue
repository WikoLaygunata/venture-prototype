<script setup>
/**
 * SocialLinks — button list for Instagram / LinkedIn / Spotify.
 *
 * Accepts either a bare handle ("rakaprtm") or a full URL and normalises it,
 * because the edit form lets people paste whatever they have.
 */
import { computed } from 'vue'
import { ExternalLink, Instagram, Linkedin } from 'lucide-vue-next'

const props = defineProps({
  profile: { type: Object, default: () => ({}) },
})

function toUrl(value, base) {
  if (!value) return null
  const raw = String(value).trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return raw
  return base + raw.replace(/^@/, '')
}

const links = computed(() =>
  [
    {
      key: 'instagram',
      label: 'Instagram',
      handle: props.profile.instagram,
      url: toUrl(props.profile.instagram, 'https://instagram.com/'),
      icon: Instagram,
      classes: 'bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400',
    },
    {
      key: 'linkedin',
      label: 'LinkedIn',
      handle: props.profile.linkedin,
      url: toUrl(props.profile.linkedin, 'https://linkedin.com/in/'),
      icon: Linkedin,
      classes: 'bg-[#0a66c2]',
    },
    {
      key: 'spotify',
      label: 'Spotify',
      handle: props.profile.spotify,
      url: toUrl(props.profile.spotify, 'https://open.spotify.com/user/'),
      icon: null, // Lucide has no Spotify glyph — inline SVG below
      classes: 'bg-[#1db954]',
    },
  ].filter((link) => Boolean(link.url)),
)
</script>

<template>
  <div v-if="links.length" class="space-y-2">
    <a
      v-for="link in links"
      :key="link.key"
      :href="link.url"
      target="_blank"
      rel="noopener noreferrer"
      class="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition hover:border-kenalan-200 hover:bg-kenalan-50/40 active:scale-[0.99]"
    >
      <span
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
        :class="link.classes"
        aria-hidden="true"
      >
        <component :is="link.icon" v-if="link.icon" class="h-4 w-4" />
        <!-- Spotify mark (Lucide ships no brand icon for it) -->
        <svg v-else viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4">
          <path
            d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.586 14.424a.75.75 0 0 1-1.03.253c-2.82-1.724-6.373-2.114-10.56-1.158a.75.75 0 1 1-.334-1.462c4.578-1.046 8.503-.6 11.67 1.336a.75.75 0 0 1 .254 1.03Zm1.223-2.722a.937.937 0 0 1-1.288.309c-3.23-1.986-8.152-2.56-11.973-1.4a.937.937 0 1 1-.544-1.794c4.363-1.324 9.786-.683 13.495 1.597a.937.937 0 0 1 .31 1.288Zm.105-2.835c-3.873-2.3-10.26-2.512-13.958-1.39a1.125 1.125 0 1 1-.653-2.152c4.244-1.288 11.297-1.039 15.757 1.608a1.125 1.125 0 0 1-1.146 1.934Z"
          />
        </svg>
      </span>

      <span class="min-w-0 flex-1">
        <span class="block text-sm font-bold text-slate-700">{{ link.label }}</span>
        <span class="block truncate text-[11px] text-slate-400">{{ link.handle }}</span>
      </span>

      <ExternalLink class="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
    </a>
  </div>

  <p v-else class="rounded-2xl bg-slate-50 p-4 text-center text-xs text-slate-400">
    Belum ada link sosial media yang ditambahkan.
  </p>
</template>
