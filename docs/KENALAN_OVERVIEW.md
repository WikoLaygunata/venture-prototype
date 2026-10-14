# Kenalan — Ringkasan Fitur, Flow & Arsitektur

Dokumen hidup untuk prototype **Kenalan** (NFC keychain + aplikasi sosial kampus).
Isinya: apa yang sudah terbangun dan bagaimana tiap flow bekerja.

> Status: **prototype frontend**. Jalan penuh di _demo mode_ (mock lokal) tanpa
> backend. Migrasi sinkronisasi member API sudah tersedia di
> `20261011210000_app_api_contract_security.sql`; belum dijalankan atau
> diverifikasi pada proyek Supabase nyata.

---

## 1. Konsep Produk

Kenalan menghilangkan momen canggung "tukar IG" dengan satu tap fisik:

1. Tiap orang punya **keychain ber-NFC** yang menyimpan token unik.
2. Tap keychain → buka **profil publik** pemiliknya di aplikasi.
3. Dari profil itu kamu bisa **Mutualan / Send PING** untuk mulai kenalan.
4. **Color Code** (Mint/Yellow/Grey/Red) jadi sinyal sosial: seberapa terbuka
   seseorang untuk disapa saat ini.
5. **Location Stamp** = postingan singkat "lagi di sekitar sini" berumur 24 jam
   yang berfungsi seperti **thread/forum** (bisa dibalas), lengkap dengan foto
   opsional. Lokasi persis tidak pernah ditampilkan — hanya perkiraan jarak.
6. **Explore** merekomendasikan orang untuk diajak mutualan (bisa dinonaktifkan
   lewat toggle privasi).

---

## 2. Tech Stack

| Lapisan | Pilihan |
|---|---|
| Framework | Vue 3 (`<script setup>`) |
| Routing | Vue Router **5.3.1** (API identik gaya v4) |
| Styling | Tailwind CSS v3 + palet pastel custom (`kenalan`, `mint`, `sunny`, `smoke`, `blush`) |
| Peta | Leaflet 1.9 + tile OpenStreetMap (tanpa API key) |
| Ikon | `lucide-vue-next` |
| Backend | Supabase (`@supabase/supabase-js`) — Auth + Postgres + RLS + RPC |
| State | Modul reaktif ringan (`src/stores/`), tanpa Pinia |

**Demo mode**: kalau `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` kosong,
`src/lib/api.js` otomatis melayani data dari `src/lib/mockData.js`
(ter-_persist_ ke `localStorage`, key `kenalan.demo.v8`). Dashboard punya mode
demo dan sesi terpisah dari akun pengguna aplikasi.

Kredensial demo: `demo@kenalan.id` / `kenalan123` (atau tombol satu-tap di login).
Kredensial admin demo: `admin@kenalan.id` / `kenalan123` di `/dashboard/login`.

---

## 3. Peta Halaman (Routes)

| Path | Nama | Akses | Nav bawah | Fungsi |
|---|---|---|---|---|
| `/` | home | redirect | — | → `/map` kalau login, else `/welcome` |
| `/welcome` | landing | publik | ✕ | Hero + simulasi scan NFC |
| `/t/:token` | activate | publik | ✕ | Aktivasi keychain (Skenario 1); token di path, link pendek & estetik |
| `/login?redirect=…` | login | guest-only | ✕ | Login & Register |
| `/map` | map | perlu login | ✓ | Feed Location Stamp (24 jam) |
| `/stamp/:id` | stamp-thread | perlu login | ✕ | Thread/forum sebuah stamp |
| `/explore` | explore | perlu login | ✓ | Rekomendasi orang buat mutualan |
| `/mutualan` | mutualan | perlu login | ✓ | PING masuk, mutualan, PING terkirim |
| `/profile` | profile | perlu login | ✓ | Profil sendiri |
| `/profile/edit` | profile-edit | perlu login | ✕ | Dashboard edit profil |
| `/user/:user_id` | user-profile | **publik** | ✕ | Profil hasil scan (Skenario 2 & 3) |
| `/:catchAll` | not-found | publik | ✕ | 404 |

**Bottom nav sekarang 4 tab**: **Map · Explore · Mutualan · Profile**.

Guard (`src/router/index.js`): `requiresAuth` → `/login?redirect=`; `guestOnly`
honour `?redirect=`; `/user/:id` milik sendiri → redirect ke `/profile`.

### Dashboard admin

Panel internal punya layout desktop tersendiri (bukan frame ponsel) di prefix
`/dashboard`:

| Path | Fungsi |
|---|---|
| `/dashboard/login` | Login admin; demo memakai `admin@kenalan.id` / `kenalan123` |
| `/dashboard/home` | Ringkasan metrik, laporan dan pengguna terbaru |
| `/dashboard/users` | Direktori, pencarian dan paginasi pengguna |
| `/dashboard/users/:userId` | Detail profil dengan data kontak privat disembunyikan |
| `/dashboard/nfc-tokens` | Inventaris dan pembuatan token |
| `/dashboard/stamps` | Moderasi baca-saja tanpa koordinat presisi |
| `/dashboard/reports` | Antrean laporan dan status penanganan |

Sesi auth dashboard memakai Supabase client/storage key terpisah dari sesi app.
Saat Supabase dikonfigurasi, role berasal dari tabel `dashboard_admins`; user
app biasa tidak otomatis mendapat akses. Migrasi terkait:
`supabase/migrations/20261011090000_dashboard_admin.sql`. Migrasi belum
menyinkronkan seluruh skema Supabase app pengguna. Mode dashboard dapat dipilih
di halaman login admin; `VITE_DASHBOARD_USE_SUPABASE=true` di `.env` hanya
menentukan mode awalnya.

---

## 4. Layout "ala mobile app" (fixed header + nav)

Frame di `App.vue` sekarang **tinggi tetap** (`h-[100dvh]`, desktop `h-[844px]`)
dengan `overflow-hidden`. Konsekuensinya:

- **AppHeader** (atas) dan **BottomNav** (bawah) jadi _flex sibling_ yang
  `shrink-0` → keduanya **pinned**, tidak ikut scroll.
- Hanya area `.screen-scroll` di tiap view yang menggulir.
- FAB, save bar, composer thread, dan banner guest juga pakai pola yang sama
  (sibling `shrink-0` atau `absolute` ke root view yang `relative`), jadi tetap
  di dalam frame, bukan menempel ke viewport browser.

---

## 5. Tiga Skenario Scan NFC

### Skenario 1 — Keychain baru (`/t/:token`, mis. `/t/KNL-NEW-01`)
`OnboardingView.vue` cek token via `resolve_nfc_token`:
- tidak ada → "Token tidak dikenali"; **unclaimed** → form registrasi (token
  terkunci) → `signUp()` + `claim_nfc_token()`; **claimed** → auto-redirect ke
  `/user/:owner_id`. Deferred-claim tetap ada untuk email-confirmation.

### Skenario 2 — Scan keychain orang (`/user/:user_id`)
- **visitor** (login): profil penuh + **"Mutualan / Send PING!"** + menu
  overflow (**⋮**). Isi menu: **Laporkan**, **Putuskan mutual** (hanya kalau
  sudah mutualan, di atas Blokir), dan **Blokir**.
- **guest** (belum login): profil tetap tampil + banner sticky → `/login?redirect=`.

### Skenario 3 — Scan keychain sendiri
`mode === 'self'`: banner "Ini Profil Kamu", Color Code tappable, **toggle
"Muncul di rekomendasi"**, tombol **"Tampilkan history stamp"**, dan shortcut
Edit Profil.

---

## 6. Fitur per Layar

### MapView `/map`
- **Peta interaktif Leaflet** (tile OpenStreetMap, tanpa API key): bisa
  geser/zoom/scroll. Tile sedikit di-desaturasi biar pin brand menonjol. Tiap
  stamp jadi **marker berwarna** (warna = Color Code pembuat; ikon 🔒 untuk
  mutual-only) yang bisa diklik → popup → **Buka thread**. Marker **"lokasiku"**
  (biru berdenyut) muncul kalau geolocation diaktifkan lewat tombol "Lokasiku".
  Ada tombol **extend** (ikon Expand) yang membuka peta **fullscreen** dalam
  frame (overlay z-40, di bawah toast). Komponen: `components/StampMap.vue`.
- Catatan: atribusi OSM **sengaja tidak dihapus** (syarat lisensi tile ODbL),
  tapi diperkecil & dibikin samar + prefix "Leaflet" dihilangkan. Z-index semua
  pane/kontrol Leaflet dibatasi (≤2) di dalam container `z-0` supaya peta tidak
  pernah menimpa modal/BottomSheet.
- Feed **"Stamps Around You"** (24 jam terakhir). Tiap kartu bisa dibuka jadi
  thread, bisa di-PING, dan menampilkan **keterangan lokasi + jarak nyata**
  (dihitung haversine dari lokasimu ke koordinat stamp; kalau lokasi belum
  diaktifkan tampil "lihat di peta", bukan angka palsu). Stamp sendiri tak
  menampilkan jarak. Perhitungan ini dipakai sama di feed card, thread, dan
  StampLocationModal.
- **Badge lokasi bisa diklik** → buka **StampLocationModal**: peta mini Leaflet
  (`readonly`) berisi marker stamp + marker kamu, plus ringkasan jarak + arah
  yang dihitung dinamis dari koordinat. Kalau kamu aktifkan lokasi (geolocation),
  titikmu jadi biru + berdenyut dan muncul petunjuk arah ("ke arah Timur Laut").
  Modal yang sama dipakai di StampThreadView — **sekarang pakai peta Leaflet
  betulan** (StampMap mode `readonly`), bukan radar statis lagi.
- **FAB "+ Stamp Location"** → form: pesan, **keterangan lokasi** (free-text +
  chip saran), **foto opsional** (preview + hapus), dan **audiens**
  (**Publik / Mutual aja**, default Publik). Pilihan audiens **diingat di
  localStorage** (`kenalan.stampAudience`) jadi nggak perlu pilih tiap kali.
- Stamp **mutual-only** cuma muncul di feed/thread untuk pembuatnya + orang yang
  sudah mutualan dengannya; kartu menampilkan badge 🔒 "Mutual aja". Membuka
  thread stamp mutual-only tanpa hak → pesan "cuma buat mutual pembuatnya".

### StampThreadView `/stamp/:id`
- Stamp asli di atas (pesan, foto, lokasi+jarak), lalu daftar **balasan**, dengan
  **composer** di bawah. Pemilik bisa menghapus thread. Stamp >24 jam menutup
  balasan.

### StampHistoryView `/history` dan `/history/:user_id`
- **History stamp 30 hari terakhir** (termasuk yang sudah hangus, ditandai
  Aktif/Hangus). `/history` = milik sendiri (bisa hapus); `/history/:user_id` =
  milik orang lain, **read-only**, dan hanya kalau mereka mengaktifkan
  **"History stamp publik"** — kalau tidak, muncul state "History ini privat".
- Visibility history diatur lewat toggle di Profile (self). Di profil orang yang
  mengaktifkannya, muncul tombol **"Lihat history stamp"**.

### ExploreView `/explore`
- Grid **rekomendasi orang** untuk mutualan (`fetchRecommendedProfiles`): hanya
  yang `is_discoverable`, belum mutual, dan tidak diblokir.
- **Filter kategori**: chip Status (Color Code) + chip Fakultas, dihitung dari
  hasil rekomendasi. Ada state kosong + "Reset filter".
- Kalau kamu sendiri menonaktifkan discovery, muncul **nudge** untuk mengaktifkan.
- Tiap kartu → lihat profil atau langsung PING.

### MutualanView `/mutualan`
- **Dua segmen**: **PING masuk** (terima → jadi mutualan; tolak) + daftar
  **PING terkirim** yang menunggu, dan **Mutualan** (koneksi aktif). Tab
  Rekomendasi **dihapus** (pindah ke Explore).

### ProfileView `/profile` & `/user/:id`
- Satu komponen tiga mode (self/visitor/guest). Hero + Color Code + jumlah
  mutualan + minat + link sosial. **Icebreaker generator sudah dihapus.**
- Self: toggle discovery + **shortcut history stamp** + ganti Color Code + Edit.
- Visitor: PING + overflow **Laporkan / Putuskan mutual / Blokir**.
- Link sosial dihormati per-visibilitas (lihat bagian 7).

### EditProfileView `/profile/edit`
- Identitas, bio, minat, Color Code, **toggle privasi "Muncul di rekomendasi"**,
  dan **sosial media & kontak**: Instagram, LinkedIn, WhatsApp, LINE, Spotify —
  tiap jenis punya kontrol visibilitas **Publik / Mutual aja / Off**. Save bar pinned.
- **Foto profil pakai tombol upload** (bukan URL): foto dibaca jadi data URL dan
  disimpan sementara di memori/form (`avatar_url`), **belum ke server**. Ada
  preview + hapus, maks 5MB. Wiring ke Supabase Storage menyusul.

### Color Code
| Warna | Judul | Arti |
|---|---|---|
| 🟢 Mint | Open to Chat | Terbuka disapa |
| 🟡 Yellow | Focus Mode | Lagi fokus, sapa singkat |
| ⚪ Grey | Do Not Disturb | Butuh waktu sendiri |
| 🔴 Red | **Open for Connection** | Aktif cari kenalan (badge berdenyut) |

---

## 7. Fitur Keamanan & Moderasi

- **Batas PING**: maksimal `MAX_PENDING_PINGS` (= 5) PING yang belum dibalas per
  pengirim. Lewat batas → ditolak dengan pesan jelas. Dicek di `sendPing`
  (demo + Supabase) via `countPendingSentPings`.
- **Blokir**: `blockUser` menyembunyikan kedua pihak dari satu sama lain dan
  membatalkan PING pending di antara mereka. Juga menyaring rekomendasi Explore
  dan PING masuk. Ada `unblockUser` / `isBlocked`.
- **Report**: `reportUser` dengan pilihan alasan (demo menyimpan lokal; backend
  nyata akan antre untuk moderasi).
- **Discovery toggle** (`is_discoverable`): kontrol apakah profil muncul di
  Explore orang lain. Default aktif.
- **History publik toggle** (`stamp_history_public`): kontrol apakah history
  stamp 30 hari bisa dilihat orang lain dari profil. Default privat.
- **Putuskan mutual** (`removeMutual`): salah satu pihak bisa mengakhiri koneksi
  dari menu ⋮ (di atas Blokir).
- **Visibilitas sosial per-jenis**: tiap sosmed/kontak punya `public` / `mutual`
  / `off`. `SocialLinks` cuma menampilkan yang boleh dilihat viewer (owner lihat
  semua + label visibilitas; mutual lihat public+mutual; lainnya cuma public).

---

## 8. Model Data (demo mode, `mockData.js`, key `kenalan.demo.v8`)

- `profiles` — `is_discoverable`; `stamp_history_public`; kontak `whatsapp` +
  `line` (selain `instagram`/`linkedin`/`spotify`); `social_visibility` (map
  per-jenis: `public`|`mutual`|`off`); `avatar_url` kini bisa berisi data URL
  hasil upload (demo).
- `nfc_tokens` — token keychain (unclaimed/claimed).
- `location_stamps` — **tanpa** `spot_id`; punya `location_label`, `lat`, `lng`
  (koordinat perkiraan untuk peta Leaflet), `image_url`,
  `audience` (`public`|`mutual`, default `public`), `expires_at` (24 jam).
  Jarak dan bearing dihitung dinamis dari koordinat viewer/stamp, tidak disimpan.
  Beberapa stamp `u-raka` sengaja berumur beberapa hari untuk mengisi History 30
  hari; st-1 & st-5 di-seed `mutual` untuk demo. Semua di-seed di sekitar
  `CAMPUS_CENTER` (konstanta di `mockData.js`).
- Preferensi audiens stamp terakhir disimpan di localStorage key
  `kenalan.stampAudience` (lihat `getStampAudiencePref`/`setStampAudiencePref`).
- `stamp_replies` — balasan thread.
- `pings`, `mutuals` — seperti sebelumnya (mutual = pasangan terurut).
- `blocks`, `reports` — moderasi.
- Tabel `spots` **dihapus**.

Konstanta sosial di `src/lib/socials.js` (`SOCIAL_NETWORKS`,
`SOCIAL_VISIBILITY_OPTIONS`, `defaultSocialVisibility()`).

---

## 9. Struktur Folder

```
src/
├── lib/            supabase, api, dashboardApi, mockData, colorCodes, socials, time,
│                   useGeolocation, pendingToken   (icebreakers.js DIHAPUS)
├── stores/         auth, dashboardAuth, toast
├── layouts/        DashboardLayout
├── router/         index.js (+ guards)
├── components/     BottomNav(4 tab), ColorCodeBadge/Picker, LocationStampCard,
│                   StampMap(Leaflet), StampLocationModal, BottomSheet, AppHeader,
│                   SocialLinks, StateBlock, ToastHost, UserAvatar
├── views/          Onboarding, Login, Profile, Map, StampThread, StampHistory,
│                   Explore, Mutualan, EditProfile, Dashboard*, Landing, NotFound
└── App.vue         frame mobile tinggi-tetap (header + nav pinned)
supabase/           migrations app + dashboard admin
```

Prinsip: view app memakai `src/lib/api.js`; panel admin memakai
`src/lib/dashboardApi.js` agar query dashboard dan sesi admin tetap terpisah.

---

## 10. Status Sinkronisasi SQL

Migrasi `20261011210000_app_api_contract_security.sql` menyinkronkan schema
member API setelah migrasi awal dan dashboard. Isinya:

- Konversi stamp dari `spot_id` ke `location_label`, `image_url`, koordinat
  perkiraan dan `audience`; hapus kolom jarak/bearing yang bersifat dinamis.
- Buat `stamp_replies` dan `blocks`, lengkap dengan FK, indeks, grants dan RLS.
- Batasi proyeksi kolom profil yang dapat dibaca langsung. Handle sosial/kontak
  hanya dikembalikan melalui RPC yang menerapkan visibility `public`/`mutual`/
  `off`; update kontak dilakukan melalui RPC owner-only.
- Terapkan RLS untuk audience stamp, history publik 30 hari, dan akses replies.
- Terapkan kuota lima PING pending secara atomik di database; blokir membatalkan
  PING pending dua arah, dan trigger/RPC menolak PING yang melanggar blokir.
- Bulatkan koordinat stamp server-side ke empat angka desimal; jarak dan arah
  dihitung di perangkat viewer dan tidak disimpan.

Belum ada migrasi yang dijalankan, jadi kontrak ini belum diverifikasi terhadap
instance Supabase aktual. Sebelum mengaktifkan `VITE_SUPABASE_URL` dan anon key,
terapkan semua migrasi secara berurutan pada proyek uji dan lakukan validasi
akses sebagai anon, pemilik, mutual, non-mutual, serta moderator/admin.

Foto profil/stamp yang dipilih pada demo masih dapat berupa data URL. Upload
produksi sebaiknya memakai Supabase Storage dan menyimpan URL, bukan data URL
besar di kolom database.

---

## 11. Ruang untuk Perubahan Flow

### Perubahan yang diinginkan
- [ ] _(tulis di sini)_
- [ ]

### Pertanyaan terbuka
- Upload avatar/foto stamp masih menggunakan data URL di demo; alur produksi
  masih perlu memakai Supabase Storage.

---

_Catatan: build dan migrasi untuk perubahan dashboard ini belum dijalankan sesuai
permintaan. Peta Leaflet mempertahankan atribusi OSM demi lisensi; migrasi
Supabase dashboard juga belum diterapkan._
