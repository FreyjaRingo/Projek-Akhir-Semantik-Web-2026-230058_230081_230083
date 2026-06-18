import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/analytics/top-connected - Get top connected anime
export async function GET() {
  try {
    // Get anime with their relation counts
    const { data: animeWithRelations } = await supabase
      .from('Anime')
      .select(`
        id,
        title,
        imageUrl,
        score,
        year,
        type,
        AnimeStudio(studio:Studio(*)),
        AnimeGenre(genre:Genre(*)),
        AnimeTheme(theme:Theme(*))
      `)
      .not('lastSyncedAt', 'is', null)
      .order('score', { ascending: false })
      .limit(100);

    // Calculate connection score for each anime
    const scoredAnime = (animeWithRelations || []).map((anime) => {
      const genreCount = anime.AnimeGenre?.length || 0;
      const studioCount = anime.AnimeStudio?.length || 0;
      const themeCount = anime.AnimeTheme?.length || 0;
      const connectionScore = genreCount + studioCount + themeCount;

      return {
        id: anime.id,
        title: anime.title,
        imageUrl: anime.imageUrl,
        score: anime.score,
        year: anime.year,
        type: anime.type,
        genres: anime.AnimeGenre?.map((g: any) => g.genre?.name) || [],
        studios: anime.AnimeStudio?.map((s: any) => s.studio?.name) || [],
        themes: anime.AnimeTheme?.map((t: any) => t.theme?.name) || [],
        connectionScore,
        genreCount,
        studioCount,
        themeCount,
      };
    });

    // Sort by connection score
    const topConnected = scoredAnime
      .sort((a, b) => b.connectionScore - a.connectionScore)
      .slice(0, 20);

    // Get genre distribution
    const allGenres = scoredAnime.flatMap((a) => a.genres);
    const genreCounts: Record<string, number> = {};
    allGenres.forEach((g) => {
      genreCounts[g] = (genreCounts[g] || 0) + 1;
    });
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Get type distribution
    const typeCounts: Record<string, number> = {};
    scoredAnime.forEach((a) => {
      typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
    });
    const typeDistribution = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));

    // Get year distribution
    const yearCounts: Record<string, number> = {};
    scoredAnime.forEach((a) => {
      if (a.year) {
        const decade = Math.floor(a.year / 10) * 10;
        const key = `${decade}s`;
        yearCounts[key] = (yearCounts[key] || 0) + 1;
      }
    });
    const yearDistribution = Object.entries(yearCounts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([decade, count]) => ({ decade, count }));

    return NextResponse.json({
      topConnected,
      stats: {
        totalAnime: scoredAnime.length,
        avgConnectionScore: scoredAnime.length > 0
          ? Math.round(scoredAnime.reduce((sum, a) => sum + a.connectionScore, 0) / scoredAnime.length)
          : 0,
      },
      distributions: {
        genres: topGenres,
        types: typeDistribution,
        years: yearDistribution,
      },
    });
  } catch (error) {
    console.error('GET /api/analytics/top-connected error:', error);
    return NextResponse.json(
      { error: 'Failed to get analytics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
