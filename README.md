# AnimeGraph Nexus

AnimeGraph Nexus adalah aplikasi Next.js untuk eksplorasi knowledge graph anime berbasis RDF. Aplikasi menyediakan semantic search lokal, detail resource, visualisasi relasi, semantic compare, grounded QA, demo SPARQL, pencarian live Wikidata, dashboard database, sinkronisasi Jikan, dan ekspor RDF.

## Fitur Utama

- Workbench Semantic Web dari `public/data/data.ttl` dan `public/data/animegraph.json`
- Pencarian resource lokal berdasarkan anime, studio, genre, tema, dan karakter
- Korelasi anime, graph neighborhood, perbandingan semantik, dan grounded QA
- Pencarian Wikidata melalui route server-side `/api/sparql`
- Dashboard Supabase untuk CRUD anime dan sinkronisasi Jikan
- Ekspor Turtle dan JSON-LD melalui `/api/rdf`
- UI responsif untuk desktop dan perangkat mobile

## Teknologi

- Next.js 14 dan React 18
- TypeScript dan Tailwind CSS
- Supabase PostgreSQL melalui `@supabase/supabase-js`
- Prisma untuk tooling schema database
- Jikan API dan Wikidata SPARQL

## Kebutuhan Sistem

- Node.js 20 atau lebih baru
- npm 10 atau lebih baru
- Project Supabase untuk fitur admin dan sinkronisasi

## Setup Lokal

1. Install dependency:

```bash
npm install
```

2. Buat file `.env` dari contoh:

```bash
copy .env.example .env
```

3. Isi variabel berikut:

```env
NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_your-key-here"
SUPABASE_SECRET_KEY="sb_secret_your-key-here"
DATABASE_URL="postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres"
```

`SUPABASE_SECRET_KEY` hanya boleh berada di server dan tidak boleh memakai prefix `NEXT_PUBLIC_`. Project lama masih dapat memakai `NEXT_PUBLIC_SUPABASE_ANON_KEY` dan `SUPABASE_SERVICE_ROLE_KEY`.

4. Jalankan `server/supabase-setup.sql` melalui Supabase SQL Editor. Panduan rinci tersedia di `SUPABASE-SETUP.md`.

5. Jalankan aplikasi:

```bash
npm run dev
```

Buka `http://localhost:3000`.

## Perintah Penting

```bash
npm run dev          # sinkronkan RDF lalu jalankan Next dev server
npm run build        # build produksi lengkap
npm run preview      # jalankan hasil build
npm run sync:data    # buat ulang animegraph.json dari data RDF/dataset
npm run db:generate  # generate Prisma client
npm run db:push      # sinkronkan Prisma schema ke database
npm run db:studio    # buka Prisma Studio
```

Perintah `dev:client`, `build:client`, dan `preview:client` hanya dipertahankan untuk frontend Vite lama. Jalur aplikasi utama adalah Next.js.

## Route Aplikasi

- `/` - Semantic workbench
- `/admin` - Ringkasan database
- `/admin/anime` - CRUD anime
- `/admin/sync` - Sinkronisasi dan pencarian Jikan
- `/api/rdf?format=turtle` - Ekspor Turtle
- `/api/rdf?format=jsonld` - Ekspor JSON-LD
- `/api/sparql?q=Naruto` - Pencarian anime di Wikidata

## Data RDF

- Turtle: `public/data/data.ttl`
- Graph JSON: `public/data/animegraph.json`
- Raw Turtle: https://raw.githubusercontent.com/FreyjaRingo/Projek-Akhir-Semantik-Web-2026-230058_230081_230083/main/public/data/data.ttl

Setelah mengubah Turtle atau dataset, jalankan:

```bash
npm run sync:data
```

## Keamanan Supabase

- Jangan commit `.env` atau secret key.
- Route admin memakai key server-side dan tidak mengirim secret ke browser.
- SQL setup mengaktifkan RLS dan mencabut akses tabel dari role `anon` serta `authenticated`.
- Rotasi segera key yang pernah tertulis di source, log, screenshot, atau pesan.

## Verifikasi

Build dan smoke test terakhir dilakukan pada 14 Juni 2026:

- `npm run build` berhasil
- 15 route Next.js berhasil dibuat
- Workbench, seluruh halaman admin, API anime, status sync, graph JSON, dan SPARQL Wikidata merespons HTTP 200
