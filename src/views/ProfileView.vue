<script setup>
/**
 * ProfileView — serves both `/profile` (own) and `/user/:user_id` (scanned).
 *
 * Three viewer modes drive the whole screen:
 *
 *  SCENARIO 3 — mode 'self'
 *    You scanned your own keychain. Banner "Ini Profil Kamu", tappable
 *    color-code badge, discovery toggle, and a shortcut to the edit dashboard.
 *
 *  SCENARIO 2a — mode 'visitor'
 *    Logged in, looking at someone else. Full public profile + "Mutualan / Send
 *    PING!" and an overflow menu to block/report.
 *
 *  SCENARIO 2b — mode 'guest'
 *    Not logged in. Profile stays fully visible, with a sticky banner that
 *    routes to /login?redirect=/user/:id so they return here after auth.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowRight,
  Ban,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCheck,
  Flag,
  Heart,
  HeartCrack,
  History,
  Sparkles,
  LoaderCircle,
  LogOut,
  MoreVertical,
  Nfc,
  Pencil,
  RotateCcw,
  Send,
  Settings,
  Share2,
  ShieldOff,
  UserRound,
} from 'lucide-vue-next'

import AppHeader from '@/components/AppHeader.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import ColorCodeBadge from '@/components/ColorCodeBadge.vue'
import ColorCodePicker from '@/components/ColorCodePicker.vue'
import SocialLinks from '@/components/SocialLinks.vue'
import StateBlock from '@/components/StateBlock.vue'
import UserAvatar from '@/components/UserAvatar.vue'

import {
  blockUser,
  fetchBlockedUsers,
  fetchMutualCount,
  fetchProfile,
  hasPendingPing,
  isMutualWith,
  removeMutual,
  reportUser,
  sendPing,
  setDiscoverable,
  setStampHistoryPublic,
  unblockUser,
  updateColorCode,
} from '@/lib/api'
import { getColorCode } from '@/lib/colorCodes'
import { isSupabaseConfigured } from '@/lib/supabase'
import { currentProfile, currentUserId, setProfile, signOut } from '@/stores/auth'
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

    const [count, mutualFlag, pending] = await Promise.all([
      fetchMutualCount(row.id),
      currentUserId.value && !isSelf.value
        ? isMutualWith(currentUserId.value, row.id)
        : Promise.resolve(false),
      currentUserId.value && !isSelf.value
        ? hasPendingPing(currentUserId.value, row.id)
        : Promise.resolve(false),
    ])

    mutualCount.value = count
    alreadyMutual.value = mutualFlag
    pingPending.value = pending
  } catch (error) {
    loadError.value = error.message
  } finally {
    loading.value = false
  }
}

watch([targetId, currentUserId], () => load(), { immediate: true })

const status = computed(() => getColorCode(profile.value?.color_code))
const firstName = computed(() => (profile.value?.full_name || '').split(' ')[0] || 'dia')

/* --------------------------------------------------- guest -> login handoff */

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
    toast.success(
      `Status kamu sekarang ${getColorCode(updated.color_code).title} ${getColorCode(updated.color_code).emoji}`,
    )
  } catch (error) {
    toast.error(error.message)
  } finally {
    savingColor.value = false
  }
}

/* ------------------------------------------------- discovery toggle (self) */

const togglingDiscovery = ref(false)

async function toggleDiscovery() {
  if (!profile.value) return
  togglingDiscovery.value = true
  try {
    const next = !(profile.value.is_discoverable !== false)
    const updated = await setDiscoverable(profile.value.id, next)
    profile.value = updated
    setProfile(updated)
    toast.success(
      next ? 'Kamu sekarang muncul di rekomendasi ✨' : 'Kamu disembunyikan dari rekomendasi.',
    )
  } catch (error) {
    toast.error(error.message)
  } finally {
    togglingDiscovery.value = false
  }
}

const togglingHistory = ref(false)

async function toggleHistoryPublic() {
  if (!profile.value) return
  togglingHistory.value = true
  try {
    const next = profile.value.stamp_history_public !== true
    const updated = await setStampHistoryPublic(profile.value.id, next)
    profile.value = updated
    setProfile(updated)
    toast.success(
      next ? 'History stamp kamu sekarang publik 👀' : 'History stamp kamu kembali privat.',
    )
  } catch (error) {
    toast.error(error.message)
  } finally {
    togglingHistory.value = false
  }
}

/* ----------------------------------------------------- PING / Mutualan flow */

const pingSheetOpen = ref(false)
const pingMessage = ref('')
const sendingPing = ref(false)

function startPing() {
  if (mode.value === 'guest') return goToLogin()
  pingMessage.value = ''
  pingSheetOpen.value = true
}

async function submitPing() {
  const message = pingMessage.value.trim()
  if (!message || !profile.value) return

  sendingPing.value = true
  try {
    await sendPing({ senderId: currentUserId.value, receiverId: profile.value.id, message })
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

/* ---------------------------------------------------------- block & report */

const moreOpen = ref(false)
const reportSheetOpen = ref(false)
const reportReason = ref('')
const submittingReport = ref(false)
const blocking = ref(false)

const REPORT_REASONS = [
  'Spam atau promosi',
  'Pelecehan atau kata kasar',
  'Profil palsu / impersonasi',
  'Konten tidak pantas',
  'Lainnya',
]

async function confirmBlock() {
  if (!profile.value) return
  blocking.value = true
  try {
    await blockUser(currentUserId.value, profile.value.id)
    moreOpen.value = false
    toast.info(`${firstName.value} diblokir. Kalian nggak akan saling muncul lagi.`)
    router.replace({ name: 'map' })
  } catch (error) {
    toast.error(error.message)
  } finally {
    blocking.value = false
  }
}

function openReport() {
  moreOpen.value = false
  reportReason.value = ''
  reportSheetOpen.value = true
}

const unmutualing = ref(false)

async function confirmUnmutual() {
  if (!profile.value) return
  unmutualing.value = true
  try {
    await removeMutual(currentUserId.value, profile.value.id)
    alreadyMutual.value = false
    mutualCount.value = Math.max(0, mutualCount.value - 1)
    moreOpen.value = false
    toast.info(`Mutual dengan ${firstName.value} diputuskan.`)
  } catch (error) {
    toast.error(error.message)
  } finally {
    unmutualing.value = false
  }
}

async function submitReport() {
  if (!profile.value || !reportReason.value) return
  submittingReport.value = true
  try {
    await reportUser({
      reporterId: currentUserId.value,
      reportedId: profile.value.id,
      reason: reportReason.value,
    })
    reportSheetOpen.value = false
    toast.success('Laporan terkirim. Terima kasih sudah menjaga komunitas 🙏')
  } catch (error) {
    toast.error(error.message)
  } finally {
    submittingReport.value = false
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

/* ----------------------------------------------------------- blocked users */

const blockedOpen = ref(false)
const blockedList = ref([])
const blockedLoading = ref(false)
const unblockingId = ref('')

/** Open the "blocked users" sheet from Settings and load the list. */
async function openBlocked() {
  settingsOpen.value = false
  blockedOpen.value = true
  await loadBlocked()
}

async function loadBlocked() {
  blockedLoading.value = true
  try {
    blockedList.value = await fetchBlockedUsers(currentUserId.value)
  } catch (error) {
    toast.error(error.message)
  } finally {
    blockedLoading.value = false
  }
}

async function handleUnblock(user) {
  if (unblockingId.value) return
  unblockingId.value = user.id
  try {
    await unblockUser(currentUserId.value, user.id)
    blockedList.value = blockedList.value.filter((u) => u.id !== user.id)
    toast.success(`Blokir ke @${user.username} dibuka.`)
  } catch (error) {
    toast.error(error.message)
  } finally {
    unblockingId.value = ''
  }
}
</script>

<template>
  <div class="flex h-full flex-col bg-slate-50">
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
        <button
          v-else-if="mode === 'visitor'"
          type="button"
          class="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Opsi lainnya"
          @click="moreOpen = true"
        >
          <MoreVertical class="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </template>
    </AppHeader>

    <div class="screen-scroll">
      <StateBlock :loading="loading" :error="loadError" loading-text="Memuat profil…" @retry="load">
        <template v-if="profile">
          <!-- ============================================== profile hero -->
          <div class="relative overflow-hidden bg-white pb-5">
            <div
              class="absolute inset-x-0 top-0 h-28 bg-gradient-to-br opacity-90"
              :class="status.gradient"
              aria-hidden="true"
            />

            <div class="relative px-5 pt-14">
              <div class="flex items-end justify-between gap-3">
                <UserAvatar :profile="profile" size="xl" ring class="mb-3" />

                <!-- mutualan count as a compact stat chip -->
                <div class="mb-2 rounded-2xl bg-slate-50 px-3.5 py-2 text-center ring-1 ring-slate-100">
                  <p class="text-lg font-extrabold leading-none text-slate-800">{{ mutualCount }}</p>
                  <p class="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Mutualan
                  </p>
                </div>
              </div>

              <h2 class="text-xl font-extrabold leading-tight tracking-tight text-slate-800">
                {{ profile.full_name }}
              </h2>
              <p class="mt-0.5 text-sm text-slate-400">@{{ profile.username }}</p>

              <p v-if="profile.bio" class="mt-3 text-sm leading-relaxed text-slate-600">
                {{ profile.bio }}
              </p>

              <!-- academic identity: a clean icon list instead of scattered chips -->
              <dl
                v-if="profile.major || profile.faculty || profile.batch"
                class="mt-4 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
              >
                <div v-if="profile.major" class="flex items-center gap-3 px-4 py-3">
                  <BookOpen class="h-4 w-4 shrink-0 text-kenalan-500" aria-hidden="true" />
                  <dt class="sr-only">Jurusan</dt>
                  <dd class="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">
                    {{ profile.major }}
                  </dd>
                </div>
                <div v-if="profile.faculty" class="flex items-center gap-3 px-4 py-3">
                  <Building2 class="h-4 w-4 shrink-0 text-kenalan-500" aria-hidden="true" />
                  <dt class="sr-only">Fakultas</dt>
                  <dd class="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">
                    {{ profile.faculty }}
                  </dd>
                </div>
                <div v-if="profile.batch" class="flex items-center gap-3 px-4 py-3">
                  <CalendarDays class="h-4 w-4 shrink-0 text-kenalan-500" aria-hidden="true" />
                  <dt class="sr-only">Angkatan</dt>
                  <dd class="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">
                    Angkatan {{ profile.batch }}
                  </dd>
                </div>
              </dl>

              <!-- interests as proper tags -->
              <div v-if="profile.interests?.length" class="mt-4">
                <p class="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  <Sparkles class="h-3.5 w-3.5" aria-hidden="true" />
                  Minat
                </p>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="interest in profile.interests"
                    :key="interest"
                    class="rounded-full bg-kenalan-50 px-2.5 py-1 text-xs font-semibold text-kenalan-700 ring-1 ring-kenalan-100"
                  >
                    {{ interest }}
                  </span>
                </div>
              </div>

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
                <p class="mt-2 text-xs leading-relaxed text-slate-400">{{ status.description }}</p>
              </div>
            </div>
          </div>

          <!-- ===================================== SCENARIO 3 — own profile -->
          <div v-if="isSelf" class="space-y-3 px-5 pt-4">
            <div
              class="flex items-start gap-3 rounded-3xl border border-kenalan-100 bg-gradient-to-br from-kenalan-50 to-fuchsia-50 p-4"
            >
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-kenalan-500 text-white">
                <Nfc class="h-4 w-4" aria-hidden="true" />
              </div>
              <div class="min-w-0">
                <p class="text-sm font-extrabold text-kenalan-700">Ini Profil Kamu</p>
                <p class="mt-0.5 text-xs leading-relaxed text-kenalan-700/70">
                  Ini yang dilihat orang lain saat scan keychain NFC kamu. Ubah status warna
                  biar sinyal sosialmu selalu akurat.
                </p>
              </div>
            </div>

            <RouterLink :to="{ name: 'profile-edit' }" class="btn-primary w-full !py-3.5">
              <Pencil class="h-4 w-4" aria-hidden="true" />
              Edit Profil & Ubah Status Warna
            </RouterLink>

            <div class="grid grid-cols-2 gap-3">
              <button type="button" class="btn-ghost !py-3" @click="openStatusSheet">
                <span class="h-2.5 w-2.5 rounded-full" :class="status.dot" aria-hidden="true" />
                Ganti status
              </button>
              <RouterLink :to="{ name: 'mutualan' }" class="btn-ghost !py-3">
                <Heart class="h-4 w-4" aria-hidden="true" />
                Mutualan
              </RouterLink>
            </div>

            <!-- discovery toggle -->
            <div class="flex items-center gap-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-card">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-bold text-slate-800">Muncul di rekomendasi</p>
                <p class="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                  Kalau aktif, profilmu bisa muncul di tab Explore orang lain.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                :aria-checked="profile.is_discoverable !== false"
                class="relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50"
                :class="profile.is_discoverable !== false ? 'bg-kenalan-500' : 'bg-slate-300'"
                :disabled="togglingDiscovery"
                @click="toggleDiscovery"
              >
                <span
                  class="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all"
                  :class="profile.is_discoverable !== false ? 'left-6' : 'left-1'"
                  aria-hidden="true"
                />
              </button>
            </div>

            

            <!-- history visibility toggle -->
            <div class="flex items-center gap-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-card">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-bold text-slate-800">History stamp publik</p>
                <p class="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                  Kalau aktif, orang lain bisa lihat history stamp 30 harimu dari profilmu.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                :aria-checked="profile.stamp_history_public === true"
                class="relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50"
                :class="profile.stamp_history_public === true ? 'bg-kenalan-500' : 'bg-slate-300'"
                :disabled="togglingHistory"
                @click="toggleHistoryPublic"
              >
                <span
                  class="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all"
                  :class="profile.stamp_history_public === true ? 'left-6' : 'left-1'"
                  aria-hidden="true"
                />
              </button>
            </div>
            <!-- stamp history shortcut -->
            <RouterLink :to="{ name: 'stamp-history' }" class="btn-ghost w-full !justify-start !py-3.5">
              <History class="h-4 w-4" aria-hidden="true" />
              History Stamp
            </RouterLink>
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

            <button type="button" class="btn-primary w-full !py-3.5" :disabled="pingPending" @click="startPing">
              <Send class="h-4 w-4" aria-hidden="true" />
              {{
                pingPending
                  ? 'PING sudah terkirim — tunggu balasan'
                  : alreadyMutual
                    ? 'Kirim PING lagi'
                    : 'Mutualan / Send PING!'
              }}
            </button>

            <RouterLink
              v-if="profile.stamp_history_public === true"
              :to="{ name: 'stamp-history', params: { user_id: profile.id } }"
              class="btn-ghost w-full !py-3"
            >
              <History class="h-4 w-4" aria-hidden="true" />
              Lihat history stamp {{ firstName }}
            </RouterLink>
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
            <SocialLinks :profile="profile" :is-self="isSelf" :is-mutual="alreadyMutual" />
          </div>

          <!-- spacer so content clears the guest banner / bottom edge -->
          <div class="h-6" :class="mode === 'guest' ? 'pb-40' : ''" />

          <div v-if="!isSupabaseConfigured" class="px-5 pb-6">
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
      class="shrink-0 border-t border-slate-100 bg-white px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
    >
      <div class="rounded-3xl bg-gradient-to-br from-kenalan-600 to-fuchsia-500 p-4 shadow-lg">
        <p class="text-sm font-extrabold leading-snug text-white">Suka dengan profil ini?</p>
        <p class="mt-1 text-xs leading-relaxed text-white/80">
          Login atau buat akun Kenalan buat mutualan &amp; kirim PING ke {{ firstName }}!
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
      subtitle="Sinyal ini tampil di keychain dan profil kamu."
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
        placeholder="Halo! Aku lihat keychain NFC kamu…"
        class="input-field resize-none"
      />
      <p class="mt-1 text-right text-[11px] text-slate-400">{{ pingMessage.length }}/220</p>

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

    <!-- ============================================ visitor overflow menu -->
    <BottomSheet :open="moreOpen" :busy="blocking" title="Opsi" @close="moreOpen = false">
      <div class="space-y-2">
        <button type="button" class="btn-ghost w-full !justify-start !py-3.5" @click="openReport">
          <Flag class="h-4 w-4" aria-hidden="true" />
          Laporkan {{ firstName }}
        </button>
        <button
          v-if="alreadyMutual"
          type="button"
          class="btn-ghost w-full !justify-start !py-3.5"
          :disabled="unmutualing"
          @click="confirmUnmutual"
        >
          <LoaderCircle v-if="unmutualing" class="h-4 w-4 animate-spin" aria-hidden="true" />
          <HeartCrack v-else class="h-4 w-4" aria-hidden="true" />
          Putuskan mutual
        </button>
        <button
          type="button"
          class="btn-ghost w-full !justify-start !py-3.5 !text-blush-deep"
          :disabled="blocking"
          @click="confirmBlock"
        >
          <LoaderCircle v-if="blocking" class="h-4 w-4 animate-spin" aria-hidden="true" />
          <Ban v-else class="h-4 w-4" aria-hidden="true" />
          Blokir {{ firstName }}
        </button>
        <p class="px-1 pt-1 text-[11px] leading-relaxed text-slate-400">
          Memblokir membatalkan PING yang belum dibalas dan menyembunyikan kalian dari satu
          sama lain.
        </p>
      </div>
    </BottomSheet>

    <!-- ================================================== report composer -->
    <BottomSheet
      :open="reportSheetOpen"
      :busy="submittingReport"
      :title="`Laporkan ${firstName}`"
      subtitle="Pilih alasan laporan kamu."
      @close="reportSheetOpen = false"
    >
      <fieldset class="space-y-2" :disabled="submittingReport">
        <legend class="sr-only">Alasan laporan</legend>
        <label
          v-for="reason in REPORT_REASONS"
          :key="reason"
          class="flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 transition"
          :class="reportReason === reason ? 'border-kenalan-400 bg-kenalan-50' : 'border-slate-100 bg-white'"
        >
          <input v-model="reportReason" type="radio" name="report-reason" :value="reason" class="sr-only" />
          <span
            class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2"
            :class="reportReason === reason ? 'border-kenalan-500' : 'border-slate-300'"
            aria-hidden="true"
          >
            <span v-if="reportReason === reason" class="h-2.5 w-2.5 rounded-full bg-kenalan-500" />
          </span>
          <span class="text-sm font-semibold text-slate-700">{{ reason }}</span>
        </label>
      </fieldset>

      <button
        type="button"
        class="btn-primary mt-4 w-full !py-3.5"
        :disabled="!reportReason || submittingReport"
        @click="submitReport"
      >
        <LoaderCircle v-if="submittingReport" class="h-4 w-4 animate-spin" aria-hidden="true" />
        <Flag v-else class="h-4 w-4" aria-hidden="true" />
        {{ submittingReport ? 'Mengirim…' : 'Kirim laporan' }}
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
        <button type="button" class="btn-ghost w-full !justify-start !py-3.5" @click="openBlocked">
          <ShieldOff class="h-4 w-4" aria-hidden="true" />
          Pengguna diblokir
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

    <!-- =============================================== blocked users -->
    <BottomSheet :open="blockedOpen" title="Pengguna diblokir" @close="blockedOpen = false">
      <div v-if="blockedLoading" class="flex items-center justify-center py-10 text-slate-400">
        <LoaderCircle class="h-6 w-6 animate-spin" aria-hidden="true" />
      </div>

      <div
        v-else-if="!blockedList.length"
        class="flex flex-col items-center gap-2 py-10 text-center"
      >
        <ShieldOff class="h-8 w-8 text-slate-300" aria-hidden="true" />
        <p class="text-sm font-bold text-slate-600">Belum ada yang diblokir</p>
        <p class="max-w-[16rem] text-xs leading-relaxed text-slate-400">
          Orang yang kamu blokir bakal muncul di sini, lengkap dengan tombol buka blokir.
        </p>
      </div>

      <ul v-else class="space-y-2">
        <li
          v-for="user in blockedList"
          :key="user.id"
          class="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm"
        >
          <UserAvatar :profile="user" size="sm" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-bold text-slate-800">
              {{ user.full_name || user.username }}
            </p>
            <p class="truncate text-[11px] text-slate-400">@{{ user.username }}</p>
          </div>
          <button
            type="button"
            class="btn-secondary shrink-0 !px-3 !py-2 !text-[12px]"
            :disabled="unblockingId === user.id"
            @click="handleUnblock(user)"
          >
            <LoaderCircle
              v-if="unblockingId === user.id"
              class="h-3.5 w-3.5 animate-spin"
              aria-hidden="true"
            />
            <RotateCcw v-else class="h-3.5 w-3.5" aria-hidden="true" />
            Buka blokir
          </button>
        </li>
      </ul>
    </BottomSheet>
  </div>
</template>
