<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Activity,
  ArrowUpRight,
  ChevronRight,
  Command,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  Users,
  X,
  Tag,
} from 'lucide-vue-next'
import { dashboardRole, dashboardUser, signOutDashboard } from '@/stores/dashboardAuth'

const route = useRoute()
const router = useRouter()
const menuOpen = ref(false)
const loggingOut = ref(false)
const logoutError = ref('')

const navItems = [
  { label: 'Ringkasan', to: '/dashboard/home', icon: LayoutDashboard, roles: ['admin', 'moderator', 'superadmin'] },
  { label: 'Pengguna', to: '/dashboard/users', icon: Users, roles: ['admin', 'moderator', 'superadmin'] },
  { label: 'NFC Keychain', to: '/dashboard/nfc-tokens', icon: Tag, roles: ['admin', 'superadmin'] },
  { label: 'Location Stamps', to: '/dashboard/stamps', icon: FileText, roles: ['admin', 'moderator', 'superadmin'] },
  { label: 'Laporan', to: '/dashboard/reports', icon: Shield, roles: ['admin', 'moderator', 'superadmin'] },
]

const visibleNavItems = computed(() =>
  navItems.filter((item) => item.roles.includes(dashboardRole.value)),
)
const pageTitle = computed(
  () => navItems.find((item) => route.path.startsWith(item.to))?.label ?? 'Dashboard',
)
const displayName = computed(
  () => dashboardUser.value?.name ?? dashboardUser.value?.user_metadata?.full_name ?? 'Admin',
)
const avatarLetter = computed(() => displayName.value.trim().charAt(0).toUpperCase() || 'A')

async function logout() {
  loggingOut.value = true
  logoutError.value = ''
  try {
    await signOutDashboard()
    await router.replace('/dashboard/login')
  } catch (error) {
    logoutError.value = error.message
  } finally {
    loggingOut.value = false
  }
}
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-[#f5f7f8] text-slate-800">
    <div
      v-if="menuOpen"
      class="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
      @click="menuOpen = false"
    />

    <aside
      class="fixed inset-y-0 left-0 z-40 flex w-[260px] -translate-x-full flex-col border-r border-slate-100 bg-white transition-transform duration-200 lg:static lg:translate-x-0"
      :class="{ 'translate-x-0': menuOpen }"
    >
      <div class="flex h-[82px] items-center justify-between border-b border-slate-100 px-6">
        <RouterLink to="/dashboard/home" class="flex items-center gap-3" @click="menuOpen = false">
          <span class="grid h-10 w-10 place-items-center rounded-2xl bg-kenalan-500 text-white shadow-lg shadow-kenalan-500/25">
            <Command :size="20" :stroke-width="2.4" />
          </span>
          <span>
            <span class="block text-[15px] font-extrabold tracking-tight text-slate-900">kenalan</span>
            <span class="block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Admin console</span>
          </span>
        </RouterLink>
        <button class="rounded-xl p-2 text-slate-400 hover:bg-slate-100 lg:hidden" aria-label="Tutup menu" @click="menuOpen = false">
          <X :size="19" />
        </button>
      </div>

      <div class="px-4 pt-7">
        <p class="mb-3 px-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Workspace</p>
        <nav class="space-y-1">
          <RouterLink
            v-for="item in visibleNavItems"
            :key="item.to"
            :to="item.to"
            class="group flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-semibold transition"
            :class="route.path.startsWith(item.to)
              ? 'bg-kenalan-50 text-kenalan-700'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'"
            @click="menuOpen = false"
          >
            <component :is="item.icon" :size="18" :stroke-width="2" />
            <span class="flex-1">{{ item.label }}</span>
            <ChevronRight v-if="route.path.startsWith(item.to)" :size="15" class="text-kenalan-500" />
          </RouterLink>
        </nav>
      </div>

      <div class="mt-auto p-4">
        <div class="mb-4 rounded-2xl bg-slate-50 p-4">
          <div class="flex items-start gap-3">
            <span class="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
              <Activity :size="15" />
            </span>
            <div>
              <p class="text-xs font-bold text-slate-700">Mode dashboard aktif</p>
              <p class="mt-1 text-[11px] leading-relaxed text-slate-500">Akses dibatasi sesuai peran admin.</p>
            </div>
          </div>
        </div>
        <button
          class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-semibold text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
          :disabled="loggingOut"
          @click="logout"
        >
          <LogOut :size="17" />
          {{ loggingOut ? 'Keluar...' : 'Keluar' }}
          <ArrowUpRight :size="14" class="ml-auto" />
        </button>
        <p class="mt-4 px-3 text-[10px] text-slate-400">KENALAN · INTERNAL</p>
      </div>
    </aside>

    <section class="flex min-w-0 flex-1 flex-col">
      <header class="z-10 flex h-[72px] shrink-0 items-center justify-between border-b border-slate-100 bg-white/90 px-4 backdrop-blur sm:px-8">
        <div class="flex min-w-0 items-center gap-3">
          <button class="rounded-xl p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Buka menu" @click="menuOpen = true">
            <Menu :size="20" />
          </button>
          <div class="min-w-0">
            <p class="truncate text-sm font-bold text-slate-800">{{ pageTitle }}</p>
            <p class="hidden text-[11px] text-slate-400 sm:block">Ruang kerja operasional Kenalan</p>
          </div>
        </div>
        <div class="flex items-center gap-3 sm:gap-5">
          <span class="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 sm:flex">
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Sistem operasional
          </span>
          <span class="h-7 w-px bg-slate-100" />
          <div class="flex items-center gap-2.5">
            <span class="grid h-9 w-9 place-items-center rounded-full bg-kenalan-100 text-xs font-extrabold text-kenalan-700">
              {{ avatarLetter }}
            </span>
            <span class="hidden sm:block">
              <span class="block max-w-[140px] truncate text-xs font-bold text-slate-700">{{ displayName }}</span>
              <span class="block text-[10px] capitalize text-slate-400">{{ dashboardRole }}</span>
            </span>
          </div>
        </div>
      </header>

      <main class="min-h-0 flex-1 overflow-y-auto">
        <div class="mx-auto w-full max-w-[1440px] p-4 sm:p-7 lg:p-9">
          <div v-if="logoutError" class="mb-5 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-700" role="alert">
            {{ logoutError }}
          </div>
          <RouterView />
        </div>
      </main>
    </section>
  </div>
</template>
