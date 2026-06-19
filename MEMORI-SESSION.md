# AnimeGraph Nexus - Project Memory

## Project Overview
Semantic Web anime database project dengan Next.js + Supabase + RDF (TTL format)

## Last Session Summary (2026-06-19)

### Issues Fixed
1. **Graph tidak menampilkan data** - API `/api/rdf/graph` membaca dari `animegraph.json` yang kosong
   - Fixed: Diubah untuk parse langsung dari `data.ttl` (1190 anime, 5575 relations)
   - File: `app/api/rdf/graph/route.ts`

2. **Pertanyaan rekomendasi tidak berfungsi** - Regex tidak menangkap pola "mirip dengan X"
   - Fixed: Ditambah pattern baru untuk `mirip dengan [anime]`
   - File: `app/api/qa/route.ts` - fungsi `extractEntity()` dan `handleRecommendation()`

3. **HTML structure bug** di graph page
   - Fixed: Closing div tags yang tidak lengkap
   - File: `app/admin/graph/page.tsx`

### Files Modified
- `app/api/rdf/graph/route.ts` - Parse TTL untuk graph
- `app/api/qa/route.ts` - Fix recommendation patterns
- `app/admin/graph/page.tsx` - Fix HTML structure

### New File Created
- `scripts/import-ttl.mjs` - Script untuk import data dari `data.ttl` ke Supabase

### Data Source
- `public/data/data.ttl` - RDF data dengan 1190 anime entities
- `public/data/animegraph.json` - Empty (not used anymore)

### Environment
- Supabase URL: `https://yhpqueuycgqbzsiaszyp.supabase.co`
- Database: PostgreSQL via Supabase
- Schema: Prisma with Anime, Studio, Genre, Theme, Character tables

### Known Issues
1. QA API butuh data di Supabase untuk berfungsi (karena query Supabase, bukan TTL)
2. Script `import-ttl.mjs` perlu dijalankan untuk import data

## Pending Tasks
1. Run `node scripts/import-ttl.mjs` untuk import data dari TTL ke Supabase
2. Verify Graph page berfungsi dengan data baru
3. Verify QA recommendation berfungsi setelah import

## Commands
```bash
# Import data dari TTL ke Supabase
node scripts/import-ttl.mjs

# Start dev server
npm run dev

# Test graph API
curl http://localhost:3000/api/rdf/graph

# Test QA API
curl "http://localhost:3000/api/qa?q=anime%20yang%20mirip%20dengan%20Frieren"
```
