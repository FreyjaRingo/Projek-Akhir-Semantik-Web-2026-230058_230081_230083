/**
 * Bulk Import from animegraph.json to Supabase
 * Usage: node scripts/bulk-import.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

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
const SUPABASE_KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SECRET_KEY wajib diatur di .env untuk bulk import.');
}

console.log('Supabase project:', new URL(SUPABASE_URL).hostname);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function upsertStudio(name) {
  if (!name) return null;
  try {
    const res = await supabase.from('Studio').upsert({ name }, { onConflict: 'name' }).select('id').single();
    return res.data?.id || null;
  } catch { return null; }
}

async function upsertGenre(name) {
  if (!name) return null;
  try {
    const res = await supabase.from('Genre').upsert({ name }, { onConflict: 'name' }).select('id').single();
    return res.data?.id || null;
  } catch { return null; }
}

async function upsertTheme(name) {
  if (!name) return null;
  try {
    const res = await supabase.from('Theme').upsert({ name }, { onConflict: 'name' }).select('id').single();
    return res.data?.id || null;
  } catch { return null; }
}

async function importOne(entity) {
  const label = entity.label || entity.title || entity.name;
  if (!label) return { ok: false, reason: 'No label' };

  try {
    // Insert anime
    const res = await supabase.from('Anime').upsert({
      malId: entity.malId || null,
      title: label,
      titleEnglish: entity.titleEnglish || null,
      description: entity.description || null,
      imageUrl: entity.imageUrl || null,
      score: entity.score || null,
      type: entity.type || entity.format || 'TV',
      status: 'COMPLETED',
      year: entity.year ? parseInt(entity.year) : null,
      lastSyncedAt: new Date().toISOString(),
    }, { onConflict: 'malId' }).select('id').single();

    if (res.error || !res.data) {
      return { ok: false, reason: res.error?.message || 'Insert failed' };
    }

    const animeId = res.data.id;

    // Link studio
    if (entity.studio) {
      const sid = await upsertStudio(entity.studio);
      if (sid) {
        await supabase.from('AnimeStudio').insert({ animeId, studioId: sid, isMain: true }).catch(() => {});
      }
    }

    // Link genre
    if (entity.genre) {
      const gid = await upsertGenre(entity.genre);
      if (gid) {
        await supabase.from('AnimeGenre').insert({ animeId: animeId, genreId: gid }).catch(() => {});
      }
    }

    // Link theme
    if (entity.theme) {
      const tid = await upsertTheme(entity.theme);
      if (tid) {
        await supabase.from('AnimeTheme').insert({ animeId: animeId, themeId: tid }).catch(() => {});
      }
    }

    return { ok: true, id: animeId };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

async function main() {
  console.log('\n=== Bulk Import animegraph.json ===\n');

  const paths = ['public/data/animegraph.json', 'animegraph.json', '../animegraph.json'];
  let jsonPath = null;
  for (const p of paths) {
    if (existsSync(p)) { jsonPath = p; break; }
  }

  if (!jsonPath) {
    console.error('animegraph.json not found');
    process.exit(1);
  }

  console.log('Reading:', jsonPath);
  const raw = readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(raw);
  const list = data.entities || data.anime || [];
  console.log('Entities:', list.length, '\n');

  let imported = 0, skipped = 0, errors = 0;

  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    process.stdout.write(`\r${i + 1}/${list.length}  ok:${imported}  skip:${skipped}  err:${errors}`);

    const r = await importOne(e);
    if (r.ok) imported++;
    else if (r.reason === 'No label') skipped++;
    else errors++;

    await sleep(20); // Rate limit
  }

  console.log(`\n\nDone!  imported:${imported}  skipped:${skipped}  errors:${errors}`);
}

main().catch(e => { console.error(e); process.exit(1); });
