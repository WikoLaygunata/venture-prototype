<script setup>
/**
 * EditProfileView — the "Dashboard Edit Profil" that the own-profile shortcut
 * points at. Covers identity, bio, the Color Code selector and social links.
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { LoaderCircle, Save, Upload, X } from 'lucide-vue-next'

import AppHeader from '@/components/AppHeader.vue'
import ColorCodePicker from '@/components/ColorCodePicker.vue'
import StateBlock from '@/components/StateBlock.vue'
import UserAvatar from '@/components/UserAvatar.vue'

import { fetchProfile, updateProfile } from '@/lib/api'
import { getColorCode } from '@/lib/colorCodes'
import {
  SOCIAL_NETWORKS,
  SOCIAL_VISIBILITY_OPTIONS,
  defaultSocialVisibility,
} from '@/lib/socials'
import { currentUserId, setProfile } from '@/stores/auth'
import { toast } from '@/stores/toast'

const router = useRouter()

const loading = ref(true)
const loadError = ref('')
const saving = ref(false)

const form = reactive({
  full_name: '',
  username: '',
  faculty: '',
  major: '',
  batch: '',
  bio: '',
  color_code: 'mint',
  avatar_url: '',
  interests: '',
  is_discoverable: true,
  stamp_history_public: false,
  // social handles keyed by network, plus a visibility map
  socials: SOCIAL_NETWORKS.reduce((acc, n) => ({ ...acc, [n.key]: '' }), {}),
  social_visibility: defaultSocialVisibility(),
})

const socialNetworks = SOCIAL_NETWORKS
const visibilityOptions = SOCIAL_VISIBILITY_OPTIONS

onMounted(async () => {
  try {
    const row = await fetchProfile(currentUserId.value)
    if (!row) {
      loadError.value = 'Profil kamu belum terbentuk. Coba login ulang.'
      return
    }
    Object.assign(form, {
      full_name: row.full_name ?? '',
      username: row.username ?? '',
      faculty: row.faculty ?? '',
      major: row.major ?? '',
      batch: row.batch ?? '',
      bio: row.bio ?? '',
      color_code: row.color_code ?? 'mint',
      avatar_url: row.avatar_url ?? '',
      interests: (row.interests ?? []).join(', '),
      is_discoverable: row.is_discoverable !== false,
      stamp_history_public: row.stamp_history_public === true,
      socials: SOCIAL_NETWORKS.reduce(
        (acc, n) => ({ ...acc, [n.key]: row[n.key] ?? '' }),
        {},
      ),
      social_visibility: { ...defaultSocialVisibility(), ...(row.social_visibility ?? {}) },
    })
  } catch (error) {
    loadError.value = error.message
  } finally {
    loading.value = false
  }
})

/** Live preview object for the avatar + status chip at the top. */
const preview = computed(() => ({
  full_name: form.full_name,
  username: form.username,
  avatar_url: form.avatar_url,
  color_code: form.color_code,
}))

const status = computed(() => getColorCode(form.color_code))

/**
 * Avatar upload — demo only. Reads the picked file into a data URL kept on the
 * form (and shown in the live preview). No upload backend yet; wiring this to
 * Supabase Storage later means swapping this handler for an upload call.
 */
function onPickAvatar(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    toast.error('File harus berupa gambar.')
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    toast.error('Foto maksimal 5MB.')
    return
  }
  const reader = new FileReader()
  reader.onload = () => (form.avatar_url = String(reader.result))
  reader.readAsDataURL(file)
  // allow re-picking the same file later
  event.target.value = ''
}

const canSave = computed(
  () => form.full_name.trim().length >= 3 && form.username.trim().length >= 3 && !saving.value,
)

async function save() {
  if (!canSave.value) return

  saving.value = true
  try {
    const updated = await updateProfile(currentUserId.value, {
      full_name: form.full_name.trim(),
      username: form.username.trim(),
      faculty: form.faculty.trim(),
      major: form.major.trim(),
      batch: form.batch.trim(),
      bio: form.bio.trim(),
      color_code: form.color_code,
      avatar_url: form.avatar_url, // data URL or existing URL, kept as-is
      interests: form.interests
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      is_discoverable: form.is_discoverable,
      stamp_history_public: form.stamp_history_public,
      // flatten the social handles back onto the row + persist the visibility map
      ...SOCIAL_NETWORKS.reduce(
        (acc, n) => ({ ...acc, [n.key]: String(form.socials[n.key] ?? '').trim() }),
        {},
      ),
      social_visibility: { ...form.social_visibility },
    })

    setProfile(updated)
    toast.success('Profil kamu tersimpan ✅')
    router.replace({ name: 'profile' })
  } catch (error) {
    toast.error(error.message)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="relative flex h-full flex-col bg-slate-50">
    <AppHeader title="Edit Profil" subtitle="Atur identitas & status warna" back :fallback-to="{ name: 'profile' }" />

    <div class="screen-scroll px-5 pb-6 pt-4">
      <StateBlock :loading="loading" :error="loadError" loading-text="Memuat data profil…" :retryable="false">
        <form class="space-y-6" novalidate @submit.prevent="save">
          <!-- live preview -->
          <div
            class="flex items-center gap-4 rounded-3xl border p-4"
            :class="[status.bg, status.border]"
          >
            <UserAvatar :profile="preview" size="lg" ring />
            <div class="min-w-0">
              <p class="truncate text-base font-extrabold text-slate-800">
                {{ form.full_name || 'Nama kamu' }}
              </p>
              <p class="truncate text-xs text-slate-500">@{{ form.username || 'username' }}</p>
              <p class="mt-1 text-[11px] font-bold" :class="status.text">
                {{ status.emoji }} {{ status.title }}
              </p>
            </div>
          </div>

          <!-- identity -->
          <section class="space-y-3.5">
            <h2 class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Identitas</h2>

            <div>
              <label for="edit-name" class="field-label">Nama lengkap</label>
              <input id="edit-name" v-model="form.full_name" type="text" required class="input-field" />
            </div>

            <div>
              <label for="edit-username" class="field-label">Username</label>
              <div class="relative">
                <span
                  class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400"
                  aria-hidden="true"
                >
                  @
                </span>
                <input
                  id="edit-username"
                  v-model="form.username"
                  type="text"
                  required
                  minlength="3"
                  class="input-field pl-9"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="edit-faculty" class="field-label">Fakultas</label>
                <input id="edit-faculty" v-model="form.faculty" type="text" class="input-field !text-[13px]" />
              </div>
              <div>
                <label for="edit-major" class="field-label">Jurusan</label>
                <input id="edit-major" v-model="form.major" type="text" class="input-field !text-[13px]" />
              </div>
            </div>

            <div>
              <label for="edit-batch" class="field-label">Angkatan</label>
              <input
                id="edit-batch"
                v-model="form.batch"
                type="text"
                inputmode="numeric"
                placeholder="2023"
                class="input-field"
              />
            </div>

            <div>
              <span class="field-label">Foto profil</span>
              <div class="flex items-center gap-4">
                <UserAvatar :profile="preview" size="lg" ring />
                <div class="min-w-0 flex-1 space-y-2">
                  <label class="btn-secondary w-full cursor-pointer !py-2.5 !text-[13px]">
                    <Upload class="h-4 w-4" aria-hidden="true" />
                    {{ form.avatar_url ? 'Ganti foto' : 'Upload foto' }}
                    <input type="file" accept="image/*" class="sr-only" @change="onPickAvatar" />
                  </label>
                  <button
                    v-if="form.avatar_url"
                    type="button"
                    class="btn-ghost w-full !py-2 !text-[12px] !text-blush-deep"
                    @click="form.avatar_url = ''"
                  >
                    <X class="h-3.5 w-3.5" aria-hidden="true" />
                    Hapus foto
                  </button>
                </div>
              </div>
              <p class="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                Prototype: foto disimpan sementara di memori (belum ke server). Maks 5MB.
              </p>
            </div>

            <div>
              <label for="edit-bio" class="field-label">Bio</label>
              <textarea
                id="edit-bio"
                v-model="form.bio"
                rows="3"
                maxlength="160"
                class="input-field resize-none"
              />
              <p class="mt-1 text-right text-[11px] text-slate-400">{{ form.bio.length }}/160</p>
            </div>

            <div>
              <label for="edit-interests" class="field-label">Minat (pisahkan dengan koma)</label>
              <input
                id="edit-interests"
                v-model="form.interests"
                type="text"
                placeholder="UI design, kopi, basket"
                class="input-field !text-[13px]"
              />
            </div>
          </section>

          <!-- color code -->
          <section>
            <h2 class="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Status warna
            </h2>
            <ColorCodePicker v-model="form.color_code" :busy="saving" />
          </section>

          <!-- privacy -->
          <section>
            <h2 class="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Privasi
            </h2>
            <div class="flex items-center gap-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-card">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-bold text-slate-800">Muncul di rekomendasi Explore</p>
                <p class="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                  Kalau dimatikan, profilmu nggak ditampilkan di tab Explore orang lain.
                  Orang tetap bisa buka profilmu lewat scan keychain.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                :aria-checked="form.is_discoverable"
                class="relative h-7 w-12 shrink-0 rounded-full transition"
                :class="form.is_discoverable ? 'bg-kenalan-500' : 'bg-slate-300'"
                @click="form.is_discoverable = !form.is_discoverable"
              >
                <span
                  class="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all"
                  :class="form.is_discoverable ? 'left-6' : 'left-1'"
                  aria-hidden="true"
                />
              </button>
            </div>

            <div class="mt-2.5 flex items-center gap-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-card">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-bold text-slate-800">Munculkan history untuk publik</p>
                <p class="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                  Kalau aktif, orang lain bisa lihat history stamp 30 harimu dari profilmu.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                :aria-checked="form.stamp_history_public"
                class="relative h-7 w-12 shrink-0 rounded-full transition"
                :class="form.stamp_history_public ? 'bg-kenalan-500' : 'bg-slate-300'"
                @click="form.stamp_history_public = !form.stamp_history_public"
              >
                <span
                  class="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all"
                  :class="form.stamp_history_public ? 'left-6' : 'left-1'"
                  aria-hidden="true"
                />
              </button>
            </div>
          </section>

          <!-- socials -->
          <section class="space-y-4">
            <div>
              <h2 class="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Sosial media & kontak
              </h2>
              <p class="mt-1 text-[11px] leading-relaxed text-slate-400">
                Atur siapa yang boleh lihat tiap kontak: publik, hanya yang sudah mutualan,
                atau sembunyikan.
              </p>
            </div>

            <div
              v-for="net in socialNetworks"
              :key="net.key"
              class="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm"
            >
              <label :for="`edit-${net.key}`" class="field-label">{{ net.label }}</label>
              <input
                :id="`edit-${net.key}`"
                v-model="form.socials[net.key]"
                type="text"
                :placeholder="net.placeholder"
                class="input-field !text-[13px]"
              />

              <!-- visibility segmented control -->
              <div
                class="mt-2.5 flex gap-1 rounded-xl bg-slate-100 p-1"
                role="radiogroup"
                :aria-label="`Visibilitas ${net.label}`"
              >
                <button
                  v-for="opt in visibilityOptions"
                  :key="opt.value"
                  type="button"
                  role="radio"
                  :aria-checked="form.social_visibility[net.key] === opt.value"
                  class="flex-1 rounded-lg py-1.5 text-[11px] font-bold transition"
                  :class="
                    form.social_visibility[net.key] === opt.value
                      ? 'bg-white text-kenalan-600 shadow-sm'
                      : 'text-slate-500'
                  "
                  :title="opt.hint"
                  @click="form.social_visibility[net.key] = opt.value"
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>
          </section>
        </form>
      </StateBlock>
    </div>

    <!-- sticky save bar (flex sibling so it's pinned without overlapping) -->
    <div
      v-if="!loading && !loadError"
      class="shrink-0 border-t border-slate-100 bg-white/95 px-5 pb-[calc(env(safe-area-inset-bottom)+0.875rem)] pt-3.5 backdrop-blur"
    >
      <button type="button" class="btn-primary w-full !py-3.5" :disabled="!canSave" @click="save">
        <LoaderCircle v-if="saving" class="h-4 w-4 animate-spin" aria-hidden="true" />
        <Save v-else class="h-4 w-4" aria-hidden="true" />
        {{ saving ? 'Menyimpan…' : 'Simpan perubahan' }}
      </button>
    </div>
  </div>
</template>
