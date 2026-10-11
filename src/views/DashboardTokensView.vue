<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { Check, Copy, KeyRound, Plus, Search, X } from 'lucide-vue-next'
import { createDashboardTokens, fetchDashboardTokens } from '@/lib/dashboardApi'
import { shortDate, timeAgo } from '@/lib/time'
import DashboardPagination from '@/components/DashboardPagination.vue'

const query = ref('')
const statusFilter = ref('all')
const batchLabel = ref('')
const page = ref(1)
const pageSize = 10
const rows = ref([])
const total = ref(0)
const loading = ref(false)
const creating = ref(false)
const createModalOpen = ref(false)
const tokenCount = ref(1)
const errorMessage = ref('')
const successMessage = ref('')
const createdTokens = ref([])
let searchTimer

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await fetchDashboardTokens({ query: query.value, status: statusFilter.value, page: page.value, pageSize })
    rows.value = result.rows
    total.value = result.total
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    loading.value = false
  }
}

async function createToken() {
  creating.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const tokens = await createDashboardTokens(batchLabel.value, tokenCount.value)
    createdTokens.value = tokens.map((token) => ({ ...token, url: tokenUrl(token.token) }))
    batchLabel.value = ''
    tokenCount.value = 1
    createModalOpen.value = false
    successMessage.value = 'Token berhasil dibuat. Salin dan simpan sebelum meninggalkan halaman ini.'
    page.value = 1
    await load()
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    creating.value = false
  }
}

async function copyToken() {
  try {
    await navigator.clipboard.writeText(createdTokens.value.map((item) => item.url).join('\n'))
    successMessage.value = 'URL token berhasil disalin.'
  } catch (error) {
    errorMessage.value = `Tidak bisa menyalin token: ${error.message}`
  }
}

function tokenUrl(token) {
  return `${window.location.origin}/t/${encodeURIComponent(token)}`
}

async function copyUrl(token) {
  try {
    await navigator.clipboard.writeText(tokenUrl(token))
    successMessage.value = 'URL keychain berhasil disalin.'
  } catch (error) {
    errorMessage.value = `Tidak bisa menyalin URL: ${error.message}`
  }
}

watch(query, () => {
  page.value = 1
  clearTimeout(searchTimer)
  searchTimer = setTimeout(load, 250)
})
watch(statusFilter, () => {
  page.value = 1
  load()
})
watch(page, load)
onMounted(load)
onUnmounted(() => clearTimeout(searchTimer))
</script>

<template>
  <div>
    <div class="mb-6">
      <p class="text-xs font-semibold text-slate-400">Inventaris perangkat</p>
      <h1 class="mt-1 text-[26px] font-extrabold tracking-tight text-slate-900">NFC Keychain</h1>
      <p class="mt-2 text-sm text-slate-500">Pantau dan buat token untuk keychain Kenalan.</p>
    </div>

    <section class="mb-5 rounded-[22px] border border-kenalan-100 bg-gradient-to-br from-white to-kenalan-50/60 p-5 sm:p-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span class="grid h-10 w-10 place-items-center rounded-2xl bg-kenalan-100 text-kenalan-700"><Plus :size="19" /></span>
          <h2 class="mt-4 text-sm font-extrabold text-slate-800">Buat token keychain</h2>
          <p class="mt-1 max-w-lg text-xs leading-relaxed text-slate-500">Token baru hanya dapat diklaim satu kali. Simpan nilainya dengan aman setelah dibuat.</p>
        </div>
        <button type="button" class="btn-primary !rounded-xl !py-2.5 !text-xs" @click="createModalOpen = true">
          <Plus :size="15" /> Buat token
        </button>
      </div>
      <div v-if="createdTokens.length" class="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
          <p class="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Token baru</p>
            <p class="mt-1 text-xs font-semibold text-emerald-900">{{ createdTokens.length }} token berhasil dibuat</p>
          </div>
          <button type="button" class="btn !rounded-xl bg-white !px-3 !py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100" @click="copyToken"><Copy :size="14" /> Salin semua URL</button>
          <button type="button" class="rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-100" aria-label="Sembunyikan token" @click="createdTokens = []"><X :size="15" /></button>
        </div>
        <div class="mt-3 max-h-40 space-y-1 overflow-y-auto">
          <p v-for="item in createdTokens" :key="item.id" class="break-all font-mono text-[10px] text-emerald-800">{{ item.url }}</p>
        </div>
      </div>
    </section>

    <div v-if="errorMessage" class="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-700" role="alert">{{ errorMessage }}</div>
    <div v-if="successMessage && !createdTokens.length" class="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-700" role="status">{{ successMessage }}</div>

    <section class="overflow-hidden rounded-[22px] border border-slate-100 bg-white">
      <div class="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:px-5">
        <div>
          <h2 class="text-sm font-extrabold text-slate-800">Semua token</h2>
          <p class="mt-1 text-[11px] text-slate-400">{{ total }} keychain terdaftar</p>
        </div>
        <div class="relative w-full sm:max-w-xs">
          <Search :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input v-model="query" class="input-field !rounded-xl !py-2.5 !pl-10 !text-xs" type="search" placeholder="Cari token...">
        </div>
        <select v-model="statusFilter" class="input-field !w-auto !rounded-xl !py-2.5 !text-xs" aria-label="Filter status token">
          <option value="all">Semua status</option>
          <option value="claimed">Diklaim</option>
          <option value="unclaimed">Belum diklaim</option>
        </select>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[900px] text-left">
          <thead class="bg-slate-50/70 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
            <tr><th class="px-5 py-3.5">Token</th><th class="px-4 py-3.5">Batch</th><th class="px-4 py-3.5">Pemilik</th><th class="px-4 py-3.5">Status</th><th class="px-4 py-3.5">Dibuat / diklaim</th><th class="px-4 py-3.5">URL</th></tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr v-if="loading">
              <td v-for="item in 6" :key="item" class="px-4 py-4"><div class="h-7 animate-pulse rounded-lg bg-slate-50" /></td>
            </tr>
            <tr v-else-if="!rows.length"><td colspan="6" class="px-5 py-14 text-center"><KeyRound :size="23" class="mx-auto text-slate-300" /><p class="mt-3 text-xs font-bold text-slate-600">Belum ada token</p></td></tr>
            <template v-else>
              <tr v-for="token in rows" :key="token.id" class="hover:bg-slate-50/50">
                <td class="px-5 py-4"><code class="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold tracking-wide text-slate-700">{{ token.token }}</code></td>
                <td class="px-4 py-4 text-xs text-slate-500">{{ token.batch_label || '—' }}</td>
                <td class="px-4 py-4">
                  <span v-if="token.owner" class="text-xs font-semibold text-slate-700">{{ token.owner.full_name || token.owner.username }}<span class="mt-0.5 block text-[10px] font-normal text-slate-400">@{{ token.owner.username }}</span></span>
                  <span v-else class="text-xs text-slate-400">Belum diklaim</span>
                </td>
                <td class="px-4 py-4"><span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold" :class="token.status === 'claimed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'"><Check v-if="token.status === 'claimed'" :size="12" />{{ token.status === 'claimed' ? 'Diklaim' : 'Tersedia' }}</span></td>
                <td class="px-4 py-4"><span class="block text-[10px] text-slate-500">{{ shortDate(token.claimed_at || token.created_at) }}</span><span class="mt-1 block text-[10px] text-slate-400">{{ token.claimed_at ? timeAgo(token.claimed_at) : 'Belum diklaim' }}</span></td>
                <td class="px-4 py-4"><button type="button" class="inline-flex items-center gap-1 rounded-lg bg-kenalan-50 px-2.5 py-1.5 text-[10px] font-bold text-kenalan-700 hover:bg-kenalan-100" @click="copyUrl(token.token)"><Copy :size="12" /> Salin URL</button></td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <DashboardPagination v-model:page="page" :total="total" :page-size="pageSize" :loading="loading" />
    </section>
  </div>
  <div v-if="createModalOpen" class="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" @click.self="createModalOpen = false">
    <form class="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl" @submit.prevent="createToken">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h2 class="text-lg font-extrabold text-slate-900">Buat token keychain</h2>
          <p class="mt-1 text-xs leading-relaxed text-slate-500">Token hanya dapat diklaim sekali. Maksimal 20 token per batch.</p>
        </div>
        <button type="button" class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Tutup modal" @click="createModalOpen = false"><X :size="18" /></button>
      </div>
      <label for="token-batch-label" class="field-label mt-5">Label batch (opsional)</label>
      <input id="token-batch-label" v-model="batchLabel" class="input-field" maxlength="80" placeholder="Contoh: Orientasi 2026">
      <label for="token-count" class="field-label mt-4">Jumlah token (1–20)</label>
      <input id="token-count" v-model.number="tokenCount" class="input-field" type="number" min="1" max="20" required>
      <p v-if="errorMessage" class="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700" role="alert">{{ errorMessage }}</p>
      <div class="mt-6 flex justify-end gap-2">
        <button type="button" class="btn-secondary !rounded-xl !py-2.5 text-xs" :disabled="creating" @click="createModalOpen = false">Batal</button>
        <button type="submit" class="btn-primary !rounded-xl !py-2.5 text-xs" :disabled="creating || !Number.isInteger(tokenCount) || tokenCount < 1 || tokenCount > 20">
          <Plus :size="14" /> {{ creating ? 'Membuat…' : 'Buat token' }}
        </button>
      </div>
    </form>
  </div>
</template>
