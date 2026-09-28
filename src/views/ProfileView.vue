<script setup>
/**
 * ProfileView — serves both `/profile` (own) and `/user/:user_id` (scanned).
 *
 * It resolves one of three viewer modes and the whole screen follows from that:
 *
 *  SCENARIO 3 — mode 'self'
 *    You scanned your own lanyard. Banner "Ini Profil Kamu", tappable color-code
 *    badge, and a shortcut to the edit dashboard.
 *
 *  SCENARIO 2a — mode 'visitor'
 *    You are logged in and looking at somebody else. Full public profile plus
 *    the two active CTAs: "Mutualan / Send PING!" and the Icebreaker generator.
 *
 *  SCENARIO 2b — mode 'guest'
 *    Not logged in. Profile is still fully visible (view profile first), with a
 *    sticky floating banner at the bottom. Tapping Mutualan/PING sends them to
 *    /login?redirect=/user/:user_id so they come straight back here.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowRight,
  CheckCheck,
  Copy,
  GraduationCap,
  Heart,
  LoaderCircle,
  LogOut,
  Nfc,
  Pencil,
  RefreshCw,
  Send,
  Settings,
  Share2,
  Sparkles,
  UserRound,
  WandSparkles,
} from 'lucide-vue-next'

import AppHeader from '@/components/AppHeader.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import ColorCodeBadge from '@/components/ColorCodeBadge.vue'
import ColorCodePicker from '@/components/ColorCodePicker.vue'
import SocialLinks from '@/components/SocialLinks.vue'
import StateBlock from '@/components/StateBlock.vue'
import UserAvatar from '@/components/UserAvatar.vue'

import {
  fetchMutuals,
  fetchProfile,
  hasPendingPing,
  isMutualWith,
  sendPing,
  updateColorCode,
} from '@/lib/api'
import { getColorCode } from '@/lib/colorCodes'
import { generateIcebreaker } from '@/lib/icebreakers'
import { isSupabaseConfigured } from '@/lib/supabase'
import { currentProfile, currentUserId, refreshProfile, setProfile, signOut } from '@/stores/auth'
import { toast } from '@/stores/toast'

const route = useRoute()
const router = useRouter()

/* ------------------------------------------------------------ which profile? */

/** Empty on `/profile`, which means "show the logged-in user". */
const targetId = computed(() => {
  const raw = route.params.user_id
  return typeof raw === 'string' && raw ? raw : (currentUserId.value ?? null)
})

/** 'self' | 'visitor' | 'guest' */
const mode = computed(() => {
  if (!currentUserId.value) return 'guest'
  return targetId.value === currentUserId.value ? 'self' : 'visitor'
})

const isSelf = computed(() => mode.value === 'self')

/* -------------------------------------------------------------------- loading */

const profile = ref(null)
const loading = ref(true)
const loadError = ref('')
const mutualCount = ref(0)
const alreadyMutual = ref(false)
const pingPending = ref(false)

async function load() {
  if (!targetId.value) {
    loading.value = false
    loadError.value = 'Profil tidak ditemukan.'
    return
  }

  loading.value = true
  loadError.value = ''

  try {
    const row = await fetchProfile(targetId.value)
    if (!row) {
      loadError.value = 'Profil ini nggak ada atau sudah dihapus.'
      profile.value = null
      return
    }

    profile.value = row
    if (isSelf.value) setProfile(row)

    // Relationship context — only meaningful for a logged-in visitor.
    const [mutuals, mutualFlag, pending] = await Promise.all([
      fetchMutuals(row.id),
      currentUserId.value && !isSelf.value
        ? isMutualWith(currentUserId.value, row.id)
        : Promise.resolve(false),
      currentUserId.value && !isSelf.value
        ? hasPendingPing(currentUserId.value, row.id)
        : Promise.resolve(false),
    ])

    mutualCount.value = mutuals.length
    alreadyMutual.value = mutualFlag
    pingPending.value = pending
  } catch (error) {
    loadError.value = error.message
  } finally {
    loading.value = false
  }
}

watch(
  [targetId, currentUserId],
  () => {
    load()
  },
  { immediate: true },
)

const status = computed(() => getColorCode(profile.value?.color_code))
const firstName = computed(() => (profile.value?.full_name || '').split(' ')[0] || 'dia')

/* --------------------------------------------------- guest -> login handoff */

/** Where a guest should be returned to after authenticating. */
function goToLogin() {
  const redirect = route.params.user_id
    ? `/user/${route.params.user_id}`
    : (route.fullPath ?? '/map')
  router.push({ name: 'login', query: { redirect } })
}

/* ------------------------------------------------------- color code (self) */

const statusSheetOpen = ref(false)
const pendingColor = ref('mint')
const savingColor = ref(false)

function openStatusSheet() {
  pendingColor.value = profile.value?.color_code ?? 'mint'
  statusSheetOpen.value = true
}

async function saveColor() {
  if (!profile.value || pendingColor.value === profile.value.color_code) {
    statusSheetOpen.value = false
    return
  }

  savingColor.value = true
  try {
    const updated = await updateColorCode(profile.value.id, pendingColor.value)
    profile.value = updated
    setProfile(updated)
    statusSheetOpen.value = false
    toast.success(`Status kamu sekarang ${getColorCode(updated.color_code).title} ${getColorCode(updated.color_code).emoji}`)
  } catch (error) {
    toast.error(error.message)
  } finally {
    savingColor.value = false
  }
}

/* ----------------------------------------------------- PING / Mutualan flow */

const pingSheetOpen = ref(false)
const pingMessage = ref('')
const sendingPing = ref(false)

function startPing() {
  if (mode.value === 'guest') {
    goToLogin()
    return
  }
  pingMessage.value = icebreaker.value || ''
  pingSheetOpen.value = true
}

async function submitPing() {
  const message = pingMessage.value.trim()
  if (!message || !profile.value) return

  sendingPing.value = true
  try {
    await sendPing({
      senderId: currentUserId.value,
      receiverId: profile.value.id,
      message,
    })
    pingPending.value = true
    pingSheetOpen.value = false
    pingMessage.value = ''
    toast.success(`PING terkirim ke ${firstName.value}! Tunggu balasannya ya 💫`)
  } catch (error) {
    toast.error(error.message)
  } finally {
    sendingPing.value = false
  }
}

/* ------------------------------------------------- Icebreaker prompt generator */

const icebreaker = ref('')
const copied = ref(false)

function rollIcebreaker() {
  if (mode.value === 'guest') {
    goToLogin()
    return
  }
  icebreaker.value = generateIcebreaker(profile.value ?? {}, icebreaker.value)
  copied.value = false
}

async function copyIcebreaker() {
  try {
    await navigator.clipboard.writeText(icebreaker.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1800)
  } catch {
    toast.info('Clipboard diblokir browser. Salin manual ya.')
  }
}

/* ------------------------------------------------------------------- sharing */

async function shareProfile() {
  const url = `${window.location.origin}/user/${profile.value?.id}`
  try {
    if (navigator.share) {
      await navigator.share({ title: profile.value?.full_name, url })
      return
    }
    await navigator.clipboard.writeText(url)
    toast.success('Link profil disalin!')
  } catch {
    /* user dismissed the share sheet — nothing to report */
  }
}

/* ------------------------------------------------------------------- logout */

const settingsOpen = ref(false)

async function handleSignOut() {
  try {
    await signOut()
    settingsOpen.value = false
    toast.info('Kamu sudah keluar.')
    router.replace({ name: 'landing' })
  } catch (error) {
    toast.error(error.message)
  }
}

async function handleRefresh() {
  await Promise.all([load(), isSelf.value ? refreshProfile() : Promise.resolve()])
}
</script>

<template>
  <div class="relative flex h-full flex-col bg-slate-50">
    <AppHeader
      :title="isSelf ? 'Profil Kamu' : (profile?.full_name || 'Profil')"
      :subtitle="isSelf ? `@${currentProfile?.username ?? ''}` : profile ? `@${profile.username}` : ''"
      :back="!isSelf"
      :fallback-to="{ name: 'map' }"
    >
      <template #actions>
        <button
          type="button"
          class="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Bagikan profil"
          @click="shareProfile"
        >
          <Share2 class="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        <button
          v-if="isSelf"
          type="button"
          class="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Pengaturan"
          @click="settingsOpen = true"
        >
          <Settings class="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </template>
    </AppHeader>

    <div class="screen-scroll" :class="mode === 'guest' ? 'pb-40' : 'pb-24'">
      <StateBlock
        :loading="loading"
        :error="loadError"
        loading-text="Memuat profil…"
        @retry="load"
      >
        <template v-if="profile">
          <!-- ============================================== profile hero -->
          <div class="relative overflow-hidden bg-white pb-5">
            <div
              class="absolute inset-x-0 top-0 h-28 bg-gradient-to-br opacity-90"
              :class="status.gradient"
              aria-hidden="true"
            />

            <div class="relative px-5 pt-14">
              <UserAvatar :profile="profile" size="xl" ring class="mb-3" />

              <h2 class="text-xl font-extrabold leading-tight tracking-tight text-slate-800">
                {{ profile.full_name }}
              </h2>
              <p class="mt-0.5 text-sm text-slate-400">@{{ profile.username }}</p>

              <div class="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <span
                  v-if="profile.major"
                  class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-semibold"
                >
                  <GraduationCap class="h-3.5 w-3.5" aria-hidden="true" />
                  {{ profile.major }}
                </span>
                <span
                  v-if="profile.faculty"
                  class="rounded-full bg-slate-100 px-2.5 py-1 font-semibold"
                >
                  {{ profile.faculty }}
                </span>
                <span
                  v-if="profile.batch"
                  class="rounded-full bg-slate-100 px-2.5 py-1 font-semibold"
                >
                  Angkatan {{ profile.batch }}
                </span>
              </div>

              <p v-if="profile.bio" class="mt-3.5 text-sm leading-relaxed text-slate-600">
                {{ profile.bio }}
              </p>

              <!-- Color code: tappable only when it's your own profile -->
              <div class="mt-4">
                <p class="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Status sekarang
                </p>
                <ColorCodeBadge
                  :code="profile.color_code"
                  :interactive="isSelf"
                  :pulse="profile.color_code === 'red'"
                  @click="openStatusSheet"
                />
                <p class="mt-2 text-xs leading-relaxed text-slate-400">
                  {{ status.description }}
                </p>
              </div>

              <div class="mt-4 flex items-center gap-4 text-xs">
                <span class="font-bold text-slate-700">
                  {{ mutualCount }}
                  <span class="font-medium text-slate-400">mutualan</span>
                </span>
                <span v-if="profile.interests?.length" class="truncate text-slate-400">
                  Suka: {{ profile.interests.join(', ') }}
                </span>
              </div>
            </div>
          </div>

          <!-- ===================================== SCENARIO 3 — own profile -->
          <div v-if="isSelf" class="space-y-3 px-5 pt-4">
            <div
              class="flex items-start gap-3 rounded-3xl border border-kenalan-100 bg-gradient-to-br from-kenalan-50 to-fuchsia-50 p-4"
            >
              <div
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-kenalan-500 text-white"
              >
                <Nfc class="h-4 w-4" aria-hidden="true" />
              </div>
              <div class="min-w-0">
                <p class="text-sm font-extrabold text-kenalan-700">Ini Profil Kamu</p>
                <p class="mt-0.5 text-xs leading-relaxed text-kenalan-700/70">
                  Ini yang dilihat orang lain saat scan lanyard kamu. Ubah status warna biar
                  sinyal sosialmu selalu akurat.
                </p>
              </div>
            </div>

            <RouterLink :to="{ name: 'profile-edit' }" class="btn-primary w-full !py-3.5">
              <Pencil class="h-4 w-4" aria-hidden="true" />
              Edit Profil & Ubah Status Warna
            </RouterLink>

            <div class="grid grid-cols-2 gap-3">
              <button type="button" class="btn-ghost !py-3" @click="openStatusSheet">
                <span
                  class="h-2.5 w-2.5 rounded-full"
                  :class="status.dot"
                  aria-hidden="true"
                />
                Ganti status
              </button>
              <RouterLink :to="{ name: 'mutualan' }" class="btn-ghost !py-3">
                <Heart class="h-4 w-4" aria-hidden="true" />
                Mutualan
              </RouterLink>
            </div>
          </div>

          <!-- ============================ SCENARIO 2a — logged-in visitor -->
          <div v-else-if="mode === 'visitor'" class="space-y-3 px-5 pt-4">
            <div
              v-if="alreadyMutual"
              class="flex items-center gap-2.5 rounded-3xl border border-mint/40 bg-mint-soft p-4 text-mint-deep"
            >
              <CheckCheck class="h-4 w-4 shrink-0" aria-hidden="true" />
              <p class="text-xs font-bold">Kamu dan {{ firstName }} udah mutualan 🎉</p>
            </div>

            <button
              type="button"
              class="btn-primary w-full !py-3.5"
              :disabled="pingPending"
              @click="startPing"
            >
              <Send class="h-4 w-4" aria-hidden="true" />
              {{
                pingPending
                  ? 'PING sudah terkirim — tunggu balasan'
                  : alreadyMutual
                    ? 'Kirim PING lagi'
                    : 'Mutualan / Send PING!'
              }}
            </button>

            <!-- Icebreaker Prompt Generator -->
            <section class="card">
              <header class="flex items-center gap-2">
                <div
                  class="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-kenalan-400 to-fuchsia-400 text-white"
                >
                  <WandSparkles class="h-4 w-4" aria-hidden="true" />
                </div>
                <div class="min-w-0 flex-1">
                  <h3 class="text-sm font-extrabold text-slate-800">Icebreaker Prompt</h3>
                  <p class="text-[11px] text-slate-400">
                    Bingung mau bilang apa? Biar kami yang mulai.
                  </p>
                </div>
              </header>

              <p
                v-if="icebreaker"
                class="mt-3 rounded-2xl bg-kenalan-50 p-3.5 text-sm italic leading-relaxed text-kenalan-800"
              >
                “{{ icebreaker }}”
              </p>

              <div class="mt-3 flex gap-2">
                <button type="button" class="btn-secondary flex-1 !py-2.5 !text-xs" @click="rollIcebreaker">
                  <RefreshCw class="h-3.5 w-3.5" aria-hidden="true" />
                  {{ icebreaker ? 'Acak lagi' : 'Buatkan pembuka' }}
                </button>
                <button
                  v-if="icebreaker"
                  type="button"
                  class="btn-ghost !py-2.5 !text-xs"
                  @click="copyIcebreaker"
                >
                  <CheckCheck v-if="copied" class="h-3.5 w-3.5 text-mint-deep" aria-hidden="true" />
                  <Copy v-else class="h-3.5 w-3.5" aria-hidden="true" />
                  {{ copied ? 'Tersalin' : 'Salin' }}
                </button>
              </div>

              <button
                v-if="icebreaker"
                type="button"
                class="btn-primary mt-2 w-full !py-2.5 !text-xs"
                :disabled="pingPending"
                @click="startPing"
              >
                <Sparkles class="h-3.5 w-3.5" aria-hidden="true" />
                Pakai ini buat PING
              </button>
            </section>
          </div>

          <!-- ========================================= SCENARIO 2b — guest -->
          <div v-else class="px-5 pt-4">
            <div class="card">
              <div class="flex items-center gap-2 text-slate-400">
                <UserRound class="h-4 w-4" aria-hidden="true" />
                <p class="text-xs font-semibold">Kamu sedang melihat sebagai pengunjung</p>
              </div>
              <p class="mt-2 text-xs leading-relaxed text-slate-500">
                Profil publik bisa kamu lihat bebas. Buat kirim PING atau mutualan, kamu perlu
                akun Kenalan dulu.
              </p>
            </div>
          </div>

          <!-- ===================================================== socials -->
          <div class="px-5 pt-5">
            <h3 class="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Sosial media
            </h3>
            <SocialLinks :profile="profile" />
          </div>

          <div v-if="!isSupabaseConfigured" class="px-5 pt-5">
            <p class="rounded-2xl bg-slate-100 px-4 py-3 text-[11px] leading-relaxed text-slate-400">
              Demo mode aktif — data profil ini berasal dari mock lokal.
            </p>
          </div>
        </template>
      </StateBlock>
    </div>

    <!-- ====================================== guest sticky floating banner -->
    <div
      v-if="mode === 'guest' && profile"
      class="absolute inset-x-0 bottom-0 z-30 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
    >
      <div
        class="rounded-3xl bg-gradient-to-br from-kenalan-600 to-fuchsia-500 p-4 shadow-2xl shadow-kenalan-900/30 animate-slide-up"
      >
        <p class="text-sm font-extrabold leading-snug text-white">
          Suka dengan profil ini?
        </p>
        <p class="mt-1 text-xs leading-relaxed text-white/80">
          Login atau buat akun Kenalan buat mutualan &amp; kirim PING ke
          {{ firstName }}!
        </p>
        <div class="mt-3 flex gap-2">
          <button
            type="button"
            class="btn flex-1 bg-white !py-2.5 !text-xs font-bold text-kenalan-700"
            @click="goToLogin"
          >
            <Send class="h-3.5 w-3.5" aria-hidden="true" />
            Mutualan / PING!
          </button>
          <button
            type="button"
            class="btn bg-white/15 !py-2.5 !text-xs font-bold text-white ring-1 ring-white/30"
            @click="goToLogin"
          >
            Login
            <ArrowRight class="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>

    <!-- ============================================== color code picker -->
    <BottomSheet
      :open="statusSheetOpen"
      :busy="savingColor"
      title="Ubah Status Warna"
      subtitle="Sinyal ini tampil di lanyard dan profil kamu."
      @close="statusSheetOpen = false"
    >
      <ColorCodePicker v-model="pendingColor" :busy="savingColor" />
      <button type="button" class="btn-primary mt-4 w-full !py-3.5" :disabled="savingColor" @click="saveColor">
        <LoaderCircle v-if="savingColor" class="h-4 w-4 animate-spin" aria-hidden="true" />
        {{ savingColor ? 'Menyimpan…' : 'Simpan status' }}
      </button>
    </BottomSheet>

    <!-- ==================================================== PING composer -->
    <BottomSheet
      :open="pingSheetOpen"
      :busy="sendingPing"
      :title="`Kirim PING ke ${firstName}`"
      subtitle="Satu pesan singkat buat mulai kenalan."
      @close="pingSheetOpen = false"
    >
      <div class="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
        <UserAvatar :profile="profile ?? {}" size="sm" />
        <div class="min-w-0">
          <p class="truncate text-sm font-bold text-slate-700">{{ profile?.full_name }}</p>
          <p class="truncate text-[11px] text-slate-400">{{ profile?.major }}</p>
        </div>
      </div>

      <label for="ping-message" class="field-label mt-4">Pesan kamu</label>
      <textarea
        id="ping-message"
        v-model="pingMessage"
        rows="4"
        maxlength="220"
        data-autofocus
        placeholder="Halo! Aku lihat lanyard kamu di kantin…"
        class="input-field resize-none"
      />
      <div class="mt-1 flex items-center justify-between">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 text-[11px] font-bold text-kenalan-600"
          @click="pingMessage = generateIcebreaker(profile ?? {}, pingMessage)"
        >
          <WandSparkles class="h-3 w-3" aria-hidden="true" />
          Pakai icebreaker
        </button>
        <span class="text-[11px] text-slate-400">{{ pingMessage.length }}/220</span>
      </div>

      <button
        type="button"
        class="btn-primary mt-4 w-full !py-3.5"
        :disabled="!pingMessage.trim() || sendingPing"
        @click="submitPing"
      >
        <LoaderCircle v-if="sendingPing" class="h-4 w-4 animate-spin" aria-hidden="true" />
        <Send v-else class="h-4 w-4" aria-hidden="true" />
        {{ sendingPing ? 'Mengirim…' : 'Kirim PING!' }}
      </button>
    </BottomSheet>

    <!-- ======================================================= settings -->
    <BottomSheet :open="settingsOpen" title="Pengaturan" @close="settingsOpen = false">
      <div class="space-y-2">
        <RouterLink
          :to="{ name: 'profile-edit' }"
          class="btn-ghost w-full !justify-start !py-3.5"
          @click="settingsOpen = false"
        >
          <Pencil class="h-4 w-4" aria-hidden="true" />
          Edit profil
        </RouterLink>
        <button type="button" class="btn-ghost w-full !justify-start !py-3.5" @click="handleRefresh">
          <RefreshCw class="h-4 w-4" aria-hidden="true" />
          Muat ulang data
        </button>
        <button
          type="button"
          class="btn-ghost w-full !justify-start !py-3.5 !text-blush-deep"
          @click="handleSignOut"
        >
          <LogOut class="h-4 w-4" aria-hidden="true" />
          Keluar dari akun
        </button>
      </div>
    </BottomSheet>
  </div>
</template>
