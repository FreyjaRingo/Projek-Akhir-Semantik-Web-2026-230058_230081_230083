/**
 * Bulk Import from data.ttl to Supabase
 * Parses the RDF TTL file and imports anime data to Supabase
 * Usage: node scripts/import-ttl.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load environment variables manually
const env = {};
const envPath = '.env';

if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx > 0) {
      const key = t.slice(0, idx).trim();
      let val = t.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      env[key] = val;
    }
  }
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SECRET_KEY wajib diatur di .env');
  process.exit(1);
}

console.log('Supabase project:', new URL(SUPABASE_URL).hostname);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function upsertStudio(name) {
  if (!name) return null;
  try {
    const res = await supabase.from('Studio').upsert({ name }, { onConflict: 'name' }).select('id').single();
    return res.data?.id || null;
  } catch (e) {
    console.error('Studio upsert error:', e.message);
    return null;
  }
}

async function upsertGenre(name) {
  if (!name) return null;
  try {
    const res = await supabase.from('Genre').upsert({ name }, { onConflict: 'name' }).select('id').single();
    return res.data?.id || null;
  } catch (e) {
    console.error('Genre upsert error:', e.message);
    return null;
  }
}

async function upsertTheme(name) {
  if (!name) return null;
  try {
    const res = await supabase.from('Theme').upsert({ name }, { onConflict: 'name' }).select('id').single();
    return res.data?.id || null;
  } catch (e) {
    console.error('Theme upsert error:', e.message);
    return null;
  }
}

function parseTTL(content) {
  const blocks = content.split(/\n\s*\n/);
  const entities = [];

  // Skip prefix section (first block)
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const lines = block.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('@prefix'));
    if (lines.length === 0) continue;

    const firstLine = lines[0];
    const subjectMatch = firstLine.match(/^ag:(\w+)\s+a\s+ag:(\w+)/);
    if (!subjectMatch) continue;

    const subjectId = subjectMatch[1];
    const entityType = subjectMatch[2];

    let label = subjectId.replace(/_/g, ' ');
    let description = null;
    let year = null;
    let score = null;
    let genre = null;
    let studio = null;
    const themes = [];
    const characters = [];

    const fullBlock = block.replace(/\n/g, ' ').replace(/\s+/g, ' ');

    // Parse label
    const labelMatch = fullBlock.match(/rdfs:label\s+"([^"]+)"/);
    if (labelMatch) label = labelMatch[1];

    // Parse description
    const descMatch = fullBlock.match(/ag:description\s+"([^"]+)"/);
    if (descMatch) description = descMatch[1];

    // Parse year
    const yearMatch = fullBlock.match(/ag:releaseYear\s+"(\d+)"/);
    if (yearMatch) year = parseInt(yearMatch[1]);

    // Parse score
    const scoreMatch = fullBlock.match(/ag:score\s+"([\d.]+)"/);
    if (scoreMatch) score = parseFloat(scoreMatch[1]);

    // Parse genre
    const genreMatch = fullBlock.match(/ag:genre\s+"([^"]+)"/);
    if (genreMatch) genre = genreMatch[1];

    // Parse format
    const formatMatch = fullBlock.match(/ag:format\s+"([^"]+)"/);
    const format = formatMatch ? formatMatch[1] : 'TV';

    // Parse studio (producedBy)
    const studioMatch = fullBlock.match(/ag:producedBy\s+ag:(\w+)/);
    if (studioMatch) studio = studioMatch[1].replace(/_/g, ' ');

    // Parse themes
    const themePattern = /ag:hasTheme\s+ag:(\w+)/g;
    let themeMatch;
    while ((themeMatch = themePattern.exec(fullBlock)) !== null) {
      themes.push(themeMatch[1].replace(/_/g, ' '));
    }

    // Parse characters
    const charPattern = /ag:featuresCharacter\s+ag:(\w+)/g;
    let charMatch;
    while ((charMatch = charPattern.exec(fullBlock)) !== null) {
      characters.push(charMatch[1].replace(/_/g, ' '));
    }

    // Only process anime entities (not genre/studio/theme entities)
    if (entityType.toLowerCase().includes('anime') || entityType.toLowerCase() === 'movie') {
      entities.push({
        id: subjectId,
        label,
        description,
        year,
        score,
        genre,
        format,
        studio,
        themes,
        characters,
      });
    }
  }

  return entities;
}

async function importEntity(entity) {
  try {
    // Check if anime already exists by title
    const existing = await supabase
      .from('Anime')
      .select('id')
      .eq('title', entity.label)
      .single();

    let animeId;

    if (existing.data) {
      // Update existing anime
      animeId = existing.data.id;
      const updateRes = await supabase
        .from('Anime')
        .update({
          description: entity.description,
          score: entity.score,
          type: mapType(entity.format),
          status: 'COMPLETED',
          year: entity.year,
          lastSyncedAt: new Date().toISOString(),
        })
        .eq('id', animeId);

      if (updateRes.error) {
        return { ok: false, reason: 'Update failed: ' + updateRes.error.message };
      }
    } else {
      // Insert new anime
      const insertRes = await supabase
        .from('Anime')
        .insert({
          title: entity.label,
          description: entity.description,
          score: entity.score,
          type: mapType(entity.format),
          status: 'COMPLETED',
          year: entity.year,
          lastSyncedAt: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertRes.error || !insertRes.data) {
        return { ok: false, reason: insertRes.error?.message || 'Insert failed' };
      }
      animeId = insertRes.data.id;
    }

    // Link studio
    if (entity.studio) {
      const sid = await upsertStudio(entity.studio);
      if (sid) {
        const sres = await supabase.from('AnimeStudio').upsert({ animeId, studioId: sid, isMain: true }, { onConflict: 'animeId,studioId' });
        if (sres.error) console.error('  Studio link error:', sres.error.message);
      }
    }

    // Link genre
    if (entity.genre) {
      const gid = await upsertGenre(entity.genre);
      if (gid) {
        const gres = await supabase.from('AnimeGenre').upsert({ animeId, genreId: gid }, { onConflict: 'animeId,genreId' });
        if (gres.error) console.error('  Genre link error:', gres.error.message);
      }
    }

    // Link themes
    for (const themeName of entity.themes) {
      const tid = await upsertTheme(themeName);
      if (tid) {
        const tres = await supabase.from('AnimeTheme').upsert({ animeId, themeId: tid }, { onConflict: 'animeId,themeId' });
        if (tres.error) console.error('  Theme link error:', tres.error.message);
      }
    }

    return { ok: true, animeId };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

function mapType(format) {
  const map = {
    'TV Anime': 'TV',
    'TV': 'TV',
    'Movie': 'MOVIE',
    'OVA': 'OVA',
    'Special': 'SPECIAL',
    'ONA': 'ONA',
    'Music': 'MUSIC',
  };
  return map[format] || 'TV';
}

async function main() {
  const ttlPath = 'public/data/data.ttl';

  if (!existsSync(ttlPath)) {
    console.error('Error: data.ttl not found at', ttlPath);
    process.exit(1);
  }

  console.log('Reading TTL file...');
  const content = readFileSync(ttlPath, 'utf-8');
  console.log('Parsing TTL...');
  const entities = parseTTL(content);

  console.log(`Found ${entities.length} anime entities`);

  // Ask for confirmation
  console.log('\nThis will import all anime to Supabase.');
  console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...');

  await sleep(3000);

  let imported = 0;
  let failed = 0;

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];

    process.stdout.write(`\rImporting ${i + 1}/${entities.length}: ${entity.label.substring(0, 40)}...`);

    const result = await importEntity(entity);

    if (result.ok) {
      imported++;
    } else {
      failed++;
      if (failed <= 5) {
        console.error(`\nFailed: ${entity.label} - ${result.reason}`);
      }
    }

    // Rate limiting
    if (i % 10 === 0) {
      await sleep(100);
    }
  }

  console.log('\n\n=== Import Complete ===');
  console.log(`Imported: ${imported}`);
  console.log(`Failed: ${failed}`);
}

main().catch(console.error);
