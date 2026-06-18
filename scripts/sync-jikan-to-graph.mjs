import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUTPUT_JSON = resolve(ROOT, 'public', 'data', 'animegraph.json');

// Dynamic import to load env first
const { createClient } = await import('@supabase/supabase-js');

// Environment variables should be set by the build process
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'anonymous';

console.log('🔄 Syncing Jikan data to animegraph.json...\n');
console.log('   Supabase URL:', supabaseUrl ? 'Configured' : 'MISSING - using demo mode');

async function main() {
  if (!supabaseUrl) {
    console.log('⚠️  Creating empty animegraph.json - set environment variables for full sync\n');
    const emptyGraph = {
      entities: [],
      relations: [],
      metadata: {
        generated: new Date().toISOString(),
        source: 'AnimeGraph Nexus',
        message: 'Set NEXT_PUBLIC_SUPABASE_URL to sync data'
      }
    };
    writeFileSync(OUTPUT_JSON, JSON.stringify(emptyGraph, null, 2));
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('📡 Fetching data from Supabase...');

    const { data: animeData, error } = await supabase
      .from('Anime')
      .select('*')
      .not('lastSyncedAt', 'is', 'null')
      .limit(10000);

    if (error) throw error;
    console.log(`   Found ${animeData?.length || 0} synced anime\n`);

    const graphData = {
      entities: [],
      relations: [],
      metadata: {
        generated: new Date().toISOString(),
        source: 'AnimeGraph Nexus - Jikan Sync',
        animeCount: animeData?.length || 0,
        type: 'knowledge-graph'
      }
    };

    const { data: studios } = await supabase.from('Studio').select('*');
    const { data: genres } = await supabase.from('Genre').select('*');
    const { data: themes } = await supabase.from('Theme').select('*');
    const { data: animeStudios } = await supabase.from('AnimeStudio').select('*');
    const { data: animeGenres } = await supabase.from('AnimeGenre').select('*');
    const { data: animeThemes } = await supabase.from('AnimeTheme').select('*');

    console.log(`   Loaded ${studios?.length || 0} studios, ${genres?.length || 0} genres, ${themes?.length || 0} themes\n`);

    const studioMap = new Map((studios || []).map(s => [s.id, s]));
    const genreMap = new Map((genres || []).map(g => [g.id, g]));
    const themeMap = new Map((themes || []).map(t => [t.id, t]));
    const animeMap = new Map((animeData || []).map(a => [a.id, a]));

    for (const anime of animeData || []) {
      graphData.entities.push({
        id: anime.id,
        malId: anime.malId,
        type: 'anime',
        label: anime.title,
        entityType: anime.type || 'Anime',
        format: anime.type || 'Anime',
        year: anime.year,
        description: anime.description,
        score: anime.score,
        ranked: anime.rank,
        popularity: anime.popularity,
        episodes: anime.episodes,
        duration: anime.duration,
        malUrl: anime.malId ? `https://myanimelist.net/anime/${anime.malId}` : null,
        imageUrl: anime.imageUrl,
        lastSyncedAt: anime.lastSyncedAt
      });
    }

    for (const as of animeStudios || []) {
      const studio = studioMap.get(as.studioId);
      const anime = animeMap.get(as.animeId);
      if (studio && anime) {
        graphData.entities.push({
          id: studio.id,
          type: 'studio',
          label: studio.name,
          malId: studio.malId,
          entityType: 'Studio'
        });
        graphData.relations.push({
          id: `${anime.id}_${studio.id}`,
          type: 'relation',
          from: anime.id,
          to: studio.id,
          predicate: 'producedBy',
          label: `${anime.title} by ${studio.name}`
        });
      }
    }

    for (const ag of animeGenres || []) {
      const genre = genreMap.get(ag.genreId);
      const anime = animeMap.get(ag.animeId);
      if (genre && anime) {
        graphData.entities.push({
          id: genre.id,
          type: 'genre',
          label: genre.name,
          malId: genre.malId,
          entityType: 'Genre'
        });
        graphData.relations.push({
          id: `${anime.id}_${genre.id}`,
          type: 'relation',
          from: anime.id,
          to: genre.id,
          predicate: 'hasGenre',
          label: `${anime.title} - ${genre.name}`
        });
      }
    }

    for (const at of animeThemes || []) {
      const theme = themeMap.get(at.themeId);
      const anime = animeMap.get(at.animeId);
      if (theme && anime) {
        graphData.entities.push({
          id: theme.id,
          type: 'theme',
          label: theme.name,
          malId: theme.malId,
          entityType: 'Theme'
        });
        graphData.relations.push({
          id: `${anime.id}_${theme.id}`,
          type: 'relation',
          from: anime.id,
          to: theme.id,
          predicate: 'hasTheme',
          label: `${anime.title} - ${theme.name}`
        });
      }
    }

    const uniqueEntities = new Map();
    for (const e of graphData.entities) {
      if (!uniqueEntities.has(e.id)) uniqueEntities.set(e.id, e);
    }

    const finalGraph = {
      entities: Array.from(uniqueEntities.values()),
      relations: graphData.relations,
      metadata: {
        ...graphData.metadata,
        uniqueEntities: uniqueEntities.size,
        totalRelations: graphData.relations.length
      }
    };

    console.log(`📝 Writing ${finalGraph.entities.length} entities and ${finalGraph.relations.length} relations...`);
    writeFileSync(OUTPUT_JSON, JSON.stringify(finalGraph, null, 2));
    console.log(`✅ Done!\n`);

    console.log('📊 Summary:');
    console.log(`   Anime: ${animeData?.length || 0}`);
    console.log(`   Unique entities: ${finalGraph.entities.length}`);
    console.log(`   Relations: ${finalGraph.relations.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    const emptyGraph = {
      entities: [],
      relations: [],
      metadata: { generated: new Date().toISOString(), error: error.message }
    };
    writeFileSync(OUTPUT_JSON, JSON.stringify(emptyGraph, null, 2));
  }
}

main();
