import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';
const RATE_LIMIT_DELAY = 350;

let lastRequestTime = 0;

async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_DELAY) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY - elapsed));
  }
  lastRequestTime = Date.now();
}

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(25).default(25),
  type: z.enum(['tv', 'movie', 'ova', 'special', 'ona', 'music']).optional(),
  status: z.enum(['airing', 'complete', 'upcoming']).optional(),
  filter: z.enum(['bypopularity', 'favorite', ' airing', 'upcoming']).optional(),
  min_score: z.coerce.number().int().min(1).max(10).optional(),
  max_score: z.coerce.number().int().min(1).max(10).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  genres: z.string().optional(),
  order_by: z.enum(['score', 'popularity', 'rank', 'members', 'title', 'start_date', 'end_date', 'episodes', 'duration']).default('score'),
  sort: z.enum(['desc', 'asc']).default('desc'),
});

// GET /api/jikan/top - Get top/ranking anime from Jikan API
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const parsed = searchSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid search parameters', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { page, limit, type, status, filter, min_score, max_score, start_date, end_date, genres, order_by, sort } = parsed.data;

  try {
    await rateLimit();

    const jikanParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      order_by: order_by,
      sort: sort,
    });

    if (type) jikanParams.set('type', type);
    if (status) jikanParams.set('status', status);
    if (filter) jikanParams.set('filter', filter);
    if (min_score) jikanParams.set('min_score', min_score.toString());
    if (max_score) jikanParams.set('max_score', max_score.toString());
    if (start_date) jikanParams.set('start_date', start_date);
    if (end_date) jikanParams.set('end_date', end_date);
    if (genres) jikanParams.set('genres', genres);

    const response = await fetch(`${JIKAN_BASE_URL}/top/anime?${jikanParams}`);

    if (!response.ok) {
      if (response.status === 429) {
        return NextResponse.json(
          { error: 'Rate limited. Please wait a moment and try again.' },
          { status: 429 }
        );
      }
      throw new Error(`Jikan API error: ${response.status}`);
    }

    const json = await response.json();

    const results = (json.data || []).map((anime: any) => ({
      malId: anime.mal_id,
      title: anime.title,
      titleEnglish: anime.title_english,
      titleJapanese: anime.title_japanese,
      imageUrl: anime.images?.jpg?.image_url,
      imageUrlLarge: anime.images?.jpg?.large_image_url,
      score: anime.score,
      scoredBy: anime.scored_by,
      rank: anime.rank,
      popularity: anime.popularity,
      members: anime.members,
      favorites: anime.favorites,
      type: anime.type,
      status: anime.status,
      episodes: anime.episodes,
      duration: anime.duration,
      rating: anime.rating,
      season: anime.season,
      year: anime.year,
      studios: anime.studios?.map((s: any) => ({ malId: s.mal_id, name: s.name })) || [],
      genres: anime.genres?.map((g: any) => ({ malId: g.mal_id, name: g.name })) || [],
      url: anime.url,
    }));

    return NextResponse.json({
      results,
      pagination: {
        page: json.pagination?.current_page || page,
        limit: limit,
        total: json.pagination?.items?.total || 0,
        totalPages: json.pagination?.last_visible_page || 1,
        hasNext: json.pagination?.has_next_page || false,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('GET /api/jikan/top error:', error);
    return NextResponse.json(
      { error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
