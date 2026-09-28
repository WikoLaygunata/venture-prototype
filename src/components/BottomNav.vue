<script setup>
/**
 * BottomNav — fixed tab bar pinned to the bottom of the mobile frame.
 * Three tabs: Explore/Map, Mutualan, Profile.
 *
 * It is `absolute` (not `fixed`) because it lives inside the phone frame in
 * App.vue; `fixed` would escape the frame and stick to the browser viewport.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Compass, Sparkles, UserRound } from 'lucide-vue-next'

const props = defineProps({
  /** Unread PING count rendered as a dot on the Mutualan tab. */
  badge: { type: Number, default: 0 },
})

const route = useRoute()

const tabs = computed(() => [
  { name: 'map', label: 'Explore', icon: Compass, to: { name: 'map' }, badge: 0 },
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
    class="absolute bottom-0 left-0 right-0 z-30 border-t border-slate-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg"
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
            class="absolute top-0 h-0.5 w-10 rounded-full bg-kenalan-500 transition-opacity"
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
