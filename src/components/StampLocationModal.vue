<script setup>
/**
 * StampLocationModal — a mini "where is this stamp" map.
 *
 * Now a real Leaflet map (via StampMap) centred on the stamp's coordinates,
 * with the stamp marker and — when geolocation is on — a live "you" marker.
 * The distance/direction summary stays as a quick textual orientation.
 */
import { computed, ref, watch } from 'vue'
import { LocateFixed, Navigation } from 'lucide-vue-next'

import BottomSheet from '@/components/BottomSheet.vue'
import StampMap from '@/components/StampMap.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { useGeolocation } from '@/lib/useGeolocation'
import { bearingDeg, compassLabel, distanceLabel, haversineMeters } from '@/lib/time'

const props = defineProps({
  open: { type: Boolean, default: false },
  stamp: { type: Object, default: null },
})

defineEmits(['close'])

const { status: geoStatus, coords: geoCoords, error: geoError, request: requestGeo } =
  useGeolocation()

const profile = computed(() => props.stamp?.profile ?? {})
const label = computed(() => props.stamp?.location_label?.trim() || '')
const geoActive = computed(() => geoStatus.value === 'active')

// Real distance + bearing from the viewer's location to the stamp, computed
// from coordinates. Null until the viewer shares their location.
const distanceM = computed(() => {
  if (!props.stamp || !geoCoords.value || props.stamp.lat == null) return null
  return haversineMeters(
    { lat: geoCoords.value.lat, lng: geoCoords.value.lng },
    { lat: props.stamp.lat, lng: props.stamp.lng },
  )
})
const bearing = computed(() => {
  if (!props.stamp || !geoCoords.value || props.stamp.lat == null) return null
  return bearingDeg(
    { lat: geoCoords.value.lat, lng: geoCoords.value.lng },
    { lat: props.stamp.lat, lng: props.stamp.lng },
  )
})
const direction = computed(() => (bearing.value == null ? '' : compassLabel(bearing.value)))

/** StampMap wants an array; feed it just this one stamp (if it has coords). */
const mapStamps = computed(() =>
  props.stamp && props.stamp.lat != null && props.stamp.lng != null ? [props.stamp] : [],
)
const userCoords = computed(() =>
  geoCoords.value ? { lat: geoCoords.value.lat, lng: geoCoords.value.lng } : null,
)
const hasCoords = computed(() => mapStamps.value.length > 0)

const mapRef = ref(null)

// When the sheet opens, the map mounts fresh; nudge it to re-measure once the
// open animation has settled.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) setTimeout(() => mapRef.value?.refresh?.(), 220)
  },
)
</script>

<template>
  <BottomSheet
    :open="open"
    :title="`Lokasi ${profile.full_name || 'stamp'}`"
    subtitle="Lokasi perkiraan di peta."
    @close="$emit('close')"
  >
    <div v-if="stamp" class="space-y-4">
      <!-- leaflet mini map -->
      <div
        v-if="hasCoords"
        class="relative mx-auto h-56 w-full overflow-hidden rounded-3xl border border-slate-200 shadow-card"
      >
        <StampMap ref="mapRef" :stamps="mapStamps" :user-coords="userCoords" readonly />
      </div>
      <div
        v-else
        class="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-8 text-center text-xs text-slate-400"
      >
        Stamp ini belum punya titik koordinat di peta.
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
          Biar titik kamu muncul di peta dan lebih gampang lihat arahnya ke stamp ini.
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
          Lokasi kamu aktif — titik birunya kamu.
        </p>
      </div>

      <!-- author chip -->
      <div class="flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-3">
        <UserAvatar :profile="profile" size="sm" />
        <div class="min-w-0">
          <p class="truncate text-sm font-bold text-slate-700">{{ profile.full_name }}</p>
          <p class="truncate text-[11px] text-slate-400">{{ profile.major || 'Mahasiswa' }}</p>
        </div>
      </div>
    </div>
  </BottomSheet>
</template>
