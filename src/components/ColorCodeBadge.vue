<script setup>
/**
 * ColorCodeBadge — the Mint / Yellow / Grey / Red status indicator.
 *
 * Two shapes:
 *   size="sm"  -> compact pill for cards and lists
 *   size="md"  -> full pill with the status description (profile header)
 *
 * Pass `interactive` to render it as a button (used on your own profile to open
 * the status picker).
 */
import { computed } from 'vue'
import { getColorCode } from '@/lib/colorCodes'

const props = defineProps({
  code: { type: String, default: 'mint' },
  size: { type: String, default: 'md' }, // 'sm' | 'md'
  showDescription: { type: Boolean, default: false },
  interactive: { type: Boolean, default: false },
  /** Adds a soft pulsing halo — used for "Looking for Connection". */
  pulse: { type: Boolean, default: false },
})

defineEmits(['click'])

const status = computed(() => getColorCode(props.code))
const isSmall = computed(() => props.size === 'sm')
</script>

<template>
  <component
    :is="interactive ? 'button' : 'div'"
    :type="interactive ? 'button' : undefined"
    :aria-label="
      interactive
        ? `Status saat ini: ${status.label} — ${status.title}. Ketuk untuk mengubah.`
        : `Status: ${status.label} — ${status.title}`
    "
    class="inline-flex max-w-full items-center gap-2 rounded-full border font-semibold transition"
    :class="[
      status.bg,
      status.border,
      status.text,
      isSmall ? 'px-2.5 py-1 text-[8px]' : 'px-3 py-1.5 text-[10px]',
      interactive ? 'active:scale-[0.97] hover:brightness-[0.98] cursor-pointer' : '',
    ]"
    @click="interactive && $emit('click')"
  >
    <span class="relative flex shrink-0 items-center justify-center">
      <span
        v-if="pulse"
        class="absolute inline-flex rounded-full animate-pulse-ring"
        :class="[status.dot, isSmall ? 'h-2 w-2' : 'h-2.5 w-2.5']"
        aria-hidden="true"
      />
      <span
        class="relative inline-block rounded-full ring-2 ring-white/70"
        :class="[status.dot, isSmall ? 'h-2 w-2' : 'h-2.5 w-2.5']"
        aria-hidden="true"
      />
    </span>

    <span class="truncate">{{ status.title }}</span>

    <span
      v-if="showDescription && !isSmall"
      class="hidden font-normal opacity-70 sm:inline"
    >
      · {{ status.label }}
    </span>

    <svg
      v-if="interactive"
      class="ml-0.5 h-3 w-3 shrink-0 opacity-60"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  </component>
</template>
