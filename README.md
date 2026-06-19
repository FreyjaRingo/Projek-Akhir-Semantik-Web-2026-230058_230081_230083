# AnimeGraph Nexus

AnimeGraph Nexus adalah aplikasi web berbasis Next.js untuk eksplorasi knowledge graph anime menggunakan Semantic Web (RDF). Aplikasi ini menyediakan semantic search lokal, detail resource, visualisasi relasi graph, semantic compare, grounded QA, demo SPARQL, pencarian live Wikidata, dashboard database, sinkronisasi Jikan, dan ekspor data RDF.

Proyek ini dibangun sebagai tugas akhir mata kuliah Semantik Web 2026.

## 🌟 Fitur Utama

- **Workbench Semantic Web**: Navigasi data dari `public/data/data.ttl` dan `public/data/animegraph.json`.
- **Pencarian Lokal**: Mencari resource berdasarkan anime, studio, genre, tema, dan karakter.
- **Analisis Relasi**: Korelasi anime, graph neighborhood, perbandingan semantik, dan grounded QA.
- **Integrasi SPARQL**: Pencarian Wikidata melalui route server-side `/api/sparql`.
- **Dashboard Admin**: Panel Supabase untuk CRUD anime dan sinkronisasi otomatis menggunakan Jikan API.
- **Ekspor Data**: Mendukung ekspor format Turtle (`.ttl`) dan JSON-LD melalui endpoint `/api/rdf`.
- **UI/UX Modern**: Desain antarmuka yang responsif, mendukung desktop dan mobile (dibangun dengan Tailwind CSS).

## 💻 Teknologi yang Digunakan

- **Frontend & Framework**: Next.js 14, React 18
- **Bahasa Pemrograman**: TypeScript, Node.js
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL (via Supabase)
- **ORM**: Prisma
- **Data Integrations**: Jikan API (MyAnimeList), Wikidata SPARQL API

## 📋 Kebutuhan Sistem (System Requirements)

- **Node.js**: v20.0.0 atau lebih baru
- **npm**: v10.0.0 atau lebih baru
- **Database**: Proyek Supabase aktif (untuk backend dan fitur sinkronisasi)

*(Lihat `requirements.txt` atau `package.json` untuk daftar package).*

## 🚀 Panduan Instalasi & Setup Lokal

Ikuti langkah-langkah berikut untuk menjalankan aplikasi di komputer lokal:

### 1. Clone Repository

```bash
git clone https://github.com/FreyjaRingo/Projek-Akhir-Semantik-Web-2026-230058_230081_230083.git
cd Projek-Akhir-Semantik-Web-2026-230058_230081_230083
```

### 2. Install Dependensi

Jalankan perintah ini di terminal:

```bash
npm install
```

### 3. Konfigurasi Environment Variables

Salin template file `.env` untuk mengatur konfigurasi lokal Anda:

```bash
copy .env.example .env
```

Buka file `.env` di code editor Anda dan isi variabel berikut dengan kredensial Supabase Anda:

```env
NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_your-key-here"
SUPABASE_SECRET_KEY="sb_secret_your-key-here"
DATABASE_URL="postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres"
```

**Catatan Keamanan:** `SUPABASE_SECRET_KEY` sangat rahasia. Jangan pernah mengirimnya ke browser (hindari memakai prefix `NEXT_PUBLIC_`).

### 4. Setup Database (Supabase & Prisma)

a. Masuk ke halaman **SQL Editor** di Supabase Dashboard Anda.
b. Salin dan jalankan seluruh query SQL dari file `server/supabase-setup.sql` (Panduan rinci dapat dilihat di `SUPABASE-SETUP.md`).
c. Setelah database siap, jalankan sinkronisasi schema menggunakan Prisma:

```bash
npm run db:generate
npm run db:push
```

*(Opsional) Jika Anda ingin memuat data awal, Anda bisa menggunakan file seed:*
```bash
npm run db:seed
```

### 5. Jalankan Aplikasi (Development Server)

Mulailah development server lokal:

```bash
npm run dev
```

Server Next.js akan menyinkronkan data RDF terlebih dahulu, kemudian berjalan di `http://localhost:3000`. Silakan buka URL tersebut di browser Anda.

## 🛠️ Perintah Penting (NPM Scripts)

Berikut beberapa perintah yang sering digunakan selama pengembangan:

- `npm run dev` : Menjalankan server development (menyinkronkan RDF terlebih dahulu).
- `npm run build` : Mem-build aplikasi untuk tahap produksi.
- `npm run start` : Menjalankan aplikasi dari hasil build.
- `npm run sync:data` : Membuat ulang file `animegraph.json` dari data RDF (`data.ttl`).
- `npm run db:generate` : Meng-generate Prisma Client terbaru.
- `npm run db:push` : Mendorong perubahan schema Prisma langsung ke database.
- `npm run db:studio` : Membuka antarmuka Prisma Studio (Web GUI) untuk melihat/mengedit data database.

## 🗺️ Struktur Route Aplikasi

- `/` - Halaman Utama (Semantic workbench)
- `/admin` - Dashboard Admin (Ringkasan database)
- `/admin/anime` - Manajemen Data (CRUD anime)
- `/admin/sync` - Alat sinkronisasi Jikan API
- `/api/rdf?format=turtle` - API endpoint untuk Ekspor Turtle
- `/api/rdf?format=jsonld` - API endpoint untuk Ekspor JSON-LD
- `/api/sparql?q=[keyword]` - API endpoint untuk pencarian Wikidata

## 📄 Manajemen Data RDF

Data Semantic Web (RDF) kami dikelola melalui:
- **Turtle File**: `public/data/data.ttl`
- **Graph JSON**: `public/data/animegraph.json`

Setiap kali Anda membuat perubahan manual pada file Turtle atau file Dataset, jalankan perintah sinkronisasi ini agar grafik JSON di-update:
```bash
npm run sync:data
```

## 🔒 Keamanan (Security Guidelines)

- Pastikan `.env` terdaftar di `.gitignore` dan **jangan pernah di-commit**.
- Route `/admin` menggunakan kunci tingkat server (*server-side key*) dan tidak membocorkan credential.
- Aturan Row Level Security (RLS) diaktifkan di Supabase untuk mencegah manipulasi data dari *client-side* tanpa otorisasi.

## 🧪 Verifikasi Sistem

Aplikasi telah melewati pengujian pra-laporan akhir:
- Build produksi (`npm run build`) berhasil tanpa peringatan kritis.
- Seluruh 15 rute Next.js (statis dan dinamis) dapat diakses dengan respons `HTTP 200`.
- Sinkronisasi, visualisasi JSON graph, SPARQL, API ekspor RDF berfungsi normal.
