<script setup>
/**
 * App.vue — the mobile app frame and standalone admin dashboard shell.
 *
 * Member views live inside a fixed max-width column centred on a dark backdrop;
 * dashboard routes use the full viewport instead.
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

const isDashboardRoute = computed(() => route.path.startsWith('/dashboard'))
const showNav = computed(
  () => !isDashboardRoute.value && !route.meta.hideNav && Boolean(currentUserId.value),
)

/* Pending PING count for the Mutualan tab badge. */
const pendingPings = ref(0)

async function refreshBadge() {
  if (isDashboardRoute.value || !currentUserId.value) {
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
  <div
    class="overflow-hidden"
    :class="isDashboardRoute
      ? 'h-[100dvh] bg-[#f5f7f8]'
      : 'flex h-[100dvh] items-center justify-center bg-slate-900 p-0 sm:p-4'"
  >
    <div
      v-if="isDashboardRoute"
      class="h-full w-full"
    >
      <RouterView v-slot="{ Component }">
        <component :is="Component" :key="route.fullPath" />
      </RouterView>
    </div>

    <div
      v-else
      class="relative flex h-[100dvh] w-full max-w-md flex-col overflow-hidden border-0 bg-white shadow-2xl sm:h-[844px] sm:max-h-[100dvh] sm:max-w-[22rem] sm:rounded-[40px] sm:border-4 sm:border-slate-800"
    >
      <ToastHost />

      <!-- Views own their scroll regions; the app header and bottom nav stay pinned. -->
      <RouterView v-slot="{ Component }">
        <component :is="Component" :key="route.fullPath" class="min-h-0 flex-1" />
      </RouterView>

      <BottomNav v-if="showNav" :badge="pendingPings" />
    </div>
  </div>
</template>
