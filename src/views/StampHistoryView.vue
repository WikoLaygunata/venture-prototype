<script setup>
/**
 * StampHistoryView — Location Stamps from the last 30 days.
 *
 *   /history            → your own history, editable (delete allowed)
 *   /history/:user_id   → someone else's, read-only, and only if they turned on
 *                         "history publik". Otherwise a privacy-blocked state.
 *
 * Unlike the live Map feed (24h only), this includes expired stamps so you can
 * look back over the past month.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { History, Lock, MapPin, MessageCircle, Trash2 } from 'lucide-vue-next'

import AppHeader from '@/components/AppHeader.vue'
import StateBlock from '@/components/StateBlock.vue'
import { deleteStamp, fetchProfile, fetchStampHistory } from '@/lib/api'
import { isFresh, shortDate, timeAgo } from '@/lib/time'
import { currentUserId } from '@/stores/auth'
import { toast } from '@/stores/toast'

const route = useRoute()
const router = useRouter()

/** Target user: the route param, or the logged-in user for the bare /history. */
const targetId = computed(() => {
  const raw = route.params.user_id
  return typeof raw === 'string' && raw ? raw : currentUserId.value
})
const isOwn = computed(() => targetId.value === currentUserId.value)

const owner = ref(null)
const stamps = ref([])
const loading = ref(true)
const loadError = ref('')
/** true when viewing someone who keeps their history private */
const blocked = ref(false)

async function load() {
  loading.value = true
  loadError.value = ''
  blocked.value = false

  try {
    // For another user, confirm they opted their history public first.
    if (!isOwn.value) {
      const profile = await fetchProfile(targetId.value)
      owner.value = profile
      if (!profile) {
        loadError.value = 'Profil ini nggak ada atau sudah dihapus.'
        return
      }
      if (profile.stamp_history_public !== true) {
        blocked.value = true
        return
      }
    }

    stamps.value = await fetchStampHistory(targetId.value)
  } catch (error) {
    loadError.value = error.message
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(targetId, load)

const activeCount = computed(() => stamps.value.filter((s) => isFresh(s.created_at)).length)
const ownerName = computed(() => owner.value?.full_name?.split(' ')[0] ?? 'dia')

function openThread(stamp) {
  router.push({ name: 'stamp-thread', params: { id: stamp.id } })
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
</script>

<template>
  <div class="flex h-full flex-col bg-slate-50">
    <AppHeader
      :title="isOwn ? 'History Stamp' : `History ${ownerName}`"
      subtitle="30 hari terakhir"
      back
      :fallback-to="isOwn ? { name: 'profile' } : { name: 'user-profile', params: { user_id: targetId } }"
    />

    <div class="screen-scroll px-5 py-4">
      <!-- someone keeps their history private -->
      <div
        v-if="blocked"
        class="flex flex-col items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-10 text-center"
      >
        <Lock class="h-7 w-7 text-slate-400" aria-hidden="true" />
        <p class="text-sm font-bold text-slate-600">History ini privat</p>
        <p class="max-w-[16rem] text-xs leading-relaxed text-slate-400">
          {{ ownerName }} nggak membuka history stamp-nya untuk publik.
        </p>
      </div>

      <StateBlock
        v-else
        :loading="loading"
        :error="loadError"
        loading-text="Memuat history…"
        @retry="load"
      >
        <StateBlock
          :empty="stamps.length === 0"
          empty-icon="🗓️"
          empty-title="Belum ada stamp"
          :empty-text="
            isOwn
              ? 'Stamp yang kamu buat dalam 30 hari terakhir muncul di sini.'
              : `${ownerName} belum punya stamp dalam 30 hari terakhir.`
          "
          :retryable="false"
        >
          <div class="mb-3 flex items-center gap-2 text-[11px] font-semibold text-slate-400">
            <History class="h-3.5 w-3.5" aria-hidden="true" />
            {{ stamps.length }} stamp · {{ activeCount }} masih aktif
          </div>

          <ul class="space-y-3">
            <li v-for="stamp in stamps" :key="stamp.id" class="card animate-slide-up">
              <div class="flex items-start justify-between gap-2">
                <span class="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  {{ shortDate(stamp.created_at) }} · {{ timeAgo(stamp.created_at) }}
                </span>
                <span
                  class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                  :class="isFresh(stamp.created_at) ? 'bg-mint-soft text-mint-deep' : 'bg-slate-100 text-slate-400'"
                >
                  {{ isFresh(stamp.created_at) ? 'Aktif' : 'Hangus' }}
                </span>
              </div>

              <button type="button" class="mt-2 block w-full text-left" @click="openThread(stamp)">
                <p class="text-sm leading-relaxed text-slate-700">{{ stamp.message }}</p>
                <img
                  v-if="stamp.image_url"
                  :src="stamp.image_url"
                  alt="Foto stamp"
                  class="mt-2 h-36 w-full rounded-2xl object-cover"
                  loading="lazy"
                />
              </button>

              <div class="mt-3 flex flex-wrap items-center gap-2">
                <span
                  v-if="stamp.location_label"
                  class="inline-flex items-center gap-1.5 rounded-full bg-kenalan-50 px-2.5 py-1 text-[11px] font-semibold text-kenalan-700"
                >
                  <MapPin class="h-3 w-3" aria-hidden="true" />
                  {{ stamp.location_label }}
                </span>
                <span
                  class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500"
                >
                  <MessageCircle class="h-3 w-3" aria-hidden="true" />
                  {{ stamp.reply_count ?? 0 }} balasan
                </span>
              </div>

              <button
                v-if="isOwn"
                type="button"
                class="btn-ghost mt-3 w-full !py-2 !text-[12px] !text-blush-deep"
                @click="removeStamp(stamp)"
              >
                <Trash2 class="h-3.5 w-3.5" aria-hidden="true" />
                Hapus
              </button>
            </li>
          </ul>
        </StateBlock>
      </StateBlock>
    </div>
  </div>
</template>
