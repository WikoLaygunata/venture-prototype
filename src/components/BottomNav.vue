<script setup>
/**
 * BottomNav — the tab bar pinned to the bottom of the mobile frame.
 * Four tabs: Map, Explore, Mutualan, Profile.
 *
 * Rendered as a flex sibling (shrink-0) of the scrolling area in App.vue, so it
 * reserves its own space and the feed never slides underneath it — the header
 * and this bar stay put while only the content between them scrolls.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Compass, MapPin, Sparkles, UserRound } from 'lucide-vue-next'

const props = defineProps({
  /** Unread PING count rendered as a dot on the Mutualan tab. */
  badge: { type: Number, default: 0 },
})

const route = useRoute()

const tabs = computed(() => [
  { name: 'map', label: 'Map', icon: MapPin, to: { name: 'map' }, badge: 0 },
  { name: 'explore', label: 'Explore', icon: Compass, to: { name: 'explore' }, badge: 0 },
  { name: 'mutualan', label: 'Mutualan', icon: Sparkles, to: { name: 'mutualan' }, badge: props.badge },
  { name: 'profile', label: 'Profile', icon: UserRound, to: { name: 'profile' }, badge: 0 },
])

/** `/profile/edit` should keep the Profile tab lit. */
function isActive(tab) {
  if (tab.name === 'profile') return route.path.startsWith('/profile')
  return route.name === tab.name
}
</script>

<template>
  <nav
    class="z-30 shrink-0 border-t border-slate-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg"
    aria-label="Navigasi utama"
  >
    <ul class="flex items-stretch">
      <li v-for="tab in tabs" :key="tab.name" class="flex-1">
        <RouterLink
          :to="tab.to"
          class="group relative flex flex-col items-center gap-1 py-2.5 transition"
          :class="isActive(tab) ? 'text-kenalan-600' : 'text-slate-400 hover:text-slate-600'"
          :aria-current="isActive(tab) ? 'page' : undefined"
        >
          <span
            class="absolute top-0 h-0.5 w-9 rounded-full bg-kenalan-500 transition-opacity"
            :class="isActive(tab) ? 'opacity-100' : 'opacity-0'"
            aria-hidden="true"
          />

          <span class="relative">
            <component
              :is="tab.icon"
              class="h-[22px] w-[22px] transition-transform"
              :class="isActive(tab) ? 'scale-110' : 'group-active:scale-95'"
              :stroke-width="isActive(tab) ? 2.4 : 2"
              aria-hidden="true"
            />
            <span
              v-if="tab.badge > 0"
              class="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blush px-1 text-[10px] font-bold text-white"
            >
              {{ tab.badge > 9 ? '9+' : tab.badge }}
              <span class="sr-only">PING belum dibaca</span>
            </span>
          </span>

          <span class="text-[11px] font-semibold tracking-tight">{{ tab.label }}</span>
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
