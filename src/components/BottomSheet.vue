<script setup>
/**
 * BottomSheet — the modal pattern used for the stamp form, PING composer and
 * color-code picker.
 *
 * Deliberately positioned `absolute inset-0` rather than `fixed`: it must be
 * clipped by the phone frame in App.vue instead of covering the whole browser
 * window. Mount it as a direct child of a `relative` screen root, outside the
 * scrolling area.
 */
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  /** Blocks dismissing while a request is in flight. */
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])

const panel = ref(null)

function close() {
  if (!props.busy) emit('close')
}

function onKeydown(event) {
  if (event.key === 'Escape') close()
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      window.addEventListener('keydown', onKeydown)
      await nextTick()
      // Move focus into the sheet so keyboard users land in the right place.
      panel.value?.querySelector('[data-autofocus]')?.focus()
    } else {
      window.removeEventListener('keydown', onKeydown)
    }
  },
)

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div v-if="open" class="absolute inset-0 z-40 flex flex-col justify-end">
    <div
      class="absolute inset-0 bg-slate-900/45 animate-fade-in"
      @click="close"
      aria-hidden="true"
    />

    <section
      ref="panel"
      role="dialog"
      aria-modal="true"
      :aria-label="title || 'Dialog'"
      class="relative max-h-[88%] overflow-y-auto no-scrollbar rounded-t-4xl bg-white px-5 pb-6 pt-3 shadow-2xl animate-sheet-up"
    >
      <div class="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" aria-hidden="true" />

      <header v-if="title" class="mb-4 flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="text-lg font-extrabold tracking-tight text-slate-800">{{ title }}</h2>
          <p v-if="subtitle" class="mt-0.5 text-xs text-slate-500">{{ subtitle }}</p>
        </div>
        <button
          type="button"
          class="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
          :disabled="busy"
          aria-label="Tutup"
          @click="close"
        >
          <X class="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <slot />
    </section>
  </div>
</template>
