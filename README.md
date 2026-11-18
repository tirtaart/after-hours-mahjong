# After Hours Mahjong Club

Prototype web After Hours Mahjong Club untuk mencatat room dan leaderboard Hong Kong Mahjong.

## Jalankan di komputer

1. Pasang Node.js versi 20.19+ atau 22.12+.
2. Dari folder proyek, jalankan `npm install` bila dependensi belum terpasang.
3. Jalankan `npm run dev`.
4. Buka URL yang ditampilkan Vite, biasanya `http://localhost:5173`.

## Fitur demo

- Login demo dengan nama pemain atau Admin demo.
- Buat room 2–4 kursi, bagikan kode, dan gabung ke room.
- Host memulai match setelah room penuh, memilih pemenang, jenis kemenangan, dan 14 tiles.
- Room 4 pemain: host mencatat fan (minimum 3); leaderboard demo memberi 10 poin per fan.
- Room 2–3 pemain: host memasukkan poin leaderboard sesuai kesepakatan.
- Statistik menang/kalah serta leaderboard per-room dan keseluruhan.
- Data disimpan di localStorage browser yang sama.

> **Bukan aplikasi multiplayer yang sudah dipublikasikan.** Ini prototype lokal: akun dan peran hanya simulasi, data tidak tersinkron ke browser/perangkat lain, dan poin leaderboard bukan tabel pembayaran resmi Hong Kong Mahjong. Jangan gunakan sebagai pencatatan skor uang atau settlement resmi.

## Agar tersedia online untuk banyak pemain

Versi publik memerlukan backend bersama untuk autentikasi, izin host/admin, database, dan sinkronisasi room. Langkah deploy juga memerlukan akun pemilik proyek pada layanan hosting dan backend; jangan masukkan kredensial atau kunci rahasia ke kode publik. Setelah backend bersama dipasang, build statis dapat di-host di layanan seperti Vercel dan database/auth di Supabase. Paket gratis tunduk pada batas dan ketentuan layanan masing-masing.
