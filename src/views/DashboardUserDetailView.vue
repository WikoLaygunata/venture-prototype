<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, BookOpen, CalendarDays, FileText, Heart, LoaderCircle, MapPin, ShieldCheck, UserRound, UserRoundCog } from 'lucide-vue-next'
import { administerDashboardUser, fetchDashboardUser } from '@/lib/dashboardApi'
import { dashboardRole } from '@/stores/dashboardAuth'
import { shortDate } from '@/lib/time'

const route = useRoute()
const profile = ref(null)
const loading = ref(true)
const errorMessage = ref('')
const actionError = ref('')
const actionSuccess = ref('')
const accountModalOpen = ref(false)
const savingAccount = ref(false)
const banBusy = ref(false)
const canAdminister = computed(() => ['admin', 'superadmin'].includes(dashboardRole.value))
const accountForm = reactive({ email: '', password: '' })

function contactHref(label, value) {
  if (!value) return ''
  if (label === 'Email') return `mailto:${value}`
  if (label === 'WhatsApp') {
    let number = value.replace(/\D/g, '')
    if (number.startsWith('0')) number = `62${number.slice(1)}`
    return number ? `https://wa.me/${number}` : ''
  }
  if (label === 'LINE') {
    if (/^https:\/\/[^\s]+$/i.test(value)) return value
    return `https://line.me/R/ti/p/~${encodeURIComponent(value.replace(/^@/, ''))}`
  }
  if (['Instagram', 'LinkedIn', 'Spotify'].includes(label)) {
    if (/^https:\/\/[^\s]+$/i.test(value)) return value
    const handle = value.replace(/^@/, '')
    const path = {
      Instagram: `https://www.instagram.com/${encodeURIComponent(handle)}`,
      LinkedIn: `https://www.linkedin.com/in/${encodeURIComponent(handle)}`,
      Spotify: `https://open.spotify.com/user/${encodeURIComponent(handle)}`,
    }
    return path[label]
  }
  return ''
}

async function loadUser() {
  loading.value = true
  try {
    profile.value = await fetchDashboardUser(route.params.userId)
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    loading.value = false
  }
}

async function saveAccount() {
  actionError.value = ''
  actionSuccess.value = ''
  if (!accountForm.email.trim() && !accountForm.password) {
    actionError.value = 'Isi email baru, password baru, atau keduanya.'
    return
  }
  savingAccount.value = true
  try {
    const changes = {}
    if (accountForm.email.trim()) changes.email = accountForm.email.trim()
    if (accountForm.password) changes.password = accountForm.password
    await administerDashboardUser(profile.value.id, changes)
    accountForm.email = ''
    accountForm.password = ''
    accountModalOpen.value = false
    actionSuccess.value = 'Data akun berhasil diperbarui.'
    await loadUser()
  } catch (error) {
    actionError.value = error.message
  } finally {
    savingAccount.value = false
  }
}

async function setBanned(banned) {
  if (!profile.value) return
  const action = banned ? 'menonaktifkan' : 'mengaktifkan kembali'
  if (!window.confirm(`Yakin ingin ${action} akun @${profile.value.username}?`)) return
  actionError.value = ''
  actionSuccess.value = ''
  banBusy.value = true
  try {
    await administerDashboardUser(profile.value.id, { banned })
    actionSuccess.value = banned ? 'Akun berhasil dinonaktifkan.' : 'Akun berhasil diaktifkan kembali.'
    await loadUser()
  } catch (error) {
    actionError.value = error.message
  } finally {
    banBusy.value = false
  }
}

onMounted(loadUser)
</script>

<template>
  <div>
    <RouterLink to="/dashboard/users" class="mb-5 inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-kenalan-700">
      <ArrowLeft :size="15" /> Kembali ke pengguna
    </RouterLink>
    <div v-if="errorMessage" class="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{{ errorMessage }}</div>
    <div v-else-if="loading" class="h-64 animate-pulse rounded-[24px] bg-white" />
    <div v-else-if="!profile" class="rounded-[24px] border border-slate-100 bg-white px-6 py-16 text-center">
      <UserRound :size="28" class="mx-auto text-slate-300" />
      <h1 class="mt-3 font-bold text-slate-700">Pengguna tidak ditemukan</h1>
      <p class="mt-1 text-xs text-slate-400">Profil mungkin sudah dihapus atau tautannya tidak valid.</p>
    </div>
    <template v-else>
      <section class="overflow-hidden rounded-[24px] border border-slate-100 bg-white">
        <div class="h-28 bg-gradient-to-r from-kenalan-100 via-violet-50 to-emerald-50" />
        <div class="px-5 pb-6 sm:px-8">
          <div class="-mt-10 flex flex-wrap items-end justify-between gap-4">
            <div class="flex items-end gap-4">
              <img v-if="profile.avatar_url" :src="profile.avatar_url" alt="" class="h-[82px] w-[82px] rounded-[24px] border-4 border-white bg-slate-100 object-cover shadow-sm">
              <span v-else class="grid h-[82px] w-[82px] place-items-center rounded-[24px] border-4 border-white bg-kenalan-100 text-2xl font-extrabold text-kenalan-700 shadow-sm">{{ (profile.full_name || '?').charAt(0) }}</span>
              <div class="pb-1">
                <h1 class="text-xl font-extrabold tracking-tight text-slate-900">{{ profile.full_name || 'Tanpa nama' }}</h1>
                <p class="mt-1 text-xs text-slate-500">@{{ profile.username }}</p>
              </div>
            </div>
            <span class="mb-1 inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-600">
            <ShieldCheck :size="13" /> Detail profil
            </span>
          </div>
          <div v-if="canAdminister" class="mt-5 flex flex-wrap gap-2">
            <span class="inline-flex items-center rounded-full px-3 py-1.5 text-[10px] font-bold" :class="profile.is_banned ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'">
              {{ profile.is_banned ? 'Akun dibanned' : 'Akun aktif' }}
            </span>
            <button type="button" class="btn-secondary !rounded-xl !py-2 text-[11px]" @click="accountModalOpen = true">
              <UserRoundCog :size="14" /> Ubah email / password
            </button>
            <button type="button" class="!rounded-xl px-3 py-2 text-[11px] font-bold" :class="profile.is_banned ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'" :disabled="banBusy" @click="setBanned(!profile.is_banned)">
              <LoaderCircle v-if="banBusy" :size="14" class="animate-spin" />
              {{ profile.is_banned ? 'Aktifkan akun' : 'Ban pengguna' }}
            </button>
          </div>
          <p v-if="actionSuccess" class="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-xs text-emerald-700" role="status">{{ actionSuccess }}</p>
          <p v-if="actionError" class="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700" role="alert">{{ actionError }}</p>
          <p class="mt-5 max-w-2xl text-sm leading-6 text-slate-600">{{ profile.bio || 'Belum ada bio.' }}</p>
          <div class="mt-5 flex flex-wrap gap-2">
            <span class="rounded-full bg-slate-50 px-3 py-1.5 text-[10px] font-semibold text-slate-500">{{ profile.faculty || 'Fakultas belum diisi' }}</span>
            <span class="rounded-full bg-slate-50 px-3 py-1.5 text-[10px] font-semibold text-slate-500">{{ profile.major || 'Jurusan belum diisi' }}</span>
            <span v-if="profile.batch" class="rounded-full bg-slate-50 px-3 py-1.5 text-[10px] font-semibold text-slate-500">Angkatan {{ profile.batch }}</span>
            <span class="rounded-full bg-slate-50 px-3 py-1.5 text-[10px] font-semibold capitalize text-slate-500">Color Code: {{ profile.color_code || 'mint' }}</span>
          </div>
        </div>
      </section>

      <div class="mt-5 grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <section class="rounded-[22px] border border-slate-100 bg-white p-5 sm:p-6">
          <h2 class="text-sm font-extrabold text-slate-800">Ringkasan aktivitas</h2>
          <div class="mt-5 grid grid-cols-3 gap-3">
            <div class="rounded-2xl bg-slate-50 p-4">
              <Heart :size="17" class="text-rose-500" />
              <p class="mt-4 text-xl font-extrabold text-slate-800">{{ profile.mutual_count }}</p>
              <p class="mt-1 text-[10px] text-slate-400">Mutual</p>
            </div>
            <div class="rounded-2xl bg-slate-50 p-4">
              <MapPin :size="17" class="text-sky-600" />
              <p class="mt-4 text-xl font-extrabold text-slate-800">{{ profile.stamp_count }}</p>
              <p class="mt-1 text-[10px] text-slate-400">Stamp</p>
            </div>
            <div class="rounded-2xl bg-slate-50 p-4">
              <FileText :size="17" class="text-rose-600" />
              <p class="mt-4 text-xl font-extrabold text-slate-800">{{ profile.report_count }}</p>
              <p class="mt-1 text-[10px] text-slate-400">Laporan</p>
            </div>
          </div>
          <div class="mt-5 flex items-center gap-3 rounded-2xl border border-slate-100 p-4">
            <CalendarDays :size="17" class="text-slate-400" />
            <div>
              <p class="text-[11px] font-semibold text-slate-700">Terdaftar</p>
              <p class="mt-0.5 text-[10px] text-slate-400">{{ shortDate(profile.created_at) }}</p>
            </div>
          </div>
        </section>

        <section class="rounded-[22px] border border-slate-100 bg-white p-5 sm:p-6">
          <h2 class="text-sm font-extrabold text-slate-800">Preferensi profil</h2>
          <div class="mt-5 space-y-4">
            <div class="flex items-center justify-between gap-4">
              <span class="flex items-center gap-2 text-xs font-semibold text-slate-600"><BookOpen :size="15" class="text-slate-400" /> Muncul di rekomendasi</span>
              <span class="rounded-full px-2.5 py-1 text-[10px] font-bold" :class="profile.is_discoverable === false ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'">{{ profile.is_discoverable === false ? 'Nonaktif' : 'Aktif' }}</span>
            </div>
            <div class="h-px bg-slate-100" />
            <div class="flex items-center justify-between gap-4">
              <span class="flex items-center gap-2 text-xs font-semibold text-slate-600"><FileText :size="15" class="text-slate-400" /> History stamp publik</span>
              <span class="rounded-full px-2.5 py-1 text-[10px] font-bold" :class="profile.stamp_history_public ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">{{ profile.stamp_history_public ? 'Aktif' : 'Privat' }}</span>
            </div>
          </div>
        </section>
      </div>

      <section v-if="canAdminister" class="mt-5 rounded-[22px] border border-slate-100 bg-white p-5 sm:p-6">
        <h2 class="text-sm font-extrabold text-slate-800">Informasi kontak</h2>
        <p class="mt-1 text-[11px] text-slate-400">Data ini hanya tersedia bagi admin dan superadmin.</p>
        <div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="contact in [
            { label: 'Email', value: profile.email },
            { label: 'WhatsApp', value: profile.whatsapp },
            { label: 'LINE', value: profile.line },
            { label: 'Instagram', value: profile.instagram },
            { label: 'LinkedIn', value: profile.linkedin },
            { label: 'Spotify', value: profile.spotify },
          ]" :key="contact.label" class="min-w-0 rounded-xl bg-slate-50 px-4 py-3">
            <p class="text-[10px] font-bold uppercase tracking-wide text-slate-400">{{ contact.label }}</p>
            <a
              v-if="contactHref(contact.label, contact.value)"
              :href="contactHref(contact.label, contact.value)"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-1 block break-all text-xs font-semibold text-kenalan-700 hover:underline"
            >
              {{ contact.value }}
            </a>
            <p v-else class="mt-1 break-all text-xs font-semibold text-slate-700">{{ contact.value || 'Belum diisi' }}</p>
          </div>
        </div>
      </section>

      <div v-if="accountModalOpen" class="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" @click.self="accountModalOpen = false">
        <form class="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl" @submit.prevent="saveAccount">
          <h2 class="text-lg font-extrabold text-slate-900">Pemulihan akun</h2>
          <p class="mt-1 text-xs leading-relaxed text-slate-500">Isi satu atau kedua kolom. Email akan dikonfirmasi oleh admin demi pemulihan darurat.</p>
          <label for="admin-user-email" class="field-label mt-5">Email baru</label>
          <input id="admin-user-email" v-model="accountForm.email" type="email" autocomplete="off" class="input-field" placeholder="email-baru@kampus.ac.id">
          <label for="admin-user-password" class="field-label mt-4">Password baru (opsional)</label>
          <input id="admin-user-password" v-model="accountForm.password" type="password" minlength="8" autocomplete="new-password" class="input-field" placeholder="Minimal 8 karakter">
          <p v-if="actionError" class="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700" role="alert">{{ actionError }}</p>
          <div class="mt-6 flex justify-end gap-2">
            <button type="button" class="btn-secondary !rounded-xl !py-2.5 text-xs" :disabled="savingAccount" @click="accountModalOpen = false">Batal</button>
            <button type="submit" class="btn-primary !rounded-xl !py-2.5 text-xs" :disabled="savingAccount">
              <LoaderCircle v-if="savingAccount" :size="14" class="animate-spin" />
              {{ savingAccount ? 'Menyimpan…' : 'Simpan perubahan' }}
            </button>
          </div>
        </form>
      </div>
    </template>
  </div>
</template>
