import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

const compareSchema = z.object({
  id1: z.string().min(1),
  id2: z.string().min(1),
});

// GET /api/compare - Compare two anime entities
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id1 = searchParams.get('id1');
  const id2 = searchParams.get('id2');

  if (!id1 || !id2) {
    return NextResponse.json(
      { error: 'Both id1 and id2 parameters are required' },
      { status: 400 }
    );
  }

  try {
    // Fetch both anime with their relations
    const [{ data: anime1 }, { data: anime2 }] = await Promise.all([
      supabase
        .from('Anime')
        .select(`
          *,
          AnimeStudio(studio:Studio(*)),
          AnimeGenre(genre:Genre(*)),
          AnimeTheme(theme:Theme(*))
        `)
        .eq('id', id1)
        .single(),
      supabase
        .from('Anime')
        .select(`
          *,
          AnimeStudio(studio:Studio(*)),
          AnimeGenre(genre:Genre(*)),
          AnimeTheme(theme:Theme(*))
        `)
        .eq('id', id2)
        .single(),
    ]);

    if (!anime1 || !anime2) {
      return NextResponse.json(
        { error: 'One or both anime not found' },
        { status: 404 }
      );
    }

    // Extract attributes for comparison
    const attrs1 = {
      genres: anime1.AnimeGenre?.map((g: any) => g.genre?.name) || [],
      studios: anime1.AnimeStudio?.map((s: any) => s.studio?.name) || [],
      themes: anime1.AnimeTheme?.map((t: any) => t.theme?.name) || [],
      type: anime1.type,
      year: anime1.year,
      score: anime1.score,
      episodes: anime1.episodes,
    };

    const attrs2 = {
      genres: anime2.AnimeGenre?.map((g: any) => g.genre?.name) || [],
      studios: anime2.AnimeStudio?.map((s: any) => s.studio?.name) || [],
      themes: anime2.AnimeTheme?.map((t: any) => t.theme?.name) || [],
      type: anime2.type,
      year: anime2.year,
      score: anime2.score,
      episodes: anime2.episodes,
    };

    // Find common and different attributes
    const commonGenres = attrs1.genres.filter((g: string) => attrs2.genres.includes(g));
    const commonStudios = attrs1.studios.filter((s: string) => attrs2.studios.includes(s));
    const commonThemes = attrs1.themes.filter((t: string) => attrs2.themes.includes(t));

    const uniqueGenres1 = attrs1.genres.filter((g: string) => !attrs2.genres.includes(g));
    const uniqueGenres2 = attrs2.genres.filter((g: string) => !attrs1.genres.includes(g));
    const uniqueStudios1 = attrs1.studios.filter((s: string) => !attrs2.studios.includes(s));
    const uniqueStudios2 = attrs2.studios.filter((s: string) => !attrs1.studios.includes(s));
    const uniqueThemes1 = attrs1.themes.filter((t: string) => !attrs2.themes.includes(t));
    const uniqueThemes2 = attrs2.themes.filter((t: string) => !attrs1.themes.includes(t));

    // Calculate similarity score
    const allAttrs1 = [...attrs1.genres, ...attrs1.studios, ...attrs1.themes];
    const allAttrs2 = [...attrs2.genres, ...attrs2.studios, ...attrs2.themes];
    const commonCount = [...commonGenres, ...commonStudios, ...commonThemes].length;
    const totalCount = new Set([...allAttrs1, ...allAttrs2]).size;
    const similarityScore = totalCount > 0 ? (commonCount / totalCount) * 100 : 0;

    return NextResponse.json({
      anime1: {
        id: anime1.id,
        title: anime1.title,
        imageUrl: anime1.imageUrl,
        score: anime1.score,
        ...attrs1,
      },
      anime2: {
        id: anime2.id,
        title: anime2.title,
        imageUrl: anime2.imageUrl,
        score: anime2.score,
        ...attrs2,
      },
      comparison: {
        commonGenres,
        commonStudios,
        commonThemes,
        uniqueGenres1,
        uniqueGenres2,
        uniqueStudios1,
        uniqueStudios2,
        uniqueThemes1,
        uniqueThemes2,
        similarityScore: Math.round(similarityScore),
      },
    });
  } catch (error) {
    console.error('GET /api/compare error:', error);
    return NextResponse.json(
      { error: 'Comparison failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
