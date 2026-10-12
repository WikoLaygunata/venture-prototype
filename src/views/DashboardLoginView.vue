<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, Command, LockKeyhole, ShieldCheck } from 'lucide-vue-next'
import { dashboardAuthMessage, signInDashboard } from '@/stores/dashboardAuth'
import { isDashboardSupabaseEnabled, isDashboardSupabaseRequested } from '@/lib/supabase'

const route = useRoute()
const router = useRouter()
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')
const showDemoCredentials = computed(
  () => !isDashboardSupabaseEnabled && !isDashboardSupabaseRequested,
)

async function submit() {
  loading.value = true
  errorMessage.value = ''
  try {
    await signInDashboard({ email: email.value, password: password.value })
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    const target = redirect.startsWith('/dashboard/') && redirect !== '/dashboard/login'
      ? redirect
      : '/dashboard/home'
    await router.replace(target)
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#f5f7f8] px-5 py-12">
    <div class="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-kenalan-100/70 blur-3xl" />
    <div class="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-emerald-100/60 blur-3xl" />

    <div class="relative grid w-full max-w-[980px] overflow-hidden rounded-[30px] border border-white bg-white shadow-[0_30px_100px_-45px_rgba(15,23,42,0.3)] md:grid-cols-[1fr_1.02fr]">
      <section class="hidden flex-col justify-between bg-slate-900 p-10 text-white md:flex lg:p-12">
        <RouterLink to="/" class="flex w-fit items-center gap-3">
          <span class="grid h-10 w-10 place-items-center rounded-2xl bg-kenalan-400 text-slate-900">
            <Command :size="20" :stroke-width="2.4" />
          </span>
          <span class="text-lg font-extrabold tracking-tight">kenalan</span>
        </RouterLink>
        <div class="max-w-sm">
          <div class="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-kenalan-200">
            <ShieldCheck :size="13" />
            Ruang kerja internal
          </div>
          <h1 class="text-[38px] font-extrabold leading-[1.12] tracking-tight">
            Kelola ruang
            <span class="text-kenalan-300">kenalan</span>
            dengan aman.
          </h1>
          <p class="mt-5 text-sm leading-7 text-slate-300">
            Satu tempat untuk memantau pengguna, keychain NFC, aktivitas, dan laporan komunitas.
          </p>
        </div>
        <div class="flex items-center gap-2 text-[11px] text-slate-400">
          <LockKeyhole :size="13" />
          Akses khusus untuk tim Kenalan
        </div>
      </section>

      <section class="px-6 py-9 sm:px-10 sm:py-12 lg:px-14">
        <div class="mb-8 flex items-center gap-3 md:hidden">
          <span class="grid h-10 w-10 place-items-center rounded-2xl bg-kenalan-500 text-white">
            <Command :size="20" />
          </span>
          <span class="text-lg font-extrabold tracking-tight text-slate-900">kenalan <span class="font-semibold text-slate-400">admin</span></span>
        </div>
        <div class="mb-8">
          <p class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-kenalan-600">Welcome back</p>
          <h2 class="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">Masuk ke dashboard</h2>
          <p class="mt-2 text-sm text-slate-500">Gunakan akun admin untuk melanjutkan.</p>
        </div>

        <form class="space-y-5" @submit.prevent="submit">
          <label class="block">
            <span class="field-label">Email admin</span>
            <input v-model="email" class="input-field" type="email" autocomplete="username" placeholder="nama@kenalan.id" required>
          </label>
          <label class="block">
            <span class="field-label">Password</span>
            <input v-model="password" class="input-field" type="password" autocomplete="current-password" placeholder="Masukkan password" required>
          </label>

          <div v-if="errorMessage || dashboardAuthMessage" class="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm leading-relaxed text-rose-700" role="alert">
            {{ errorMessage || dashboardAuthMessage }}
          </div>
          <div v-if="route.query.denied" class="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
            Akunmu tidak memiliki role untuk mengakses dashboard.
          </div>

          <button class="btn-primary w-full !rounded-2xl !py-3.5" :disabled="loading">
            {{ loading ? 'Memeriksa akses...' : 'Masuk dashboard' }}
            <ArrowRight :size="17" />
          </button>
        </form>

        <div v-if="showDemoCredentials" class="mt-6 rounded-2xl border border-kenalan-100 bg-kenalan-50/70 p-4">
          <p class="text-[10px] font-extrabold uppercase tracking-[0.14em] text-kenalan-700">Akun demo dashboard</p>
          <p class="mt-2 text-xs text-slate-600"><span class="font-semibold">Email:</span> admin@kenalan.id</p>
          <p class="mt-1 text-xs text-slate-600"><span class="font-semibold">Password:</span> kenalan123</p>
        </div>
        <p class="mt-7 text-center text-[11px] leading-relaxed text-slate-400">
          Sesi dashboard terpisah dari sesi pengguna aplikasi.
        </p>
      </section>
    </div>
  </main>
</template>
