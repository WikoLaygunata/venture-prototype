<script setup>
/**
 * StateBlock — one component for the three boring-but-necessary states:
 * loading, error (with retry) and empty.
 */
import { CircleAlert, LoaderCircle, RefreshCw } from 'lucide-vue-next'

defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  /** Show the empty slot when true and not loading/errored. */
  empty: { type: Boolean, default: false },
  loadingText: { type: String, default: 'Memuat…' },
  emptyIcon: { type: String, default: '🫥' },
  emptyTitle: { type: String, default: 'Belum ada apa-apa di sini' },
  emptyText: { type: String, default: '' },
  retryable: { type: Boolean, default: true },
})

defineEmits(['retry'])
</script>

<template>
  <div v-if="loading" class="flex flex-col items-center justify-center gap-3 py-12 text-slate-400">
    <LoaderCircle class="h-6 w-6 animate-spin" aria-hidden="true" />
    <p class="text-xs font-medium">{{ loadingText }}</p>
  </div>

  <div
    v-else-if="error"
    role="alert"
    class="flex flex-col items-center gap-3 rounded-3xl border border-blush/30 bg-blush-soft px-5 py-8 text-center"
  >
    <CircleAlert class="h-6 w-6 text-blush-deep" aria-hidden="true" />
    <p class="text-sm font-semibold text-blush-deep">{{ error }}</p>
    <button v-if="retryable" type="button" class="btn-ghost !py-2 !text-xs" @click="$emit('retry')">
      <RefreshCw class="h-3.5 w-3.5" aria-hidden="true" />
      Coba lagi
    </button>
  </div>

  <div v-else-if="empty" class="flex flex-col items-center gap-2 px-6 py-12 text-center">
    <span class="text-4xl" aria-hidden="true">{{ emptyIcon }}</span>
    <p class="text-sm font-bold text-slate-600">{{ emptyTitle }}</p>
    <p v-if="emptyText" class="max-w-[16rem] text-xs leading-relaxed text-slate-400">
      {{ emptyText }}
    </p>
    <slot name="action" />
  </div>

  <slot v-else />
</template>
