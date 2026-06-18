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

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// GET /api/jikan/anime/[id] - Get anime details from Jikan API
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await paramsSchema.parseAsync(await params);

  try {
    await rateLimit();

    const response = await fetch(`${JIKAN_BASE_URL}/anime/${id}/full`);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Anime not found on MyAnimeList' },
          { status: 404 }
        );
      }
      if (response.status === 429) {
        return NextResponse.json(
          { error: 'Rate limited. Please wait a moment and try again.' },
          { status: 429 }
        );
      }
      throw new Error(`Jikan API error: ${response.status}`);
    }

    const json = await response.json();
    const anime = json.data;

    const result = {
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
      source: anime.source,
      studios: anime.studios?.map((s: any) => ({ malId: s.mal_id, name: s.name })) || [],
      genres: anime.genres?.map((g: any) => ({ malId: g.mal_id, name: g.name, url: g.url })) || [],
      themes: anime.themes?.map((t: any) => ({ malId: t.mal_id, name: t.name, url: t.url })) || [],
      demographics: anime.demographics?.map((d: any) => ({ malId: d.mal_id, name: d.name })) || [],
      synopsis: anime.synopsis,
      background: anime.background,
      premiered: anime.premiered,
      broadcast: anime.broadcast?.string,
      url: anime.url,
      relations: anime.relations?.map((rel: any) => ({
        relation: rel.relation,
        entries: rel.entry
          .filter((e: any) => e.type === 'anime')
          .map((e: any) => ({
            malId: e.mal_id,
            title: e.name,
            url: e.url,
            imageUrl: e.images?.jpg?.image_url,
          })),
      })) || [],
      characters: anime.characters?.slice(0, 10).map((c: any) => ({
        malId: c.mal_id,
        name: c.name,
        nameKanji: c.name_kanji,
        imageUrl: c.images?.jpg?.image_url,
        role: c.role,
        voiceActors: c.voice_actors?.slice(0, 3).map((va: any) => ({
          name: va.name,
          imageUrl: va.images?.jpg?.image_url,
          language: va.language,
        })),
      })) || [],
      streaming: anime.streaming?.map((s: any) => ({ name: s.name, url: s.url })) || [],
      external: anime.external?.map((e: any) => ({ name: e.name, url: e.url })) || [],
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error(`GET /api/jikan/anime/${id} error:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch anime details', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
