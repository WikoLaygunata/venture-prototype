<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Check, LoaderCircle, LockKeyhole } from 'lucide-vue-next'
import { completePasswordReset } from '@/stores/auth'

const router = useRouter()
const password = ref('')
const confirmPassword = ref('')
const submitting = ref(false)
const errorMessage = ref('')

async function submit() {
  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Konfirmasi password tidak cocok.'
    return
  }
  submitting.value = true
  errorMessage.value = ''
  try {
    await completePasswordReset(password.value)
    await router.replace({ name: 'map' })
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="screen-scroll flex h-full flex-col bg-white px-6 pb-8 pt-[calc(env(safe-area-inset-top)+2.5rem)]">
    <div class="mb-7">
      <span class="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-kenalan-100 text-kenalan-700"><LockKeyhole class="h-6 w-6" /></span>
      <h1 class="text-2xl font-extrabold tracking-tight text-slate-800">Atur password baru</h1>
      <p class="mt-2 text-sm leading-relaxed text-slate-500">Gunakan password minimal 8 karakter.</p>
    </div>
    <form class="space-y-4" @submit.prevent="submit">
      <div>
        <label for="new-password" class="field-label">Password baru</label>
        <input id="new-password" v-model="password" type="password" required minlength="8" autocomplete="new-password" class="input-field" placeholder="Minimal 8 karakter">
      </div>
      <div>
        <label for="confirm-password" class="field-label">Ulangi password baru</label>
        <input id="confirm-password" v-model="confirmPassword" type="password" required minlength="8" autocomplete="new-password" class="input-field" placeholder="Ulangi password">
      </div>
      <p v-if="errorMessage" class="rounded-xl bg-blush-soft px-4 py-3 text-xs text-blush-deep" role="alert">{{ errorMessage }}</p>
      <button type="submit" class="btn-primary w-full !py-3.5" :disabled="submitting">
        <LoaderCircle v-if="submitting" class="h-4 w-4 animate-spin" />
        <Check v-else class="h-4 w-4" />
        {{ submitting ? 'Menyimpan…' : 'Simpan password' }}
      </button>
    </form>
  </div>
</template>
