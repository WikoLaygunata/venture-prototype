import { createRouter, createWebHistory } from 'vue-router'
import { authReady, currentUserId, initAuth } from '@/stores/auth'

/**
 * Route map for the Kenalan prototype.
 *
 * meta.requiresAuth  -> guests get bounced to /login?redirect=<target>
 * meta.guestOnly     -> logged-in users get bounced to /map
 * meta.hideNav       -> full-bleed screens without the bottom tab bar
 */
const routes = [
  {
    path: '/',
    name: 'home',
    redirect: () => (currentUserId.value ? { name: 'map' } : { name: 'landing' }),
  },
  {
    path: '/welcome',
    name: 'landing',
    component: () => import('@/views/LandingView.vue'),
    meta: { hideNav: true },
  },
  {
    /* SCENARIO 1 — fresh NFC keychain. The token is baked into the keychain's
       URL once at manufacture time, so we keep the link short and pretty:
       /t/KNL-NEW-01 (no query string). No token (/t) → manual entry screen.
       When this route is opened the backend resolves the token and this view
       routes the visitor onward (owner profile vs. registration form). */
    path: '/t/:token?',
    name: 'activate',
    component: () => import('@/views/OnboardingView.vue'),
    props: true,
    meta: { hideNav: true },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { guestOnly: true, hideNav: true },
  },
  {
    path: '/map',
    name: 'map',
    component: () => import('@/views/MapView.vue'),
    meta: { requiresAuth: true },
  },
  {
    /* A Location Stamp opened as a forum thread */
    path: '/stamp/:id',
    name: 'stamp-thread',
    component: () => import('@/views/StampThreadView.vue'),
    meta: { requiresAuth: true, hideNav: true },
  },
  {
    /* Recommendations of people to mutualan with */
    path: '/explore',
    name: 'explore',
    component: () => import('@/views/ExploreView.vue'),
    meta: { requiresAuth: true },
  },
  {
    /* Location Stamps from the last 30 days.
       /history        -> your own (editable)
       /history/:user_id -> someone else's, only if they made it public (read-only) */
    path: '/history/:user_id?',
    name: 'stamp-history',
    component: () => import('@/views/StampHistoryView.vue'),
    props: true,
    meta: { requiresAuth: true, hideNav: true },
  },
  {
    path: '/mutualan',
    name: 'mutualan',
    component: () => import('@/views/MutualanView.vue'),
    meta: { requiresAuth: true },
  },
  {
    /* Own profile */
    path: '/profile',
    name: 'profile',
    component: () => import('@/views/ProfileView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/profile/edit',
    name: 'profile-edit',
    component: () => import('@/views/EditProfileView.vue'),
    meta: { requiresAuth: true, hideNav: true },
  },
  {
    /* SCENARIO 2 & 3 — someone scanned a claimed NFC keychain. Public on
       purpose: guests must be able to view the profile before signing up. */
    path: '/user/:user_id',
    name: 'user-profile',
    component: () => import('@/views/ProfileView.vue'),
    props: true,
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { hideNav: true },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  // The session must be resolved before we can judge access.
  if (!authReady.value) await initAuth()

  const loggedIn = Boolean(currentUserId.value)

  if (to.meta.requiresAuth && !loggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.guestOnly && loggedIn) {
    // Honour ?redirect= so "login then continue to the profile you scanned" works.
    const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : null
    return redirect && redirect.startsWith('/') ? redirect : { name: 'map' }
  }

  // Viewing your own id via /user/:user_id is the same screen as /profile,
  // but the canonical URL keeps the nav highlighting consistent.
  if (to.name === 'user-profile' && loggedIn && to.params.user_id === currentUserId.value) {
    return { name: 'profile', replace: true }
  }

  return true
})

export default router
