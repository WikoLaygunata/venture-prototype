<script setup>
/**
 * SocialLinks — button list for a profile's social media.
 *
 * Each network has a per-profile visibility (`public` / `mutual` / `off`) stored
 * in `profile.social_visibility`. This component decides what the current viewer
 * is allowed to see:
 *   - the owner (`isSelf`) always sees everything, with a visibility tag
 *   - a mutual sees `public` + `mutual`
 *   - anyone else (incl. guests) sees only `public`
 *
 * Handles may be a bare username or a full URL; WhatsApp numbers are normalised
 * to wa.me's digit format.
 */
import { computed } from 'vue'
import { ExternalLink, Instagram, Linkedin, MessageCircle, Phone } from 'lucide-vue-next'
import { SOCIAL_NETWORKS } from '@/lib/socials'

const props = defineProps({
  profile: { type: Object, default: () => ({}) },
  /** Viewer is this profile's owner — sees all networks + visibility tags. */
  isSelf: { type: Boolean, default: false },
  /** Viewer has mutualan with this profile. */
  isMutual: { type: Boolean, default: false },
})

const ICONS = { instagram: Instagram, linkedin: Linkedin, whatsapp: Phone, line: MessageCircle }

function toUrl(key, value, base) {
  if (!value) return null
  const raw = String(value).trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return raw

  if (key === 'whatsapp') {
    // Keep digits only; convert a leading 0 to Indonesia's 62 country code.
    let digits = raw.replace(/[^\d]/g, '')
    if (digits.startsWith('0')) digits = `62${digits.slice(1)}`
    return digits ? base + digits : null
  }

  return base + raw.replace(/^@/, '')
}

/** Can the current viewer see a network with this visibility setting? */
function canView(visibility) {
  const v = visibility ?? 'public'
  if (props.isSelf) return true
  if (v === 'off') return false
  if (v === 'mutual') return props.isMutual
  return true // public
}

const VIS_TAG = {
  public: { label: 'Publik', class: 'bg-slate-100 text-slate-500' },
  mutual: { label: 'Mutual aja', class: 'bg-kenalan-50 text-kenalan-600' },
  off: { label: 'Off', class: 'bg-slate-100 text-slate-400' },
}

const links = computed(() =>
  SOCIAL_NETWORKS.map((net) => {
    const visibility = props.profile.social_visibility?.[net.key] ?? 'public'
    return {
      key: net.key,
      label: net.label,
      handle: props.profile[net.key],
      url: toUrl(net.key, props.profile[net.key], net.baseUrl),
      icon: ICONS[net.key] ?? null,
      classes: net.brandClass,
      visibility,
      visible: canView(visibility),
    }
  }).filter((link) => Boolean(link.url) && link.visible),
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
        <span class="flex items-center gap-1.5">
          <span class="text-sm font-bold text-slate-700">{{ link.label }}</span>
          <!-- show the owner how each link is gated -->
          <span
            v-if="isSelf && link.visibility !== 'public'"
            class="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
            :class="VIS_TAG[link.visibility].class"
          >
            {{ VIS_TAG[link.visibility].label }}
          </span>
        </span>
        <span class="block truncate text-[11px] text-slate-400">{{ link.handle }}</span>
      </span>

      <ExternalLink class="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
    </a>

    <p v-if="!isSelf && isMutual" class="px-1 text-[10px] text-slate-300">
      Beberapa kontak hanya terlihat karena kalian sudah mutualan.
    </p>
  </div>

  <p v-else class="rounded-2xl bg-slate-50 p-4 text-center text-xs text-slate-400">
    {{ isSelf ? 'Belum ada link sosial media yang ditambahkan.' : 'Belum ada kontak yang bisa ditampilkan.' }}
  </p>
</template>
