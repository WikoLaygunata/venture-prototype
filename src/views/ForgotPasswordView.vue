<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, LoaderCircle, LockKeyhole, Mail } from 'lucide-vue-next'
import { requestPasswordReset } from '@/stores/auth'
import { isSupabaseConfigured } from '@/lib/supabase'

const router = useRouter()
const email = ref('')
const submitting = ref(false)
const sent = ref(false)
const errorMessage = ref('')

async function submit() {
  if (submitting.value) return
  submitting.value = true
  errorMessage.value = ''
  try {
    await requestPasswordReset(email.value)
    sent.value = true
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="screen-scroll flex h-full flex-col bg-white px-6 pb-8 pt-[calc(env(safe-area-inset-top)+2.5rem)]">
    <RouterLink :to="{ name: 'login' }" class="mb-8 inline-flex items-center gap-2 text-xs font-bold text-slate-500">
      <ArrowLeft class="h-4 w-4" /> Kembali ke login
    </RouterLink>
    <div class="mb-7">
      <span class="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-kenalan-100 text-kenalan-700"><LockKeyhole class="h-6 w-6" /></span>
      <h1 class="text-2xl font-extrabold tracking-tight text-slate-800">Lupa password?</h1>
      <p class="mt-2 text-sm leading-relaxed text-slate-500">Masukkan email akunmu untuk menerima instruksi pemulihan.</p>
    </div>

    <div v-if="sent" class="rounded-3xl border border-mint/40 bg-mint-soft p-5 text-sm leading-relaxed text-mint-deep" role="status">
      <p class="font-bold">Instruksi pemulihan siap</p>
      <p class="mt-2 text-xs">
        {{ isSupabaseConfigured ? 'Jika email terdaftar, link pemulihan akan dikirim.' : 'Mode demo tidak mengirim email. Lanjutkan ke form reset untuk mensimulasikan pemulihan akun.' }}
      </p>
      <RouterLink v-if="!isSupabaseConfigured" :to="{ name: 'reset-password' }" class="btn-primary mt-4 w-full !py-3">
        Atur password demo
      </RouterLink>
    </div>

    <form v-else class="space-y-4" @submit.prevent="submit">
      <label for="reset-email" class="field-label">Email akun</label>
      <div class="relative">
        <Mail class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input id="reset-email" v-model="email" type="email" required autocomplete="email" class="input-field pl-10" placeholder="nama@kampus.ac.id">
      </div>
      <p v-if="errorMessage" class="rounded-xl bg-blush-soft px-4 py-3 text-xs text-blush-deep" role="alert">{{ errorMessage }}</p>
      <button type="submit" class="btn-primary w-full !py-3.5" :disabled="submitting">
        <LoaderCircle v-if="submitting" class="h-4 w-4 animate-spin" />
        {{ submitting ? 'Mengirim…' : 'Kirim instruksi reset' }}
      </button>
    </form>
  </div>
</template>
