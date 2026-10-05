<script setup>
/**
 * App.vue — the phone frame.
 *
 * Everything lives inside a fixed max-width column centred on a dark backdrop.
 * The frame is the positioning context for BottomNav, ToastHost and every
 * BottomSheet, so those use `absolute` and stay clipped inside the "device".
 * Scrolling happens in each view's `.screen-scroll` element, never on <body>.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import BottomNav from '@/components/BottomNav.vue'
import ToastHost from '@/components/ToastHost.vue'

import { fetchIncomingPings } from '@/lib/api'
import { currentUserId } from '@/stores/auth'

const route = useRoute()

const showNav = computed(() => !route.meta.hideNav && Boolean(currentUserId.value))

/* Pending PING count for the Mutualan tab badge. */
const pendingPings = ref(0)

async function refreshBadge() {
  if (!currentUserId.value) {
    pendingPings.value = 0
    return
  }
  try {
    const pings = await fetchIncomingPings(currentUserId.value)
    pendingPings.value = pings.filter((p) => p.status === 'pending').length
  } catch {
    pendingPings.value = 0
  }
}

onMounted(refreshBadge)
watch(currentUserId, refreshBadge)
// Re-check when navigating, so accepting a PING updates the badge.
watch(() => route.fullPath, refreshBadge)
</script>

<template>
  <div class="h-[100dvh] bg-slate-900 flex justify-center items-center p-0 sm:p-4 overflow-hidden">
    <div
      class="w-full max-w-md bg-white h-[100dvh] sm:h-[844px] sm:max-h-[100dvh] sm:rounded-[40px] shadow-2xl relative flex flex-col overflow-hidden border-0 sm:border-4 border-slate-800"
    >
      <ToastHost />

      <!--
        The frame is a fixed-height flex column. Each view renders its own
        AppHeader (pinned top) and BottomNav sits here (pinned bottom); only the
        view's `.screen-scroll` region scrolls between them, so header + nav
        stay put like a native app.
      -->
      <RouterView v-slot="{ Component }">
        <!-- key forces a clean remount between /profile and /user/:id -->
        <component :is="Component" :key="route.fullPath" class="flex-1 min-h-0" />
      </RouterView>

      <BottomNav v-if="showNav" :badge="pendingPings" />
    </div>
  </div>
</template>
