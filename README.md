# AnimeGraph Nexus Final

React + Tailwind final project untuk eksplorasi Semantic Web AnimeGraph. Aplikasi ini memakai RDF lokal dari proyek induk sebagai sumber data, lalu menghasilkan JSON siap konsumsi untuk UI.

Fitur utama mencakup semantic search, detail resource, graph neighborhood, grounded QA, semantic compare, dashboard statistik, top connected nodes, dan SPARQL Endpoint demo berbasis query terkurasi atas RDF-derived graph.

## Struktur

```text
projek akhir final/
  public/data/
    data.ttl
    animegraph.json
  scripts/
    sync-rdf-data.mjs
  src/
    lib/animegraph.js
    App.jsx
    main.jsx
    styles.css
  .github/workflows/ci-cd.yml
```

## Data

Sumber utama adalah:

```text
../data/processed/data.ttl
```

Jika folder ini sudah berdiri sendiri sebagai repository, script akan memakai fallback:

```text
public/data/data.ttl
```

Jalankan sinkronisasi:

```bash
npm run sync:data
```

Script akan menyalin RDF ke `public/data/data.ttl` dan membuat `public/data/animegraph.json` dari triple RDF tersebut.
Jika folder induk memiliki arsip CSV di `../Dataset/`, script juga membaca dataset anime eksternal, melakukan deduplikasi judul, lalu memperluas graph sampai ribuan judul anime. Secara default script mengambil sampai 15.000 anime eksternal paling relevan supaya UI tetap ringan di browser.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## CI/CD

Workflow GitHub Actions menjalankan:

- `npm ci`
- `npm run sync:data`
- `npm run build`
- deploy ke GitHub Pages saat push ke `main` atau `master`

Jika repo memakai GitHub Pages, aktifkan Pages dengan source **GitHub Actions** di Settings repository.
