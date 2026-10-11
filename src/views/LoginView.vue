<script setup>
/**
 * LoginView — sign in only. New accounts must activate a valid NFC token first.
 *
 * Honours `?redirect=/user/xxx`, which is how a guest who tapped "Mutualan" on
 * somebody's public profile gets sent back there right after signing in.
 */
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowRight,
  LoaderCircle,
  Lock,
  Mail,
  Nfc,
  Zap,
} from 'lucide-vue-next'

import { isSupabaseConfigured } from '@/lib/supabase'
import { getDemoEmail, getDemoPassword } from '@/lib/mockData'
import { claimPendingToken } from '@/lib/pendingToken'
import { signIn } from '@/stores/auth'
import { toast } from '@/stores/toast'

const route = useRoute()
const router = useRouter()

const submitting = ref(false)
const errorMessage = ref('')

const form = reactive({
  email: '',
  password: '',
})

/** Only allow in-app paths so `?redirect=` can't bounce users off-site. */
const redirectTo = computed(() => {
  const raw = route.query.redirect
  if (typeof raw !== 'string') return null
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : null
})

const canSubmit = computed(() => {
  const base = /\S+@\S+\.\S+/.test(form.email) && form.password.length >= 6
  return base && !submitting.value
})

async function handleSubmit() {
  if (!canSubmit.value) return

  submitting.value = true
  errorMessage.value = ''

  try {
    await signIn({ email: form.email.trim(), password: form.password })
    toast.success('Berhasil masuk. Selamat datang kembali!')

    // Finish any legacy deferred claim created by an older signup flow.
    const pending = await claimPendingToken()
    if (pending?.ok) {
      toast.success(`Keychain ${pending.token} sekarang terikat ke akunmu 🎉`)
    } else if (pending) {
      toast.error(`Keychain ${pending.token} gagal diklaim: ${pending.error}`)
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
  form.email = getDemoEmail()
  form.password = getDemoPassword()
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
          Halo lagi 👋
        </h1>
        <p class="mt-1.5 text-sm leading-relaxed text-slate-500">
          Masuk buat lanjut mutualan dan lihat stamp di sekitarmu.
        </p>
      </div>

      <!-- Context banner when arriving from a profile they wanted to connect with -->
      <div
        v-if="redirectTo"
        class="mb-5 flex items-start gap-2.5 rounded-2xl border border-kenalan-100 bg-kenalan-50 p-3.5"
      >
        <Zap class="mt-0.5 h-4 w-4 shrink-0 text-kenalan-500" aria-hidden="true" />
        <p class="text-xs font-semibold leading-relaxed text-kenalan-700">
          Setelah masuk, kamu langsung dibalikin ke profil yang mau kamu mutualan.
        </p>
      </div>

      <form class="space-y-3.5" novalidate @submit.prevent="handleSubmit">

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
                autocomplete="current-password"
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
            {{ submitting ? 'Memproses…' : 'Masuk' }}
            <ArrowRight v-if="!submitting" class="h-4 w-4" aria-hidden="true" />
          </button>
        </form>

        <RouterLink :to="{ name: 'forgot-password' }" class="mt-3 block text-center text-xs font-bold text-kenalan-700 hover:text-kenalan-500">
          Lupa password?
        </RouterLink>

        <!-- Demo mode helper -->
        <div v-if="!isSupabaseConfigured" class="mt-5 rounded-2xl bg-slate-50 p-4">
          <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Demo mode</p>
          <p class="mt-1.5 text-xs leading-relaxed text-slate-500">
            Belum ada Supabase yang terhubung, jadi data dilayani dari mock lokal. Pakai
            <code class="font-mono font-bold text-kenalan-600">{{ getDemoEmail() }}</code>
            /
            <code class="font-mono font-bold text-kenalan-600">{{ getDemoPassword() }}</code>
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
            Punya keychain NFC baru? Aktifkan di sini
          </RouterLink>
        </div>
    </div>
  </div>
</template>
