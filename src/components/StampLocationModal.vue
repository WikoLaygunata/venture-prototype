<script setup>
/**
 * StampLocationModal — a mini "where is this stamp" map.
 *
 * Shows YOU at the centre and the stamp as a dot placed by its approximate
 * distance + bearing. The prototype has no real coordinates, so this is a
 * relative radar, not a street map: the point still conveys roughly how far and
 * in which direction the stamp is.
 *
 * If the viewer turns on location, a live "you" indicator lights up and the
 * direction hint ("ke arah Timur Laut") is shown to help them orient.
 */
import { computed, watch } from 'vue'
import { LocateFixed, MapPin, Navigation } from 'lucide-vue-next'

import BottomSheet from '@/components/BottomSheet.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { useGeolocation } from '@/lib/useGeolocation'
import { compassLabel, distanceLabel } from '@/lib/time'

const props = defineProps({
  open: { type: Boolean, default: false },
  stamp: { type: Object, default: null },
})

defineEmits(['close'])

const { status: geoStatus, error: geoError, request: requestGeo } = useGeolocation()

const profile = computed(() => props.stamp?.profile ?? {})
const distanceM = computed(() => props.stamp?.distance_m ?? 0)
const bearing = computed(() => props.stamp?.bearing_deg ?? 0)
const label = computed(() => props.stamp?.location_label?.trim() || '')
const direction = computed(() => compassLabel(bearing.value))
const geoActive = computed(() => geoStatus.value === 'active')

/**
 * Place the stamp dot inside the radar. The farthest seeded stamp is ~1.2km, so
 * we compress distance with a sqrt curve and cap the radius so very far stamps
 * still sit inside the ring instead of flying off the edge.
 */
const dotStyle = computed(() => {
  const maxR = 44 // % from centre to the inner edge of the outer ring
  const normalized = Math.min(1, Math.sqrt(distanceM.value / 1500))
  const r = 6 + normalized * maxR
  // bearing: 0° = North (up), clockwise. Convert to maths angle.
  const rad = ((bearing.value - 90) * Math.PI) / 180
  const x = 50 + r * Math.cos(rad)
  const y = 50 + r * Math.sin(rad)
  return { left: `${x}%`, top: `${y}%` }
})

// Reset nothing on open; geolocation stays sticky across opens within a session.
watch(
  () => props.open,
  () => {},
)
</script>

<template>
  <BottomSheet
    :open="open"
    :title="`Lokasi ${profile.full_name || 'stamp'}`"
    subtitle="Perkiraan posisi relatif — bukan titik persis."
    @close="$emit('close')"
  >
    <div v-if="stamp" class="space-y-4">
      <!-- radar mini map -->
      <div
        class="relative mx-auto aspect-square w-full max-w-[18rem] overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-kenalan-50 via-sky-50 to-emerald-50"
        role="img"
        :aria-label="`Peta mini: stamp berjarak ${distanceLabel(distanceM)}${direction ? `, ke arah ${direction}` : ''}`"
      >
        <!-- range rings -->
        <div class="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span class="absolute h-1/4 w-1/4 rounded-full border border-kenalan-200" />
          <span class="absolute h-1/2 w-1/2 rounded-full border border-kenalan-200/70" />
          <span class="absolute h-3/4 w-3/4 rounded-full border border-kenalan-200/40" />
          <span class="absolute h-[1px] w-full bg-kenalan-200/40" />
          <span class="absolute h-full w-[1px] bg-kenalan-200/40" />
        </div>

        <!-- compass N marker -->
        <span
          class="absolute left-1/2 top-1.5 -translate-x-1/2 text-[10px] font-bold text-slate-400"
          aria-hidden="true"
        >
          N
        </span>

        <!-- line from me to the stamp -->
        <svg class="absolute inset-0 h-full w-full" aria-hidden="true">
          <line
            x1="50%"
            y1="50%"
            :x2="dotStyle.left"
            :y2="dotStyle.top"
            stroke="currentColor"
            class="text-kenalan-400"
            stroke-width="2"
            stroke-dasharray="4 4"
          />
        </svg>

        <!-- me (centre) -->
        <div
          class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          aria-hidden="true"
        >
          <span
            v-if="geoActive"
            class="absolute inset-0 m-auto h-4 w-4 animate-pulse-ring rounded-full bg-sky-400"
          />
          <span
            class="relative block h-4 w-4 rounded-full ring-4 ring-white"
            :class="geoActive ? 'bg-sky-500' : 'bg-slate-400'"
          />
        </div>

        <!-- the stamp -->
        <div
          class="absolute -translate-x-1/2 -translate-y-1/2"
          :style="dotStyle"
        >
          <div class="relative">
            <span class="absolute inset-0 m-auto h-5 w-5 animate-pulse-ring rounded-full bg-kenalan-400" />
            <span
              class="relative flex h-6 w-6 items-center justify-center rounded-full bg-kenalan-500 text-white ring-4 ring-white"
            >
              <MapPin class="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </div>
        </div>
      </div>

      <!-- legend -->
      <div class="flex items-center justify-center gap-4 text-[11px] font-semibold">
        <span class="inline-flex items-center gap-1.5 text-slate-500">
          <span class="h-2.5 w-2.5 rounded-full" :class="geoActive ? 'bg-sky-500' : 'bg-slate-400'" />
          Kamu
        </span>
        <span class="inline-flex items-center gap-1.5 text-kenalan-600">
          <span class="h-2.5 w-2.5 rounded-full bg-kenalan-500" />
          Stamp
        </span>
      </div>

      <!-- distance + direction -->
      <div class="rounded-2xl bg-slate-50 p-4 text-center">
        <p class="text-sm font-bold text-slate-800">{{ distanceLabel(distanceM) }}</p>
        <p v-if="direction" class="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-500">
          <Navigation class="h-3 w-3" aria-hidden="true" />
          Ke arah {{ direction }}
        </p>
        <p v-if="label" class="mt-2 text-xs text-slate-500">
          Keterangan: <span class="font-semibold text-slate-600">{{ label }}</span>
        </p>
      </div>

      <!-- geolocation control -->
      <div v-if="!geoActive" class="rounded-2xl border border-kenalan-100 bg-kenalan-50/60 p-3.5">
        <p class="text-xs font-bold text-kenalan-700">Aktifkan lokasi kamu</p>
        <p class="mt-1 text-[11px] leading-relaxed text-kenalan-700/70">
          Biar titik kamu muncul dan lebih gampang lihat arahnya ke stamp ini.
        </p>
        <p v-if="geoError" class="mt-1.5 text-[11px] font-semibold text-blush-deep">{{ geoError }}</p>
        <button
          type="button"
          class="btn-secondary mt-2.5 w-full !py-2.5 !text-xs"
          :disabled="geoStatus === 'prompting' || geoStatus === 'unsupported'"
          @click="requestGeo"
        >
          <LocateFixed class="h-3.5 w-3.5" aria-hidden="true" />
          {{ geoStatus === 'prompting' ? 'Mengambil lokasi…' : 'Aktifkan lokasi saya' }}
        </button>
      </div>

      <div
        v-else
        class="flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sky-700"
      >
        <LocateFixed class="h-4 w-4 shrink-0" aria-hidden="true" />
        <p class="text-[11px] font-semibold">
          Lokasi kamu aktif — titik birunya kamu. Jarak persis disamarkan demi privasi.
        </p>
      </div>

      <!-- author chip -->
      <button
        type="button"
        class="flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-3 text-left"
        disabled
      >
        <UserAvatar :profile="profile" size="sm" />
        <div class="min-w-0">
          <p class="truncate text-sm font-bold text-slate-700">{{ profile.full_name }}</p>
          <p class="truncate text-[11px] text-slate-400">{{ profile.major || 'Mahasiswa' }}</p>
        </div>
      </button>
    </div>
  </BottomSheet>
</template>
