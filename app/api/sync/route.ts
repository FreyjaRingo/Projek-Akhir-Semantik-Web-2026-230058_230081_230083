import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { AnimeType, AnimeStatus, RelationType, SyncType, SyncStatus } from '@prisma/client';

const syncSchema = z.object({
  type: z.enum(['full', 'incremental', 'single']),
  malId: z.number().int().positive().optional(),
  page: z.number().int().positive().optional().default(1),
  syncId: z.string().optional(), // For pagination log tracking
  force: z.boolean().default(false),
  complete: z.boolean().optional(), // Signal to close the log
});

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';
const RATE_LIMIT_DELAY = 350; // ms between requests

let lastRequestTime = 0;
async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_DELAY) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY - elapsed));
  }
  lastRequestTime = Date.now();
}

interface JikanAnime {
  mal_id: number;
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  images: { jpg: { image_url: string; large_image_url: string } };
  synopsis: string | null;
  type: string | null;
  status: string | null;
  episodes: number | null;
  duration: string | null;
  rating: string | null;
  score: number | null;
  scored_by: number | null;
  rank: number | null;
  popularity: number | null;
  members: number | null;
  favorites: number | null;
  source: string | null;
  broadcast: { day: string; time: string; string: string } | null;
  premiered: string | null;
  year: number | null;
  season: string | null;
  studios: Array<{ mal_id: number; name: string }>;
  genres: Array<{ mal_id: number; name: string }>;
  themes: Array<{ mal_id: number; name: string }>;
  relations: Array<{
    relation: string;
    entry: Array<{ mal_id: number; type: string; name: string }>;
  }>;
}

function mapType(type: string | null): AnimeType {
  const map: Record<string, AnimeType> = { TV: 'TV', Movie: 'MOVIE', OVA: 'OVA', Special: 'SPECIAL', ONA: 'ONA', Music: 'MUSIC' };
  return map[type || 'TV'] || 'TV';
}

function mapStatus(status: string | null): AnimeStatus {
  const map: Record<string, AnimeStatus> = {
    'Currently Airing': 'AIRING',
    'Finished Airing': 'COMPLETED',
    'Not yet aired': 'TO_BE_AIRED',
  };
  return map[status || 'AIRING'] || 'AIRING';
}

function mapRelationType(relation: string): RelationType {
  const normalized = relation.toUpperCase().replace(/[^A-Z]+/g, '_').replace(/^_|_$/g, '');
  const supported = new Set([
    'SEQUEL', 'PREQUEL', 'SIDE_STORY', 'PARENT_STORY', 'SUMMARY',
    'ALTERNATIVE_VERSION', 'ADAPTATION', 'CHARACTER', 'SPIN_OFF', 'OTHER_VERSION'
  ]);
  return supported.has(normalized) ? (normalized as RelationType) : 'OTHER';
}

function parseDuration(duration: string | null): number | null {
  if (!duration) return null;
  const match = duration.match(/(\d+)\s*min/);
  return match ? parseInt(match[1]) : null;
}

function parseSeason(premiered: string | null) {
  if (!premiered) return { season: null, year: null };
  const match = premiered.match(/^(\w+)\s+(\d{4})$/);
  if (match) return { season: match[1].toLowerCase(), year: parseInt(match[2]) };
  return { season: null, year: null };
}

async function syncSingleAnime(malId: number) {
  await rateLimit();

  const response = await fetch(`${JIKAN_BASE_URL}/anime/${malId}/full`);
  if (!response.ok) {
    if (response.status === 404) return { success: false, error: `Anime with MAL ID ${malId} not found` };
    throw new Error(`Jikan API error: ${response.status}`);
  }

  const json = await response.json();
  const data: JikanAnime = json.data;

  const { season, year } = parseSeason(data.premiered);

  // Prisma Transaction for Upserting Data (with extended timeout)
  const anime = await prisma.$transaction(async (tx) => {
    // 1. Upsert Lookups sequentially to avoid transaction conflicts
    const studios: any[] = [];
    for (const s of data.studios || []) {
      const studio = await tx.studio.upsert({
        where: { name: s.name },
        update: { malId: s.mal_id },
        create: { malId: s.mal_id, name: s.name }
      });
      studios.push(studio);
    }

    const genres: any[] = [];
    for (const g of data.genres || []) {
      const genre = await tx.genre.upsert({
        where: { name: g.name },
        update: { malId: g.mal_id },
        create: { malId: g.mal_id, name: g.name }
      });
      genres.push(genre);
    }

    const themes: any[] = [];
    for (const t of data.themes || []) {
      const theme = await tx.theme.upsert({
        where: { name: t.name },
        update: { malId: t.mal_id },
        create: { malId: t.mal_id, name: t.name }
      });
      themes.push(theme);
    }

    // 2. Upsert Anime
    const animeData = {
      title: data.title,
      titleEnglish: data.title_english,
      titleJapanese: data.title_japanese,
      description: data.synopsis,
      imageUrl: data.images.jpg?.large_image_url || data.images.jpg?.image_url,
      episodes: data.episodes,
      duration: parseDuration(data.duration),
      type: mapType(data.type),
      status: mapStatus(data.status),
      rating: data.rating,
      score: data.score,
      scoredBy: data.scored_by,
      rank: data.rank,
      popularity: data.popularity,
      source: data.source,
      broadcast: data.broadcast?.string || null,
      season: season,
      year: year || data.year,
      lastSyncedAt: new Date(),
    };

    const animeRecord = await tx.anime.upsert({
      where: { malId: data.mal_id },
      update: animeData,
      create: { malId: data.mal_id, ...animeData },
    });

    // 3. Clear existing relations
    await tx.animeStudio.deleteMany({ where: { animeId: animeRecord.id } });
    await tx.animeGenre.deleteMany({ where: { animeId: animeRecord.id } });
    await tx.animeTheme.deleteMany({ where: { animeId: animeRecord.id } });

    // 4. Re-insert relations
    if (studios.length > 0) {
      await tx.animeStudio.createMany({
        data: studios.map(s => ({ animeId: animeRecord.id, studioId: s.id })),
        skipDuplicates: true
      });
    }
    if (genres.length > 0) {
      await tx.animeGenre.createMany({
        data: genres.map(g => ({ animeId: animeRecord.id, genreId: g.id })),
        skipDuplicates: true
      });
    }
    if (themes.length > 0) {
      await tx.animeTheme.createMany({
        data: themes.map(t => ({ animeId: animeRecord.id, themeId: t.id })),
        skipDuplicates: true
      });
    }

    return animeRecord;
  }, { timeout: 30000 }); // 30 second timeout

  return { success: true, animeId: anime.id };
}

// POST /api/sync - Trigger sync
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const validated = syncSchema.parse(body);

    // If complete is true, mark the SyncLog as COMPLETED
    if (validated.complete && validated.syncId) {
       await prisma.syncLog.update({
         where: { id: validated.syncId },
         data: { status: SyncStatus.COMPLETED, completedAt: new Date() }
       });
       return NextResponse.json({ success: true, message: 'Sync marked as completed.' });
    }

    // Initialize or fetch SyncLog
    let syncLog;
    if (validated.syncId) {
      syncLog = await prisma.syncLog.findUnique({ where: { id: validated.syncId } });
      if (!syncLog) throw new Error('SyncLog not found');
    } else {
      syncLog = await prisma.syncLog.create({
        data: {
          syncType: validated.type.toUpperCase() as SyncType,
          status: SyncStatus.RUNNING,
          itemsProcessed: 0,
        }
      });
    }

    if (validated.type === 'single' && validated.malId) {
      const result = await syncSingleAnime(validated.malId);
      if (result.success) {
        await prisma.syncLog.update({
          where: { id: syncLog.id },
          data: { status: SyncStatus.COMPLETED, itemsProcessed: 1, completedAt: new Date() }
        });
        return NextResponse.json({ success: true, syncId: syncLog.id, message: `Successfully synced MAL ID ${validated.malId}` });
      } else {
        await prisma.syncLog.update({
          where: { id: syncLog.id },
          data: { status: SyncStatus.FAILED, errorMessage: result.error, completedAt: new Date() }
        });
        return NextResponse.json({ error: 'Sync failed', details: result.error }, { status: 500 });
      }
    }

    if (validated.type === 'full') {
      await rateLimit();
      const response = await fetch(`${JIKAN_BASE_URL}/anime?page=${validated.page}&limit=25&order_by=popularity&sort=asc`);
      if (!response.ok) throw new Error(`Jikan API error: ${response.status}`);

      const json = await response.json();
      let processed = 0;

      for (const anime of json.data || []) {
        try {
          await syncSingleAnime(anime.mal_id);
          processed++;
        } catch (e) { console.error(`Failed to sync ${anime.mal_id}:`, e); }
      }

      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: { itemsProcessed: { increment: processed } }
      });

      return NextResponse.json({
        success: true,
        syncId: syncLog.id,
        itemsProcessed: processed,
        hasNextPage: json.pagination?.has_next_page || false,
        page: validated.page,
      });
    }

    if (validated.type === 'incremental') {
      await rateLimit();
      const response = await fetch(`${JIKAN_BASE_URL}/anime?page=${validated.page}&limit=25&status=airing&order_by=start_date&sort=desc`);
      if (!response.ok) throw new Error(`Jikan API error: ${response.status}`);

      const json = await response.json();
      let processed = 0;

      for (const anime of json.data || []) {
        try {
          await syncSingleAnime(anime.mal_id);
          processed++;
        } catch (e) { console.error(`Failed to sync ${anime.mal_id}:`, e); }
      }

      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: { itemsProcessed: { increment: processed } }
      });

      return NextResponse.json({
        success: true,
        syncId: syncLog.id,
        itemsProcessed: processed,
        hasNextPage: json.pagination?.has_next_page || false,
        page: validated.page,
      });
    }

    return NextResponse.json({ error: 'Invalid sync type' }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    console.error('POST /api/sync error:', error);
    return NextResponse.json({ error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

// GET /api/sync - Get sync status
export async function GET() {
  try {
    const latest = await prisma.syncLog.findFirst({
      orderBy: { startedAt: 'desc' },
    });

    const allLogs = await prisma.syncLog.findMany({ select: { status: true } });
    const stats: Record<string, number> = {};
    allLogs.forEach(log => {
      stats[log.status] = (stats[log.status] || 0) + 1;
    });

    const totalSynced = await prisma.anime.count({
      where: { lastSyncedAt: { not: null } }
    });

    return NextResponse.json({ latest, totalSynced, stats });
  } catch (error) {
    console.error('GET /api/sync error:', error);
    return NextResponse.json({ error: 'Failed to get sync status' }, { status: 500 });
  }
}
