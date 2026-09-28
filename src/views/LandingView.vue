<script setup>
/**
 * LandingView — what a guest sees at `/`.
 *
 * Doubles as the prototype's control panel: the "Simulasi Scan NFC" block lets
 * you jump straight into each of the three scan scenarios without a physical tag.
 */
import { ArrowRight, MapPin, Nfc, ScanLine, Sparkles } from 'lucide-vue-next'
import { isSupabaseConfigured } from '@/lib/supabase'
import { demoDb } from '@/lib/mockData'

const unclaimed = demoDb.nfc_tokens.filter((t) => t.status === 'unclaimed')
const claimed = demoDb.nfc_tokens.filter((t) => t.status === 'claimed')

const FEATURES = [
  {
    icon: Nfc,
    title: 'Tap lanyard, langsung kenalan',
    text: 'Satu tap NFC membuka profil kampus tanpa tukar username.',
  },
  {
    icon: Sparkles,
    title: 'Color Code sebagai sinyal sosial',
    text: 'Mint, Yellow, Grey, atau Red — orang tahu kapan kamu mau disapa.',
  },
  {
    icon: MapPin,
    title: 'Location Stamp 24 jam',
    text: 'Tempel status di spot kampus, hilang otomatis besoknya.',
  },
]
</script>

<template>
  <div class="relative flex h-full flex-col overflow-hidden bg-slate-900 text-white">
    <div
      class="pointer-events-none absolute -left-16 -top-24 h-64 w-64 rounded-full bg-kenalan-500/40 blur-3xl"
      aria-hidden="true"
    />
    <div
      class="pointer-events-none absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-fuchsia-500/30 blur-3xl"
      aria-hidden="true"
    />

    <div class="screen-scroll relative px-6 pb-8 pt-[calc(env(safe-area-inset-top)+3rem)]">
      <div
        class="mb-5 flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-kenalan-400 to-fuchsia-400 shadow-lg shadow-kenalan-500/40"
      >
        <Nfc class="h-7 w-7" aria-hidden="true" />
      </div>

      <h1 class="text-3xl font-extrabold leading-[1.15] tracking-tight">
        Kenalan.
        <span class="block bg-gradient-to-r from-kenalan-300 to-fuchsia-300 bg-clip-text text-transparent">
          Mulai dari satu tap.
        </span>
      </h1>
      <p class="mt-3 text-sm leading-relaxed text-slate-300">
        Lanyard NFC + aplikasi sosial kampus. Kurangi awkward, perbanyak kenalan beneran.
      </p>

      <div class="mt-7 space-y-2.5">
        <RouterLink :to="{ name: 'login' }" class="btn-primary w-full !py-3.5">
          Masuk / Daftar
          <ArrowRight class="h-4 w-4" aria-hidden="true" />
        </RouterLink>
        <RouterLink
          :to="{ name: 'activate' }"
          class="btn w-full !py-3.5 bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/15"
        >
          <ScanLine class="h-4 w-4" aria-hidden="true" />
          Aktifkan lanyard baru
        </RouterLink>
      </div>

      <ul class="mt-8 space-y-3">
        <li
          v-for="feature in FEATURES"
          :key="feature.title"
          class="flex items-start gap-3 rounded-2xl bg-white/5 p-3.5 ring-1 ring-white/10"
        >
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-kenalan-200"
            aria-hidden="true"
          >
            <component :is="feature.icon" class="h-4 w-4" />
          </span>
          <span class="min-w-0">
            <span class="block text-[13px] font-bold">{{ feature.title }}</span>
            <span class="mt-0.5 block text-[11px] leading-relaxed text-slate-400">
              {{ feature.text }}
            </span>
          </span>
        </li>
      </ul>

      <!-- Prototype shortcuts -->
      <section v-if="!isSupabaseConfigured" class="mt-8 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
        <h2 class="text-[11px] font-bold uppercase tracking-wide text-kenalan-200">
          Simulasi scan NFC
        </h2>
        <p class="mt-1.5 text-[11px] leading-relaxed text-slate-400">
          Demo mode aktif. Pilih salah satu buat mencoba tiap skenario tanpa tag fisik.
        </p>

        <div class="mt-3 space-y-2">
          <RouterLink
            v-for="token in unclaimed.slice(0, 1)"
            :key="token.token"
            :to="{ name: 'activate', query: { token: token.token } }"
            class="flex items-center gap-2.5 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10 transition hover:bg-white/10"
          >
            <span class="rounded-lg bg-mint/20 px-2 py-1 text-[10px] font-bold text-mint">BARU</span>
            <span class="min-w-0 flex-1">
              <span class="block font-mono text-[12px] font-bold">{{ token.token }}</span>
              <span class="block text-[10px] text-slate-400">Skenario 1 — token belum diklaim</span>
            </span>
            <ArrowRight class="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          </RouterLink>

          <RouterLink
            v-for="token in claimed.slice(0, 2)"
            :key="token.token"
            :to="{ name: 'activate', query: { token: token.token } }"
            class="flex items-center gap-2.5 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10 transition hover:bg-white/10"
          >
            <span class="rounded-lg bg-kenalan-400/20 px-2 py-1 text-[10px] font-bold text-kenalan-200">
              AKTIF
            </span>
            <span class="min-w-0 flex-1">
              <span class="block font-mono text-[12px] font-bold">{{ token.token }}</span>
              <span class="block text-[10px] text-slate-400">
                Skenario 2 — auto-redirect ke profil pemilik
              </span>
            </span>
            <ArrowRight class="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          </RouterLink>
        </div>
      </section>

      <p class="mt-8 text-center text-[10px] text-slate-500">
        Prototype · Kenalan Venture Project
      </p>
    </div>
  </div>
</template>
