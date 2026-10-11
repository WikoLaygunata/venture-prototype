<script setup>
import { onMounted, ref, watch } from 'vue'
import { Check, CircleOff, FileWarning, RefreshCw, ShieldCheck } from 'lucide-vue-next'
import { fetchDashboardReports, updateDashboardReportStatus } from '@/lib/dashboardApi'
import { shortDate, timeAgo } from '@/lib/time'
import DashboardPagination from '@/components/DashboardPagination.vue'

const statusFilter = ref('pending')
const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 10
const loading = ref(false)
const updatingId = ref('')
const errorMessage = ref('')
const successMessage = ref('')

const filters = [
  { id: 'pending', label: 'Menunggu' },
  { id: 'resolved', label: 'Selesai' },
  { id: 'dismissed', label: 'Ditutup' },
  { id: 'all', label: 'Semua' },
]

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await fetchDashboardReports({ status: statusFilter.value, page: page.value, pageSize })
    rows.value = result.rows
    total.value = result.total
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    loading.value = false
  }
}

async function updateStatus(report, status) {
  updatingId.value = report.id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await updateDashboardReportStatus(report.id, status)
    successMessage.value = status === 'resolved' ? 'Laporan ditandai selesai.' : 'Laporan ditutup.'
    await load()
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    updatingId.value = ''
  }
}

watch(statusFilter, () => {
  page.value = 1
  load()
})
watch(page, load)
onMounted(load)
</script>

<template>
  <div>
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-xs font-semibold text-slate-400">Keamanan komunitas</p>
        <h1 class="mt-1 text-[26px] font-extrabold tracking-tight text-slate-900">Laporan</h1>
        <p class="mt-2 text-sm text-slate-500">Tinjau laporan pengguna dan catat hasil penanganannya.</p>
      </div>
      <button class="btn-ghost !rounded-xl !px-3 !py-2.5 text-xs" :disabled="loading" @click="load"><RefreshCw :size="14" :class="{ 'animate-spin': loading }" /> Muat ulang</button>
    </div>

    <div v-if="errorMessage" class="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-700" role="alert">{{ errorMessage }}</div>
    <div v-if="successMessage" class="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-700" role="status">{{ successMessage }}</div>

    <section class="overflow-hidden rounded-[22px] border border-slate-100 bg-white">
      <div class="flex flex-col justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center">
        <div><h2 class="text-sm font-extrabold text-slate-800">Antrean moderasi</h2><p class="mt-1 text-[11px] text-slate-400">{{ total }} laporan</p></div>
        <div class="flex flex-wrap gap-1 rounded-xl bg-slate-50 p-1">
          <button v-for="filter in filters" :key="filter.id" class="rounded-lg px-3 py-2 text-[10px] font-bold transition" :class="statusFilter === filter.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'" @click="statusFilter = filter.id">{{ filter.label }}</button>
        </div>
      </div>

      <div v-if="loading" class="space-y-3 p-5">
        <div v-for="item in 4" :key="item" class="h-28 animate-pulse rounded-2xl bg-slate-50" />
      </div>
      <div v-else-if="!rows.length" class="px-5 py-16 text-center">
        <ShieldCheck :size="26" class="mx-auto text-emerald-500" /><p class="mt-3 text-sm font-bold text-slate-700">Antrean kosong</p><p class="mt-1 text-xs text-slate-400">Tidak ada laporan di kategori ini.</p>
      </div>
      <div v-else class="divide-y divide-slate-100">
        <article v-for="report in rows" :key="report.id" class="px-5 py-5 sm:px-6">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="flex min-w-0 flex-1 gap-3">
              <span class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl" :class="report.status === 'pending' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'"><FileWarning :size="18" /></span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-xs font-extrabold text-slate-800">{{ report.report_type === 'stamp' ? 'Location Stamp' : 'Pengguna' }}</span>
                  <span class="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase" :class="report.status === 'pending' ? 'bg-amber-50 text-amber-700' : report.status === 'resolved' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">{{ report.status === 'pending' ? 'Menunggu' : report.status === 'resolved' ? 'Selesai' : 'Ditutup' }}</span>
                  <span class="text-[10px] text-slate-400">{{ timeAgo(report.created_at) }}</span>
                </div>
                <p class="mt-2 text-xs leading-5 text-slate-600">{{ report.reason || 'Tidak ada keterangan.' }}</p>
                <p v-if="report.stamp?.message" class="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
                  Stamp: {{ report.stamp.message }}
                </p>
                <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400">
                  <span>Dilaporkan oleh <RouterLink v-if="report.reporter" :to="`/dashboard/users/${report.reporter.id}`" class="font-bold text-slate-600 hover:text-kenalan-700">@{{ report.reporter.username }}</RouterLink><span v-else>pengguna</span></span>
                  <span>Target <RouterLink v-if="report.reported" :to="`/dashboard/users/${report.reported.id}`" class="font-bold text-slate-600 hover:text-kenalan-700">@{{ report.reported.username }}</RouterLink><span v-else>tidak tersedia</span></span>
                  <span v-if="report.reviewed_at">Diperbarui {{ shortDate(report.reviewed_at) }}</span>
                </div>
              </div>
            </div>
            <div v-if="report.status === 'pending'" class="flex shrink-0 gap-2 pl-[52px] sm:pl-0">
              <button class="btn !rounded-xl border border-slate-200 bg-white !px-3 !py-2 text-[10px] font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50" :disabled="updatingId === report.id" @click="updateStatus(report, 'dismissed')"><CircleOff :size="13" /> Tutup</button>
              <button class="btn !rounded-xl bg-emerald-600 !px-3 !py-2 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50" :disabled="updatingId === report.id" @click="updateStatus(report, 'resolved')"><Check :size="13" /> Selesai</button>
            </div>
          </div>
        </article>
      </div>
      <DashboardPagination v-model:page="page" :total="total" :page-size="pageSize" :loading="loading" />
    </section>
  </div>
</template>
