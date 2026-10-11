<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Clock3, LoaderCircle, MapPin, MessageCircle, MessageSquareText, RefreshCw, X } from 'lucide-vue-next'
import { fetchDashboardStampThread, fetchDashboardStamps } from '@/lib/dashboardApi'
import { timeAgo } from '@/lib/time'
import DashboardPagination from '@/components/DashboardPagination.vue'
import StampMap from '@/components/StampMap.vue'

const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 10
const loading = ref(false)
const errorMessage = ref('')
const selectedStamp = ref(null)
const thread = ref(null)
const threadLoading = ref(false)
const threadError = ref('')
const threadMapStamps = computed(() =>
  thread.value?.lat != null && thread.value?.lng != null
    ? [{ ...thread.value, profile: thread.value.author }]
    : [],
)

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await fetchDashboardStamps({ page: page.value, pageSize })
    rows.value = result.rows
    total.value = result.total
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    loading.value = false
  }
}

watch(page, load)
onMounted(load)

function isActive(stamp) {
  return stamp.expires_at
    ? new Date(stamp.expires_at).getTime() > Date.now()
    : new Date(stamp.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000
}

async function showThread(stamp) {
  selectedStamp.value = stamp
  thread.value = null
  threadError.value = ''
  threadLoading.value = true
  try {
    thread.value = await fetchDashboardStampThread(stamp.id)
    if (!thread.value) threadError.value = 'Stamp tidak ditemukan.'
  } catch (error) {
    threadError.value = error.message
  } finally {
    threadLoading.value = false
  }
}
</script>

<template>
  <div>
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-xs font-semibold text-slate-400">Aktivitas komunitas</p>
        <h1 class="mt-1 text-[26px] font-extrabold tracking-tight text-slate-900">Location Stamps</h1>
        <p class="mt-2 text-sm text-slate-500">Lihat postingan stamp tanpa mengekspos lokasi presisi.</p>
      </div>
      <button class="btn-ghost !rounded-xl !px-3 !py-2.5 text-xs" :disabled="loading" @click="load"><RefreshCw :size="14" :class="{ 'animate-spin': loading }" /> Muat ulang</button>
    </div>

    <div v-if="errorMessage" class="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-700" role="alert">{{ errorMessage }}</div>
    <section class="overflow-hidden rounded-[22px] border border-slate-100 bg-white">
      <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div><h2 class="text-sm font-extrabold text-slate-800">Semua stamp</h2><p class="mt-1 text-[11px] text-slate-400">{{ total }} postingan</p></div>
        <span class="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-600"><MapPin :size="17" /></span>
      </div>
      <div v-if="loading" class="space-y-3 p-5">
        <div v-for="item in 5" :key="item" class="h-20 animate-pulse rounded-2xl bg-slate-50" />
      </div>
      <div v-else-if="!rows.length" class="px-5 py-16 text-center">
        <MapPin :size="25" class="mx-auto text-slate-300" /><p class="mt-3 text-sm font-bold text-slate-600">Belum ada stamp</p>
      </div>
      <div v-else class="divide-y divide-slate-50">
        <article v-for="stamp in rows" :key="stamp.id" class="flex gap-4 px-5 py-5 sm:px-6">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-kenalan-50 text-kenalan-700"><MessageSquareText :size="18" /></span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <RouterLink v-if="stamp.author" :to="`/dashboard/users/${stamp.user_id}`" class="text-xs font-bold text-slate-800 hover:text-kenalan-700">{{ stamp.author.full_name || stamp.author.username }}</RouterLink>
              <span v-else class="text-xs font-bold text-slate-800">Pengguna</span>
              <span class="text-[10px] text-slate-400">@{{ stamp.author?.username || 'unknown' }}</span>
              <span class="rounded-full px-2 py-0.5 text-[9px] font-bold" :class="isActive(stamp) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">{{ isActive(stamp) ? 'Aktif' : 'Kedaluwarsa' }}</span>
            </div>
            <p class="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">{{ stamp.message }}</p>
            <div class="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
              <span class="inline-flex items-center gap-1"><Clock3 :size="12" /> {{ timeAgo(stamp.created_at) }}</span>
              <button type="button" class="inline-flex items-center gap-1 rounded-lg bg-kenalan-50 px-2.5 py-1.5 text-[10px] font-bold text-kenalan-700 hover:bg-kenalan-100" @click="showThread(stamp)">
                <MessageCircle :size="13" /> Lihat detail
              </button>
            </div>
          </div>
        </article>
      </div>
      <DashboardPagination v-model:page="page" :total="total" :page-size="pageSize" :loading="loading" />
    </section>

    <div v-if="selectedStamp" class="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" @click.self="selectedStamp = null">
      <section class="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header class="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 class="text-base font-extrabold text-slate-900">Thread Location Stamp</h2>
            <p class="mt-1 text-[11px] text-slate-400">{{ selectedStamp.author?.full_name || selectedStamp.author?.username || 'Pengguna' }} · {{ timeAgo(selectedStamp.created_at) }}</p>
          </div>
          <button type="button" class="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Tutup detail" @click="selectedStamp = null"><X :size="18" /></button>
        </header>
        <div class="min-h-0 overflow-y-auto px-5 py-5">
          <div v-if="threadLoading" class="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
            <LoaderCircle :size="18" class="animate-spin" /> Memuat thread…
          </div>
          <p v-else-if="threadError" class="rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700" role="alert">{{ threadError }}</p>
          <template v-else-if="thread">
            <div class="rounded-2xl bg-slate-50 p-4">
              <p class="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{{ thread.message }}</p>
              <p v-if="thread.location_label" class="mt-3 text-[11px] font-semibold text-slate-500">{{ thread.location_label }}</p>
              <img v-if="thread.image_url" :src="thread.image_url" alt="Lampiran stamp" class="mt-4 max-h-80 w-full rounded-xl object-cover">
            </div>
            <div class="mt-4">
              <h3 class="mb-2 text-xs font-extrabold text-slate-800">Lokasi di peta</h3>
              <div v-if="threadMapStamps.length" class="relative h-64 overflow-hidden rounded-2xl border border-slate-200">
                <StampMap :stamps="threadMapStamps" readonly />
              </div>
              <p v-else class="rounded-2xl bg-slate-50 px-4 py-8 text-center text-xs text-slate-400">Stamp ini tidak memiliki koordinat untuk ditampilkan.</p>
              <p v-if="threadMapStamps.length" class="mt-2 text-[10px] leading-relaxed text-slate-400">
                Titik memakai koordinat perkiraan yang disimpan untuk stamp, bukan lokasi presisi perangkat.
              </p>
            </div>
            <div class="mt-5">
              <h3 class="flex items-center gap-2 text-xs font-extrabold text-slate-800">
                <MessageSquareText :size="15" /> Balasan ({{ thread.replies?.length ?? 0 }})
              </h3>
              <p v-if="!thread.replies?.length" class="py-8 text-center text-xs text-slate-400">Belum ada balasan.</p>
              <ol v-else class="mt-3 space-y-3">
                <li v-for="reply in thread.replies" :key="reply.id" class="rounded-2xl border border-slate-100 p-3.5">
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-[11px] font-bold text-slate-700">{{ reply.author?.full_name || reply.author?.username || 'Pengguna' }}<span v-if="reply.author?.username" class="ml-1 font-normal text-slate-400">@{{ reply.author.username }}</span></span>
                    <time class="shrink-0 text-[10px] text-slate-400">{{ timeAgo(reply.created_at) }}</time>
                  </div>
                  <p class="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">{{ reply.message }}</p>
                </li>
              </ol>
            </div>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>
