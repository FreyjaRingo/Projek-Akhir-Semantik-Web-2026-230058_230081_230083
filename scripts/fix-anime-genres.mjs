/**
 * Fix Anime Genres - Infer genres from descriptions
 */

import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load environment
const env = {};
if (existsSync('.env')) {
  const content = readFileSync('.env', 'utf8');
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx > 0) {
      const key = t.slice(0, idx).trim();
      const val = t.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      env[key] = val;
    }
  }
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials');
  console.error('URL:', SUPABASE_URL ? 'OK' : 'MISSING');
  console.error('Key:', SUPABASE_KEY ? 'OK' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Genre keywords mapping
const GENRE_KEYWORDS = {
  'Action': ['fight', 'battle', 'war', 'combat', 'martial', 'samurai', 'ninja', 'soldier', 'military', 'fighter', 'warrior', 'attack'],
  'Adventure': ['journey', 'quest', 'explore', 'treasure', 'exploration', 'adventure', 'travel', 'expedition'],
  'Comedy': ['comedy', 'funny', 'humor', 'gag', 'parody', 'slapstick', 'laugh', 'hilarious'],
  'Drama': ['drama', 'emotional', 'tears', 'cry', 'family', 'tragedy', 'relationships', 'sorrow'],
  'Fantasy': ['magic', 'fantasy', 'dragon', 'wizard', 'spell', 'sword', 'kingdom', 'elves', 'dwarves', 'mythical'],
  'Horror': ['horror', 'scary', 'fear', 'terror', 'ghost', 'haunted', 'monster', 'dark', 'creepy'],
  'Mystery': ['mystery', 'detective', 'investigate', 'secret', 'puzzle', 'clue', 'whodunit', 'riddle'],
  'Romance': ['love', 'romance', 'romantic', 'heart', 'kiss', 'couple', 'feelings', 'affection'],
  'Sci-Fi': ['sci-fi', 'science fiction', 'space', 'robot', 'android', 'cyborg', 'future', 'technology', 'dystopia'],
  'Slice of Life': ['slice of life', 'daily', 'everyday', 'school life', 'relaxing', 'peaceful'],
  'Sports': ['sports', 'tournament', 'championship', 'competition', 'match', 'team', 'athlete', 'league'],
  'Supernatural': ['supernatural', 'ghost', 'spirit', 'paranormal', 'haunting', 'possessed', 'spiritual'],
  'Thriller': ['thriller', 'suspense', 'tense', 'gripping', 'edge', 'intense'],
  'Mecha': ['mecha', 'robot', 'gundam', 'mechanical', 'pilot', 'mechanical suit'],
  'Isekai': ['transported', 'another world', 'isekai', 'summoned', 'other world', 'reincarnated'],
  'Psychological': ['psychological', 'mind', 'mental', 'twist', 'dark thoughts', 'manipulation'],
  'Shounen': ['shounen', 'power', 'growth', 'friendship', 'nakama'],
  'Seinen': ['seinen', 'complex', 'mature', 'adult themes', 'dark'],
};

// Map description keywords to genres
function inferGenres(description) {
  if (!description) return [];

  const lower = description.toLowerCase();
  const found = [];

  for (const [genre, keywords] of Object.entries(GENRE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        if (!found.includes(genre)) {
          found.push(genre);
        }
        break;
      }
    }
  }

  return found;
}

async function ensureGenreExists(name) {
  if (!name) return null;

  try {
    const { data, error } = await supabase
      .from('Genre')
      .upsert({ name }, { onConflict: 'name' })
      .select('id')
      .single();

    if (error) return null;
    return data?.id || null;
  } catch (e) {
    return null;
  }
}

async function linkGenre(animeId, genreId) {
  try {
    await supabase
      .from('AnimeGenre')
      .upsert({ animeId, genreId }, { onConflict: 'animeId,genreId' });
  } catch (e) {
    // Ignore
  }
}

async function main() {
  console.log('=== Anime Genre Inference Script ===\n');
  console.log('Fetching anime without genres...\n');

  // Get anime that already have genres
  const { data: withGenres } = await supabase
    .from('AnimeGenre')
    .select('animeId');

  const animeWithGenres = new Set((withGenres || []).map(g => g.animeId));

  // Get anime without genres
  const { data: allAnime } = await supabase
    .from('Anime')
    .select('id, title, description, malId')
    .not('lastSyncedAt', 'is', null)
    .limit(5000);

  const animeWithoutGenres = (allAnime || []).filter(a => !animeWithGenres.has(a.id));

  console.log(`Total synced anime: ${allAnime?.length || 0}`);
  console.log(`Anime without genres: ${animeWithoutGenres.length}\n`);

  if (animeWithoutGenres.length === 0) {
    console.log('All anime already have genres!');
    return;
  }

  // Process in batches
  let updated = 0;
  let batch = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < animeWithoutGenres.length; i += BATCH_SIZE) {
    batch++;
    const batchAnime = animeWithoutGenres.slice(i, i + BATCH_SIZE);

    process.stdout.write(`Batch ${batch} (${i + 1}-${Math.min(i + BATCH_SIZE, animeWithoutGenres.length)}): `);

    let batchUpdated = 0;
    for (const anime of batchAnime) {
      const inferred = inferGenres(anime.description);

      if (inferred.length > 0) {
        for (const genreName of inferred) {
          const genreId = await ensureGenreExists(genreName);
          if (genreId) {
            await linkGenre(anime.id, genreId);
          }
        }
        batchUpdated++;
        updated++;
      }
    }

    console.log(`Updated ${batchUpdated} anime\n`);

    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total processed: ${animeWithoutGenres.length}`);
  console.log(`Genres inferred: ${updated}`);
  console.log(`Success rate: ${((updated / animeWithoutGenres.length) * 100).toFixed(1)}%`);
}

main().catch(console.error);
