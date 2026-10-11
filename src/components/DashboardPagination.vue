<script setup>
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

const props = defineProps({
  page: { type: Number, required: true },
  total: { type: Number, required: true },
  pageSize: { type: Number, required: true },
  loading: { type: Boolean, default: false },
})
const emit = defineEmits(['update:page'])

const pageCount = computed(() => Math.ceil(props.total / props.pageSize))
const pages = computed(() => {
  const count = pageCount.value
  if (count <= 7) return Array.from({ length: count }, (_, index) => index + 1)
  const first = Math.max(1, Math.min(props.page - 3, count - 6))
  return Array.from({ length: 7 }, (_, index) => first + index)
})
const start = computed(() => (props.total ? (props.page - 1) * props.pageSize + 1 : 0))
const end = computed(() => Math.min(props.page * props.pageSize, props.total))

function goTo(page) {
  if (props.loading || page < 1 || page > pageCount.value || page === props.page) return
  emit('update:page', page)
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
    <span class="text-[11px] text-slate-400">Menampilkan {{ start }}–{{ end }} dari {{ total }}</span>
    <nav v-if="pageCount > 1" class="flex items-center gap-1" aria-label="Navigasi halaman">
      <button
        type="button"
        class="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30"
        :disabled="page <= 1 || loading"
        aria-label="Halaman sebelumnya"
        @click="goTo(page - 1)"
      ><ChevronLeft :size="16" /></button>
      <button
        v-for="number in pages"
        :key="number"
        type="button"
        class="grid h-8 min-w-8 place-items-center rounded-lg border px-2 text-[11px] font-bold disabled:opacity-50"
        :class="number === page ? 'border-kenalan-500 bg-kenalan-500 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'"
        :aria-label="`Halaman ${number}`"
        :aria-current="number === page ? 'page' : undefined"
        :disabled="loading"
        @click="goTo(number)"
      >{{ number }}</button>
      <button
        type="button"
        class="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30"
        :disabled="page >= pageCount || loading"
        aria-label="Halaman selanjutnya"
        @click="goTo(page + 1)"
      ><ChevronRight :size="16" /></button>
    </nav>
  </div>
</template>
