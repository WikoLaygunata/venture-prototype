<script setup>
import { ArrowLeft, Compass } from 'lucide-vue-next'
import { isLoggedIn } from '@/stores/auth'
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-4 bg-white px-8 text-center">
    <span class="text-5xl" aria-hidden="true">🧭</span>
    <h1 class="text-xl font-extrabold tracking-tight text-slate-800">Halaman nggak ketemu</h1>
    <p class="max-w-[17rem] text-sm leading-relaxed text-slate-400">
      Link-nya mungkin salah, atau lanyard yang kamu scan belum terdaftar di Kenalan.
    </p>

    <div class="mt-2 w-full max-w-[16rem] space-y-2">
      <RouterLink v-if="isLoggedIn" :to="{ name: 'map' }" class="btn-primary w-full">
        <Compass class="h-4 w-4" aria-hidden="true" />
        Ke Explore
      </RouterLink>
      <RouterLink v-else :to="{ name: 'landing' }" class="btn-primary w-full">
        <ArrowLeft class="h-4 w-4" aria-hidden="true" />
        Balik ke awal
      </RouterLink>
      <RouterLink :to="{ name: 'activate' }" class="btn-ghost w-full">
        Aktifkan lanyard
      </RouterLink>
    </div>
  </div>
</template>
