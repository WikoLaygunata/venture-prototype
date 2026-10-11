# Status Perbaikan Kontrak Supabase/API

Temuan awal audit ditangani melalui API yang diselaraskan dan migrasi
`20261011210000_app_api_contract_security.sql`. Migrasi ini **belum dijalankan**;
perubahan schema dan policy masih perlu divalidasi pada proyek Supabase uji.

## Perbaikan

| Area | Perubahan |
|---|---|
| Location Stamps | `spot_id` diganti dengan `location_label`, `image_url`, `lat`, `lng`, dan `audience`; kolom `distance_m` dan `bearing_deg` tidak disimpan karena nilainya dinamis. Koordinat dibulatkan server-side ke 4 desimal. |
| Akses stamps/history | RLS memeriksa audience, mutual, status expiry, toggle history publik 30 hari, dan stamp sendiri. API tidak lagi mengunduh lalu menyaring audience mutual di klien. |
| Replies | Tabel, FK, indeks, batas pesan, serta policy baca/tulis mengikuti hak akses stamp induk. |
| Profil/sosial | API meminta proyeksi kolom eksplisit. SELECT tabel profil tidak memberikan akses ke handles/kontak; RPC mengembalikan kontak sesuai visibility dan pemilik saja yang dapat mengubahnya. |
| Blocks | Tabel dan FK dibuat. RPC owner-only memblokir dan membatalkan PING pending di dua arah secara atomik. |
| PING | Trigger database mengunci baris pengirim dan menegakkan kuota lima PING pending serta aturan blokir. RPC balas PING diselaraskan dengan concurrency block/response. |
| Errors | API melempar error query untuk pengecekan quota, pending PING, mutual, count mutual, serta block alih-alih mengubah kegagalan menjadi `false`/`0`. |
| Reports | Alasan laporan dibatasi 1–1000 karakter, sesuai API dan constraint database. |

## Batasan dan langkah sebelum digunakan

- Jangan mengaktifkan Supabase produksi sebelum menerapkan migrasi berurutan di
  proyek uji dan menguji policy sebagai anon, pemilik, mutual, non-mutual, user
  yang diblokir, serta moderator/admin.
- Uji khusus tabel profil dengan query langsung: kolom sosial/kontak tidak boleh
  terbaca oleh anon maupun pengguna lain, sementara RPC hanya mengembalikan
  jaringan yang boleh dilihat.
- Foto yang dipilih di demo bisa berupa data URL. Untuk produksi, siapkan
  Supabase Storage dan ubah alur upload agar kolom URL tidak menyimpan payload
  base64 besar.
- Lokasi stamp tetap tersedia ke pengguna yang memang diizinkan audience-nya,
  namun nilai yang disimpan dibulatkan ke empat angka desimal. Jarak/bearing
  dihitung dinamis di browser dan tidak disimpan.

Tidak ada migrasi, build, npm, atau tes yang dijalankan selama perubahan ini.
