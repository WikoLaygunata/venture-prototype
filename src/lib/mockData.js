/**
 * DEMO MODE dataset.
 *
 * Used automatically whenever Supabase env vars are missing, so the prototype
 * is fully clickable offline. Mutations are persisted to localStorage, which
 * means claiming an NFC token / sending a PING / dropping a stamp survives a
 * page reload — handy when demoing the flow.
 *
 * Shapes here mirror the SQL schema documented in `src/lib/supabase.js`.
 */
import { hoursAgo, minutesAgo } from './time'

const STORAGE_KEY = 'kenalan.demo.v3'

/** Credentials that "work" in demo mode. */
export const DEMO_CREDENTIALS = {
  email: 'demo@kenalan.id',
  password: 'kenalan123',
}

const avatar = (seed) =>
  `https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${encodeURIComponent(
    seed,
  )}&backgroundColor=ddd6fe,fce7f3,d1fae5,fef3c7&radius=50`

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
        created_at: hoursAgo(300),
      },
    ],

    /**
     * NFC lanyard tokens.
     * - KNL-NEW-01 / KNL-NEW-02 are still unclaimed -> test the onboarding flow
     * - the rest are bound to a profile -> test the auto-redirect flow
     */
    nfc_tokens: [
      { id: 't-1', token: 'KNL-NEW-01', status: 'unclaimed', user_id: null, claimed_at: null },
      { id: 't-2', token: 'KNL-NEW-02', status: 'unclaimed', user_id: null, claimed_at: null },
      {
        id: 't-3',
        token: 'KNL-RAKA-01',
        status: 'claimed',
        user_id: 'u-raka',
        claimed_at: hoursAgo(890),
      },
      {
        id: 't-4',
        token: 'KNL-NADIA-07',
        status: 'claimed',
        user_id: 'u-nadia',
        claimed_at: hoursAgo(780),
      },
      {
        id: 't-5',
        token: 'KNL-BIMO-12',
        status: 'claimed',
        user_id: 'u-bimo',
        claimed_at: hoursAgo(1100),
      },
    ],

    spots: [
      { id: 's-perpus', name: 'Perpustakaan Pusat', emoji: '📚', category: 'Belajar', x: 26, y: 24 },
      { id: 's-kantin', name: 'Kantin LT 1', emoji: '🍜', category: 'Makan', x: 68, y: 38 },
      { id: 's-sc', name: 'Student Center', emoji: '🎪', category: 'Nongkrong', x: 44, y: 58 },
      { id: 's-coffee', name: 'Coffee Corner', emoji: '☕', category: 'Ngopi', x: 76, y: 70 },
      { id: 's-gor', name: 'GOR Kampus', emoji: '🏀', category: 'Olahraga', x: 18, y: 72 },
      { id: 's-taman', name: 'Taman Fakultas', emoji: '🌳', category: 'Santai', x: 54, y: 16 },
    ],

    location_stamps: [
      {
        id: 'st-1',
        user_id: 'u-nadia',
        spot_id: 's-kantin',
        message: 'Lagi di Kantin LT 1, nyari temen ngopi. Meja deket jendela ya!',
        created_at: minutesAgo(18),
      },
      {
        id: 'st-2',
        user_id: 'u-farrel',
        spot_id: 's-perpus',
        message: 'Nugas ML di lantai 3 perpus. Butuh second opinion soal dataset.',
        created_at: hoursAgo(2),
      },
      {
        id: 'st-3',
        user_id: 'u-gita',
        spot_id: 's-sc',
        message: 'Nunggu jadwal kosong di SC. Open buat ngobrol random sampe jam 4.',
        created_at: hoursAgo(4),
      },
      {
        id: 'st-4',
        user_id: 'u-ayra',
        spot_id: 's-coffee',
        message: 'Matcha latte-nya lagi promo. Ada yang mau nemenin brainstorming brand?',
        created_at: hoursAgo(7),
      },
      {
        id: 'st-5',
        user_id: 'u-bimo',
        spot_id: 's-gor',
        message: 'Futsal sore, masih kurang 2 orang. Gabung aja langsung.',
        created_at: hoursAgo(11),
      },
      {
        id: 'st-6',
        user_id: 'u-nadia',
        spot_id: 's-taman',
        message: 'Sketching di taman fakultas, tenang banget di sini.',
        created_at: hoursAgo(21),
      },
      {
        /* already older than 24h — proves the feed really filters */
        id: 'st-old',
        user_id: 'u-gita',
        spot_id: 's-perpus',
        message: 'Stamp lama yang seharusnya nggak muncul di feed.',
        created_at: hoursAgo(30),
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
        message: 'Bang, liat lanyard kamu di perpus. Bahas side project bareng dong.',
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

    /** Demo auth: which profile is "logged in". null = guest. */
    session_user_id: null,
  }
}

function load() {
  if (typeof localStorage === 'undefined') return seed()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seed()
    const parsed = JSON.parse(raw)
    // Merge over a fresh seed so newly added tables don't break old snapshots.
    return { ...seed(), ...parsed }
  } catch {
    return seed()
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
  Object.assign(demoDb, seed())
}

export function demoId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** Mimics network latency so loading states are visible while prototyping. */
export function fakeDelay(ms = 260) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
