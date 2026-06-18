import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const searchSchema = z.object({
  q: z.string().min(1).max(200).optional(),
  type: z.enum(['TV', 'MOVIE', 'OVA', 'SPECIAL', 'ONA', 'MUSIC']).optional(),
  status: z.enum(['AIRING', 'COMPLETED', 'TO_BE_AIRED', 'CANCELLED', 'HIATUS']).optional(),
  genres: z.union([z.string(), z.array(z.string())]).optional(),
  studios: z.union([z.string(), z.array(z.string())]).optional(),
  themes: z.union([z.string(), z.array(z.string())]).optional(),
  year_min: z.coerce.number().int().min(1900).max(2100).optional(),
  year_max: z.coerce.number().int().min(1900).max(2100).optional(),
  score_min: z.coerce.number().min(0).max(10).optional(),
  score_max: z.coerce.number().min(0).max(10).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sort_by: z.enum(['score', 'popularity', 'rank', 'title', 'year', 'createdAt']).default('score'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

// GET /api/anime/search - Advanced search with filters
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Convert searchParams to object
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

  const {
    q,
    type,
    status,
    genres,
    studios,
    themes,
    year_min,
    year_max,
    score_min,
    score_max,
    page,
    limit,
    sort_by,
    sort_order,
  } = parsed.data;

  const skip = (page - 1) * limit;

  try {
    // Build where clause
    const where: any = {};

    // Text search
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { titleEnglish: { contains: q, mode: 'insensitive' } },
        { titleJapanese: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Exact filters
    if (type) where.type = type;
    if (status) where.status = status;

    // Range filters
    if (year_min || year_max) {
      where.year = {};
      if (year_min) where.year.gte = year_min;
      if (year_max) where.year.lte = year_max;
    }

    if (score_min || score_max) {
      where.score = {};
      if (score_min) where.score.gte = score_min;
      if (score_max) where.score.lte = score_max;
    }

    // Array filters (genres, studios, themes)
    const genreArray = genres ? (Array.isArray(genres) ? genres : [genres]) : [];
    const studioArray = studios ? (Array.isArray(studios) ? studios : [studios]) : [];
    const themeArray = themes ? (Array.isArray(themes) ? themes : [themes]) : [];

    if (genreArray.length > 0) {
      where.genres = {
        some: {
          genre: {
            name: { in: genreArray, mode: 'insensitive' },
          },
        },
      };
    }

    if (studioArray.length > 0) {
      where.studios = {
        some: {
          studio: {
            name: { in: studioArray, mode: 'insensitive' },
          },
        },
      };
    }

    if (themeArray.length > 0) {
      where.themes = {
        some: {
          theme: {
            name: { in: themeArray, mode: 'insensitive' },
          },
        },
      };
    }

    // Build order by
    const orderBy: any = {};
    orderBy[sort_by] = sort_order;

    // Execute query
    const [anime, total] = await Promise.all([
      prisma.anime.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          studios: { include: { studio: true } },
          genres: { include: { genre: true } },
          themes: { include: { theme: true } },
        },
      }),
      prisma.anime.count({ where }),
    ]);

    // Transform response
    const transformedAnime = anime.map((a) => ({
      id: a.id,
      malId: a.malId,
      title: a.title,
      titleEnglish: a.titleEnglish,
      imageUrl: a.imageUrl,
      score: a.score,
      rank: a.rank,
      popularity: a.popularity,
      episodes: a.episodes,
      type: a.type,
      status: a.status,
      year: a.year,
      season: a.season,
      studios: a.studios.map((s) => s.studio.name),
      genres: a.genres.map((g) => g.genre.name),
      themes: a.themes.map((t) => t.theme.name),
    }));

    return NextResponse.json({
      data: transformedAnime,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      filters: {
        applied: {
          q,
          type,
          status,
          genres: genreArray,
          studios: studioArray,
          themes: themeArray,
          year_range: year_min || year_max ? { min: year_min, max: year_max } : undefined,
          score_range: score_min || score_max ? { min: score_min, max: score_max } : undefined,
        },
        available: {
          types: ['TV', 'MOVIE', 'OVA', 'SPECIAL', 'ONA', 'MUSIC'],
          statuses: ['AIRING', 'COMPLETED', 'TO_BE_AIRED', 'CANCELLED', 'HIATUS'],
        },
      },
    });
  } catch (error) {
    console.error('GET /api/anime/search error:', error);
    return NextResponse.json(
      { error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
