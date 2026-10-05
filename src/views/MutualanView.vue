<script setup>
/**
 * MutualanView — the connections tab.
 *
 * Two segments:
 *   PING masuk  — pending requests; accepting one promotes the pair to mutuals
 *   Mutualan    — people you are already connected with
 *
 * Discovery/recommendations live in their own Explore tab now, so there is no
 * "Rekomendasi" segment here anymore.
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Ban, CheckCheck, Clock, Compass, Heart, LoaderCircle, RefreshCw, Send } from 'lucide-vue-next'

import AppHeader from '@/components/AppHeader.vue'
import ColorCodeBadge from '@/components/ColorCodeBadge.vue'
import StateBlock from '@/components/StateBlock.vue'
import UserAvatar from '@/components/UserAvatar.vue'

import { fetchIncomingPings, fetchMutuals, fetchSentPings, respondToPing } from '@/lib/api'
import { timeAgo } from '@/lib/time'
import { currentUserId } from '@/stores/auth'
import { toast } from '@/stores/toast'

const router = useRouter()

const tab = ref('pings') // 'pings' | 'mutuals'

const incoming = ref([])
const sent = ref([])
const mutuals = ref([])

const loading = ref(true)
const loadError = ref('')
const respondingId = ref(null)

async function load() {
  if (!currentUserId.value) return

  loading.value = true
  loadError.value = ''

  try {
    const [incomingRows, sentRows, mutualRows] = await Promise.all([
      fetchIncomingPings(currentUserId.value),
      fetchSentPings(currentUserId.value),
      fetchMutuals(currentUserId.value),
    ])
    incoming.value = incomingRows
    sent.value = sentRows
    mutuals.value = mutualRows
  } catch (error) {
    loadError.value = error.message
  } finally {
    loading.value = false
  }
}

onMounted(load)

const pendingIncoming = computed(() => incoming.value.filter((p) => p.status === 'pending'))
const pendingSent = computed(() => sent.value.filter((p) => p.status === 'pending'))

const tabs = computed(() => [
  { key: 'pings', label: 'PING masuk', count: pendingIncoming.value.length },
  { key: 'mutuals', label: 'Mutualan', count: mutuals.value.length },
])

async function respond(ping, status) {
  respondingId.value = ping.id
  try {
    await respondToPing(ping.id, status)

    if (status === 'accepted') {
      toast.success(`Kamu dan ${ping.sender?.full_name?.split(' ')[0]} sekarang mutualan 🎉`)
      await load()
      tab.value = 'mutuals'
    } else {
      incoming.value = incoming.value.map((p) =>
        p.id === ping.id ? { ...p, status: 'declined' } : p,
      )
      toast.info('PING ditolak.')
    }
  } catch (error) {
    toast.error(error.message)
  } finally {
    respondingId.value = null
  }
}

function openProfile(userId) {
  if (!userId) return
  router.push({ name: 'user-profile', params: { user_id: userId } })
}
</script>

<template>
  <div class="relative flex h-full flex-col bg-slate-50">
    <AppHeader title="Mutualan" :subtitle="`${mutuals.length} koneksi · ${pendingIncoming.length} PING menunggu`">
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

    <!-- segmented control -->
    <div class="shrink-0 border-b border-slate-100 bg-white px-5 pb-3">
      <div class="flex gap-1 rounded-2xl bg-slate-100 p-1" role="tablist">
        <button
          v-for="item in tabs"
          :key="item.key"
          type="button"
          role="tab"
          :aria-selected="tab === item.key"
          class="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-bold transition"
          :class="tab === item.key ? 'bg-white text-kenalan-600 shadow-sm' : 'text-slate-500'"
          @click="tab = item.key"
        >
          {{ item.label }}
          <span
            v-if="item.count"
            class="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px]"
            :class="tab === item.key ? 'bg-kenalan-500 text-white' : 'bg-slate-200 text-slate-500'"
          >
            {{ item.count }}
          </span>
        </button>
      </div>
    </div>

    <div class="screen-scroll px-5 pb-24 pt-4">
      <StateBlock :loading="loading" :error="loadError" loading-text="Memuat koneksi…" @retry="load">
        <!-- ============================================== PING masuk -->
        <template v-if="tab === 'pings'">
          <StateBlock
            :empty="pendingIncoming.length === 0"
            empty-icon="📮"
            empty-title="Belum ada PING masuk"
            empty-text="Kalau ada yang scan keychain NFC kamu dan tertarik, PING-nya muncul di sini."
            :retryable="false"
          >
            <div class="space-y-3">
              <article
                v-for="ping in pendingIncoming"
                :key="ping.id"
                class="card animate-slide-up"
              >
                <header class="flex items-start gap-3">
                  <button type="button" @click="openProfile(ping.sender_id)">
                    <UserAvatar :profile="ping.sender ?? {}" size="md" />
                  </button>
                  <div class="min-w-0 flex-1">
                    <button type="button" class="block min-w-0 text-left" @click="openProfile(ping.sender_id)">
                      <p class="truncate text-sm font-bold text-slate-800">
                        {{ ping.sender?.full_name ?? 'Anonim' }}
                      </p>
                      <p class="truncate text-[11px] text-slate-400">
                        {{ ping.sender?.major ?? 'Mahasiswa' }} · {{ timeAgo(ping.created_at) }}
                      </p>
                    </button>
                  </div>
                  <ColorCodeBadge :code="ping.sender?.color_code" size="sm" />
                </header>

                <p class="mt-3 rounded-2xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-600">
                  “{{ ping.message }}”
                </p>

                <footer class="mt-3 flex gap-2">
                  <button
                    type="button"
                    class="btn-primary flex-1 !py-2.5 !text-[13px]"
                    :disabled="respondingId === ping.id"
                    @click="respond(ping, 'accepted')"
                  >
                    <LoaderCircle
                      v-if="respondingId === ping.id"
                      class="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    <Heart v-else class="h-4 w-4" aria-hidden="true" />
                    Terima
                  </button>
                  <button
                    type="button"
                    class="btn-ghost !py-2.5 !text-[13px]"
                    :disabled="respondingId === ping.id"
                    @click="respond(ping, 'declined')"
                  >
                    <Ban class="h-4 w-4" aria-hidden="true" />
                    Tolak
                  </button>
                </footer>
              </article>
            </div>
          </StateBlock>

          <!-- outgoing PINGs -->
          <section v-if="pendingSent.length" class="mt-7">
            <h2 class="mb-2.5 flex items-center gap-1.5 text-sm font-extrabold text-slate-800">
              <Send class="h-4 w-4 text-slate-400" aria-hidden="true" />
              PING kamu yang menunggu
            </h2>
            <div class="space-y-2">
              <button
                v-for="ping in pendingSent"
                :key="ping.id"
                type="button"
                class="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left transition hover:border-slate-200"
                @click="openProfile(ping.receiver_id)"
              >
                <UserAvatar :profile="ping.receiver ?? {}" size="sm" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-[13px] font-bold text-slate-700">
                    {{ ping.receiver?.full_name ?? 'Anonim' }}
                  </p>
                  <p class="truncate text-[11px] text-slate-400">“{{ ping.message }}”</p>
                </div>
                <span
                  class="inline-flex shrink-0 items-center gap-1 rounded-full bg-sunny-soft px-2 py-1 text-[10px] font-bold text-sunny-deep"
                >
                  <Clock class="h-3 w-3" aria-hidden="true" />
                  Menunggu
                </span>
              </button>
            </div>
          </section>
        </template>

        <!-- ================================================ mutualan -->
        <template v-else>
          <StateBlock
            :empty="mutuals.length === 0"
            empty-icon="🤝"
            empty-title="Belum ada mutualan"
            empty-text="Terima PING atau kirim PING ke orang lain buat mulai koneksi pertamamu."
            :retryable="false"
          >
            <template #action>
              <RouterLink :to="{ name: 'explore' }" class="btn-secondary mt-2 !py-2.5 !text-xs">
                <Compass class="h-3.5 w-3.5" aria-hidden="true" />
                Cari orang di Explore
              </RouterLink>
            </template>

            <div class="space-y-2.5">
              <button
                v-for="person in mutuals"
                :key="person.id"
                type="button"
                class="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 text-left shadow-sm transition hover:border-kenalan-200 active:scale-[0.99]"
                @click="openProfile(person.id)"
              >
                <UserAvatar :profile="person" size="md" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-bold text-slate-800">{{ person.full_name }}</p>
                  <p class="truncate text-[11px] text-slate-400">
                    {{ person.major || 'Mahasiswa' }} · mutualan {{ timeAgo(person.mutual_since) }}
                  </p>
                  <ColorCodeBadge :code="person.color_code" size="sm" class="mt-1.5" />
                </div>
                <CheckCheck class="h-4 w-4 shrink-0 text-mint" aria-hidden="true" />
              </button>
            </div>
          </StateBlock>
        </template>
      </StateBlock>
    </div>
  </div>
</template>
