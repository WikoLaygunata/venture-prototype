<script setup>
/**
 * MapView — "Location Stamp" home screen.
 *
 * Three layers:
 *   1. a mock campus map with spot pins, sized by how many live stamps they hold
 *   2. a horizontal list of popular spots
 *   3. the "Spot Stamps Around You" feed — stamps from the last 24 hours only
 *
 * The FAB opens a bottom sheet to drop your own stamp.
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  LoaderCircle,
  MapPin,
  Plus,
  RefreshCw,
  Radar,
  Send,
} from 'lucide-vue-next'

import AppHeader from '@/components/AppHeader.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import ColorCodeBadge from '@/components/ColorCodeBadge.vue'
import LocationStampCard from '@/components/LocationStampCard.vue'
import StateBlock from '@/components/StateBlock.vue'
import UserAvatar from '@/components/UserAvatar.vue'

import {
  createStamp,
  deleteStamp,
  fetchRecentStamps,
  fetchSpots,
  sendPing,
} from '@/lib/api'
import { currentProfile, currentUserId } from '@/stores/auth'
import { toast } from '@/stores/toast'

const router = useRouter()

const spots = ref([])
const stamps = ref([])
const loading = ref(true)
const loadError = ref('')

/** null = show everything; otherwise filter the feed by spot. */
const activeSpotId = ref(null)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [spotRows, stampRows] = await Promise.all([fetchSpots(), fetchRecentStamps()])
    spots.value = spotRows
    stamps.value = stampRows
  } catch (error) {
    loadError.value = error.message
  } finally {
    loading.value = false
  }
}

onMounted(load)

/** Live stamp count per spot, used for pin sizing and the spot chips. */
const countsBySpot = computed(() => {
  const counts = {}
  for (const stamp of stamps.value) {
    counts[stamp.spot_id] = (counts[stamp.spot_id] ?? 0) + 1
  }
  return counts
})

const visibleStamps = computed(() =>
  activeSpotId.value ? stamps.value.filter((s) => s.spot_id === activeSpotId.value) : stamps.value,
)

const activeSpot = computed(() => spots.value.find((s) => s.id === activeSpotId.value) ?? null)

const peopleNearby = computed(() => {
  const ids = new Set(stamps.value.map((s) => s.user_id))
  ids.delete(currentUserId.value)
  return ids.size
})

function toggleSpot(spotId) {
  activeSpotId.value = activeSpotId.value === spotId ? null : spotId
}

/* ------------------------------------------------------------ create a stamp */

const stampSheetOpen = ref(false)
const stampForm = ref({ spotId: '', message: '' })
const savingStamp = ref(false)

const QUICK_MESSAGES = [
  'Lagi di sini, open buat ngobrol santai ☕',
  'Nugas sendirian, butuh temen fokus 📚',
  'Nyari temen makan siang 🍜',
  'Ada waktu 1 jam kosong, ada yang mau kenalan?',
]

function openStampSheet(spotId = null) {
  stampForm.value = {
    spotId: spotId ?? activeSpotId.value ?? spots.value[0]?.id ?? '',
    message: '',
  }
  stampSheetOpen.value = true
}

const canStamp = computed(
  () => Boolean(stampForm.value.spotId) && stampForm.value.message.trim().length >= 4,
)

async function submitStamp() {
  if (!canStamp.value) return

  savingStamp.value = true
  try {
    const created = await createStamp({
      userId: currentUserId.value,
      spotId: stampForm.value.spotId,
      message: stampForm.value.message.trim(),
    })
    // Optimistically prepend so the feed reacts instantly.
    stamps.value = [created, ...stamps.value]
    stampSheetOpen.value = false
    toast.success('Stamp kamu tayang! Aktif selama 24 jam ⏱️')
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
  pingMessage.value = `Halo! Aku lihat stamp kamu di ${stamp.spot?.name ?? 'kampus'}. `
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

function openProfile(userId) {
  if (!userId) return
  if (userId === currentUserId.value) router.push({ name: 'profile' })
  else router.push({ name: 'user-profile', params: { user_id: userId } })
}

/** Pin size scales with activity so busy spots read first. */
function pinScale(spotId) {
  const count = countsBySpot.value[spotId] ?? 0
  if (count >= 3) return 'h-11 w-11 text-lg'
  if (count >= 1) return 'h-9 w-9 text-base'
  return 'h-7 w-7 text-xs opacity-60'
}
</script>

<template>
  <div class="relative flex h-full flex-col bg-slate-50">
    <AppHeader title="Explore Kampus" :subtitle="`${peopleNearby} orang aktif di sekitarmu`">
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

    <div class="screen-scroll pb-28">
      <StateBlock :loading="loading" :error="loadError" loading-text="Memuat spot kampus…" @retry="load">
        <!-- ================================================= mock campus map -->
        <section class="px-5 pt-4">
          <div
            class="relative h-52 overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-emerald-50 via-sky-50 to-kenalan-50"
            role="img"
            aria-label="Peta kampus dengan titik spot aktif"
          >
            <!-- decorative "paths" -->
            <svg class="absolute inset-0 h-full w-full" aria-hidden="true">
              <path
                d="M0 130 Q 110 90 190 150 T 420 120"
                fill="none"
                stroke="#cbd5e1"
                stroke-width="10"
                stroke-linecap="round"
                opacity="0.55"
              />
              <path
                d="M60 0 Q 90 100 40 210"
                fill="none"
                stroke="#cbd5e1"
                stroke-width="8"
                stroke-linecap="round"
                opacity="0.45"
              />
              <path
                d="M250 0 Q 270 110 330 210"
                fill="none"
                stroke="#cbd5e1"
                stroke-width="8"
                stroke-linecap="round"
                opacity="0.45"
              />
            </svg>

            <!-- spot pins -->
            <button
              v-for="spot in spots"
              :key="spot.id"
              type="button"
              class="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md ring-2 transition hover:scale-110 active:scale-95"
              :class="[
                pinScale(spot.id),
                activeSpotId === spot.id ? 'ring-kenalan-500' : 'ring-white',
              ]"
              :style="{ left: `${spot.x}%`, top: `${spot.y}%` }"
              :aria-label="`${spot.name}, ${countsBySpot[spot.id] ?? 0} stamp aktif`"
              :aria-pressed="activeSpotId === spot.id"
              @click="toggleSpot(spot.id)"
            >
              <span aria-hidden="true">{{ spot.emoji }}</span>
              <span
                v-if="(countsBySpot[spot.id] ?? 0) > 0"
                class="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-kenalan-500 px-1 text-[10px] font-bold text-white"
                aria-hidden="true"
              >
                {{ countsBySpot[spot.id] }}
              </span>
            </button>

            <!-- "you are here" pulse -->
            <div
              class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              aria-hidden="true"
            >
              <span class="absolute inset-0 m-auto h-3 w-3 animate-pulse-ring rounded-full bg-kenalan-400" />
              <span class="relative block h-3 w-3 rounded-full bg-kenalan-500 ring-4 ring-white" />
            </div>

            <p
              class="absolute bottom-2.5 left-3 rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 backdrop-blur"
            >
              Mock peta kampus
            </p>
          </div>
        </section>

        <!-- ================================================== popular spots -->
        <section class="pt-5">
          <div class="flex items-center justify-between px-5">
            <h2 class="text-sm font-extrabold tracking-tight text-slate-800">Spot populer</h2>
            <button
              v-if="activeSpotId"
              type="button"
              class="text-[11px] font-bold text-kenalan-600"
              @click="activeSpotId = null"
            >
              Tampilkan semua
            </button>
          </div>

          <div class="mt-3 flex gap-2.5 overflow-x-auto no-scrollbar px-5 pb-1">
            <button
              v-for="spot in spots"
              :key="spot.id"
              type="button"
              class="flex w-[7.5rem] shrink-0 flex-col gap-1 rounded-2xl border-2 bg-white p-3 text-left transition active:scale-[0.97]"
              :class="
                activeSpotId === spot.id
                  ? 'border-kenalan-400 shadow-card'
                  : 'border-slate-100 hover:border-slate-200'
              "
              :aria-pressed="activeSpotId === spot.id"
              @click="toggleSpot(spot.id)"
            >
              <span class="text-xl" aria-hidden="true">{{ spot.emoji }}</span>
              <span class="text-[13px] font-bold leading-tight text-slate-700">{{ spot.name }}</span>
              <span class="text-[11px] font-semibold text-kenalan-600">
                {{ countsBySpot[spot.id] ?? 0 }} stamp aktif
              </span>
            </button>
          </div>
        </section>

        <!-- ======================================== stamps around you (24h) -->
        <section class="px-5 pt-6">
          <div class="mb-3 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="flex items-center gap-1.5 text-sm font-extrabold tracking-tight text-slate-800">
                <Radar class="h-4 w-4 text-kenalan-500" aria-hidden="true" />
                Spot Stamps Around You
              </h2>
              <p class="mt-0.5 text-[11px] text-slate-400">
                {{
                  activeSpot
                    ? `Difilter: ${activeSpot.emoji} ${activeSpot.name}`
                    : 'Postingan 24 jam terakhir di sekitar kampus'
                }}
              </p>
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
            :empty="visibleStamps.length === 0"
            empty-icon="📍"
            empty-title="Belum ada stamp aktif"
            :empty-text="
              activeSpot
                ? `Belum ada yang stamp di ${activeSpot.name} dalam 24 jam terakhir. Jadi yang pertama!`
                : 'Semua stamp sudah hangus. Drop stamp pertama hari ini!'
            "
            :retryable="false"
          >
            <template #action>
              <button type="button" class="btn-secondary mt-2 !py-2.5 !text-xs" @click="openStampSheet()">
                <Plus class="h-3.5 w-3.5" aria-hidden="true" />
                Stamp Location
              </button>
            </template>

            <div class="space-y-3">
              <LocationStampCard
                v-for="stamp in visibleStamps"
                :key="stamp.id"
                :stamp="stamp"
                :is-own="stamp.user_id === currentUserId"
                @ping="openPing"
                @delete="removeStamp"
                @open-profile="openProfile"
              />
            </div>
          </StateBlock>
        </section>
      </StateBlock>
    </div>

    <!-- ===================================================== FAB: + Stamp -->
    <button
      type="button"
      class="absolute bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] right-5 z-30 inline-flex items-center gap-2 rounded-full bg-kenalan-500 px-5 py-3.5 text-sm font-bold text-white shadow-fab transition hover:bg-kenalan-600 active:scale-95"
      @click="openStampSheet()"
    >
      <Plus class="h-4 w-4" stroke-width="3" aria-hidden="true" />
      Stamp Location
    </button>

    <!-- =============================================== stamp form (modal) -->
    <BottomSheet
      :open="stampSheetOpen"
      :busy="savingStamp"
      title="Stamp Location"
      subtitle="Kasih tahu orang di sekitar kamu lagi di mana dan lagi apa."
      @close="stampSheetOpen = false"
    >
      <div class="space-y-4">
        <div>
          <span class="field-label">Pilih spot</span>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="spot in spots"
              :key="spot.id"
              type="button"
              class="flex flex-col items-center gap-1 rounded-2xl border-2 p-2.5 transition active:scale-95"
              :class="
                stampForm.spotId === spot.id
                  ? 'border-kenalan-400 bg-kenalan-50'
                  : 'border-slate-100 bg-white'
              "
              :aria-pressed="stampForm.spotId === spot.id"
              @click="stampForm.spotId = spot.id"
            >
              <span class="text-lg" aria-hidden="true">{{ spot.emoji }}</span>
              <span class="text-center text-[10px] font-bold leading-tight text-slate-600">
                {{ spot.name }}
              </span>
            </button>
          </div>
        </div>

        <div>
          <label for="stamp-message" class="field-label">Pesan singkat</label>
          <textarea
            id="stamp-message"
            v-model="stampForm.message"
            rows="3"
            maxlength="180"
            data-autofocus
            placeholder="Lagi di Kantin LT 1, nyari temen ngopi"
            class="input-field resize-none"
          />
          <div class="mt-1 flex items-center justify-between">
            <span class="text-[11px] text-slate-400">Otomatis hangus setelah 24 jam</span>
            <span class="text-[11px] text-slate-400">{{ stampForm.message.length }}/180</span>
          </div>
        </div>

        <div>
          <span class="field-label">Template cepat</span>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="text in QUICK_MESSAGES"
              :key="text"
              type="button"
              class="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-kenalan-100 hover:text-kenalan-700"
              @click="stampForm.message = text"
            >
              {{ text }}
            </button>
          </div>
        </div>

        <button type="button" class="btn-primary w-full !py-3.5" :disabled="!canStamp || savingStamp" @click="submitStamp">
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
            <p class="truncate text-[11px] text-slate-400">
              {{ pingTarget.spot?.emoji }} {{ pingTarget.spot?.name }}
            </p>
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
  </div>
</template>
