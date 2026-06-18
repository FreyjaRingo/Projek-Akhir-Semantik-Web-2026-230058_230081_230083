import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

// Validation schemas
const createAnimeSchema = z.object({
  title: z.string().min(1).max(500),
  titleEnglish: z.string().max(500).optional(),
  titleJapanese: z.string().max(500).optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  score: z.number().min(0).max(10).optional(),
  episodes: z.number().int().min(0).optional(),
  duration: z.number().int().min(0).optional(),
  type: z.enum(['TV', 'MOVIE', 'OVA', 'SPECIAL', 'ONA', 'MUSIC']).optional(),
  status: z.enum(['AIRING', 'COMPLETED', 'TO_BE_AIRED', 'CANCELLED', 'HIATUS']).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  season: z.string().optional(),
  source: z.string().optional(),
  malId: z.number().int().positive().optional(),
  studios: z.array(z.string()).optional(),
  genres: z.array(z.string()).optional(),
  themes: z.array(z.string()).optional(),
});

const updateAnimeSchema = createAnimeSchema.partial();

// GET /api/anime - List all anime with pagination
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Pagination
  const page = Math.max(parseInt(searchParams.get('page') || '1') || 1, 1);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20') || 20, 1), 100);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // Filters
  const type = searchParams.get('type');
  const status = searchParams.get('status');
  const genre = searchParams.get('genre');
  const studio = searchParams.get('studio');
  const yearMin = searchParams.get('year_min');
  const yearMax = searchParams.get('year_max');
  const scoreMin = searchParams.get('score_min');
  const scoreMax = searchParams.get('score_max');
  const search = searchParams.get('q');
  const sortBy = searchParams.get('sort_by') || 'score';
  const sortOrder = searchParams.get('sort_order') || 'desc';

  try {
    let query = supabase
      .from('Anime')
      .select(`
        *,
        AnimeStudio(studio:Studio(*)),
        AnimeGenre(genre:Genre(*)),
        AnimeTheme(theme:Theme(*))
      `, { count: 'exact' });

    // Apply filters
    if (type) query = query.eq('type', type);
    if (status) query = query.eq('status', status);
    if (yearMin) query = query.gte('year', parseInt(yearMin));
    if (yearMax) query = query.lte('year', parseInt(yearMax));
    if (scoreMin) query = query.gte('score', parseFloat(scoreMin));
    if (scoreMax) query = query.lte('score', parseFloat(scoreMax));

    if (search) {
      const safeSearch = search.replace(/[%_,().]/g, ' ').trim().slice(0, 100);
      if (safeSearch) query = query.or(`title.ilike.%${safeSearch}%,titleEnglish.ilike.%${safeSearch}%`);
    }

    // Sorting
    if (sortBy === 'title') {
      query = query.order('title', { ascending: sortOrder === 'asc' });
    } else if (sortBy === 'year') {
      query = query.order('year', { ascending: sortOrder === 'asc', nullsFirst: false });
    } else if (sortBy === 'popularity') {
      query = query.order('popularity', { ascending: sortOrder === 'asc', nullsFirst: false });
    } else {
      query = query.order('score', { ascending: sortOrder === 'asc', nullsFirst: false });
    }

    // Pagination
    query = query.range(from, to);

    const { data: anime, error, count } = await query;

    if (error) throw error;

    // Transform response
    const transformedAnime = (anime || []).map((a: any) => ({
      id: a.id,
      malId: a.malId,
      title: a.title,
      titleEnglish: a.titleEnglish,
      description: a.description,
      imageUrl: a.imageUrl,
      score: a.score,
      episodes: a.episodes,
      type: a.type,
      status: a.status,
      year: a.year,
      studios: a.AnimeStudio?.map((s: any) => s.studio?.name).filter(Boolean) || [],
      genres: a.AnimeGenre?.map((g: any) => g.genre?.name).filter(Boolean) || [],
      themes: a.AnimeTheme?.map((t: any) => t.theme?.name).filter(Boolean) || [],
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));

    return NextResponse.json({
      data: transformedAnime,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasNext: page * limit < (count || 0),
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('GET /api/anime error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch anime', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/anime - Create new anime
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createAnimeSchema.parse(body);

    // Create anime
    const { data: anime, error: animeError } = await supabase
      .from('Anime')
      .insert({
        title: validated.title,
        titleEnglish: validated.titleEnglish,
        titleJapanese: validated.titleJapanese,
        description: validated.description,
        imageUrl: validated.imageUrl,
        score: validated.score,
        episodes: validated.episodes,
        duration: validated.duration,
        type: validated.type || 'TV',
        status: validated.status || 'AIRING',
        year: validated.year,
        season: validated.season,
        source: validated.source,
        malId: validated.malId,
      })
      .select()
      .single();

    if (animeError) throw animeError;

    // Add studios
    for (const studioName of validated.studios || []) {
      // Upsert studio
      const { data: studio } = await supabase
        .from('Studio')
        .upsert({ name: studioName }, { onConflict: 'name' })
        .select()
        .single();

      if (studio) {
        await supabase.from('AnimeStudio').insert({
          animeId: anime.id,
          studioId: studio.id,
          isMain: true,
        });
      }
    }

    // Add genres
    for (const genreName of validated.genres || []) {
      const { data: genre } = await supabase
        .from('Genre')
        .upsert({ name: genreName }, { onConflict: 'name' })
        .select()
        .single();

      if (genre) {
        await supabase.from('AnimeGenre').insert({
          animeId: anime.id,
          genreId: genre.id,
        });
      }
    }

    // Add themes
    for (const themeName of validated.themes || []) {
      const { data: theme } = await supabase
        .from('Theme')
        .upsert({ name: themeName }, { onConflict: 'name' })
        .select()
        .single();

      if (theme) {
        await supabase.from('AnimeTheme').insert({
          animeId: anime.id,
          themeId: theme.id,
        });
      }
    }

    return NextResponse.json(
      {
        message: 'Anime created successfully',
        data: anime,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    console.error('POST /api/anime error:', error);
    return NextResponse.json(
      { error: 'Failed to create anime', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
