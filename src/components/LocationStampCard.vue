<script setup>
/**
 * LocationStampCard — one "Spot Stamp" in the feed.
 *
 * A stamp is a short note pinned to a campus spot that expires after 24 hours,
 * so the card always surfaces both "how long ago" and "how long left".
 */
import { computed } from 'vue'
import { Clock, MapPin, Send, Trash2 } from 'lucide-vue-next'
import UserAvatar from '@/components/UserAvatar.vue'
import ColorCodeBadge from '@/components/ColorCodeBadge.vue'
import { expiresIn, timeAgo } from '@/lib/time'
import { getColorCode } from '@/lib/colorCodes'

const props = defineProps({
  stamp: { type: Object, required: true },
  /** Renders the delete action instead of PING when the stamp is yours. */
  isOwn: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
})

defineEmits(['ping', 'delete', 'open-profile'])

const profile = computed(() => props.stamp.profile ?? {})
const spot = computed(() => props.stamp.spot ?? {})
const status = computed(() => getColorCode(profile.value.color_code))
const remaining = computed(() => expiresIn(props.stamp.created_at))
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
          <button
            type="button"
            class="min-w-0 text-left"
            @click="$emit('open-profile', profile.id)"
          >
            <p class="truncate text-sm font-bold text-slate-800">
              {{ profile.full_name || 'Anonim' }}
              <span v-if="isOwn" class="ml-1 text-[11px] font-semibold text-kenalan-500">
                (kamu)
              </span>
            </p>
            <p class="truncate text-[11px] text-slate-400">
              {{ profile.major || 'Mahasiswa' }} · {{ timeAgo(stamp.created_at) }}
            </p>
          </button>

          <ColorCodeBadge :code="profile.color_code" size="sm" class="shrink-0" />
        </div>
      </div>
    </header>

    <p class="mt-3 text-sm leading-relaxed text-slate-600">
      {{ stamp.message }}
    </p>

    <div class="mt-3 flex flex-wrap items-center gap-2">
      <span
        class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
        :class="[status.bg, status.text]"
      >
        <MapPin class="h-3 w-3" aria-hidden="true" />
        {{ spot.emoji }} {{ spot.name || 'Spot kampus' }}
      </span>

      <span
        class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500"
      >
        <Clock class="h-3 w-3" aria-hidden="true" />
        hangus dalam {{ remaining }}
      </span>
    </div>

    <footer class="mt-4 flex gap-2">
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
        v-if="!isOwn"
        type="button"
        class="btn-ghost !py-2.5 !text-[13px]"
        @click="$emit('open-profile', profile.id)"
      >
        Lihat profil
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
