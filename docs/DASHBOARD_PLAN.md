# Rancangan Dashboard Admin Kenalan

Dokumen ini merancang panel internal untuk mengelola operasional Kenalan dan
mencatat cakupan implementasi dashboard MVP.

## Asumsi dan tujuan

- `/dashboard/*` adalah area **admin/staf**, bukan dashboard pengguna biasa.
- Aplikasi pengguna tetap memakai route yang ada seperti `/map`, `/explore`,
  `/mutualan`, dan `/profile`. Untuk pengguna yang sudah login, `/map` tetap
  menjadi halaman utama.
- Dashboard memakai layout web tersendiri (sidebar, header, area konten), bukan
  frame ponsel dan bottom navigation aplikasi pengguna.
- Akses dashboard harus dibatasi berdasarkan role yang diverifikasi server.
  Memiliki akun Kenalan biasa tidak otomatis memberi akses admin.

## Struktur route

Semua route operasional berada di bawah prefix `/dashboard`. Route login khusus
dashboard tetap bisa diakses tanpa sesi admin.

| Route | Nama route yang disarankan | Akses | Fungsi |
|---|---|---|---|
| `/dashboard/login` | `dashboard-login` | Publik | Login staf/admin |
| `/dashboard` | `dashboard-root` | Admin | Redirect ke `/dashboard/home` |
| `/dashboard/home` | `dashboard-home` | Admin | Ringkasan dan metrik operasional |
| `/dashboard/users` | `dashboard-users` | Admin/moderator | Cari dan lihat daftar pengguna |
| `/dashboard/users/:user_id` | `dashboard-user-detail` | Admin/moderator | Detail profil dan status akun |
| `/dashboard/nfc-tokens` | `dashboard-nfc-tokens` | Admin operasional | Kelola token/keychain NFC |
| `/dashboard/stamps` | `dashboard-stamps` | Admin/moderator | Tinjau Location Stamp dan moderasi |
| `/dashboard/reports` | `dashboard-reports` | Moderator/admin | Tinjau laporan pengguna |
| `/dashboard/locations` | `dashboard-locations` | Admin operasional | Kelola referensi lokasi kampus, jika masih digunakan |
| `/dashboard/admins` | `dashboard-admins` | Superadmin | Kelola akses admin |
| `/dashboard/settings` | `dashboard-settings` | Superadmin | Pengaturan operasional dashboard |

Route yang belum masuk MVP dapat ditambahkan setelah kebutuhan dan sumber
datanya tersedia. Route detail opsional mengikuti route induk, misalnya
`/dashboard/reports/:report_id`.

### Route MVP yang sudah dibuat

| Route | Implementasi |
|---|---|
| `/dashboard/login` | Login demo atau autentikasi Supabase dashboard |
| `/dashboard/home` | Metrik, laporan terbaru, pengguna terbaru |
| `/dashboard/users` | Pencarian, paginasi, dan direktori pengguna |
| `/dashboard/users/:userId` | Ringkasan profil, aktivitas, dan preferensi privasi |
| `/dashboard/nfc-tokens` | Daftar token dan pembuatan token baru |
| `/dashboard/stamps` | Daftar stamp read-only tanpa koordinat presisi |
| `/dashboard/reports` | Filter status serta penutupan/penyelesaian laporan |

Layout dashboard terpisah dari frame ponsel. Sesi Supabase admin memakai
storage key terpisah agar login dashboard tidak menggantikan sesi pengguna
aplikasi. Mode default selalu dummy; mode Supabase dashboard hanya aktif setelah
`VITE_DASHBOARD_USE_SUPABASE=true` dan konfigurasi URL/anon key tersedia.

## Menu navigasi

Menu sidebar MVP yang disarankan:

1. **Ringkasan** — `/dashboard/home`
2. **Pengguna** — `/dashboard/users`
3. **NFC Keychain** — `/dashboard/nfc-tokens`
4. **Location Stamps** — `/dashboard/stamps`
5. **Laporan** — `/dashboard/reports`
6. **Lokasi Kampus** — `/dashboard/locations`, tampilkan hanya jika data lokasi
   kampus benar-benar dipakai
7. **Keluar** — mengakhiri sesi dashboard

Menu **Admin & Akses** dan **Pengaturan** sebaiknya ditambahkan pada tahap
lanjutan, dan hanya terlihat bagi superadmin. Menu tidak boleh menjadi pengganti
pengecekan role di server.

### Isi utama setiap menu

- **Ringkasan:** jumlah akun, akun baru, token NFC belum diklaim/sudah diklaim,
  stamp aktif, laporan belum ditinjau, dan aktivitas terbaru. Metrik yang belum
  bisa diambil dengan aman dari backend tidak ditampilkan sebagai angka palsu.
- **Pengguna:** pencarian username/nama, tautan detail, kontak operasional bagi
  admin/superadmin, pemulihan kredensial darurat, serta ban/unban melalui backend
  tepercaya.
- **NFC Keychain:** daftar token dengan status, label batch, pemilik (jika sudah
  diklaim), dan waktu klaim. Admin dapat membuat 1–20 token terkontrol dan
  menyalin URL aktivasi `/t/:token`.
- **Location Stamps:** daftar stamp dengan pembuat, waktu, status aktif/kedaluwarsa,
  dan audience. Aksi hapus/sembunyikan harus tercatat dan memiliki konfirmasi.
  Dashboard tidak perlu menampilkan koordinat presisi kecuali ada kebutuhan
  operasional yang disetujui.
- **Laporan:** antrean laporan, alasan, objek yang dilaporkan, status tindak
  lanjut, moderator, dan waktu penanganan. Status dan aksi harus dicatat.
- **Lokasi Kampus:** kelola nama dan atribut lokasi hanya jika fitur aktif masih
  memakai entitas lokasi terkurasi.

## Perilaku akses dan navigasi

- Pengunjung `/dashboard/*` tanpa sesi admin diarahkan ke
  `/dashboard/login?redirect=<route-tujuan>`.
- Sesi pengguna biasa tidak cukup untuk membuka dashboard; role harus
  diverifikasi server dan akses yang ditolak diarahkan ke halaman akses ditolak
  atau kembali ke aplikasi.
- Admin yang sudah login dan membuka `/dashboard/login` diarahkan ke
  `/dashboard/home`.
- Setelah login, nilai `redirect` hanya boleh mengarah ke path internal dashboard
  yang diizinkan.
- Logout menghapus sesi dan mengarahkan kembali ke `/dashboard/login`.
- Halaman login dashboard, halaman akses ditolak, dan halaman 404 dashboard
  memakai layout dashboard yang konsisten tanpa bottom navigation aplikasi.

## Role awal

| Role | Cakupan yang disarankan |
|---|---|
| `admin` | Ringkasan dan pengelolaan operasional |
| `moderator` | Pengguna (baca), stamp, dan laporan |
| `superadmin` | Seluruh akses termasuk pengelolaan admin dan pengaturan |

Untuk MVP, role dapat dipersempit ke satu role admin jika tim kecil, tetapi
otorisasi server tetap wajib. Jangan menentukan role dari parameter URL,
`localStorage`, atau field profil yang dapat diedit pengguna.

## Kebutuhan backend dan keamanan

1. Migrasi `20261011090000_dashboard_admin.sql` menambahkan sumber role admin,
   RLS, RPC untuk verifikasi role, pembuatan token NFC, peninjauan laporan, dan
   audit untuk dua aksi tersebut.
2. Migrasi tidak membuat admin secara otomatis. Karena signup anggota wajib
   memakai NFC, siapkan satu token belum diklaim melalui proses tepercaya,
   daftarkan akun operator menggunakan token tersebut, lalu berikan role
   superadmin melalui SQL Editor:

   ```sql
   insert into public.dashboard_admins (user_id, role)
   select id, 'superadmin'
   from auth.users
   where email = 'admin@kampus.ac.id'
   on conflict (user_id) do update set role = excluded.role;
   ```

   Ganti email dengan email akun operator yang sudah diverifikasi. Jangan membuka
   pembuatan role admin dari browser/klien.
3. Jangan menaruh Supabase `service_role` key di frontend. Operasi dashboard
   yang melampaui RLS harus melalui backend tepercaya, Edge Function, atau RPC
   dengan validasi role dan input.
4. Terapkan least privilege untuk tiap role dan tiap operasi; log perubahan
   penting (aktor, aksi, target, waktu, dan hasil).
5. Lindungi data pribadi. Dashboard hanya menampilkan data yang diperlukan
   untuk tugas staf; hindari mengekspos email, koordinat presisi, dan isi
   komunikasi sosial tanpa dasar operasional.
6. Terapkan konfirmasi untuk tindakan destruktif, validasi input, paginasi, dan
   pencatatan kegagalan operasi.

## Gap terhadap implementasi saat ini

- Aplikasi sekarang memakai satu Vue Router dan auth store untuk pengguna.
- Dashboard MVP sekarang memiliki layout, route guard role, login, menu dan
  API mode demo; autentikasi dashboard Supabase sudah dipisahkan dari sesi app.
- Jalankan migrasi dashboard terlebih dahulu sebelum mencoba mode Supabase.
  Migrasi tersebut menyiapkan tabel laporan dan role dashboard tetapi **belum
  menyinkronkan seluruh skema app pengguna** yang masih tertinggal dari demo.
- Token NFC tetap tertutup untuk pengguna biasa: migration memberi akses baca
  hanya kepada admin dan pembuatan token lewat RPC ber-role; tidak ada secret
  `service_role` di frontend.
- Mode demo menggunakan `admin@kenalan.id` / `kenalan123`. Kredensial ini hanya
  untuk prototipe dan harus diganti/dinonaktifkan sebelum aplikasi publik.
- Supabase app dapat tetap dikonfigurasi tetapi dashboard tetap menggunakan
  data dummy sampai `VITE_DASHBOARD_USE_SUPABASE=true` di `.env`.
- Model lokasi frontend terbaru memakai label/koordinat stamp, sedangkan skema
  SQL awal masih memuat tabel `spots`. Menu **Lokasi Kampus** belum dimasukkan
  ke MVP; validasi kebutuhan sebelum implementasi.
- Audit pembuatan token, perubahan status laporan, dan aksi akun ditulis ke
  audit log; halaman pembacaan audit belum dibuat.

## Langkah lanjutan

- Buat tabel `blocks`, `stamp_replies`, dan migrasi keselarasan schema app
  pengguna yang masih tercatat di `KENALAN_OVERVIEW.md`.
- Tambahkan halaman audit log dan pengelolaan role admin/superadmin melalui
  operasi backend yang diaudit.
- Putuskan apakah lokasi kampus terkurasi masih dibutuhkan; route itu belum
  menjadi bagian dashboard MVP.
- Sebelum production, ganti kredensial demo dan berikan akses hanya ke admin
  yang sudah diverifikasi.
## Akun, NFC, dan pemulihan

- Pendaftaran anggota dimulai dari `/t/:token`; pembuatan akun mengirim token yang sudah diverifikasi. Migrasi terbaru mengikat token secara atomik di trigger `auth.users`, sehingga signup langsung ke Supabase tanpa token ditolak juga.
- Dashboard mengizinkan admin/superadmin melihat kontak anggota. Perubahan email/password serta ban/unban dilakukan oleh Supabase Edge Function `dashboard-user-admin`, bukan dengan service-role key dari browser.
- Sebelum mengaktifkan pemulihan admin di Supabase, deploy function tersebut dan pastikan secret bawaan `SUPABASE_URL`, `SUPABASE_ANON_KEY`, serta `SUPABASE_SERVICE_ROLE_KEY` tersedia di environment Edge Functions. Terapkan migrasi terbaru setelah migrasi kontrak API.
- Form reset password mengirim email melalui Supabase Auth; URL redirect `/reset-password` harus diizinkan pada konfigurasi Auth. Mode demo mensimulasikan alur reset dan menyimpan password dummy pada browser lokal.
- Batch pembuatan token NFC dibatasi 1–20 per permintaan dan tabel menyediakan tombol salin URL `/t/:token`.
- Daftar pengguna, token, stamp, dan laporan menampilkan navigasi bernomor; daftar token memiliki filter status klaim. Detail stamp memuat thread dan balasan lengkap melalui RPC khusus berotorisasi.
