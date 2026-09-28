<script setup>
/**
 * UserAvatar — photo with a graceful initials fallback (offline, broken URL,
 * or a profile that has not uploaded anything yet) and an optional color-code
 * ring so status reads at a glance inside lists.
 */
import { computed, ref, watch } from 'vue'
import { getColorCode } from '@/lib/colorCodes'

const props = defineProps({
  profile: { type: Object, default: () => ({}) },
  size: { type: String, default: 'md' }, // 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  ring: { type: Boolean, default: false },
})

const failed = ref(false)
watch(() => props.profile?.avatar_url, () => (failed.value = false))

const SIZES = {
  xs: 'h-8 w-8 text-[11px]',
  sm: 'h-10 w-10 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-20 w-20 text-xl',
  xl: 'h-28 w-28 text-3xl',
}

const initials = computed(() => {
  const name = props.profile?.full_name || props.profile?.username || '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
})

const status = computed(() => getColorCode(props.profile?.color_code))
const showImage = computed(() => Boolean(props.profile?.avatar_url) && !failed.value)
</script>

<template>
  <div
    class="relative shrink-0 overflow-hidden rounded-full bg-gradient-to-br"
    :class="[
      SIZES[size] ?? SIZES.md,
      status.gradient,
      ring ? `ring-4 ring-offset-2 ring-offset-white ${status.ring}` : '',
    ]"
  >
    <img
      v-if="showImage"
      :src="profile.avatar_url"
      :alt="`Foto profil ${profile.full_name || profile.username || 'pengguna'}`"
      class="h-full w-full object-cover"
      loading="lazy"
      @error="failed = true"
    />
    <span
      v-else
      class="flex h-full w-full items-center justify-center font-bold text-white"
      aria-hidden="true"
    >
      {{ initials }}
    </span>
  </div>
</template>
