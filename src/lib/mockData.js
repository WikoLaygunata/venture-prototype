/**
 * DEMO MODE dataset.
 *
 * Used automatically whenever Supabase env vars are missing, so the prototype
 * is fully clickable offline. Mutations are persisted to localStorage, which
 * means claiming an NFC keychain / sending a PING / dropping a stamp survives a
 * page reload — handy when demoing the flow.
 *
 * Shapes here mirror the SQL schema documented in `src/lib/supabase.js`.
 */
import { hoursAgo, minutesAgo } from './time'

// Bumped to v4: profiles gained is_discoverable, stamps dropped spot_id in
// favour of location_label + image_url + coordinates, and stamp_replies /
// blocks / reports are new. The seed-merge in load() keeps older snapshots
// from breaking, but a reset is cleaner if you were on v3.
const STORAGE_KEY = 'kenalan.demo.v8'

/** Remembered stamp audience choice ('public' | 'mutual'), its own key. */
const STAMP_AUDIENCE_KEY = 'kenalan.stampAudience'

/**
 * Default campus center for the map. Stamps carry real lat/lng now so Leaflet
 * can place them; when a user drops a stamp without geolocation we fan it out a
 * little around this point. (This is a generic campus-ish spot in Depok, ID —
 * swap for your real campus coords.)
 */
export const CAMPUS_CENTER = { lat: -6.3629, lng: 106.8275 }

/** Credentials that "work" in demo mode. */
export const DEMO_CREDENTIALS = {
  email: 'demo@kenalan.id',
  password: 'kenalan123',
}

const DEMO_PASSWORD_KEY = 'kenalan.demo.password'

export function getDemoPassword() {
  try {
    return localStorage.getItem(DEMO_PASSWORD_KEY) || DEMO_CREDENTIALS.password
  } catch {
    return DEMO_CREDENTIALS.password
  }
}

export function setDemoPassword(password) {
  try {
    localStorage.setItem(DEMO_PASSWORD_KEY, String(password))
  } catch {
    throw new Error('Password demo tidak dapat disimpan pada browser ini.')
  }
}

export function getDemoEmail() {
  return demoDb.profiles.find((profile) => profile.id === 'u-raka')?.admin_email
    || DEMO_CREDENTIALS.email
}

/** Max simultaneous outgoing PINGs still awaiting a reply (anti-spam). */
export const MAX_PENDING_PINGS = 5

const avatar = (seed) =>
  `https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${encodeURIComponent(
    seed,
  )}&backgroundColor=ddd6fe,fce7f3,d1fae5,fef3c7&radius=50`

// Placeholder stamp photos (picsum = stable seeded images, no API key needed).
const photo = (seed) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/640/420`

function seed() {
  return {
    profiles: [
      {
        id: 'u-raka',
        username: 'rakaprtm',
        full_name: 'Raka Pratama',
        avatar_url: avatar('Raka Pratama'),
        faculty: 'Fakultas Ilmu Komputer',
        major: 'Sistem Informasi',
        batch: '2023',
        bio: 'Suka ngoprek side project sambil ngopi. Cari partner ngide jam 2 pagi.',
        color_code: 'mint',
        interests: ['UI design', 'kopi manual brew', 'basket'],
        instagram: 'rakaprtm',
        linkedin: 'raka-pratama',
        spotify: 'rakaprtm',
        whatsapp: '081234567890',
        line: 'rakaprtm',
        social_visibility: {
          instagram: 'public',
          linkedin: 'public',
          spotify: 'public',
          whatsapp: 'mutual',
          line: 'mutual',
        },
        is_discoverable: true,
        stamp_history_public: true,
        created_at: hoursAgo(900),
      },
      {
        id: 'u-nadia',
        username: 'nadiakirana',
        full_name: 'Nadia Kirana',
        avatar_url: avatar('Nadia Kirana'),
        faculty: 'Fakultas Ilmu Sosial & Politik',
        major: 'Ilmu Komunikasi',
        batch: '2023',
        bio: 'Anak komunikasi yang lebih milih dengerin daripada ngomong. Ajak aku ke pameran!',
        color_code: 'red',
        interests: ['film indie', 'thrifting', 'jurnal harian'],
        instagram: 'nadiakirana',
        linkedin: 'nadia-kirana',
        spotify: 'nadiakirana',
        whatsapp: '081200001111',
        line: '',
        social_visibility: {
          instagram: 'public',
          linkedin: 'mutual',
          spotify: 'public',
          whatsapp: 'mutual',
          line: 'off',
        },
        is_discoverable: true,
        stamp_history_public: true,
        created_at: hoursAgo(800),
      },
      {
        id: 'u-ayra',
        username: 'ayrasls',
        full_name: 'Ayra Salsabila',
        avatar_url: avatar('Ayra Salsabila'),
        faculty: 'Fakultas Ekonomi & Bisnis',
        major: 'Manajemen',
        batch: '2024',
        bio: 'Lagi bangun brand kecil-kecilan. Selalu buka buat kolaborasi.',
        color_code: 'yellow',
        interests: ['bisnis kreatif', 'matcha', 'podcast'],
        instagram: 'ayrasls',
        linkedin: 'ayra-salsabila',
        spotify: '',
        whatsapp: '',
        line: 'ayrasls',
        social_visibility: {
          instagram: 'public',
          linkedin: 'public',
          spotify: 'public',
          whatsapp: 'off',
          line: 'public',
        },
        is_discoverable: true,
        stamp_history_public: false,
        created_at: hoursAgo(700),
      },
      {
        id: 'u-bimo',
        username: 'bimoard',
        full_name: 'Bimo Ardiansyah',
        avatar_url: avatar('Bimo Ardiansyah'),
        faculty: 'Fakultas Teknik',
        major: 'Teknik Mesin',
        batch: '2022',
        bio: 'Kalau nggak di lab, berarti di parkiran benerin motor.',
        color_code: 'grey',
        interests: ['otomotif', 'futsal'],
        instagram: 'bimoard',
        linkedin: '',
        spotify: 'bimoard',
        whatsapp: '081355557777',
        line: 'bimoard',
        social_visibility: {
          instagram: 'public',
          linkedin: 'public',
          spotify: 'mutual',
          whatsapp: 'mutual',
          line: 'mutual',
        },
        // Opted out of the Explore recommendation list.
        is_discoverable: false,
        stamp_history_public: false,
        created_at: hoursAgo(1200),
      },
      {
        id: 'u-gita',
        username: 'gitamaharani',
        full_name: 'Gita Maharani',
        avatar_url: avatar('Gita Maharani'),
        faculty: 'Fakultas Psikologi',
        major: 'Psikologi',
        batch: '2023',
        bio: 'Pendengar profesional (belum bersertifikat). Suka ngobrol random di kantin.',
        color_code: 'mint',
        interests: ['psikologi sosial', 'nulis puisi', 'yoga'],
        instagram: 'gitamaharani',
        linkedin: 'gita-maharani',
        spotify: 'gitamaharani',
        whatsapp: '',
        line: 'gitamaharani',
        social_visibility: {
          instagram: 'public',
          linkedin: 'public',
          spotify: 'public',
          whatsapp: 'off',
          line: 'mutual',
        },
        is_discoverable: true,
        stamp_history_public: true,
        created_at: hoursAgo(600),
      },
      {
        id: 'u-farrel',
        username: 'farrelngr',
        full_name: 'Farrel Nugroho',
        avatar_url: avatar('Farrel Nugroho'),
        faculty: 'Fakultas Ilmu Komputer',
        major: 'Teknik Informatika',
        batch: '2024',
        bio: 'Ngulik AI, tapi masih kalah debat sama dosen metodologi.',
        color_code: 'red',
        interests: ['machine learning', 'game dev', 'mie ayam'],
        instagram: 'farrelngr',
        linkedin: 'farrel-nugroho',
        spotify: '',
        whatsapp: '081988887777',
        line: 'farrelngr',
        social_visibility: {
          instagram: 'public',
          linkedin: 'public',
          spotify: 'off',
          whatsapp: 'public',
          line: 'public',
        },
        is_discoverable: true,
        stamp_history_public: false,
        created_at: hoursAgo(300),
      },
    ],

    /**
     * NFC keychain tokens.
     * - KNL-NEW-01 / KNL-NEW-02 are still unclaimed -> test the onboarding flow
     * - the rest are bound to a profile -> test the auto-redirect flow
     */
    nfc_tokens: [
      {
        id: 't-1',
        token: 'KNL-NEW-01',
        status: 'unclaimed',
        user_id: null,
        batch_label: 'demo-samples',
        created_at: hoursAgo(48),
        claimed_at: null,
      },
      {
        id: 't-2',
        token: 'KNL-NEW-02',
        status: 'unclaimed',
        user_id: null,
        batch_label: 'demo-samples',
        created_at: hoursAgo(36),
        claimed_at: null,
      },
      {
        id: 't-3',
        token: 'KNL-RAKA-01',
        status: 'claimed',
        user_id: 'u-raka',
        batch_label: 'demo-samples',
        created_at: hoursAgo(900),
        claimed_at: hoursAgo(890),
      },
      {
        id: 't-4',
        token: 'KNL-NADIA-07',
        status: 'claimed',
        user_id: 'u-nadia',
        batch_label: 'demo-samples',
        created_at: hoursAgo(800),
        claimed_at: hoursAgo(780),
      },
      {
        id: 't-5',
        token: 'KNL-BIMO-12',
        status: 'claimed',
        user_id: 'u-bimo',
        batch_label: 'demo-samples',
        created_at: hoursAgo(1105),
        claimed_at: hoursAgo(1100),
      },
    ],

    /**
     * Location Stamps are now a lightweight forum: each stamp is a thread, and
     * people reply to it (see stamp_replies). The physical place is NOT named;
      * only a free-text `location_label` the author chose. Distance and bearing
      * are computed from coordinates for the current viewer; image_url is optional.
     */
    location_stamps: [
      {
        id: 'st-1',
        user_id: 'u-nadia',
        location_label: 'Deket area kantin',
        lat: -6.3625,
        lng: 106.8279,
        audience: 'mutual',
        message: 'Nyari temen ngopi sore ini, lagi santai aja. Meja deket jendela ya!',
        image_url: photo('coffee-table'),
        created_at: minutesAgo(18),
      },
      {
        id: 'st-2',
        user_id: 'u-farrel',
        location_label: 'Gedung sebelah barat, lantai atas',
        lat: -6.3631,
        lng: 106.8262,
        message: 'Nugas ML, butuh second opinion soal dataset. Boleh mampir diskusi.',
        image_url: photo('laptop-dataset'),
        created_at: hoursAgo(2),
      },
      {
        id: 'st-3',
        user_id: 'u-gita',
        location_label: 'Area terbuka tengah kampus',
        lat: -6.3637,
        lng: 106.8281,
        message: 'Lagi nunggu jadwal kosong. Open buat ngobrol random sampe jam 4.',
        image_url: '',
        created_at: hoursAgo(4),
      },
      {
        id: 'st-4',
        user_id: 'u-ayra',
        location_label: 'Kedai kopi dekat gerbang',
        lat: -6.3598,
        lng: 106.8251,
        message: 'Matcha-nya lagi promo. Ada yang mau nemenin brainstorming brand?',
        image_url: photo('matcha-latte'),
        created_at: hoursAgo(7),
      },
      {
        id: 'st-5',
        user_id: 'u-bimo',
        location_label: 'Lapangan olahraga',
        lat: -6.3688,
        lng: 106.8233,
        audience: 'mutual',
        message: 'Futsal sore, masih kurang 2 orang. Gabung aja langsung.',
        image_url: '',
        created_at: hoursAgo(11),
      },
      {
        /* already older than 24h — proves the feed really filters */
        id: 'st-old',
        user_id: 'u-gita',
        location_label: 'Perpus lama',
        lat: -6.3627,
        lng: 106.8269,
        message: 'Stamp lama yang seharusnya nggak muncul di feed.',
        image_url: '',
        created_at: hoursAgo(30),
      },
      /* --- u-raka (demo account) history: expired but < 30 days old, so the
         live feed hides them but Stamp History (bagian 30 hari) shows them. --- */
      {
        id: 'st-h1',
        user_id: 'u-raka',
        location_label: 'Perpus lantai 3',
        lat: -6.3633,
        lng: 106.8271,
        message: 'Nugas bareng yuk, aku bawa cemilan.',
        image_url: photo('study-session'),
        created_at: hoursAgo(28),
      },
      {
        id: 'st-h2',
        user_id: 'u-raka',
        location_label: 'Coffee corner',
        lat: -6.3619,
        lng: 106.8288,
        message: 'Ngopi sore sambil review desain, mampir aja.',
        image_url: '',
        created_at: hoursAgo(26 + 2 * 24),
      },
      {
        id: 'st-h3',
        user_id: 'u-raka',
        location_label: 'Student center',
        lat: -6.3641,
        lng: 106.8259,
        message: 'Rapat kecil komunitas, open buat yang penasaran.',
        image_url: photo('community-meetup'),
        created_at: hoursAgo(10 * 24),
      },
      {
        id: 'st-h4',
        user_id: 'u-raka',
        location_label: 'Taman fakultas',
        lat: -6.3609,
        lng: 106.8273,
        message: 'Sketsa pagi sebelum kelas. Produktif dikit.',
        image_url: '',
        created_at: hoursAgo(22 * 24),
      },
    ],

    /** Replies turn each stamp into a thread/forum post. */
    stamp_replies: [
      {
        id: 'sr-1',
        stamp_id: 'st-1',
        user_id: 'u-gita',
        message: 'Aku ke sana 10 menit lagi ya, lagi dari kelas.',
        created_at: minutesAgo(12),
      },
      {
        id: 'sr-2',
        stamp_id: 'st-1',
        user_id: 'u-farrel',
        message: 'Pesenin es kopi dong kalau sempat 🙏',
        created_at: minutesAgo(6),
      },
      {
        id: 'sr-3',
        stamp_id: 'st-2',
        user_id: 'u-ayra',
        message: 'Dataset-nya soal apa? Aku ada waktu abis ini.',
        created_at: hoursAgo(1),
      },
    ],

    pings: [
      {
        id: 'p-1',
        sender_id: 'u-gita',
        receiver_id: 'u-raka',
        message: 'Halo Raka! Kita sekelas metodologi kan? Mau tanya soal tugas kelompok.',
        status: 'pending',
        created_at: hoursAgo(3),
      },
      {
        id: 'p-2',
        sender_id: 'u-farrel',
        receiver_id: 'u-raka',
        message: 'Bang, liat keychain NFC kamu di perpus. Bahas side project bareng dong.',
        status: 'pending',
        created_at: hoursAgo(9),
      },
      {
        id: 'p-3',
        sender_id: 'u-raka',
        receiver_id: 'u-ayra',
        message: 'Hai Ayra! Penasaran sama brand yang kamu bangun.',
        status: 'pending',
        created_at: hoursAgo(5),
      },
    ],

    mutuals: [
      { id: 'm-1', user_a_id: 'u-raka', user_b_id: 'u-nadia', created_at: hoursAgo(48) },
      { id: 'm-2', user_a_id: 'u-raka', user_b_id: 'u-bimo', created_at: hoursAgo(120) },
    ],

    /** Who the current user has blocked. blocker_id blocked blocked_id. */
    blocks: [],

    /** Abuse reports (demo keeps them local; a real backend would queue them). */
    reports: [
      {
        id: 'rp-1',
        reporter_id: 'u-gita',
        reported_id: 'u-farrel',
        report_type: 'user',
        reason: 'Mengirim pesan promosi berulang kali.',
        status: 'pending',
        created_at: hoursAgo(4),
      },
      {
        id: 'rp-2',
        reporter_id: 'u-ayra',
        reported_id: 'u-bimo',
        report_type: 'user',
        reason: 'Perilaku tidak nyaman saat mengirim PING.',
        status: 'pending',
        created_at: hoursAgo(14),
      },
      {
        id: 'rp-3',
        reporter_id: 'u-nadia',
        reported_id: 'u-gita',
        report_type: 'user',
        reason: 'Akun terlihat menyamar sebagai orang lain.',
        status: 'resolved',
        created_at: hoursAgo(72),
        reviewed_at: hoursAgo(60),
      },
    ],

    /** Admin dashboard actions, stored locally only in demo mode. */
    dashboard_audit_logs: [],

    /** Demo auth: which profile is "logged in". null = guest. */
    session_user_id: null,
  }
}

function refreshSeedStampTimestamps(stamps, seededStamps) {
  const seedById = new Map(seededStamps.map((stamp) => [stamp.id, stamp]))
  return stamps.map((stamp) => {
    const seedStamp = seedById.get(stamp.id)
    if (!seedStamp) return stamp

    const createdAt = seedStamp.created_at
    return {
      ...stamp,
      created_at: createdAt,
      expires_at: new Date(new Date(createdAt).getTime() + 24 * 60 * 60 * 1000).toISOString(),
    }
  })
}

function freshSeed() {
  const defaults = seed()
  defaults.location_stamps = refreshSeedStampTimestamps(
    defaults.location_stamps,
    defaults.location_stamps,
  )
  return defaults
}

function load() {
  if (typeof localStorage === 'undefined') return freshSeed()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return freshSeed()
    const parsed = JSON.parse(raw)
    // Merge over a fresh seed so newly added tables don't break old snapshots.
    const defaults = freshSeed()
    const merged = { ...defaults, ...parsed }
    if (Array.isArray(parsed.location_stamps)) {
      merged.location_stamps = refreshSeedStampTimestamps(
        parsed.location_stamps,
        defaults.location_stamps,
      )
    }
    if (!Array.isArray(parsed.reports) || parsed.reports.length === 0) {
      merged.reports = defaults.reports
    } else {
      merged.reports = parsed.reports.map((report) => ({
        report_type: 'user',
        status: 'pending',
        ...report,
      }))
    }
    return merged
  } catch {
    return freshSeed()
  }
}

/** Single mutable in-memory database for demo mode. */
export const demoDb = load()

export function persistDemoDb() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demoDb))
  } catch {
    /* storage full or blocked — demo still works in-memory */
  }
}

/** Wipes demo progress and reloads the seed (used by the Reset Demo button). */
export function resetDemoDb() {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY)
  Object.assign(demoDb, freshSeed())
}

export function demoId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** Mimics network latency so loading states are visible while prototyping. */
export function fakeDelay(ms = 260) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** A believable random distance for a freshly dropped stamp (metres). */
export function randomDistance() {
  return Math.floor(20 + Math.random() * 900)
}

/** Random compass bearing (0..359°) for a freshly dropped stamp. */
export function randomBearing() {
  return Math.floor(Math.random() * 360)
}

/* ----------------------------------------------- stamp audience preference */

export const STAMP_AUDIENCES = ['public', 'mutual']
export const DEFAULT_STAMP_AUDIENCE = 'public'

/** The audience the user last picked, so the form doesn't reset every time. */
export function getStampAudiencePref() {
  if (typeof localStorage === 'undefined') return DEFAULT_STAMP_AUDIENCE
  try {
    const saved = localStorage.getItem(STAMP_AUDIENCE_KEY)
    return STAMP_AUDIENCES.includes(saved) ? saved : DEFAULT_STAMP_AUDIENCE
  } catch {
    return DEFAULT_STAMP_AUDIENCE
  }
}

export function setStampAudiencePref(audience) {
  if (typeof localStorage === 'undefined') return
  if (!STAMP_AUDIENCES.includes(audience)) return
  try {
    localStorage.setItem(STAMP_AUDIENCE_KEY, audience)
  } catch {
    /* storage blocked — not critical */
  }
}
