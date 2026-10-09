<script setup>
/**
 * MapView — the "Location Stamp" home screen.
 *
 * A stamp is a short "I'm around here right now" note that lives for 24 hours
 * and works as a thread (people reply to it). The exact place is never named;
 * the author writes a free-text location hint and the feed shows an approximate
 * distance instead.
 *
 * Layers:
 *   1. a decorative mock radar/map with a "you are here" pulse
 *   2. the "Stamps Around You" feed (last 24h), each card opens its thread
 *   3. a FAB that opens the stamp composer (message + optional location + image)
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Expand,
  ImagePlus,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Plus,
  Radar,
  RefreshCw,
  Send,
  X,
} from 'lucide-vue-next'

import AppHeader from '@/components/AppHeader.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import ColorCodeBadge from '@/components/ColorCodeBadge.vue'
import LocationStampCard from '@/components/LocationStampCard.vue'
import StampLocationModal from '@/components/StampLocationModal.vue'
import StampMap from '@/components/StampMap.vue'
import StateBlock from '@/components/StateBlock.vue'
import UserAvatar from '@/components/UserAvatar.vue'

import { createStamp, deleteStamp, fetchRecentStamps, sendPing } from '@/lib/api'
import { getStampAudiencePref, setStampAudiencePref } from '@/lib/mockData'
import { useGeolocation } from '@/lib/useGeolocation'
import { currentProfile, currentUserId } from '@/stores/auth'
import { toast } from '@/stores/toast'

const router = useRouter()

const stamps = ref([])
const loading = ref(true)
const loadError = ref('')

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    stamps.value = await fetchRecentStamps(currentUserId.value)
  } catch (error) {
    loadError.value = error.message
  } finally {
    loading.value = false
  }
}

onMounted(load)

const peopleNearby = computed(() => {
  const ids = new Set(stamps.value.map((s) => s.user_id))
  ids.delete(currentUserId.value)
  return ids.size
})

/* --------------------------------------------------------------- geolocation */

const { status: geoStatus, coords: geoCoords, error: geoError, request: requestGeo } =
  useGeolocation()

const userCoords = computed(() =>
  geoCoords.value ? { lat: geoCoords.value.lat, lng: geoCoords.value.lng } : null,
)
const geoActive = computed(() => geoStatus.value === 'active')

/* ------------------------------------------------------------ create a stamp */

const stampSheetOpen = ref(false)
const stampForm = ref({ message: '', locationLabel: '', imageUrl: '', audience: 'public' })
const savingStamp = ref(false)

const AUDIENCE_OPTIONS = [
  { value: 'public', label: 'Publik', hint: 'Semua orang di sekitar bisa lihat' },
  { value: 'mutual', label: 'Mutual aja', hint: 'Cuma yang sudah mutualan sama kamu' },
]

const LOCATION_HINTS = [
  'Deket kantin',
  'Gedung perkuliahan',
  'Area perpustakaan',
  'Taman kampus',
  'Dekat parkiran',
]

function openStampSheet() {
  // Default to whatever audience they last used, so they don't re-pick each time.
  stampForm.value = { message: '', locationLabel: '', imageUrl: '', audience: getStampAudiencePref() }
  stampSheetOpen.value = true
}

const canStamp = computed(() => stampForm.value.message.trim().length >= 4 && !savingStamp.value)

/**
 * Demo image handling: read the picked file to a data URL so a thumbnail shows
 * without any upload backend. Against Supabase you'd upload to Storage and keep
 * the public URL instead.
 */
function onPickImage(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    toast.error('File harus berupa gambar.')
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    toast.error('Gambar maksimal 5MB.')
    return
  }
  const reader = new FileReader()
  reader.onload = () => (stampForm.value.imageUrl = String(reader.result))
  reader.readAsDataURL(file)
}

async function submitStamp() {
  if (!canStamp.value) return

  savingStamp.value = true
  try {
    const created = await createStamp({
      userId: currentUserId.value,
      message: stampForm.value.message.trim(),
      locationLabel: stampForm.value.locationLabel.trim(),
      imageUrl: stampForm.value.imageUrl,
      audience: stampForm.value.audience,
      lat: userCoords.value?.lat ?? null,
      lng: userCoords.value?.lng ?? null,
    })
    // Remember the choice for next time.
    setStampAudiencePref(stampForm.value.audience)
    stamps.value = [created, ...stamps.value]
    stampSheetOpen.value = false
    toast.success(
      stampForm.value.audience === 'mutual'
        ? 'Stamp tayang buat mutual kamu! Aktif 24 jam ⏱️'
        : 'Stamp kamu tayang! Aktif selama 24 jam ⏱️',
    )
  } catch (error) {
    toast.error(error.message)
  } finally {
    savingStamp.value = false
  }
}

async function removeStamp(stamp) {
  try {
    await deleteStamp(stamp.id, currentUserId.value)
    stamps.value = stamps.value.filter((s) => s.id !== stamp.id)
    toast.info('Stamp dihapus.')
  } catch (error) {
    toast.error(error.message)
  }
}

/* --------------------------------------------------------- PING from the feed */

const pingTarget = ref(null)
const pingMessage = ref('')
const sendingPing = ref(false)

function openPing(stamp) {
  pingTarget.value = stamp
  pingMessage.value = 'Halo! Aku lihat stamp kamu, kayaknya kita lagi deketan. '
}

async function submitPing() {
  const message = pingMessage.value.trim()
  if (!message || !pingTarget.value) return

  sendingPing.value = true
  try {
    await sendPing({
      senderId: currentUserId.value,
      receiverId: pingTarget.value.user_id,
      message,
    })
    toast.success('PING terkirim! Cek tab Mutualan buat balasannya.')
    pingTarget.value = null
  } catch (error) {
    toast.error(error.message)
  } finally {
    sendingPing.value = false
  }
}

function openThread(stamp) {
  router.push({ name: 'stamp-thread', params: { id: stamp.id } })
}

/* ----------------------------------------------------------- fullscreen map */

const mapExpanded = ref(false)

function openThreadFromExpanded(stamp) {
  mapExpanded.value = false
  openThread(stamp)
}

/* ------------------------------------------------------------- location map */

const locationStamp = ref(null)

function openLocation(stamp) {
  locationStamp.value = stamp
}

function openProfile(userId) {
  if (!userId) return
  if (userId === currentUserId.value) router.push({ name: 'profile' })
  else router.push({ name: 'user-profile', params: { user_id: userId } })
}


</script>

<template>
  <div class="relative flex h-full flex-col bg-slate-50">
    <AppHeader title="Map" :subtitle="`${peopleNearby} orang aktif di sekitarmu`">
      <template #actions>
        <ColorCodeBadge
          v-if="currentProfile"
          :code="currentProfile.color_code"
          size="sm"
          interactive
          @click="router.push({ name: 'profile' })"
        />
      </template>
    </AppHeader>

    <div class="screen-scroll">
      <StateBlock :loading="loading" :error="loadError" loading-text="Memuat stamp…" @retry="load">
        <!-- ============================================= interactive map -->
        <section class="px-5 pt-4">
          <div class="relative h-72 overflow-hidden rounded-3xl border border-slate-200 shadow-card">
            <StampMap :stamps="stamps" :user-coords="userCoords" @open="openThread" />

            <!-- controls overlay the map, top-right (z-10 keeps them above the
                 map's capped panes but below app modals) -->
            <div class="absolute right-2.5 top-2.5 z-10 flex items-center gap-1.5">
              <button
                v-if="!geoActive"
                type="button"
                class="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-kenalan-700 shadow-md backdrop-blur transition hover:bg-white disabled:opacity-60"
                :disabled="geoStatus === 'prompting' || geoStatus === 'unsupported'"
                @click="requestGeo"
              >
                <LocateFixed class="h-3.5 w-3.5" aria-hidden="true" />
                {{ geoStatus === 'prompting' ? 'Mencari…' : 'Lokasiku' }}
              </button>
              <span
                v-else
                class="inline-flex items-center gap-1.5 rounded-full bg-sky-500/95 px-3 py-1.5 text-[11px] font-bold text-white shadow-md"
              >
                <LocateFixed class="h-3.5 w-3.5" aria-hidden="true" />
                Lokasi aktif
              </span>

              <button
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow-md backdrop-blur transition hover:bg-white active:scale-95"
                aria-label="Perbesar peta"
                @click="mapExpanded = true"
              >
                <Expand class="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
          <p v-if="geoError" class="mt-1.5 px-1 text-[11px] font-semibold text-blush-deep">
            {{ geoError }}
          </p>
          <p v-else class="mt-1.5 px-1 text-[11px] text-slate-400">
            Geser buat jelajah peta. Ketuk pin buat buka thread stamp-nya.
          </p>
        </section>

        <!-- ======================================== stamps around you (24h) -->
        <section class="px-5 pb-24 pt-6">
          <div class="mb-3 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="flex items-center gap-1.5 text-sm font-extrabold tracking-tight text-slate-800">
                <Radar class="h-4 w-4 text-kenalan-500" aria-hidden="true" />
                Stamps Around You
              </h2>
              <p class="mt-0.5 text-[11px] text-slate-400">Postingan 24 jam terakhir di sekitarmu</p>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Muat ulang feed"
              @click="load"
            >
              <RefreshCw class="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <StateBlock
            :empty="stamps.length === 0"
            empty-icon="📍"
            empty-title="Belum ada stamp aktif"
            empty-text="Semua stamp sudah hangus. Drop stamp pertama hari ini!"
            :retryable="false"
          >
            <template #action>
              <button type="button" class="btn-secondary mt-2 !py-2.5 !text-xs" @click="openStampSheet">
                <Plus class="h-3.5 w-3.5" aria-hidden="true" />
                Stamp Location
              </button>
            </template>

            <div class="space-y-3">
              <LocationStampCard
                v-for="stamp in stamps"
                :key="stamp.id"
                :stamp="stamp"
                :is-own="stamp.user_id === currentUserId"
                :viewer-coords="userCoords"
                @ping="openPing"
                @delete="removeStamp"
                @open-profile="openProfile"
                @open-thread="openThread"
                @open-location="openLocation"
              />
            </div>
          </StateBlock>
        </section>
      </StateBlock>
    </div>

    <!-- ===================================================== FAB: + Stamp -->
    <!-- absolute to the view root so it floats above the feed, just over the nav -->
    <button
      type="button"
      class="absolute bottom-4 right-5 z-20 inline-flex items-center gap-2 rounded-full bg-kenalan-500 px-5 py-3.5 text-sm font-bold text-white shadow-fab transition hover:bg-kenalan-600 active:scale-95"
      @click="openStampSheet"
    >
      <Plus class="h-4 w-4" stroke-width="3" aria-hidden="true" />
      Stamp Location
    </button>

    <!-- =========================================== fullscreen map overlay -->
    <!-- z-40 = same layer as BottomSheet, still below ToastHost (z-50) -->
    <div v-if="mapExpanded" class="absolute inset-0 z-40 flex flex-col bg-white animate-fade-in">
      <div
        class="flex shrink-0 items-center justify-between gap-3 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3"
      >
        <div class="min-w-0">
          <p class="text-sm font-extrabold tracking-tight text-slate-800">Peta Stamp</p>
          <p class="text-[11px] text-slate-400">{{ stamps.length }} stamp aktif di sekitarmu</p>
        </div>
        <button
          type="button"
          class="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 active:scale-95"
          aria-label="Tutup peta"
          @click="mapExpanded = false"
        >
          <X class="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div class="relative flex-1">
        <StampMap :stamps="stamps" :user-coords="userCoords" @open="openThreadFromExpanded" />

        <div class="absolute right-3 top-3 z-10">
          <button
            v-if="!geoActive"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-kenalan-700 shadow-md backdrop-blur transition hover:bg-white disabled:opacity-60"
            :disabled="geoStatus === 'prompting' || geoStatus === 'unsupported'"
            @click="requestGeo"
          >
            <LocateFixed class="h-3.5 w-3.5" aria-hidden="true" />
            {{ geoStatus === 'prompting' ? 'Mencari…' : 'Lokasiku' }}
          </button>
          <span
            v-else
            class="inline-flex items-center gap-1.5 rounded-full bg-sky-500/95 px-3 py-1.5 text-[11px] font-bold text-white shadow-md"
          >
            <LocateFixed class="h-3.5 w-3.5" aria-hidden="true" />
            Lokasi aktif
          </span>
        </div>
      </div>
    </div>

    <!-- =============================================== stamp form (modal) -->
    <BottomSheet
      :open="stampSheetOpen"
      :busy="savingStamp"
      title="Stamp Location"
      subtitle="Kasih tahu orang sekitar kamu lagi di mana dan lagi apa."
      @close="stampSheetOpen = false"
    >
      <div class="space-y-4">
        <div>
          <label for="stamp-message" class="field-label">Pesan singkat</label>
          <textarea
            id="stamp-message"
            v-model="stampForm.message"
            rows="3"
            maxlength="180"
            data-autofocus
            placeholder="Lagi nyari temen ngopi, santai aja"
            class="input-field resize-none"
          />
          <div class="mt-1 flex items-center justify-between">
            <span class="text-[11px] text-slate-400">Otomatis hangus setelah 24 jam</span>
            <span class="text-[11px] text-slate-400">{{ stampForm.message.length }}/180</span>
          </div>
        </div>

        <!-- free-text location hint instead of a named spot -->
        <div>
          <label for="stamp-location" class="field-label">Keterangan lokasi (opsional)</label>
          <input
            id="stamp-location"
            v-model="stampForm.locationLabel"
            type="text"
            maxlength="60"
            placeholder="mis. deket kantin, gedung sebelah barat"
            class="input-field"
          />
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="hint in LOCATION_HINTS"
              :key="hint"
              type="button"
              class="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-kenalan-100 hover:text-kenalan-700"
              @click="stampForm.locationLabel = hint"
            >
              {{ hint }}
            </button>
          </div>
          <p class="mt-1.5 text-[11px] leading-relaxed text-slate-400">
            Alamat persis nggak ditampilkan ke orang lain — mereka cuma lihat perkiraan jarak.
          </p>
        </div>

        <!-- audience: who can see this stamp -->
        <div>
          <span class="field-label">Siapa yang bisa lihat</span>
          <div class="flex gap-1 rounded-2xl bg-slate-100 p-1" role="radiogroup" aria-label="Audiens stamp">
            <button
              v-for="opt in AUDIENCE_OPTIONS"
              :key="opt.value"
              type="button"
              role="radio"
              :aria-checked="stampForm.audience === opt.value"
              class="flex-1 rounded-xl py-2 text-[12px] font-bold transition"
              :class="
                stampForm.audience === opt.value
                  ? 'bg-white text-kenalan-600 shadow-sm'
                  : 'text-slate-500'
              "
              @click="stampForm.audience = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
          <p class="mt-1.5 text-[11px] leading-relaxed text-slate-400">
            {{ AUDIENCE_OPTIONS.find((o) => o.value === stampForm.audience)?.hint }}
            Pilihan ini diingat untuk stamp berikutnya.
          </p>
        </div>

        <!-- optional image -->
        <div>
          <span class="field-label">Foto (opsional)</span>
          <div v-if="stampForm.imageUrl" class="relative">
            <img
              :src="stampForm.imageUrl"
              alt="Pratinjau foto stamp"
              class="h-40 w-full rounded-2xl object-cover"
            />
            <button
              type="button"
              class="absolute right-2 top-2 rounded-full bg-slate-900/60 p-1.5 text-white backdrop-blur transition hover:bg-slate-900/80"
              aria-label="Hapus foto"
              @click="stampForm.imageUrl = ''"
            >
              <X class="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <label
            v-else
            class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-6 text-slate-400 transition hover:border-kenalan-300 hover:text-kenalan-500"
          >
            <ImagePlus class="h-6 w-6" aria-hidden="true" />
            <span class="text-xs font-semibold">Tambah foto</span>
            <input type="file" accept="image/*" class="sr-only" @change="onPickImage" />
          </label>
        </div>

        <button type="button" class="btn-primary w-full !py-3.5" :disabled="!canStamp" @click="submitStamp">
          <LoaderCircle v-if="savingStamp" class="h-4 w-4 animate-spin" aria-hidden="true" />
          <MapPin v-else class="h-4 w-4" aria-hidden="true" />
          {{ savingStamp ? 'Menempel stamp…' : 'Tempel Stamp' }}
        </button>
      </div>
    </BottomSheet>

    <!-- ============================================ PING from a feed card -->
    <BottomSheet
      :open="Boolean(pingTarget)"
      :busy="sendingPing"
      :title="`PING ke ${pingTarget?.profile?.full_name ?? ''}`"
      subtitle="Balas stamp-nya dengan pesan singkat."
      @close="pingTarget = null"
    >
      <div v-if="pingTarget" class="space-y-4">
        <div class="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
          <UserAvatar :profile="pingTarget.profile ?? {}" size="sm" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-bold text-slate-700">
              {{ pingTarget.profile?.full_name }}
            </p>
            <p class="truncate text-[11px] text-slate-400">{{ pingTarget.message }}</p>
          </div>
        </div>

        <div>
          <label for="feed-ping-message" class="field-label">Pesan kamu</label>
          <textarea
            id="feed-ping-message"
            v-model="pingMessage"
            rows="4"
            maxlength="220"
            data-autofocus
            class="input-field resize-none"
          />
        </div>

        <button
          type="button"
          class="btn-primary w-full !py-3.5"
          :disabled="!pingMessage.trim() || sendingPing"
          @click="submitPing"
        >
          <LoaderCircle v-if="sendingPing" class="h-4 w-4 animate-spin" aria-hidden="true" />
          <Send v-else class="h-4 w-4" aria-hidden="true" />
          {{ sendingPing ? 'Mengirim…' : 'Kirim PING!' }}
        </button>
      </div>
    </BottomSheet>

    <!-- =============================================== stamp location map -->
    <StampLocationModal
      :open="Boolean(locationStamp)"
      :stamp="locationStamp"
      @close="locationStamp = null"
    />
  </div>
</template>
