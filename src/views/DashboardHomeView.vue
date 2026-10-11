<script setup>
import { onMounted, ref } from 'vue'
import { ArrowRight, ArrowUpRight, FileWarning, KeyRound, Users, MapPin, RefreshCw } from 'lucide-vue-next'
import { fetchDashboardSummary } from '@/lib/dashboardApi'
import { shortDate, timeAgo } from '@/lib/time'

const summary = ref(null)
const loading = ref(true)
const errorMessage = ref('')

const stats = [
  { key: 'users', title: 'Total pengguna', detail: 'Akun terdaftar', icon: Users, tone: 'bg-violet-50 text-violet-600', trend: 'Komunitas' },
  { key: 'newUsers', title: 'Pengguna baru', detail: '30 hari terakhir', icon: ArrowUpRight, tone: 'bg-emerald-50 text-emerald-600', trend: '30 hari' },
  { key: 'unclaimedTokens', title: 'NFC belum diklaim', detail: 'Siap dibagikan', icon: KeyRound, tone: 'bg-amber-50 text-amber-600', trend: 'Keychain' },
  { key: 'activeStamps', title: 'Stamp aktif', detail: 'Terbit dalam 24 jam', icon: MapPin, tone: 'bg-sky-50 text-sky-600', trend: '24 jam' },
]

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    summary.value = await fetchDashboardSummary()
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div>
    <div class="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-xs font-semibold text-slate-400">{{ shortDate(new Date().toISOString()) }}</p>
        <h1 class="mt-1 text-[26px] font-extrabold tracking-tight text-slate-900 sm:text-[30px]">Ringkasan operasional</h1>
        <p class="mt-2 text-sm text-slate-500">Pantau kondisi komunitas Kenalan hari ini.</p>
      </div>
      <button class="btn-ghost !rounded-xl !px-3 !py-2.5 text-xs" :disabled="loading" @click="load">
        <RefreshCw :size="15" :class="{ 'animate-spin': loading }" />
        Perbarui
      </button>
    </div>

    <div v-if="errorMessage" class="mb-5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
      {{ errorMessage }}
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article v-for="stat in stats" :key="stat.key" class="rounded-[22px] border border-slate-100 bg-white p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.22)]">
        <div class="flex items-center justify-between">
          <span class="grid h-10 w-10 place-items-center rounded-2xl" :class="stat.tone">
            <component :is="stat.icon" :size="19" />
          </span>
          <span class="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-400">{{ stat.trend }}</span>
        </div>
        <p class="mt-5 text-[26px] font-extrabold tracking-tight text-slate-900">
          <span v-if="loading" class="inline-block h-8 w-14 animate-pulse rounded-lg bg-slate-100" />
          <template v-else>{{ summary?.[stat.key] ?? 0 }}</template>
        </p>
        <p class="mt-1 text-xs font-semibold text-slate-600">{{ stat.title }}</p>
        <p class="mt-1 text-[11px] text-slate-400">{{ stat.detail }}</p>
      </article>
    </div>

    <div class="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
      <section class="overflow-hidden rounded-[22px] border border-slate-100 bg-white">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 class="text-sm font-extrabold text-slate-800">Laporan terbaru</h2>
            <p class="mt-1 text-[11px] text-slate-400">Perlu perhatian moderator</p>
          </div>
          <RouterLink to="/dashboard/reports" class="flex items-center gap-1 text-xs font-bold text-kenalan-600 hover:text-kenalan-700">
            Semua laporan <ArrowRight :size="14" />
          </RouterLink>
        </div>
        <div v-if="loading" class="space-y-3 p-5">
          <div v-for="item in 3" :key="item" class="h-14 animate-pulse rounded-xl bg-slate-50" />
        </div>
        <div v-else-if="!summary?.recentReports?.length" class="px-6 py-12 text-center">
          <span class="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><FileWarning :size="19" /></span>
          <p class="mt-3 text-sm font-bold text-slate-700">Belum ada laporan</p>
          <p class="mt-1 text-xs text-slate-400">Antrean moderasi sedang kosong.</p>
        </div>
        <div v-else class="divide-y divide-slate-50">
          <div v-for="report in summary.recentReports" :key="report.id" class="flex items-center gap-3 px-5 py-4 sm:px-6">
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-500"><FileWarning :size="16" /></span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs font-bold text-slate-700">{{ report.reported?.full_name || report.reported?.username || 'Pengguna' }}</p>
              <p class="mt-1 truncate text-[11px] text-slate-400">{{ report.reason }}</p>
            </div>
            <div class="shrink-0 text-right">
              <span class="rounded-full px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide"
                :class="report.status === 'pending' ? 'bg-amber-50 text-amber-700' : report.status === 'resolved' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">
                {{ report.status === 'pending' ? 'Menunggu' : report.status === 'resolved' ? 'Selesai' : 'Ditutup' }}
              </span>
              <p class="mt-1.5 text-[10px] text-slate-400">{{ timeAgo(report.created_at) }}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="overflow-hidden rounded-[22px] border border-slate-100 bg-white">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 class="text-sm font-extrabold text-slate-800">Pengguna terbaru</h2>
            <p class="mt-1 text-[11px] text-slate-400">Akun yang baru bergabung</p>
          </div>
          <RouterLink to="/dashboard/users" aria-label="Lihat semua pengguna" class="rounded-xl p-2 text-slate-400 hover:bg-slate-50"><ArrowRight :size="16" /></RouterLink>
        </div>
        <div v-if="loading" class="space-y-4 p-5">
          <div v-for="item in 4" :key="item" class="h-10 animate-pulse rounded-xl bg-slate-50" />
        </div>
        <div v-else-if="!summary?.recentUsersList?.length" class="p-8 text-center text-xs text-slate-400">Belum ada pengguna.</div>
        <div v-else class="divide-y divide-slate-50">
          <RouterLink v-for="profile in summary.recentUsersList" :key="profile.id" :to="`/dashboard/users/${profile.id}`" class="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/70">
            <img v-if="profile.avatar_url" :src="profile.avatar_url" alt="" class="h-9 w-9 rounded-full bg-slate-100 object-cover">
            <span v-else class="grid h-9 w-9 place-items-center rounded-full bg-kenalan-100 text-xs font-bold text-kenalan-700">{{ (profile.full_name || '?').charAt(0) }}</span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-xs font-bold text-slate-700">{{ profile.full_name || profile.username }}</span>
              <span class="mt-0.5 block truncate text-[10px] text-slate-400">@{{ profile.username }}</span>
            </span>
            <span class="text-[10px] text-slate-400">{{ timeAgo(profile.created_at) }}</span>
          </RouterLink>
        </div>
      </section>
    </div>

    <section class="mt-5 rounded-[22px] bg-gradient-to-br from-kenalan-600 to-kenalan-500 p-6 text-white sm:p-7">
      <div class="flex flex-wrap items-center justify-between gap-5">
        <div>
          <p class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-kenalan-100">Moderation queue</p>
          <h2 class="mt-2 text-xl font-extrabold">Ada {{ summary?.pendingReports ?? 0 }} laporan yang menunggu</h2>
          <p class="mt-1 text-xs text-kenalan-100">Tinjau laporan agar komunitas tetap nyaman.</p>
        </div>
        <RouterLink to="/dashboard/reports" class="btn !rounded-xl bg-white !px-4 !py-2.5 text-xs font-bold text-kenalan-700 hover:bg-kenalan-50">
          Buka antrean <ArrowRight :size="15" />
        </RouterLink>
      </div>
    </section>
  </div>
</template>
