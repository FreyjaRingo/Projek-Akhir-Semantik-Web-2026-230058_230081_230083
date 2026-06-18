import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

const updateAnimeSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  titleEnglish: z.string().max(500).optional().nullable(),
  titleJapanese: z.string().max(500).optional().nullable(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  score: z.number().min(0).max(10).optional().nullable(),
  scoredBy: z.number().int().min(0).optional().nullable(),
  rank: z.number().int().min(0).optional().nullable(),
  popularity: z.number().int().min(0).optional().nullable(),
  episodes: z.number().int().min(0).optional().nullable(),
  duration: z.number().int().min(0).optional().nullable(),
  type: z.enum(['TV', 'MOVIE', 'OVA', 'SPECIAL', 'ONA', 'MUSIC']).optional(),
  status: z.enum(['AIRING', 'COMPLETED', 'TO_BE_AIRED', 'CANCELLED', 'HIATUS']).optional(),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  season: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  malId: z.number().int().positive().optional().nullable(),
  studios: z.array(z.string()).optional(),
  genres: z.array(z.string()).optional(),
  themes: z.array(z.string()).optional(),
});

// GET /api/anime/[id] - Get single anime
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    const { data: anime, error } = await supabase
      .from('Anime')
      .select(`
        *,
        AnimeStudio(studio:Studio(*)),
        AnimeGenre(genre:Genre(*)),
        AnimeTheme(theme:Theme(*)),
        Character(*)
      `)
      .eq('id', id)
      .single();

    if (error || !anime) {
      return NextResponse.json({ error: 'Anime not found' }, { status: 404 });
    }

    // Transform response
    const response = {
      id: anime.id,
      malId: anime.malId,
      title: anime.title,
      titleEnglish: anime.titleEnglish,
      titleJapanese: anime.titleJapanese,
      description: anime.description,
      imageUrl: anime.imageUrl,
      score: anime.score,
      scoredBy: anime.scoredBy,
      rank: anime.rank,
      popularity: anime.popularity,
      episodes: anime.episodes,
      duration: anime.duration,
      type: anime.type,
      status: anime.status,
      year: anime.year,
      season: anime.season,
      source: anime.source,
      rating: anime.rating,
      broadcast: anime.broadcast,
      studios: anime.AnimeStudio?.map((s: any) => ({
        name: s.studio?.name,
        isMain: s.isMain,
      })) || [],
      genres: anime.AnimeGenre?.map((g: any) => g.genre?.name).filter(Boolean) || [],
      themes: anime.AnimeTheme?.map((t: any) => t.theme?.name).filter(Boolean) || [],
      characters: anime.Character || [],
      createdAt: anime.createdAt,
      updatedAt: anime.updatedAt,
      lastSyncedAt: anime.lastSyncedAt,
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error('GET /api/anime/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch anime', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT /api/anime/[id] - Update anime
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    // Check if anime exists
    const { data: existing } = await supabase
      .from('Anime')
      .select('id')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Anime not found' }, { status: 404 });
    }

    const body = await request.json();
    const validated = updateAnimeSchema.parse(body);

    // Update studios
    if (validated.studios) {
      // Delete existing
      await supabase.from('AnimeStudio').delete().eq('animeId', id);

      // Add new ones
      for (const name of validated.studios) {
        const { data: studio } = await supabase
          .from('Studio')
          .upsert({ name }, { onConflict: 'name' })
          .select()
          .single();

        if (studio) {
          await supabase.from('AnimeStudio').insert({
            animeId: id,
            studioId: studio.id,
            isMain: true,
          });
        }
      }
    }

    // Update genres
    if (validated.genres) {
      await supabase.from('AnimeGenre').delete().eq('animeId', id);

      for (const name of validated.genres) {
        const { data: genre } = await supabase
          .from('Genre')
          .upsert({ name }, { onConflict: 'name' })
          .select()
          .single();

        if (genre) {
          await supabase.from('AnimeGenre').insert({
            animeId: id,
            genreId: genre.id,
          });
        }
      }
    }

    // Update themes
    if (validated.themes) {
      await supabase.from('AnimeTheme').delete().eq('animeId', id);

      for (const name of validated.themes) {
        const { data: theme } = await supabase
          .from('Theme')
          .upsert({ name }, { onConflict: 'name' })
          .select()
          .single();

        if (theme) {
          await supabase.from('AnimeTheme').insert({
            animeId: id,
            themeId: theme.id,
          });
        }
      }
    }

    // Update anime fields
    const { studios, genres, themes, ...updateData } = validated;

    const { data: anime, error } = await supabase
      .from('Anime')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      message: 'Anime updated successfully',
      data: anime,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    console.error('PUT /api/anime/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to update anime', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/anime/[id] - Delete anime
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    const { error } = await supabase
      .from('Anime')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      message: 'Anime deleted successfully',
      deletedId: id,
    });
  } catch (error) {
    console.error('DELETE /api/anime/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete anime', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
