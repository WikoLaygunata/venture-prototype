<script setup>
/**
 * AppHeader — sticky screen header inside the phone frame.
 * Optional back button, title/subtitle, and an `actions` slot on the right.
 */
import { useRouter } from 'vue-router'
import { ChevronLeft } from 'lucide-vue-next'

const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  back: { type: Boolean, default: false },
  /** Where the back arrow goes when there is no history to pop. */
  fallbackTo: { type: [String, Object], default: () => ({ name: 'map' }) },
  transparent: { type: Boolean, default: false },
})

const router = useRouter()

function goBack() {
  if (window.history.state?.back) router.back()
  else router.replace(props.fallbackTo)
}
</script>

<template>
  <header
    class="z-20 flex shrink-0 items-center gap-3 px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-3"
    :class="transparent ? '' : 'border-b border-slate-100 bg-white/90 backdrop-blur-lg'"
  >
    <button
      v-if="back"
      type="button"
      class="-ml-2 rounded-full p-2 text-slate-500 transition hover:bg-slate-100 active:scale-95"
      aria-label="Kembali"
      @click="goBack"
    >
      <ChevronLeft class="h-5 w-5" aria-hidden="true" />
    </button>

    <div class="min-w-0 flex-1">
      <h1 class="truncate text-lg font-extrabold tracking-tight text-slate-800">
        {{ title }}
      </h1>
      <p v-if="subtitle" class="truncate text-xs text-slate-400">{{ subtitle }}</p>
    </div>

    <div class="flex shrink-0 items-center gap-1">
      <slot name="actions" />
    </div>
  </header>
</template>
