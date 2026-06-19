import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/neighborhood - Get related anime (graph neighborhood)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const limit = parseInt(searchParams.get('limit') || '10');
  const depth = parseInt(searchParams.get('depth') || '1');

  if (!id) {
    return NextResponse.json(
      { error: 'id parameter is required' },
      { status: 400 }
    );
  }

  try {
    // Get the source anime
    const { data: sourceAnime } = await supabase
      .from('Anime')
      .select(`
        *,
        AnimeStudio(studio:Studio(*)),
        AnimeGenre(genre:Genre(*)),
        AnimeTheme(theme:Theme(*))
      `)
      .eq('id', id)
      .single();

    if (!sourceAnime) {
      return NextResponse.json(
        { error: 'Anime not found' },
        { status: 404 }
      );
    }

    // Extract genres, studios, themes
    const sourceGenres = sourceAnime.AnimeGenre?.map((g: any) => g.genre?.id) || [];
    const sourceStudios = sourceAnime.AnimeStudio?.map((s: any) => s.studio?.id) || [];
    const sourceThemes = sourceAnime.AnimeTheme?.map((t: any) => t.theme?.id) || [];

    // Find related anime by fetching IDs from join tables first
    const candidateAnimeIds = new Set<string>();

    if (sourceGenres.length > 0) {
      const { data: genreMatches } = await supabase
        .from('AnimeGenre')
        .select('animeId')
        .in('genreId', sourceGenres)
        .limit(200);
      genreMatches?.forEach((m: any) => candidateAnimeIds.add(m.animeId));
    }

    if (sourceStudios.length > 0) {
      const { data: studioMatches } = await supabase
        .from('AnimeStudio')
        .select('animeId')
        .in('studioId', sourceStudios)
        .limit(100);
      studioMatches?.forEach((m: any) => candidateAnimeIds.add(m.animeId));
    }

    if (sourceThemes.length > 0) {
      const { data: themeMatches } = await supabase
        .from('AnimeTheme')
        .select('animeId')
        .in('themeId', sourceThemes)
        .limit(100);
      themeMatches?.forEach((m: any) => candidateAnimeIds.add(m.animeId));
    }

    // Remove source anime ID
    candidateAnimeIds.delete(id);

    // Fetch the candidate anime
    const candidateIdsArray = Array.from(candidateAnimeIds).slice(0, 80);
    
    let relatedAnime: any[] = [];
    if (candidateIdsArray.length > 0) {
      const { data } = await supabase
        .from('Anime')
        .select(`
          *,
          AnimeStudio(studio:Studio(*)),
          AnimeGenre(genre:Genre(*)),
          AnimeTheme(theme:Theme(*))
        `)
        .in('id', candidateIdsArray);
      
      relatedAnime = data || [];
    }

    // Calculate relationship scores
    const scoredRelated = (relatedAnime || [])
      .map((anime) => {
        let score = 0;
        const relations: string[] = [];

        const animeGenres = anime.AnimeGenre?.map((g: any) => g.genre?.id) || [];
        const animeStudios = anime.AnimeStudio?.map((s: any) => s.studio?.id) || [];
        const animeThemes = anime.AnimeTheme?.map((t: any) => t.theme?.id) || [];

        // Genre matches
        const genreMatches = sourceGenres.filter((g: string) => animeGenres.includes(g));
        score += genreMatches.length * 3;
        genreMatches.forEach(() => relations.push('genre'));

        // Studio matches
        const studioMatches = sourceStudios.filter((s: string) => animeStudios.includes(s));
        score += studioMatches.length * 2;
        studioMatches.forEach(() => relations.push('studio'));

        // Theme matches
        const themeMatches = sourceThemes.filter((t: string) => animeThemes.includes(t));
        score += themeMatches.length * 2;
        themeMatches.forEach(() => relations.push('theme'));

        return {
          anime,
          score,
          relations: [...new Set(relations)],
          matchCount: genreMatches.length + studioMatches.length + themeMatches.length,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return NextResponse.json({
      source: {
        id: sourceAnime.id,
        title: sourceAnime.title,
        imageUrl: sourceAnime.imageUrl,
        genres: sourceAnime.AnimeGenre?.map((g: any) => g.genre?.name) || [],
        studios: sourceAnime.AnimeStudio?.map((s: any) => s.studio?.name) || [],
        themes: sourceAnime.AnimeTheme?.map((t: any) => t.theme?.name) || [],
      },
      related: scoredRelated.map((item) => ({
        id: item.anime.id,
        title: item.anime.title,
        imageUrl: item.anime.imageUrl,
        score: item.anime.score,
        year: item.anime.year,
        type: item.anime.type,
        matchScore: item.score,
        relations: item.relations,
        genres: item.anime.AnimeGenre?.map((g: any) => g.genre?.name) || [],
        studios: item.anime.AnimeStudio?.map((s: any) => s.studio?.name) || [],
      })),
    });
  } catch (error) {
    console.error('GET /api/neighborhood error:', error);
    return NextResponse.json(
      { error: 'Failed to get neighborhood', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
