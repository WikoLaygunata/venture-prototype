<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { Search, Users, RefreshCw } from 'lucide-vue-next'
import DashboardPagination from '@/components/DashboardPagination.vue'
import { fetchDashboardUsers } from '@/lib/dashboardApi'
import { timeAgo } from '@/lib/time'

const query = ref('')
const page = ref(1)
const pageSize = 10
const rows = ref([])
const total = ref(0)
const loading = ref(false)
const errorMessage = ref('')
let searchTimer

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await fetchDashboardUsers({ query: query.value, page: page.value, pageSize })
    rows.value = result.rows
    total.value = result.total
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    loading.value = false
  }
}

watch(query, () => {
  page.value = 1
  clearTimeout(searchTimer)
  searchTimer = setTimeout(load, 250)
})
watch(page, load)
onMounted(load)
onUnmounted(() => clearTimeout(searchTimer))
</script>

<template>
  <div>
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-xs font-semibold text-slate-400">Direktori komunitas</p>
        <h1 class="mt-1 text-[26px] font-extrabold tracking-tight text-slate-900">Pengguna</h1>
        <p class="mt-2 text-sm text-slate-500">Cari akun dan lihat ringkasan profilnya.</p>
      </div>
      <span class="rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-500 shadow-sm">
        {{ total }} akun
      </span>
    </div>

    <section class="overflow-hidden rounded-[22px] border border-slate-100 bg-white">
      <div class="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:px-5">
        <div class="relative w-full sm:max-w-sm">
          <Search :size="17" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input v-model="query" class="input-field !rounded-xl !py-2.5 !pl-10 !text-xs" type="search" placeholder="Cari nama, username, fakultas...">
        </div>
        <button class="btn-ghost !rounded-xl !px-3 !py-2 text-xs" :disabled="loading" @click="load">
          <RefreshCw :size="14" :class="{ 'animate-spin': loading }" /> Muat ulang
        </button>
      </div>
      <div v-if="errorMessage" class="m-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-700" role="alert">{{ errorMessage }}</div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[700px] text-left">
          <thead class="bg-slate-50/70 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
            <tr>
              <th class="px-5 py-3.5">Pengguna</th>
              <th class="px-4 py-3.5">Fakultas / jurusan</th>
              <th class="px-4 py-3.5">Color Code</th>
              <th class="px-4 py-3.5">Discovery</th>
              <th class="px-4 py-3.5">Bergabung</th>
              <th class="px-4 py-3.5" />
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <template v-if="loading">
              <tr v-for="item in 5" :key="item">
                <td colspan="6" class="px-5 py-4"><div class="h-8 animate-pulse rounded-lg bg-slate-50" /></td>
              </tr>
            </template>
            <tr v-else-if="!rows.length">
              <td colspan="6" class="px-5 py-16 text-center">
                <Users :size="24" class="mx-auto text-slate-300" />
                <p class="mt-3 text-sm font-bold text-slate-600">Pengguna tidak ditemukan</p>
                <p class="mt-1 text-xs text-slate-400">Coba kata kunci yang lain.</p>
              </td>
            </tr>
            <template v-else>
              <tr v-for="profile in rows" :key="profile.id" class="group hover:bg-slate-50/60">
                <td class="px-5 py-3.5">
                  <RouterLink :to="`/dashboard/users/${profile.id}`" class="flex items-center gap-3">
                    <img v-if="profile.avatar_url" :src="profile.avatar_url" alt="" class="h-9 w-9 rounded-full bg-slate-100 object-cover">
                    <span v-else class="grid h-9 w-9 place-items-center rounded-full bg-kenalan-100 text-xs font-bold text-kenalan-700">{{ (profile.full_name || '?').charAt(0) }}</span>
                    <span class="min-w-0">
                      <span class="block max-w-[200px] truncate text-xs font-bold text-slate-800">{{ profile.full_name || 'Tanpa nama' }}</span>
                      <span class="mt-0.5 block text-[10px] text-slate-400">@{{ profile.username }}</span>
                    </span>
                  </RouterLink>
                </td>
                <td class="px-4 py-3.5">
                  <span class="block max-w-[180px] truncate text-[11px] font-semibold text-slate-600">{{ profile.faculty || '—' }}</span>
                  <span class="mt-0.5 block max-w-[180px] truncate text-[10px] text-slate-400">{{ profile.major || 'Belum diisi' }}</span>
                </td>
                <td class="px-4 py-3.5">
                  <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold capitalize text-slate-600">
                    <span class="h-2 w-2 rounded-full" :class="{
                      'bg-emerald-400': profile.color_code === 'mint',
                      'bg-amber-400': profile.color_code === 'yellow',
                      'bg-slate-400': profile.color_code === 'grey',
                      'bg-rose-400': profile.color_code === 'red',
                    }" />
                    {{ profile.color_code || 'mint' }}
                  </span>
                </td>
                <td class="px-4 py-3.5">
                  <span class="rounded-full px-2.5 py-1 text-[10px] font-bold" :class="profile.is_discoverable === false ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'">
                    {{ profile.is_discoverable === false ? 'Nonaktif' : 'Aktif' }}
                  </span>
                </td>
                <td class="px-4 py-3.5 text-[10px] text-slate-400">{{ timeAgo(profile.created_at) }}</td>
                <td class="px-4 py-3.5">
                  <RouterLink :to="`/dashboard/users/${profile.id}`" class="rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-kenalan-700 opacity-0 transition hover:bg-kenalan-50 group-hover:opacity-100">Detail</RouterLink>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <DashboardPagination v-model:page="page" :total="total" :page-size="pageSize" :loading="loading" />
    </section>
  </div>
</template>
