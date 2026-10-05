<script setup>
/**
 * ExploreView — recommendations of people to mutualan with.
 *
 * Only shows profiles that opted into discovery (`is_discoverable`), are not
 * already a mutual, and are not blocked. If the viewer themselves is hidden,
 * a banner nudges them to turn discovery on (and links to the edit screen).
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { EyeOff, LoaderCircle, RefreshCw, Send, Sparkles } from 'lucide-vue-next'

import AppHeader from '@/components/AppHeader.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import ColorCodeBadge from '@/components/ColorCodeBadge.vue'
import StateBlock from '@/components/StateBlock.vue'
import UserAvatar from '@/components/UserAvatar.vue'

import { fetchRecommendedProfiles, hasPendingPing, sendPing, setDiscoverable } from '@/lib/api'
import { COLOR_CODE_LIST, getColorCode } from '@/lib/colorCodes'
import { currentProfile, currentUserId, refreshProfile } from '@/stores/auth'
import { toast } from '@/stores/toast'

const router = useRouter()

const people = ref([])
const loading = ref(true)
const loadError = ref('')
const pendingToggle = ref(false)

const hidden = computed(() => currentProfile.value?.is_discoverable === false)

/* ------------------------------------------------------------ category filter */

// Active filter: { type: 'all' | 'status' | 'faculty', value }
const filter = ref({ type: 'all', value: null })

function setFilter(type, value) {
  filter.value = type === 'all' ? { type: 'all', value: null } : { type, value }
}

function isActiveFilter(type, value) {
  return filter.value.type === type && filter.value.value === value
}

/** Faculties present in the current recommendation set, for the chip row. */
const faculties = computed(() => {
  const set = new Set(people.value.map((p) => p.faculty).filter(Boolean))
  return [...set]
})

/** Which color codes actually appear, so we don't show empty status chips. */
const statuses = computed(() => {
  const present = new Set(people.value.map((p) => p.color_code))
  return COLOR_CODE_LIST.filter((s) => present.has(s.key))
})

const filteredPeople = computed(() => {
  if (filter.value.type === 'all') return people.value
  if (filter.value.type === 'status') {
    return people.value.filter((p) => p.color_code === filter.value.value)
  }
  if (filter.value.type === 'faculty') {
    return people.value.filter((p) => p.faculty === filter.value.value)
  }
  return people.value
})

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    people.value = await fetchRecommendedProfiles(currentUserId.value)
  } catch (error) {
    loadError.value = error.message
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function enableDiscovery() {
  pendingToggle.value = true
  try {
    await setDiscoverable(currentUserId.value, true)
    await refreshProfile()
    toast.success('Sekarang kamu muncul di rekomendasi orang lain ✨')
  } catch (error) {
    toast.error(error.message)
  } finally {
    pendingToggle.value = false
  }
}

/* --------------------------------------------------------------- PING flow */

const pingTarget = ref(null)
const pingMessage = ref('')
const sendingPing = ref(false)

async function openPing(person) {
  pingTarget.value = person
  pingMessage.value = `Halo ${person.full_name?.split(' ')[0] ?? ''}! Kayaknya kita bisa nyambung, kenalan yuk. `
  // Avoid duplicate PINGs: if one is already pending, say so and bail.
  if (await hasPendingPing(currentUserId.value, person.id)) {
    toast.info('Kamu udah pernah PING orang ini, tunggu balasannya ya.')
    pingTarget.value = null
  }
}

async function submitPing() {
  const message = pingMessage.value.trim()
  if (!message || !pingTarget.value) return

  sendingPing.value = true
  try {
    await sendPing({ senderId: currentUserId.value, receiverId: pingTarget.value.id, message })
    toast.success('PING terkirim! Cek tab Mutualan buat balasannya.')
    // Drop them from the list so the feed feels responsive.
    people.value = people.value.filter((p) => p.id !== pingTarget.value.id)
    pingTarget.value = null
  } catch (error) {
    toast.error(error.message)
  } finally {
    sendingPing.value = false
  }
}

function openProfile(userId) {
  router.push({ name: 'user-profile', params: { user_id: userId } })
}
</script>

<template>
  <div class="flex h-full flex-col bg-slate-50">
    <AppHeader title="Explore" subtitle="Rekomendasi buat mutualan">
      <template #actions>
        <button
          type="button"
          class="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Muat ulang"
          @click="load"
        >
          <RefreshCw class="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </template>
    </AppHeader>

    <div class="screen-scroll px-5 py-4">
      <!-- nudge if the viewer opted out of discovery -->
      <div
        v-if="hidden"
        class="mb-4 flex items-start gap-3 rounded-2xl border border-sunny/40 bg-sunny-soft p-3.5"
      >
        <EyeOff class="mt-0.5 h-4 w-4 shrink-0 text-sunny-deep" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="text-xs font-bold text-sunny-deep">Kamu lagi disembunyikan</p>
          <p class="mt-0.5 text-[11px] leading-relaxed text-sunny-deep/80">
            Profilmu nggak muncul di rekomendasi orang lain. Aktifkan biar lebih
            gampang ditemukan.
          </p>
          <button
            type="button"
            class="btn-secondary mt-2 !py-2 !text-[11px]"
            :disabled="pendingToggle"
            @click="enableDiscovery"
          >
            <LoaderCircle v-if="pendingToggle" class="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Munculkan aku di rekomendasi
          </button>
        </div>
      </div>

      <StateBlock :loading="loading" :error="loadError" loading-text="Mencari orang…" @retry="load">
        <StateBlock
          :empty="people.length === 0"
          empty-icon="🔍"
          empty-title="Belum ada rekomendasi"
          empty-text="Kamu sudah kenalan sama semua orang yang bisa ditampilkan. Mantap."
          :retryable="false"
        >
          <!-- ======================================== category filter chips -->
          <div class="mb-3 space-y-2">
            <div class="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
              <button
                type="button"
                class="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition"
                :class="isActiveFilter('all', null) ? 'bg-kenalan-500 text-white' : 'bg-slate-100 text-slate-500'"
                @click="setFilter('all')"
              >
                Semua
              </button>
              <button
                v-for="s in statuses"
                :key="`st-${s.key}`"
                type="button"
                class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition"
                :class="isActiveFilter('status', s.key) ? 'bg-kenalan-500 text-white' : 'bg-slate-100 text-slate-500'"
                @click="setFilter('status', s.key)"
              >
                <span class="h-2 w-2 rounded-full" :class="getColorCode(s.key).dot" aria-hidden="true" />
                {{ s.title }}
              </button>
            </div>

            <div v-if="faculties.length > 1" class="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
              <button
                v-for="f in faculties"
                :key="`fac-${f}`"
                type="button"
                class="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition"
                :class="isActiveFilter('faculty', f) ? 'bg-kenalan-100 text-kenalan-700 ring-1 ring-kenalan-300' : 'bg-slate-100 text-slate-500'"
                @click="setFilter('faculty', f)"
              >
                {{ f }}
              </button>
            </div>
          </div>

          <!-- empty result for the active filter -->
          <div
            v-if="filteredPeople.length === 0"
            class="rounded-2xl bg-slate-50 px-4 py-8 text-center"
          >
            <p class="text-sm font-bold text-slate-500">Nggak ada yang cocok</p>
            <p class="mt-1 text-[11px] text-slate-400">Coba ganti filter kategorinya.</p>
            <button type="button" class="btn-ghost mt-3 !py-2 !text-xs" @click="setFilter('all')">
              Reset filter
            </button>
          </div>

          <div v-else class="grid grid-cols-2 gap-3">
            <article
              v-for="person in filteredPeople"
              :key="person.id"
              class="flex flex-col rounded-3xl border border-slate-100 bg-white p-4 shadow-card"
            >
              <button type="button" class="flex flex-col items-center text-center" @click="openProfile(person.id)">
                <UserAvatar :profile="person" size="lg" ring />
                <p class="mt-2 truncate text-sm font-bold text-slate-800">{{ person.full_name }}</p>
                <p class="truncate text-[11px] text-slate-400">{{ person.major || 'Mahasiswa' }}</p>
                <ColorCodeBadge :code="person.color_code" size="sm" class="mt-2" />
              </button>

              <p
                v-if="person.bio"
                class="mt-2 line-clamp-2 text-center text-[11px] leading-snug text-slate-500"
              >
                {{ person.bio }}
              </p>

              <button type="button" class="btn-primary mt-3 !py-2 !text-[12px]" @click="openPing(person)">
                <Send class="h-3.5 w-3.5" aria-hidden="true" />
                PING
              </button>
            </article>
          </div>
        </StateBlock>
      </StateBlock>
    </div>

    <!-- PING composer -->
    <BottomSheet
      :open="Boolean(pingTarget)"
      :busy="sendingPing"
      :title="`PING ke ${pingTarget?.full_name ?? ''}`"
      subtitle="Satu pesan singkat buat mulai kenalan."
      @close="pingTarget = null"
    >
      <div v-if="pingTarget" class="space-y-4">
        <div class="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
          <UserAvatar :profile="pingTarget" size="sm" />
          <div class="min-w-0">
            <p class="truncate text-sm font-bold text-slate-700">{{ pingTarget.full_name }}</p>
            <p class="truncate text-[11px] text-slate-400">{{ pingTarget.major }}</p>
          </div>
        </div>

        <div>
          <label for="explore-ping" class="field-label">Pesan kamu</label>
          <textarea
            id="explore-ping"
            v-model="pingMessage"
            rows="4"
            maxlength="220"
            data-autofocus
            class="input-field resize-none"
          />
          <p class="mt-1 text-right text-[11px] text-slate-400">{{ pingMessage.length }}/220</p>
        </div>

        <button
          type="button"
          class="btn-primary w-full !py-3.5"
          :disabled="!pingMessage.trim() || sendingPing"
          @click="submitPing"
        >
          <LoaderCircle v-if="sendingPing" class="h-4 w-4 animate-spin" aria-hidden="true" />
          <Sparkles v-else class="h-4 w-4" aria-hidden="true" />
          {{ sendingPing ? 'Mengirim…' : 'Kirim PING!' }}
        </button>
      </div>
    </BottomSheet>
  </div>
</template>
