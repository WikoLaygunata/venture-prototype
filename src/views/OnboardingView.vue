<script setup>
/**
 * OnboardingView — SCENARIO 1: somebody tapped a Kenalan NFC keychain.
 *
 * URL: /t/:token  (e.g. /t/KNL-NEW-01) — the token is written to the keychain
 * once when it's made, so the link stays short and pretty. Opening the route
 * resolves the token (backend) and this view decides where the visitor goes.
 *
 * The token decides the whole screen:
 *   no token          -> ask them to type the code printed on the keychain
 *   token not found   -> invalid tag state
 *   status 'claimed'  -> auto-redirect to /user/:user_id (that keychain has an owner)
 *   status 'unclaimed'-> registration form with the token prefilled + disabled
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  GraduationCap,
  LoaderCircle,
  Lock,
  Mail,
  Nfc,
  RefreshCw,
  ScanLine,
  Sparkles,
  UserRound,
} from 'lucide-vue-next'

import { fetchNfcToken } from '@/lib/api'
import { isDemoMode } from '@/lib/dataMode'
import { supabase } from '@/lib/supabase'
import { signUp } from '@/stores/auth'
import { toast } from '@/stores/toast'

const route = useRoute()
const router = useRouter()

/** 'checking' | 'no-token' | 'invalid' | 'claimed' | 'ready' | 'done' */
const phase = ref('checking')
const tokenRecord = ref(null)
const lookupError = ref('')
const manualToken = ref('')

const registeredEmail = ref('')
const registeredToken = ref('')
const hasDirectSession = ref(false)
const resending = ref(false)
const resendCountdown = ref(0)
let resendTimer = null

onBeforeUnmount(() => {
  if (resendTimer) clearInterval(resendTimer)
})

const form = reactive({
  fullName: '',
  username: '',
  email: '',
  password: '',
  faculty: '',
  major: '',
  bio: '',
})

const submitting = ref(false)
const formError = ref('')

const token = computed(() => {
  const raw = route.params.token
  return typeof raw === 'string' ? raw.trim() : ''
})

/* ------------------------------------------------------------------- lookup */

async function checkToken() {
  lookupError.value = ''

  if (!token.value) {
    phase.value = 'no-token'
    return
  }

  phase.value = 'checking'

  try {
    const record = await fetchNfcToken(token.value)

    if (!record) {
      phase.value = 'invalid'
      return
    }

    tokenRecord.value = record

    if (record.status === 'claimed') {
      // The keychain already belongs to someone: send the scanner to their profile.
      phase.value = 'claimed'
      if (record.user_id) {
        // Small pause so the scanner sees what happened instead of a blank flash.
        setTimeout(() => {
          router.replace({ name: 'user-profile', params: { user_id: record.user_id } })
        }, 900)
      } else {
        phase.value = 'invalid'
        lookupError.value = 'Token ini ditandai sudah diklaim tapi tidak punya pemilik.'
      }
      return
    }

    phase.value = 'ready'
  } catch (error) {
    phase.value = 'invalid'
    lookupError.value = error.message
  }
}

onMounted(checkToken)
watch(token, checkToken)

function submitManualToken() {
  const value = manualToken.value.trim()
  if (!value) return
  router.replace({ name: 'activate', params: { token: value } })
}

/* --------------------------------------------------------------- suggestions */

// Auto-suggest a username from the typed name until the user edits it manually.
const usernameTouched = ref(false)
watch(
  () => form.fullName,
  (name) => {
    if (usernameTouched.value) return
    form.username = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 18)
  },
)

/* ---------------------------------------------------------------- submission */

const canSubmit = computed(
  () =>
    form.fullName.trim().length >= 3 &&
    form.username.trim().length >= 3 &&
    /\S+@\S+\.\S+/.test(form.email) &&
    form.password.length >= 6 &&
    !submitting.value,
)

async function handleResendEmail() {
  if (resending.value || resendCountdown.value > 0 || !registeredEmail.value) return
  resending.value = true
  try {
    if (isDemoMode.value) {
      toast.success('Email verifikasi simulasi berhasil dikirim ulang!')
    } else if (supabase) {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: registeredEmail.value,
      })
      if (error) throw error
      toast.success('Email verifikasi baru telah dikirimkan ke kotak masukmu!')
    }
    resendCountdown.value = 60
    if (resendTimer) clearInterval(resendTimer)
    resendTimer = setInterval(() => {
      if (resendCountdown.value > 0) {
        resendCountdown.value--
      } else {
        clearInterval(resendTimer)
      }
    }, 1000)
  } catch (error) {
    toast.error(`Gagal mengirim ulang: ${error.message}`)
  } finally {
    resending.value = false
  }
}

async function handleRegister() {
  if (!canSubmit.value) return

  submitting.value = true
  formError.value = ''

  try {
    const { needsEmailConfirmation } = await signUp({
      token: token.value,
      email: form.email.trim(),
      password: form.password,
      fullName: form.fullName.trim(),
      username: form.username.trim(),
      faculty: form.faculty.trim(),
      major: form.major.trim(),
      bio: form.bio.trim(),
    })

    registeredEmail.value = form.email.trim()
    registeredToken.value = token.value
    hasDirectSession.value = !needsEmailConfirmation

    // Selalu arahkan ke tampilan verifikasi email agar pengguna tahu langkah berikutnya
    phase.value = 'done'
    if (needsEmailConfirmation) {
      toast.info('Pendaftaran berhasil! Silakan cek kotak masuk emailmu.')
    } else {
      toast.success(`Akun berhasil dibuat! Selamat datang, ${form.fullName.split(' ')[0]} 🎉`)
    }
  } catch (error) {
    formError.value = error.message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="relative flex h-full flex-col bg-white">
    <!-- Decorative gradient header -->
    <div
      class="shrink-0 bg-gradient-to-br from-kenalan-500 via-kenalan-400 to-fuchsia-400 px-6 pb-8 pt-[calc(env(safe-area-inset-top)+2rem)] text-white"
    >
      <div class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] opacity-80">
        <Nfc class="h-4 w-4" aria-hidden="true" />
        Kenalan Keychain
      </div>
      <h1 class="mt-2 text-2xl font-extrabold leading-tight">
        {{
          phase === 'ready'
            ? 'Aktifkan keychain kamu'
            : phase === 'claimed'
              ? 'Keychain ini sudah punya pemilik'
              : phase === 'done'
                ? 'Verifikasi email kamu ✉️'
                : 'Scan terdeteksi'
        }}
      </h1>
      <p class="mt-1.5 text-sm leading-relaxed text-white/80">
        {{
          phase === 'ready'
            ? 'Satu langkah lagi buat jadi bagian dari jaringan kampus.'
            : phase === 'claimed'
              ? 'Kami arahkan kamu ke profil pemiliknya.'
              : phase === 'done'
                ? 'Tautan aktivasi telah dikirimkan ke kotak masuk emailmu.'
                : 'Kami sedang mencocokkan tag NFC dengan database.'
        }}
      </p>

      <div
        v-if="token || registeredToken"
        class="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 font-mono text-xs font-bold tracking-wider ring-1 ring-white/25"
      >
        <ScanLine class="h-3.5 w-3.5" aria-hidden="true" />
        {{ token || registeredToken }}
      </div>
    </div>

    <div class="screen-scroll px-5 py-6">
      <!-- ------------------------------------------------ checking the token -->
      <div
        v-if="phase === 'checking'"
        class="flex flex-col items-center gap-3 py-16 text-slate-400"
      >
        <LoaderCircle class="h-7 w-7 animate-spin text-kenalan-400" aria-hidden="true" />
        <p class="text-xs font-semibold">Memeriksa token NFC…</p>
      </div>

      <!-- ------------------------------------------------------ claimed tag -->
      <div
        v-else-if="phase === 'claimed'"
        class="flex flex-col items-center gap-3 py-14 text-center"
      >
        <span class="text-4xl" aria-hidden="true">👋</span>
        <p class="text-sm font-bold text-slate-700">Token ini sudah diklaim</p>
        <p class="max-w-[17rem] text-xs leading-relaxed text-slate-400">
          Mengalihkan kamu ke profil pemilik keychain…
        </p>
        <LoaderCircle class="mt-1 h-5 w-5 animate-spin text-kenalan-400" aria-hidden="true" />
        <RouterLink
          v-if="tokenRecord?.user_id"
          :to="{ name: 'user-profile', params: { user_id: tokenRecord.user_id } }"
          class="btn-secondary mt-3 !py-2 !text-xs"
        >
          Buka sekarang
          <ArrowRight class="h-3.5 w-3.5" aria-hidden="true" />
        </RouterLink>
      </div>

      <!-- ------------------------------------------------------- no token yet -->
      <div v-else-if="phase === 'no-token'" class="space-y-5">
        <div class="rounded-3xl border border-kenalan-100 bg-kenalan-50/60 p-4">
          <p class="text-sm font-bold text-kenalan-700">Nggak ada token terdeteksi</p>
          <p class="mt-1 text-xs leading-relaxed text-kenalan-700/70">
            Tempelkan HP ke keychain, atau masukkan kode yang tercetak di keychain.
          </p>
        </div>

        <form class="space-y-3" @submit.prevent="submitManualToken">
          <div>
            <label for="manual-token" class="field-label">Kode keychain</label>
            <input
              id="manual-token"
              v-model="manualToken"
              type="text"
              autocomplete="off"
              spellcheck="false"
              placeholder="KNL-XXXX-00"
              class="input-field font-mono uppercase tracking-wider"
            />
          </div>
          <button type="submit" class="btn-primary w-full" :disabled="!manualToken.trim()">
            Cek token
            <ArrowRight class="h-4 w-4" aria-hidden="true" />
          </button>
        </form>

        <div v-if="isDemoMode" class="rounded-2xl bg-slate-50 p-4">
          <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Demo mode — token siap pakai
          </p>
          <ul class="mt-2 space-y-1 text-xs text-slate-500">
            <li><code class="font-mono font-bold text-kenalan-600">KNL-NEW-01</code> — belum diklaim</li>
            <li><code class="font-mono font-bold text-kenalan-600">KNL-NADIA-07</code> — sudah diklaim</li>
          </ul>
        </div>

        <RouterLink :to="{ name: 'login' }" class="btn-ghost w-full">
          Udah punya akun? Login
        </RouterLink>
      </div>

      <!-- -------------------------------------------------------- invalid tag -->
      <div v-else-if="phase === 'invalid'" class="space-y-4">
        <div
          role="alert"
          class="flex flex-col items-center gap-3 rounded-3xl border border-blush/30 bg-blush-soft px-5 py-8 text-center"
        >
          <CircleAlert class="h-7 w-7 text-blush-deep" aria-hidden="true" />
          <p class="text-sm font-bold text-blush-deep">Token tidak dikenali</p>
          <p class="max-w-[17rem] text-xs leading-relaxed text-blush-deep/75">
            {{
              lookupError ||
              `Token "${token}" nggak ada di database Kenalan. Pastikan kamu scan keychain resmi.`
            }}
          </p>
        </div>
        <button type="button" class="btn-ghost w-full" @click="checkToken">Coba scan lagi</button>
        <RouterLink :to="{ name: 'activate' }" class="btn-secondary w-full">
          Masukkan kode manual
        </RouterLink>
      </div>

      <!-- ------------------------------------------- email confirmation state -->
      <div v-else-if="phase === 'done'" class="space-y-6 py-2">
        <div class="flex flex-col items-center text-center">
          <div
            class="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-kenalan-500 to-fuchsia-500 text-white shadow-xl shadow-kenalan-500/25 ring-8 ring-kenalan-50"
          >
            <Mail class="h-10 w-10 animate-pulse" aria-hidden="true" />
            <div
              class="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md ring-2 ring-white"
            >
              <CircleCheck class="h-4 w-4" />
            </div>
          </div>

          <h2 class="mt-5 text-xl font-extrabold text-slate-800">
            Cek Kotak Masuk Email Kamu
          </h2>
          <p class="mt-1 text-xs text-slate-500">
            Kami telah mengirimkan tautan konfirmasi akun ke:
          </p>
          <div
            class="mt-2.5 inline-flex items-center gap-2 rounded-full border border-kenalan-200 bg-kenalan-50 px-4 py-1.5 shadow-sm"
          >
            <Mail class="h-3.5 w-3.5 text-kenalan-600" />
            <span class="text-xs font-bold text-kenalan-800">{{ registeredEmail || form.email }}</span>
          </div>
        </div>

        <!-- Panduan langkah-langkah verifikasi -->
        <div class="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 space-y-3">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Langkah Selanjutnya
          </p>
          <ol class="space-y-2.5 text-xs text-slate-600">
            <li class="flex items-start gap-2.5">
              <span
                class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-kenalan-500 font-bold text-white text-[10px]"
              >1</span>
              <span>Buka aplikasi email kamu dan cari pesan dari <strong class="text-slate-800">Kenalan / Supabase</strong>.</span>
            </li>
            <li class="flex items-start gap-2.5">
              <span
                class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-kenalan-500 font-bold text-white text-[10px]"
              >2</span>
              <span>Klik tombol atau tautan <strong class="text-slate-800">"Confirm your email"</strong> di dalam pesan tersebut.</span>
            </li>
            <li class="flex items-start gap-2.5">
              <span
                class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-kenalan-500 font-bold text-white text-[10px]"
              >3</span>
              <span>Setelah diverifikasi, keychain <code class="rounded bg-slate-200 px-1 py-0.5 font-mono font-bold text-kenalan-700">{{ registeredToken || token }}</code> akan aktif dan kamu bisa langsung masuk.</span>
            </li>
          </ol>
        </div>

        <!-- Tips Spam/Junk Folder -->
        <div class="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-amber-800">
          <CircleAlert class="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <p class="text-[11px] leading-relaxed">
            Belum menerima email? Tunggu 1–2 menit, dan pastikan juga mengecek folder <strong>Spam / Junk</strong> atau tab Promosi di email kamu.
          </p>
        </div>

        <!-- Tombol Aksi -->
        <div class="space-y-2.5 pt-2">
          <RouterLink
            v-if="hasDirectSession"
            :to="{ name: 'profile' }"
            class="btn-primary w-full !py-3.5"
          >
            Buka Profil Saya
            <ArrowRight class="h-4 w-4" aria-hidden="true" />
          </RouterLink>

          <RouterLink
            :to="{ name: 'login' }"
            :class="hasDirectSession ? 'btn-secondary' : 'btn-primary'"
            class="w-full !py-3.5"
          >
            Ke Halaman Login
            <ArrowRight class="h-4 w-4" aria-hidden="true" />
          </RouterLink>

          <button
            type="button"
            class="btn-secondary w-full !py-3 text-xs"
            :disabled="resending || resendCountdown > 0"
            @click="handleResendEmail"
          >
            <LoaderCircle v-if="resending" class="h-3.5 w-3.5 animate-spin" />
            <RefreshCw v-else class="h-3.5 w-3.5" :class="resending ? 'animate-spin' : ''" />
            {{
              resendCountdown > 0
                ? `Kirim ulang tersedia dalam ${resendCountdown} detik`
                : 'Kirim ulang email verifikasi'
            }}
          </button>
        </div>
      </div>

      <!-- ------------------------------------------------- registration form -->
      <form v-else class="space-y-4" novalidate @submit.prevent="handleRegister">
        <div
          class="flex items-start gap-3 rounded-2xl border border-mint/40 bg-mint-soft p-3.5 text-mint-deep"
        >
          <CircleCheck class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p class="text-xs font-semibold leading-relaxed">
            Token valid dan belum diklaim. Isi data di bawah buat mengikat keychain ini ke akunmu.
          </p>
        </div>

        <!-- Token: prefilled and locked, exactly as scanned -->
        <div>
          <label for="token" class="field-label">Token NFC (terisi otomatis)</label>
          <div class="relative">
            <input
              id="token"
              :value="token"
              type="text"
              disabled
              readonly
              class="input-field pr-10 font-mono font-bold uppercase tracking-wider"
            />
            <Lock
              class="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
          </div>
        </div>

        <div class="h-px bg-slate-100" />

        <div>
          <label for="fullName" class="field-label">Nama lengkap</label>
          <div class="relative">
            <UserRound
              class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="fullName"
              v-model="form.fullName"
              type="text"
              required
              autocomplete="name"
              placeholder="Raka Pratama"
              class="input-field pl-10"
              data-autofocus
            />
          </div>
        </div>

        <div>
          <label for="username" class="field-label">Username</label>
          <div class="relative">
            <span
              class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400"
              aria-hidden="true"
            >
              @
            </span>
            <input
              id="username"
              v-model="form.username"
              type="text"
              required
              minlength="3"
              autocomplete="username"
              placeholder="rakaprtm"
              class="input-field pl-9"
              @input="usernameTouched = true"
            />
          </div>
        </div>

        <div>
          <label for="email" class="field-label">Email kampus</label>
          <div class="relative">
            <Mail
              class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="email"
              v-model="form.email"
              type="email"
              required
              autocomplete="email"
              placeholder="raka@kampus.ac.id"
              class="input-field pl-10"
            />
          </div>
        </div>

        <div>
          <label for="password" class="field-label">Password</label>
          <div class="relative">
            <Lock
              class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="password"
              v-model="form.password"
              type="password"
              required
              minlength="6"
              autocomplete="new-password"
              placeholder="Minimal 6 karakter"
              class="input-field pl-10"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="faculty" class="field-label">Fakultas</label>
            <div class="relative">
              <GraduationCap
                class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="faculty"
                v-model="form.faculty"
                type="text"
                placeholder="FILKOM"
                class="input-field pl-9 !text-[13px]"
              />
            </div>
          </div>
          <div>
            <label for="major" class="field-label">Jurusan</label>
            <input
              id="major"
              v-model="form.major"
              type="text"
              placeholder="Sistem Informasi"
              class="input-field !text-[13px]"
            />
          </div>
        </div>

        <div>
          <label for="bio" class="field-label">Bio singkat</label>
          <textarea
            id="bio"
            v-model="form.bio"
            rows="3"
            maxlength="160"
            placeholder="Satu kalimat yang bikin orang pengen nyapa kamu."
            class="input-field resize-none"
          />
          <p class="mt-1 text-right text-[11px] text-slate-400">{{ form.bio.length }}/160</p>
        </div>

        <p
          v-if="formError"
          role="alert"
          class="rounded-2xl border border-blush/30 bg-blush-soft px-4 py-3 text-xs font-semibold text-blush-deep"
        >
          {{ formError }}
        </p>

        <button type="submit" class="btn-primary w-full !py-3.5" :disabled="!canSubmit">
          <LoaderCircle v-if="submitting" class="h-4 w-4 animate-spin" aria-hidden="true" />
          <Sparkles v-else class="h-4 w-4" aria-hidden="true" />
          {{ submitting ? 'Mengaktifkan…' : 'Aktifkan & Buat Akun' }}
        </button>

        <p class="pb-2 text-center text-[11px] leading-relaxed text-slate-400">
          Dengan lanjut, kamu setuju keychain <strong class="font-mono">{{ token }}</strong> terikat
          permanen ke akun ini.
        </p>
      </form>
    </div>
  </div>
</template>
