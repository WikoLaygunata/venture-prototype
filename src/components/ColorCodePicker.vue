<script setup>
/**
 * ColorCodePicker — radio list for switching your own Color Code.
 * Shared by the profile status sheet and the edit-profile form.
 */
import { Check } from 'lucide-vue-next'
import { COLOR_CODE_LIST } from '@/lib/colorCodes'

defineProps({
  modelValue: { type: String, default: 'mint' },
  busy: { type: Boolean, default: false },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <fieldset class="space-y-2" :disabled="busy">
    <legend class="sr-only">Pilih status color code</legend>

    <label
      v-for="status in COLOR_CODE_LIST"
      :key="status.key"
      class="flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 transition"
      :class="
        modelValue === status.key
          ? [status.bg, status.border, 'shadow-sm']
          : 'border-slate-100 bg-white hover:border-slate-200'
      "
    >
      <input
        type="radio"
        name="color-code"
        class="sr-only"
        :value="status.key"
        :checked="modelValue === status.key"
        @change="$emit('update:modelValue', status.key)"
      />

      <span
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-base"
        :class="status.gradient"
        aria-hidden="true"
      >
        {{ status.emoji }}
      </span>

      <span class="min-w-0 flex-1">
        <span class="block text-sm font-bold text-slate-800">
          {{ status.title }}
        </span>
        <span class="block text-[11px] leading-snug text-slate-500">
          {{ status.description }}
        </span>
      </span>

      <span
        class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition"
        :class="
          modelValue === status.key
            ? [status.dot, 'border-transparent text-white']
            : 'border-slate-200 text-transparent'
        "
        aria-hidden="true"
      >
        <Check class="h-3.5 w-3.5" stroke-width="3.5" />
      </span>
    </label>
  </fieldset>
</template>
