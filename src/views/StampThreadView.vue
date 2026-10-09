<script setup>
/**
 * StampThreadView — a Location Stamp opened as a forum thread.
 *
 * Shows the original stamp (message, optional image, approximate distance) at
 * the top, then its replies, with a composer pinned to the bottom. Anyone
 * signed in can reply; the author can also delete the whole thread.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Lock, LoaderCircle, MapPin, Send, Trash2 } from 'lucide-vue-next'

import AppHeader from '@/components/AppHeader.vue'
import ColorCodeBadge from '@/components/ColorCodeBadge.vue'
import StampLocationModal from '@/components/StampLocationModal.vue'
import StateBlock from '@/components/StateBlock.vue'
import UserAvatar from '@/components/UserAvatar.vue'

import {
  createStampReply,
  deleteStamp,
  fetchStamp,
  fetchStampReplies,
} from '@/lib/api'
import { distanceLabel, haversineMeters, isFresh, timeAgo } from '@/lib/time'
import { useGeolocation } from '@/lib/useGeolocation'
import { currentUserId } from '@/stores/auth'
import { toast } from '@/stores/toast'

const route = useRoute()
const router = useRouter()

const stampId = computed(() => route.params.id)

const stamp = ref(null)
const replies = ref([])
const loading = ref(true)
const loadError = ref('')

const draft = ref('')
const sending = ref(false)
const scroller = ref(null)
const locationOpen = ref(false)

const { coords: geoCoords } = useGeolocation()

const isOwn = computed(() => stamp.value?.user_id === currentUserId.value)
const expired = computed(() => stamp.value && !isFresh(stamp.value.created_at))
const isMutualOnly = computed(() => (stamp.value?.audience ?? 'public') === 'mutual')

/**
 * Real distance from the viewer to the stamp, computed from coordinates — not
 * the seed's fictional `distance_m`. It's your own stamp -> no distance; no
 * geolocation yet -> null (label says "jarak belum diketahui").
 */
const distanceM = computed(() => {
  if (!stamp.value || isOwn.value) return null
  if (!geoCoords.value || stamp.value.lat == null) return null
  return haversineMeters(
    { lat: geoCoords.value.lat, lng: geoCoords.value.lng },
    { lat: stamp.value.lat, lng: stamp.value.lng },
  )
})

const where = computed(() => {
  if (!stamp.value) return ''
  const label = stamp.value.location_label?.trim()
  if (isOwn.value) return label || 'Lokasi stamp kamu'
  // No viewer location -> don't fake a distance; show label or a map hint.
  const dist = geoCoords.value ? distanceLabel(distanceM.value) : 'lihat di peta'
  return label ? `${label} · ${dist}` : dist
})

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const s = await fetchStamp(stampId.value, currentUserId.value)
    if (!s) {
      loadError.value = 'Stamp ini sudah hangus atau dihapus.'
      return
    }
    if (s.restricted) {
      loadError.value = 'Stamp ini cuma buat mutual pembuatnya.'
      return
    }
    stamp.value = s
    replies.value = await fetchStampReplies(stampId.value)
  } catch (error) {
    loadError.value = error.message
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(stampId, load)

async function scrollToBottom() {
  await nextTick()
  scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: 'smooth' })
}

async function sendReply() {
  const message = draft.value.trim()
  if (!message || sending.value) return

  sending.value = true
  try {
    const reply = await createStampReply({
      stampId: stampId.value,
      userId: currentUserId.value,
      message,
    })
    replies.value = [...replies.value, reply]
    draft.value = ''
    scrollToBottom()
  } catch (error) {
    toast.error(error.message)
  } finally {
    sending.value = false
  }
}

async function removeThread() {
  try {
    await deleteStamp(stampId.value, currentUserId.value)
    toast.info('Stamp dihapus.')
    router.replace({ name: 'map' })
  } catch (error) {
    toast.error(error.message)
  }
}

function openProfile(userId) {
  if (!userId) return
  if (userId === currentUserId.value) router.push({ name: 'profile' })
  else router.push({ name: 'user-profile', params: { user_id: userId } })
}
</script>

<template>
  <div class="flex h-full flex-col bg-slate-50">
    <AppHeader title="Thread" subtitle="Balasan di stamp ini" back :fallback-to="{ name: 'map' }">
      <template #actions>
        <button
          v-if="isOwn"
          type="button"
          class="rounded-full p-2 text-slate-400 transition hover:bg-blush-soft hover:text-blush-deep"
          aria-label="Hapus stamp"
          @click="removeThread"
        >
          <Trash2 class="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </template>
    </AppHeader>

    <div ref="scroller" class="screen-scroll px-5 py-4">
      <StateBlock :loading="loading" :error="loadError" loading-text="Memuat thread…" @retry="load">
        <template v-if="stamp">
          <!-- original stamp -->
          <article class="card">
            <header class="flex items-start gap-3">
              <button type="button" class="shrink-0" @click="openProfile(stamp.user_id)">
                <UserAvatar :profile="stamp.profile ?? {}" size="md" />
              </button>
              <div class="min-w-0 flex-1">
                <button type="button" class="min-w-0 text-left" @click="openProfile(stamp.user_id)">
                  <p class="truncate text-sm font-bold text-slate-800">
                    {{ stamp.profile?.full_name || 'Anonim' }}
                    <span v-if="isOwn" class="ml-1 text-[11px] font-semibold text-kenalan-500">(kamu)</span>
                  </p>
                  <p class="truncate text-[11px] text-slate-400">
                    {{ stamp.profile?.major || 'Mahasiswa' }} · {{ timeAgo(stamp.created_at) }}
                  </p>
                </button>
              </div>
              <ColorCodeBadge :code="stamp.profile?.color_code" size="sm" />
            </header>

            <p class="mt-3 text-sm leading-relaxed text-slate-700">{{ stamp.message }}</p>

            <img
              v-if="stamp.image_url"
              :src="stamp.image_url"
              alt="Foto stamp"
              class="mt-3 w-full rounded-2xl object-cover"
              loading="lazy"
            />

            <div class="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-full bg-kenalan-50 px-2.5 py-1 text-[11px] font-semibold text-kenalan-700 transition hover:bg-kenalan-100 active:scale-95"
                aria-label="Lihat lokasi di peta"
                @click="locationOpen = true"
              >
                <MapPin class="h-3 w-3" aria-hidden="true" />
                {{ where }}
              </button>
              <span
                v-if="isMutualOnly"
                class="inline-flex items-center gap-1.5 rounded-full bg-kenalan-100 px-2.5 py-1 text-[11px] font-semibold text-kenalan-700"
              >
                <Lock class="h-3 w-3" aria-hidden="true" />
                Mutual aja
              </span>
            </div>
          </article>

          <div
            v-if="expired"
            class="mt-3 rounded-2xl bg-slate-100 px-4 py-2.5 text-center text-[11px] font-semibold text-slate-400"
          >
            Stamp ini sudah lewat 24 jam — balasan ditutup.
          </div>

          <!-- replies -->
          <h2 class="mb-2 mt-5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            {{ replies.length }} balasan
          </h2>

          <StateBlock
            :empty="replies.length === 0"
            empty-icon="💬"
            empty-title="Belum ada balasan"
            empty-text="Jadi yang pertama balas stamp ini."
            :retryable="false"
          >
            <ul class="space-y-3">
              <li v-for="reply in replies" :key="reply.id" class="flex items-start gap-2.5">
                <button type="button" class="shrink-0" @click="openProfile(reply.user_id)">
                  <UserAvatar :profile="reply.profile ?? {}" size="sm" />
                </button>
                <div class="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-white p-3 shadow-sm">
                  <div class="flex items-baseline justify-between gap-2">
                    <button
                      type="button"
                      class="truncate text-[13px] font-bold text-slate-700"
                      @click="openProfile(reply.user_id)"
                    >
                      {{ reply.profile?.full_name || 'Anonim' }}
                    </button>
                    <span class="shrink-0 text-[10px] text-slate-400">{{ timeAgo(reply.created_at) }}</span>
                  </div>
                  <p class="mt-0.5 text-sm leading-relaxed text-slate-600">{{ reply.message }}</p>
                </div>
              </li>
            </ul>
          </StateBlock>
        </template>
      </StateBlock>
    </div>

    <!-- composer -->
    <div
      v-if="stamp && !expired"
      class="shrink-0 border-t border-slate-100 bg-white px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
    >
      <form class="flex items-end gap-2" @submit.prevent="sendReply">
        <textarea
          v-model="draft"
          rows="1"
          maxlength="220"
          placeholder="Tulis balasan…"
          class="input-field max-h-24 flex-1 resize-none !py-2.5"
          @keydown.enter.exact.prevent="sendReply"
        />
        <button
          type="submit"
          class="btn-primary !h-11 !w-11 shrink-0 !rounded-2xl !p-0"
          :disabled="!draft.trim() || sending"
          aria-label="Kirim balasan"
        >
          <LoaderCircle v-if="sending" class="h-4 w-4 animate-spin" aria-hidden="true" />
          <Send v-else class="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </div>

    <!-- stamp location map -->
    <StampLocationModal :open="locationOpen" :stamp="stamp" @close="locationOpen = false" />
  </div>
</template>
