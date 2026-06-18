#!/usr/bin/env node
/**
 * Jikan API Sync Script
 *
 * Usage:
 *   node scripts/sync-jikan.mjs                    # Full sync (top 250 anime)
 *   node scripts/sync-jikan.mjs --single 21        # Single anime by MAL ID
 *   node scripts/sync-jikan.mjs --incremental      # Recent airing anime
 *   node scripts/sync-jikan.mjs --pages 5         # Custom page count
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load environment variables
try {
  const envFile = readFileSync('.env', 'utf8');
  for (const line of envFile.split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
} catch {
  // .env file not found, use environment variables
}

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';
const RATE_LIMIT_DELAY = 350;

// Parse command line arguments
const args = process.argv.slice(2);
let mode = 'full';
let malId = null;
let maxPages = 10;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--single' && args[i + 1]) {
    mode = 'single';
    malId = parseInt(args[i + 1]);
    i++;
  } else if (args[i] === '--incremental') {
    mode = 'incremental';
  } else if (args[i] === '--pages' && args[i + 1]) {
    maxPages = parseInt(args[i + 1]);
    i++;
  } else if (args[i] === '--help') {
    console.log(`
Jikan API Sync Script

Usage:
  node scripts/sync-jikan.mjs                    # Full sync (top 250 anime)
  node scripts/sync-jikan.mjs --single <mal_id>  # Single anime by MAL ID
  node scripts/sync-jikan.mjs --incremental      # Recent airing anime
  node scripts/sync-jikan.mjs --pages <n>        # Custom page count (default: 10)

Environment:
  DATABASE_URL    PostgreSQL connection string

Example:
  DATABASE_URL="postgresql://localhost/animegraph" node scripts/sync-jikan.mjs --single 21
`);
    process.exit(0);
  }
}

// Dynamic import Prisma
let PrismaClient;
try {
  const { PrismaClient: PC } = await import('@prisma/client');
  PrismaClient = PC;
} catch (error) {
  console.error('Failed to import Prisma Client. Make sure dependencies are installed:');
  console.error('  npm install @prisma/client prisma');
  console.error('  npx prisma generate');
  process.exit(1);
}

const prisma = new PrismaClient();
let lastRequestTime = 0;

async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_DELAY) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY - elapsed));
  }
  lastRequestTime = Date.now();
}

async function fetchJikan(url) {
  await rateLimit();
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Jikan API error: ${response.status}`);
  }
  return response.json();
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/[;\s]/g, '_');
}

function mapType(type) {
  const map = { TV: 'TV', Movie: 'MOVIE', OVA: 'OVA', Special: 'SPECIAL', ONA: 'ONA', Music: 'MUSIC' };
  return map[type] || 'TV';
}

function mapStatus(status) {
  const map = {
    'Currently Airing': 'AIRING',
    'Finished Airing': 'COMPLETED',
    'Not yet aired': 'TO_BE_AIRED',
  };
  return map[status] || 'AIRING';
}

function parseDuration(duration) {
  if (!duration) return null;
  const match = duration.match(/(\d+)\s*min/);
  return match ? parseInt(match[1]) : null;
}

function parseSeason(premiered) {
  if (!premiered) return { season: null, year: null };
  const match = premiered.match(/^(\w+)\s+(\d{4})$/);
  if (match) return { season: match[1].toLowerCase(), year: parseInt(match[2]) };
  return { season: null, year: null };
}

async function syncSingleAnime(malId) {
  console.log(`Fetching anime MAL ID: ${malId}...`);

  const json = await fetchJikan(`${JIKAN_BASE_URL}/anime/${malId}/full`);
  const data = json.data;

  const { season, year } = parseSeason(data.premiered);

  // Upsert studios (using name for uniqueness)
  for (const s of data.studios || []) {
    await prisma.studio.upsert({
      where: { name: s.name },
      create: { malId: s.mal_id, name: s.name },
      update: { malId: s.mal_id },
    });
  }

  // Upsert genres (using name for uniqueness)
  for (const g of data.genres || []) {
    await prisma.genre.upsert({
      where: { name: g.name },
      create: { malId: g.mal_id, name: g.name },
      update: { malId: g.mal_id },
    });
  }

  // Upsert themes (using name for uniqueness)
  for (const t of data.themes || []) {
    await prisma.theme.upsert({
      where: { name: t.name },
      create: { malId: t.mal_id, name: t.name },
      update: { malId: t.mal_id },
    });
  }

  // Upsert anime
  const anime = await prisma.anime.upsert({
    where: { malId: data.mal_id },
    create: {
      malId: data.mal_id,
      title: data.title,
      titleEnglish: data.title_english,
      titleJapanese: data.title_japanese,
      description: data.synopsis,
      imageUrl: data.images.jpg.image_url,
      episodes: data.episodes,
      duration: parseDuration(data.duration),
      type: mapType(data.type),
      status: mapStatus(data.status),
      rating: data.rating,
      score: data.score,
      scoredBy: data.scored_by,
      rank: data.rank,
      popularity: data.popularity,
      members: data.members,
      favorites: data.favorites,
      source: data.source,
      broadcast: data.broadcast?.string || null,
      season: season,
      year: year || data.year,
      lastSyncedAt: new Date(),
    },
    update: {
      title: data.title,
      titleEnglish: data.title_english,
      titleJapanese: data.title_japanese,
      description: data.synopsis,
      imageUrl: data.images.jpg.image_url,
      episodes: data.episodes,
      duration: parseDuration(data.duration),
      type: mapType(data.type),
      status: mapStatus(data.status),
      score: data.score,
      scoredBy: data.scored_by,
      rank: data.rank,
      popularity: data.popularity,
      lastSyncedAt: new Date(),
    },
  });

  // Sync relations
  if (data.relations) {
    await prisma.animeRelation.deleteMany({ where: { animeId: anime.id } });

    for (const rel of data.relations) {
      for (const entry of rel.entry) {
        if (entry.type !== 'anime') continue;
        const related = await prisma.anime.findUnique({ where: { malId: entry.mal_id } });
        if (related) {
          await prisma.animeRelation.create({
            data: {
              animeId: anime.id,
              relatedAnimeId: related.id,
              relationType: rel.relation || 'OTHER',
            },
          });
        }
      }
    }
  }

  console.log(`  ✓ Synced: ${data.title}`);
  return anime;
}

async function runFullSync() {
  console.log(`Starting full sync (${maxPages} pages)...\n`);

  let processed = 0;
  let errors = 0;

  for (let page = 1; page <= maxPages; page++) {
    console.log(`Fetching page ${page}/${maxPages}...`);

    const json = await fetchJikan(
      `${JIKAN_BASE_URL}/anime?page=${page}&limit=25&order_by=popularity&sort=asc`
    );

    if (!json.data || json.data.length === 0) break;

    for (const anime of json.data) {
      try {
        await syncSingleAnime(anime.mal_id);
        processed++;
      } catch (error) {
        errors++;
        console.error(`  ✗ Error: ${error.message}`);
      }
    }

    if (!json.pagination?.has_next_page) break;
  }

  console.log(`\nSync complete!`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Errors: ${errors}`);
}

async function runIncrementalSync() {
  console.log('Starting incremental sync (airing anime)...\n');

  const json = await fetchJikan(
    `${JIKAN_BASE_URL}/anime?limit=50&status=airing&order_by=start_date&sort=desc`
  );

  let processed = 0;
  let errors = 0;

  for (const anime of json.data || []) {
    try {
      await syncSingleAnime(anime.mal_id);
      processed++;
    } catch (error) {
      errors++;
      console.error(`  ✗ Error: ${error.message}`);
    }
  }

  console.log(`\nSync complete!`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Errors: ${errors}`);
}

async function main() {
  try {
    if (mode === 'single' && malId) {
      await syncSingleAnime(malId);
    } else if (mode === 'incremental') {
      await runIncrementalSync();
    } else {
      await runFullSync();
    }
  } catch (error) {
    console.error('Sync failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
