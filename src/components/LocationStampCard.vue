<script setup>
/**
 * LocationStampCard — one Location Stamp in the feed, now a thread entry.
 *
 * The exact place is intentionally NOT shown. Instead the card surfaces the
 * author's free-text `location_label` and an approximate `distance_m` from the
 * viewer. Stamps expire after 24h, carry an optional image, and can be opened
 * as a thread to read/post replies.
 */
import { computed } from 'vue'
import { Clock, MapPin, MessageCircle, Send, Trash2 } from 'lucide-vue-next'
import UserAvatar from '@/components/UserAvatar.vue'
import ColorCodeBadge from '@/components/ColorCodeBadge.vue'
import { distanceLabel, expiresIn, timeAgo } from '@/lib/time'

const props = defineProps({
  stamp: { type: Object, required: true },
  /** Renders the delete action instead of PING when the stamp is yours. */
  isOwn: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
})

defineEmits(['ping', 'delete', 'open-profile', 'open-thread', 'open-location'])

const profile = computed(() => props.stamp.profile ?? {})
const remaining = computed(() => expiresIn(props.stamp.created_at))
const where = computed(() => {
  const label = props.stamp.location_label?.trim()
  const dist = distanceLabel(props.stamp.distance_m)
  return label ? `${label} · ${dist}` : dist
})
const replyCount = computed(() => props.stamp.reply_count ?? 0)
</script>

<template>
  <article class="card animate-slide-up">
    <header class="flex items-start gap-3">
      <button
        type="button"
        class="shrink-0 rounded-full transition active:scale-95"
        :aria-label="`Buka profil ${profile.full_name || 'pengguna'}`"
        @click="$emit('open-profile', profile.id)"
      >
        <UserAvatar :profile="profile" size="md" />
      </button>

      <div class="min-w-0 flex-1">
        <div class="flex items-start justify-between gap-2">
          <button type="button" class="min-w-0 text-left" @click="$emit('open-profile', profile.id)">
            <p class="truncate text-sm font-bold text-slate-800">
              {{ profile.full_name || 'Anonim' }}
              <span v-if="isOwn" class="ml-1 text-[11px] font-semibold text-kenalan-500">(kamu)</span>
            </p>
            <p class="truncate text-[11px] text-slate-400">
              {{ profile.major || 'Mahasiswa' }} · {{ timeAgo(stamp.created_at) }}
            </p>
          </button>

          <ColorCodeBadge :code="profile.color_code" size="sm" class="shrink-0" />
        </div>
      </div>
    </header>

    <!-- tap the body to open the thread -->
    <button type="button" class="mt-3 block w-full text-left" @click="$emit('open-thread', stamp)">
      <p class="text-sm leading-relaxed text-slate-600">{{ stamp.message }}</p>

      <img
        v-if="stamp.image_url"
        :src="stamp.image_url"
        :alt="`Foto dari stamp ${profile.full_name || ''}`"
        class="mt-3 h-44 w-full rounded-2xl object-cover"
        loading="lazy"
      />
    </button>

    <div class="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full bg-kenalan-50 px-2.5 py-1 text-[11px] font-semibold text-kenalan-700 transition hover:bg-kenalan-100 active:scale-95"
        aria-label="Lihat lokasi di peta"
        @click="$emit('open-location', stamp)"
      >
        <MapPin class="h-3 w-3" aria-hidden="true" />
        {{ where }}
      </button>

      <span
        class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500"
      >
        <Clock class="h-3 w-3" aria-hidden="true" />
        hangus dalam {{ remaining }}
      </span>
    </div>

    <footer class="mt-4 flex gap-2">
      <button
        type="button"
        class="btn-ghost !py-2.5 !text-[13px]"
        @click="$emit('open-thread', stamp)"
      >
        <MessageCircle class="h-4 w-4" aria-hidden="true" />
        {{ replyCount > 0 ? `${replyCount} balasan` : 'Balas' }}
      </button>

      <button
        v-if="!isOwn"
        type="button"
        class="btn-primary flex-1 !py-2.5 !text-[13px]"
        :disabled="busy"
        @click="$emit('ping', stamp)"
      >
        <Send class="h-4 w-4" aria-hidden="true" />
        Send PING!
      </button>

      <button
        v-if="isOwn"
        type="button"
        class="btn-ghost flex-1 !py-2.5 !text-[13px] !text-blush-deep"
        :disabled="busy"
        @click="$emit('delete', stamp)"
      >
        <Trash2 class="h-4 w-4" aria-hidden="true" />
        Hapus stamp
      </button>
    </footer>
  </article>
</template>
