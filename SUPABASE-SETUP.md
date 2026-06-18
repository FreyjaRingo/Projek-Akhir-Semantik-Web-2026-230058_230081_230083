# AnimeGraph Nexus - Supabase Setup Guide

Panduan lengkap untuk setup AnimeGraph Nexus dengan Supabase sebagai database PostgreSQL.

---

## 📋 Prerequisites

1. Akun Supabase (https://supabase.com)
2. Node.js 18+
3. Git

---

## 🚀 Langkah Setup

### Step 1: Buat Project Supabase

1. Buka https://supabase.com/dashboard
2. Klik **"New Project"**
3. Isi detail project:
   - **Name**: `animegraph-nexus`
   - **Database Password**: (generate secure password, SIMPAN!)
   - **Region**: Pilih region terdekat (Singapore)
4. Klik **"Create new project"**
5. Tunggu sampai project selesai dibuat (~2 menit)

### Step 2: Dapatkan Connection String

1. Di Supabase Dashboard, pergi ke **Settings** → **Database**
2. Scroll ke bagian **Connection string**
3. Copy URI yang ada (format: `postgresql://postgres.xxx...`)
4. **PENTING**: Ganti `postgres` jadi `postgres.[PROJECT-REF]` di connection string

Contoh:
```
# Sebelum:
postgresql://postgres:password@db.xxx.supabase.co:5432/postgres

# Sesudah (dengan PROJECT-REF):
postgresql://postgres.xxx:password@db.xxx.supabase.co:5432/postgres
```

### Step 3: Setup Environment Variables

```bash
# Copy contoh environment file
cp .env.example .env

# Edit .env dengan credentials Supabase Anda
nano .env
# atau gunakan text editor favorit Anda
```

Update nilai koneksi database dan API Supabase:
```env
DATABASE_URL="postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_your-key-here"
SUPABASE_SECRET_KEY="sb_secret_your-key-here"
```

Project lama dapat memakai `NEXT_PUBLIC_SUPABASE_ANON_KEY` dan `SUPABASE_SERVICE_ROLE_KEY`. Jangan pernah memberi prefix `NEXT_PUBLIC_` pada secret atau service-role key.

### Step 4: Buat Tables di Supabase

Ada 2 cara untuk membuat tables:

#### Cara A: Via Supabase SQL Editor (Recommended)

1. Di Supabase Dashboard, pergi ke **SQL Editor**
2. Klik **"New Query"**
3. Copy isi file `server/supabase-setup.sql`
4. Paste ke SQL Editor
5. Klik **"Run"** atau tekan **Ctrl+Enter**

#### Cara B: Via Prisma CLI

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Push schema ke database (create/update tables)
npm run db:push
```

### Step 5: Verifikasi Setup

1. Di Supabase Dashboard, pergi ke **Table Editor**
2. Anda seharusnya melihat semua tables:
   - `Anime`
   - `Studio`
   - `Genre`
   - `Theme`
   - `Character`
   - `AnimeStudio`
   - `AnimeGenre`
   - `AnimeTheme`
   - `AnimeRelation`
   - `SyncLog`

### Step 6: Jalankan Aplikasi

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Jalankan development server
npm run dev
```

Buka:
- **App**: http://localhost:3000
- **Admin Dashboard**: http://localhost:3000/admin

---

## 🔄 Sync Data dari Jikan API

### Via Admin Dashboard

1. Buka http://localhost:3000/admin
2. Klik **"Sync"** di navigation
3. Pilih sync type:
   - **Single Anime**: Sync satu anime by MAL ID
   - **Incremental**: Sync anime yang sedang airing
   - **Full Sync**: Sync top 250 anime (butuh ~2-3 menit)

### Via CLI

```bash
# Single anime (contoh: One Piece, MAL ID 21)
npm run sync:jikan -- --single 21

# Incremental sync (anime yang sedang airing)
npm run sync:jikan -- --incremental

# Full sync (top 250 anime)
npm run sync:jikan -- --pages 10
```

---

## 📤 Export RDF/Turtle

### Via Admin Dashboard

1. Buka http://localhost:3000/admin
2. Di section **Export Data**, klik **"Export Turtle (.ttl)"**

### Via API

```bash
# Download RDF Turtle
curl http://localhost:3000/api/rdf?format=turtle -o animegraph.ttl

# Download JSON-LD
curl http://localhost:3000/api/rdf?format=jsonld -o animegraph.jsonld
```

---

## 🗂️ Struktur Database

```
┌─────────────────────────────────────────────────────────────┐
│                      AnimeGraph Nexus                        │
│                    Database Schema                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐                                            │
│  │   Anime    │ ◄── Main entity                             │
│  └──────┬──────┘                                            │
│         │                                                   │
│         ├───┬───────────┬────────────┐                     │
│         │   │           │            │                      │
│         ▼   ▼           ▼            ▼                      │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐          │
│  │ Studio │ │ Genre  │ │ Theme  │ │ Character  │          │
│  └───┬────┘ └───┬────┘ └───┬────┘ └──────┬─────┘          │
│      │           │           │              │                 │
│      └───────────┴───────────┴──────────────┘             │
│              (Junction Tables)                              │
│                                                             │
│  ┌──────────────────────────────────────┐                  │
│  │          AnimeRelation                │                  │
│  │   (Sequel, Prequel, Side Story, etc) │                  │
│  └──────────────────────────────────────┘                  │
│                                                             │
│  ┌──────────────────────────────────────┐                  │
│  │            SyncLog                    │                  │
│  │   (Track Jikan API sync history)      │                  │
│  └──────────────────────────────────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Troubleshooting

### Connection Error

```
Error: P1001: Can't reach database server
```

Solution:
1. Pastikan `DATABASE_URL` di `.env` benar
2. Cek apakah Supabase project masih aktif
3. Pastikan password database benar
4. Cek apakah IP allowed di Supabase (Settings → Database → Connection Pooling → IP Whitelist)

### Prisma Client Error

```
Error: Prisma Client could not generate
```

Solution:
```bash
npm run db:generate
```

### Sync Error

```
Error: Jikan API error: 429
```

Solution: Rate limit tercapai. Tunggu beberapa detik dan coba lagi. Jikan API limit: 3 req/detik.

---

## 📚 Referensi

- [Supabase Documentation](https://supabase.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Jikan API Documentation](https://jikan.moe/docs/v4)
- [RDF 1.1 Turtle Specification](https://www.w3.org/TR/turtle/)

---

## 🔐 Security Notes

1. **Jangan commit `.env`** ke version control
2. **Gunakan Service Role Key** hanya di server-side
3. **Biarkan Row Level Security (RLS) aktif** untuk seluruh tabel di schema yang diekspos
4. **Jangan beri akses `anon` atau `authenticated`** kecuali sudah ada policy yang benar-benar diperlukan
5. **Regular backup** dari Supabase Dashboard

---

## 📞 Need Help?

Jika ada masalah, cek:
1. Supabase Dashboard → Logs
2. Terminal output saat running `npm run dev`
3. Browser Console (F12 → Console tab)
