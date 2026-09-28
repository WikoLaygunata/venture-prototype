<script setup>
/**
 * LoginView — login + simple register on one screen.
 *
 * Honours `?redirect=/user/xxx`, which is how a guest who tapped "Mutualan" on
 * somebody's public profile gets sent back there right after signing in.
 */
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowRight,
  CircleCheck,
  LoaderCircle,
  Lock,
  Mail,
  Nfc,
  UserRound,
  Zap,
} from 'lucide-vue-next'

import { isSupabaseConfigured } from '@/lib/supabase'
import { DEMO_CREDENTIALS } from '@/lib/mockData'
import { signIn, signUp } from '@/stores/auth'
import { toast } from '@/stores/toast'

const route = useRoute()
const router = useRouter()

const mode = ref('login') // 'login' | 'register'
const submitting = ref(false)
const errorMessage = ref('')
const confirmationSent = ref(false)

const form = reactive({
  email: '',
  password: '',
  fullName: '',
  username: '',
})

/** Only allow in-app paths so `?redirect=` can't bounce users off-site. */
const redirectTo = computed(() => {
  const raw = route.query.redirect
  if (typeof raw !== 'string') return null
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : null
})

const isRegister = computed(() => mode.value === 'register')

const canSubmit = computed(() => {
  const base = /\S+@\S+\.\S+/.test(form.email) && form.password.length >= 6
  if (!isRegister.value) return base && !submitting.value
  return (
    base &&
    form.fullName.trim().length >= 3 &&
    form.username.trim().length >= 3 &&
    !submitting.value
  )
})

const usernameTouched = ref(false)
watch(
  () => form.fullName,
  (name) => {
    if (usernameTouched.value || !isRegister.value) return
    form.username = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 18)
  },
)

function switchMode(next) {
  mode.value = next
  errorMessage.value = ''
  confirmationSent.value = false
}

async function handleSubmit() {
  if (!canSubmit.value) return

  submitting.value = true
  errorMessage.value = ''

  try {
    if (isRegister.value) {
      const { needsEmailConfirmation } = await signUp({
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        username: form.username.trim(),
      })

      if (needsEmailConfirmation) {
        confirmationSent.value = true
        return
      }

      toast.success('Akun kamu siap! Yuk mulai kenalan 🎉')
    } else {
      await signIn({ email: form.email.trim(), password: form.password })
      toast.success('Berhasil masuk. Selamat datang kembali!')
    }

    router.replace(redirectTo.value ?? { name: 'map' })
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    submitting.value = false
  }
}

/** Demo shortcut so the prototype is one tap away from a populated account. */
async function fillDemo() {
  mode.value = 'login'
  form.email = DEMO_CREDENTIALS.email
  form.password = DEMO_CREDENTIALS.password
  await handleSubmit()
}
</script>

<template>
  <div class="relative flex h-full flex-col bg-white">
    <div class="screen-scroll px-6 pb-8 pt-[calc(env(safe-area-inset-top)+2.5rem)]">
      <!-- Brand -->
      <div class="mb-8">
        <div
          class="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-kenalan-500 to-fuchsia-400 text-white shadow-lg shadow-kenalan-500/30"
        >
          <Nfc class="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 class="text-2xl font-extrabold leading-tight tracking-tight text-slate-800">
          {{ isRegister ? 'Buat akun Kenalan' : 'Halo lagi 👋' }}
        </h1>
        <p class="mt-1.5 text-sm leading-relaxed text-slate-500">
          {{
            isRegister
              ? 'Daftar dulu, lanyard bisa kamu kaitkan kapan aja.'
              : 'Masuk buat lanjut mutualan dan lihat stamp di sekitarmu.'
          }}
        </p>
      </div>

      <!-- Context banner when arriving from a profile they wanted to connect with -->
      <div
        v-if="redirectTo && !confirmationSent"
        class="mb-5 flex items-start gap-2.5 rounded-2xl border border-kenalan-100 bg-kenalan-50 p-3.5"
      >
        <Zap class="mt-0.5 h-4 w-4 shrink-0 text-kenalan-500" aria-hidden="true" />
        <p class="text-xs font-semibold leading-relaxed text-kenalan-700">
          Setelah masuk, kamu langsung dibalikin ke profil yang mau kamu mutualan.
        </p>
      </div>

      <!-- Email confirmation success state -->
      <div
        v-if="confirmationSent"
        class="flex flex-col items-center gap-3 rounded-3xl border border-mint/40 bg-mint-soft px-5 py-10 text-center"
      >
        <CircleCheck class="h-9 w-9 text-mint-deep" aria-hidden="true" />
        <p class="text-sm font-bold text-mint-deep">Cek inbox kamu</p>
        <p class="max-w-[17rem] text-xs leading-relaxed text-mint-deep/75">
          Link konfirmasi udah dikirim ke <strong>{{ form.email }}</strong>. Klik link-nya, terus
          balik ke sini buat login.
        </p>
        <button type="button" class="btn-ghost mt-1 !py-2 !text-xs" @click="switchMode('login')">
          Balik ke login
        </button>
      </div>

      <template v-else>
        <!-- Mode switcher -->
        <div class="mb-5 flex gap-1 rounded-2xl bg-slate-100 p-1" role="tablist">
          <button
            v-for="tab in [
              { key: 'login', label: 'Masuk' },
              { key: 'register', label: 'Daftar' },
            ]"
            :key="tab.key"
            type="button"
            role="tab"
            :aria-selected="mode === tab.key"
            class="flex-1 rounded-xl py-2.5 text-[13px] font-bold transition"
            :class="
              mode === tab.key
                ? 'bg-white text-kenalan-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            "
            @click="switchMode(tab.key)"
          >
            {{ tab.label }}
          </button>
        </div>

        <form class="space-y-3.5" novalidate @submit.prevent="handleSubmit">
          <template v-if="isRegister">
            <div>
              <label for="login-fullname" class="field-label">Nama lengkap</label>
              <div class="relative">
                <UserRound
                  class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="login-fullname"
                  v-model="form.fullName"
                  type="text"
                  required
                  autocomplete="name"
                  placeholder="Nama kamu"
                  class="input-field pl-10"
                />
              </div>
            </div>

            <div>
              <label for="login-username" class="field-label">Username</label>
              <div class="relative">
                <span
                  class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400"
                  aria-hidden="true"
                >
                  @
                </span>
                <input
                  id="login-username"
                  v-model="form.username"
                  type="text"
                  required
                  minlength="3"
                  autocomplete="username"
                  placeholder="usernamekamu"
                  class="input-field pl-9"
                  @input="usernameTouched = true"
                />
              </div>
            </div>
          </template>

          <div>
            <label for="login-email" class="field-label">Email</label>
            <div class="relative">
              <Mail
                class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="login-email"
                v-model="form.email"
                type="email"
                required
                autocomplete="email"
                placeholder="kamu@kampus.ac.id"
                class="input-field pl-10"
              />
            </div>
          </div>

          <div>
            <label for="login-password" class="field-label">Password</label>
            <div class="relative">
              <Lock
                class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="login-password"
                v-model="form.password"
                type="password"
                required
                minlength="6"
                :autocomplete="isRegister ? 'new-password' : 'current-password'"
                placeholder="Minimal 6 karakter"
                class="input-field pl-10"
              />
            </div>
          </div>

          <p
            v-if="errorMessage"
            role="alert"
            class="rounded-2xl border border-blush/30 bg-blush-soft px-4 py-3 text-xs font-semibold text-blush-deep"
          >
            {{ errorMessage }}
          </p>

          <button type="submit" class="btn-primary w-full !py-3.5" :disabled="!canSubmit">
            <LoaderCircle v-if="submitting" class="h-4 w-4 animate-spin" aria-hidden="true" />
            {{
              submitting
                ? 'Memproses…'
                : isRegister
                  ? 'Daftar sekarang'
                  : 'Masuk'
            }}
            <ArrowRight v-if="!submitting" class="h-4 w-4" aria-hidden="true" />
          </button>
        </form>

        <!-- Demo mode helper -->
        <div v-if="!isSupabaseConfigured" class="mt-5 rounded-2xl bg-slate-50 p-4">
          <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Demo mode</p>
          <p class="mt-1.5 text-xs leading-relaxed text-slate-500">
            Belum ada Supabase yang terhubung, jadi data dilayani dari mock lokal. Pakai
            <code class="font-mono font-bold text-kenalan-600">{{ DEMO_CREDENTIALS.email }}</code>
            /
            <code class="font-mono font-bold text-kenalan-600">{{ DEMO_CREDENTIALS.password }}</code>
          </p>
          <button
            type="button"
            class="btn-secondary mt-3 w-full !py-2.5 !text-xs"
            :disabled="submitting"
            @click="fillDemo"
          >
            <Zap class="h-3.5 w-3.5" aria-hidden="true" />
            Masuk sebagai akun demo
          </button>
        </div>

        <div class="mt-6 border-t border-slate-100 pt-5">
          <RouterLink :to="{ name: 'activate' }" class="btn-ghost w-full !py-3">
            <Nfc class="h-4 w-4" aria-hidden="true" />
            Punya lanyard baru? Aktifkan di sini
          </RouterLink>
        </div>
      </template>
    </div>
  </div>
</template>
