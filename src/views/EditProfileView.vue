<script setup>
/**
 * EditProfileView — the "Dashboard Edit Profil" that the own-profile shortcut
 * points at. Covers identity, bio, the Color Code selector and social links.
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Instagram, Linkedin, LoaderCircle, Save } from 'lucide-vue-next'

import AppHeader from '@/components/AppHeader.vue'
import ColorCodePicker from '@/components/ColorCodePicker.vue'
import StateBlock from '@/components/StateBlock.vue'
import UserAvatar from '@/components/UserAvatar.vue'

import { fetchProfile, updateProfile } from '@/lib/api'
import { getColorCode } from '@/lib/colorCodes'
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
  instagram: '',
  linkedin: '',
  spotify: '',
})

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
      instagram: row.instagram ?? '',
      linkedin: row.linkedin ?? '',
      spotify: row.spotify ?? '',
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
      avatar_url: form.avatar_url.trim(),
      interests: form.interests
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      instagram: form.instagram.trim(),
      linkedin: form.linkedin.trim(),
      spotify: form.spotify.trim(),
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

    <div class="screen-scroll px-5 pb-28 pt-4">
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
              <label for="edit-avatar" class="field-label">URL foto profil</label>
              <input
                id="edit-avatar"
                v-model="form.avatar_url"
                type="url"
                placeholder="https://…"
                class="input-field !text-[13px]"
              />
              <p class="mt-1 text-[11px] text-slate-400">
                Prototype masih pakai URL. Upload ke Supabase Storage nanti.
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

          <!-- socials -->
          <section class="space-y-3.5">
            <h2 class="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Sosial media
            </h2>

            <div>
              <label for="edit-instagram" class="field-label">Instagram</label>
              <div class="relative">
                <Instagram
                  class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="edit-instagram"
                  v-model="form.instagram"
                  type="text"
                  placeholder="username atau link"
                  class="input-field pl-10 !text-[13px]"
                />
              </div>
            </div>

            <div>
              <label for="edit-linkedin" class="field-label">LinkedIn</label>
              <div class="relative">
                <Linkedin
                  class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="edit-linkedin"
                  v-model="form.linkedin"
                  type="text"
                  placeholder="nama-kamu atau link"
                  class="input-field pl-10 !text-[13px]"
                />
              </div>
            </div>

            <div>
              <label for="edit-spotify" class="field-label">Spotify</label>
              <input
                id="edit-spotify"
                v-model="form.spotify"
                type="text"
                placeholder="user id atau link"
                class="input-field !text-[13px]"
              />
            </div>
          </section>
        </form>
      </StateBlock>
    </div>

    <!-- sticky save bar -->
    <div
      v-if="!loading && !loadError"
      class="absolute inset-x-0 bottom-0 z-30 border-t border-slate-100 bg-white/95 px-5 pb-[calc(env(safe-area-inset-bottom)+0.875rem)] pt-3.5 backdrop-blur"
    >
      <button type="button" class="btn-primary w-full !py-3.5" :disabled="!canSave" @click="save">
        <LoaderCircle v-if="saving" class="h-4 w-4 animate-spin" aria-hidden="true" />
        <Save v-else class="h-4 w-4" aria-hidden="true" />
        {{ saving ? 'Menyimpan…' : 'Simpan perubahan' }}
      </button>
    </div>
  </div>
</template>
