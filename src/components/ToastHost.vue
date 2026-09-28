<script setup>
/**
 * ToastHost — rendered once in App.vue, inside the phone frame so toasts float
 * over the mobile UI instead of the browser window.
 */
import { CircleAlert, CircleCheck, Info } from 'lucide-vue-next'
import { toasts, dismiss } from '@/stores/toast'

const TONES = {
  success: { icon: CircleCheck, classes: 'bg-mint-soft text-mint-deep border-mint/40' },
  error: { icon: CircleAlert, classes: 'bg-blush-soft text-blush-deep border-blush/40' },
  info: { icon: Info, classes: 'bg-kenalan-50 text-kenalan-700 border-kenalan-200' },
}
</script>

<template>
  <div
    class="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 flex flex-col items-center gap-2 px-4"
    role="status"
    aria-live="polite"
  >
    <button
      v-for="item in toasts"
      :key="item.id"
      type="button"
      class="pointer-events-auto flex w-full items-center gap-2.5 rounded-2xl border px-4 py-3 text-left text-[13px] font-semibold shadow-lg backdrop-blur animate-slide-up"
      :class="(TONES[item.tone] ?? TONES.info).classes"
      @click="dismiss(item.id)"
    >
      <component
        :is="(TONES[item.tone] ?? TONES.info).icon"
        class="h-4 w-4 shrink-0"
        aria-hidden="true"
      />
      <span class="flex-1">{{ item.message }}</span>
    </button>
  </div>
</template>
