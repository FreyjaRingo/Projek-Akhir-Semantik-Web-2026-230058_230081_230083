import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Grounded Question Answering based on RDF facts
// Each answer shows the RDF facts that ground it

interface QAResult {
  question: string;
  answer: string;
  intent: string;
  confidence: number;
  grounding: {
    anime: string;
    fact: string;
    source: string;
  }[];
  relatedAnime?: {
    id: string;
    title: string;
    score: number | null;
    imageUrl: string | null;
  }[];
}

type IntentType =
  | 'genre_search'
  | 'studio_search'
  | 'year_search'
  | 'recommendation'
  | 'character_search'
  | 'theme_search'
  | 'similar_anime'
  | 'description'
  | 'unknown';

// Intent patterns
const intentPatterns: { intent: IntentType; patterns: RegExp[] }[] = [
  {
    intent: 'genre_search',
    patterns: [
      /genre/i,
      /yang bergenre/i,
      /bertema/i,
      /bergenre/i,
      /genre\s+(\w+)/i,
    ]
  },
  {
    intent: 'studio_search',
    patterns: [
      /diproduksi\s+oleh/i,
      /studio\s+(\w+)/i,
      /dari\s+studio/i,
      /by\s+studio/i,
      /made\s+by/i,
    ]
  },
  {
    intent: 'character_search',
    patterns: [
      /karakter/i,
      /character/i,
      /muncul\s+di/i,
      /appears?\s+(in|on)/i,
    ]
  },
  {
    intent: 'theme_search',
    patterns: [
      /theme/i,
      /tema/i,
      /hastheme/i,
    ]
  },
  {
    intent: 'year_search',
    patterns: [
      /tahun\s+(\d{4})/i,
      /year\s+(\d{4})/i,
      /release\s+(\d{4})/i,
    ]
  },
  {
    intent: 'recommendation',
    patterns: [
      /rekomendasi/i,
      /recommend/i,
      /similar/i,
      /mirip/i,
      /like\s+(\w+)/i,
    ]
  },
  {
    intent: 'description',
    patterns: [
      /apa\s+itu/i,
      /what\s+is/i,
      /deskripsi/i,
      /sinopsis/i,
      /description/i,
    ]
  },
];

function detectIntent(question: string): IntentType {
  for (const { intent, patterns } of intentPatterns) {
    for (const pattern of patterns) {
      if (pattern.test(question)) {
        return intent;
      }
    }
  }
  return 'unknown';
}

function extractEntity(question: string, intent: IntentType): string | null {
  // Extract anime name from question
  const animeMatch = question.match(/(?:anime\s+)?(.+?)(?:\s+(?:yang|yang\s+diproduksi|yang\s+bergenre|yang\s+muncul|$))/i);
  if (animeMatch) {
    return animeMatch[1].trim();
  }
  return null;
}

function extractYear(question: string): number | null {
  const yearMatch = question.match(/(?:tahun|year)\s*(\d{4})/i);
  return yearMatch ? parseInt(yearMatch[1]) : null;
}

// GET /api/qa - Grounded Question Answering
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const question = searchParams.get('q')?.trim() || '';

  if (!question || question.length < 3) {
    return NextResponse.json(
      { ok: false, error: 'Question must be at least 3 characters' },
      { status: 400 }
    );
  }

  if (question.length > 200) {
    return NextResponse.json(
      { ok: false, error: 'Question must be at most 200 characters' },
      { status: 400 }
    );
  }

  try {
    const intent = detectIntent(question);
    const entityName = extractEntity(question, intent);
    const year = extractYear(question);

    let result: QAResult;

    switch (intent) {
      case 'genre_search':
        result = await handleGenreSearch(question, entityName, year);
        break;
      case 'studio_search':
        result = await handleStudioSearch(question, entityName);
        break;
      case 'character_search':
        result = await handleCharacterSearch(question, entityName);
        break;
      case 'theme_search':
        result = await handleThemeSearch(question, entityName);
        break;
      case 'year_search':
        result = await handleYearSearch(question, year);
        break;
      case 'recommendation':
        result = await handleRecommendation(question, entityName);
        break;
      case 'description':
        result = await handleDescription(question, entityName);
        break;
      default:
        result = await handleGeneralSearch(question);
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('GET /api/qa error:', error);
    return NextResponse.json(
      { ok: false, error: 'Question answering failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function handleGenreSearch(question: string, entityName: string | null, year: number | null): Promise<QAResult> {
  const grounding: QAResult['grounding'] = [];
  let query = supabase
    .from('Anime')
    .select(`
      id, title, score, imageUrl, year,
      AnimeGenre(genre:Genre(id, name))
    `)
    .not('lastSyncedAt', 'is', null);

  // Extract genre from question
  const genreMatch = question.match(/genre\s+(\w+)|bertema\s+(\w+)/i);
  const genreName = genreMatch ? (genreMatch[1] || genreMatch[2]) : null;

  if (genreName) {
    query = query.contains('AnimeGenre.genre.name', genreName);
  }

  if (year) {
    query = query.eq('year', year);
  }

  const { data: animeList } = await query.limit(20);

  // Build grounding facts
  for (const anime of animeList || []) {
    const genres = (anime as any).AnimeGenre?.map((ag: any) => ag.genre?.name).filter(Boolean) || [];
    grounding.push({
      anime: anime.title,
      fact: `hasGenre: ${genres.join(', ')}`,
      source: 'RDF Graph'
    });
  }

  const answer = animeList && animeList.length > 0
    ? `Ditemukan ${animeList.length} anime${genreName ? ` dengan genre "${genreName}"` : ''}${year ? ` dari tahun ${year}` : ''}`
    : `Tidak ada anime yang cocok dengan kriteria tersebut`;

  return {
    question,
    answer,
    intent: 'genre_search',
    confidence: animeList && animeList.length > 0 ? 0.9 : 0.5,
    grounding,
    relatedAnime: animeList?.slice(0, 5).map(a => ({
      id: a.id,
      title: a.title,
      score: a.score,
      imageUrl: a.imageUrl
    }))
  };
}

async function handleStudioSearch(question: string, entityName: string | null): Promise<QAResult> {
  const grounding: QAResult['grounding'] = [];

  // Extract studio name
  const studioMatch = question.match(/studio\s+(\w+)|diproduksi\s+oleh\s+(\w+)/i);
  const studioName = studioMatch ? (studioMatch[1] || studioMatch[2]) : entityName;

  let query = supabase
    .from('Anime')
    .select(`
      id, title, score, imageUrl, year,
      AnimeStudio(studio:Studio(id, name))
    `)
    .not('lastSyncedAt', 'is', null);

  if (studioName) {
    query = query.contains('AnimeStudio.studio.name', studioName);
  }

  const { data: animeList } = await query.limit(20);

  // Build grounding facts
  for (const anime of animeList || []) {
    const studios = (anime as any).AnimeStudio?.map((as: any) => as.studio?.name).filter(Boolean) || [];
    grounding.push({
      anime: anime.title,
      fact: `producedBy: ${studios.join(', ')}`,
      source: 'RDF Graph'
    });
  }

  const answer = animeList && animeList.length > 0
    ? `Ditemukan ${animeList.length} anime${studioName ? ` yang diproduksi oleh "${studioName}"` : ''}`
    : `Tidak ada anime dari studio tersebut`;

  return {
    question,
    answer,
    intent: 'studio_search',
    confidence: animeList && animeList.length > 0 ? 0.9 : 0.5,
    grounding,
    relatedAnime: animeList?.slice(0, 5).map(a => ({
      id: a.id,
      title: a.title,
      score: a.score,
      imageUrl: a.imageUrl
    }))
  };
}

async function handleCharacterSearch(question: string, entityName: string | null): Promise<QAResult> {
  const grounding: QAResult['grounding'] = [];

  // Extract character name
  const charMatch = question.match(/karakter\s+(.+?)(?:\s+yang|\s+muncul|$)/i);
  const charName = charMatch ? charMatch[1].trim() : entityName;

  let query = supabase
    .from('Anime')
    .select(`
      id, title, score, imageUrl,
      Character(id, name, role)
    `)
    .not('lastSyncedAt', 'is', null);

  if (charName) {
    query = query.ilike('Character.name', `%${charName}%`);
  }

  const { data: animeList } = await query.limit(20);

  // Build grounding facts
  for (const anime of animeList || []) {
    const characters = (anime as any).Character?.map((c: any) => `${c.name} (${c.role})`).filter(Boolean) || [];
    grounding.push({
      anime: anime.title,
      fact: `featuresCharacter: ${characters.join(', ')}`,
      source: 'RDF Graph'
    });
  }

  const answer = animeList && animeList.length > 0
    ? `Ditemukan ${animeList.length} anime${charName ? ` dengan karakter "${charName}"` : ''}`
    : `Tidak ada anime dengan karakter tersebut`;

  return {
    question,
    answer,
    intent: 'character_search',
    confidence: animeList && animeList.length > 0 ? 0.85 : 0.5,
    grounding,
    relatedAnime: animeList?.slice(0, 5).map(a => ({
      id: a.id,
      title: a.title,
      score: a.score,
      imageUrl: a.imageUrl
    }))
  };
}

async function handleThemeSearch(question: string, entityName: string | null): Promise<QAResult> {
  const grounding: QAResult['grounding'] = [];

  const themeMatch = question.match(/tema\s+(\w+)|theme\s+(\w+)/i);
  const themeName = themeMatch ? (themeMatch[1] || themeMatch[2]) : entityName;

  let query = supabase
    .from('Anime')
    .select(`
      id, title, score, imageUrl,
      AnimeTheme(theme:Theme(id, name))
    `)
    .not('lastSyncedAt', 'is', null);

  if (themeName) {
    query = query.contains('AnimeTheme.theme.name', themeName);
  }

  const { data: animeList } = await query.limit(20);

  for (const anime of animeList || []) {
    const themes = (anime as any).AnimeTheme?.map((at: any) => at.theme?.name).filter(Boolean) || [];
    grounding.push({
      anime: anime.title,
      fact: `hasTheme: ${themes.join(', ')}`,
      source: 'RDF Graph'
    });
  }

  const answer = animeList && animeList.length > 0
    ? `Ditemukan ${animeList.length} anime dengan tema "${themeName || 'tertentu'}"${entityName ? ` di "${entityName}"` : ''}`
    : `Tidak ada anime dengan tema tersebut`;

  return {
    question,
    answer,
    intent: 'theme_search',
    confidence: animeList && animeList.length > 0 ? 0.85 : 0.5,
    grounding,
    relatedAnime: animeList?.slice(0, 5).map(a => ({
      id: a.id,
      title: a.title,
      score: a.score,
      imageUrl: a.imageUrl
    }))
  };
}

async function handleYearSearch(question: string, year: number | null): Promise<QAResult> {
  const grounding: QAResult['grounding'] = [];

  const { data: animeList } = await supabase
    .from('Anime')
    .select(`id, title, score, imageUrl, year, type`)
    .eq('year', year || new Date().getFullYear())
    .not('lastSyncedAt', 'is', null)
    .order('score', { ascending: false })
    .limit(20);

  for (const anime of animeList || []) {
    grounding.push({
      anime: anime.title,
      fact: `releaseYear: ${anime.year}, format: ${anime.type}`,
      source: 'RDF Graph'
    });
  }

  const answer = animeList && animeList.length > 0
    ? `Ditemukan ${animeList.length} anime dari tahun ${year || new Date().getFullYear()}`
    : `Tidak ada anime dari tahun tersebut`;

  return {
    question,
    answer,
    intent: 'year_search',
    confidence: animeList && animeList.length > 0 ? 0.95 : 0.5,
    grounding,
    relatedAnime: animeList?.slice(0, 5).map(a => ({
      id: a.id,
      title: a.title,
      score: a.score,
      imageUrl: a.imageUrl
    }))
  };
}

async function handleRecommendation(question: string, entityName: string | null): Promise<QAResult> {
  const grounding: QAResult['grounding'] = [];

  // Find anime similar to the given one
  if (entityName) {
    const { data: sourceAnime } = await supabase
      .from('Anime')
      .select(`
        id, title,
        AnimeGenre(genre:Genre(id)),
        AnimeStudio(studio:Studio(id)),
        AnimeTheme(theme:Theme(id))
      `)
      .ilike('title', `%${entityName}%`)
      .limit(1)
      .single();

    if (sourceAnime) {
      const sourceGenres = (sourceAnime as any).AnimeGenre?.map((ag: any) => ag.genre?.id) || [];
      const sourceStudios = (sourceAnime as any).AnimeStudio?.map((as: any) => as.studio?.id) || [];
      const sourceThemes = (sourceAnime as any).AnimeTheme?.map((at: any) => at.theme?.id) || [];

      // Find similar anime
      const { data: allAnime } = await supabase
        .from('Anime')
        .select(`
          id, title, score, imageUrl,
          AnimeGenre(genre:Genre(id, name)),
          AnimeStudio(studio:Studio(id, name)),
          AnimeTheme(theme:Theme(id, name))
        `)
        .neq('id', sourceAnime.id)
        .not('lastSyncedAt', 'is', null)
        .limit(50);

      // Score by similarity
      const scored = (allAnime || []).map((anime: any) => {
        const genres = anime.AnimeGenre?.map((ag: any) => ag.genre?.id) || [];
        const studios = anime.AnimeStudio?.map((as: any) => as.studio?.id) || [];
        const themes = anime.AnimeTheme?.map((at: any) => at.theme?.id) || [];

        const genreMatch = genres.filter((g: string) => sourceGenres.includes(g)).length;
        const studioMatch = studios.filter((s: string) => sourceStudios.includes(s)).length;
        const themeMatch = themes.filter((t: string) => sourceThemes.includes(t)).length;

        const score = genreMatch * 3 + studioMatch * 2 + themeMatch * 2;

        return { anime, score };
      })
        .filter((item: any) => item.score > 0)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 10);

      grounding.push({
        anime: sourceAnime.title,
        fact: `Reference entity for similarity search`,
        source: 'RDF Graph'
      });

      for (const item of scored) {
        const genres = item.anime.AnimeGenre?.map((ag: any) => ag.genre?.name).filter(Boolean) || [];
        grounding.push({
          anime: item.anime.title,
          fact: `Similarity score: ${item.score} (shared: ${genres.slice(0, 2).join(', ')})`,
          source: 'RDF Graph'
        });
      }

      const answer = scored.length > 0
        ? `Ditemukan ${scored.length} anime yang mirip dengan "${sourceAnime.title}"`
        : `Tidak ada anime yang mirip ditemukan`;

      return {
        question,
        answer,
        intent: 'recommendation',
        confidence: scored.length > 0 ? 0.8 : 0.4,
        grounding,
        relatedAnime: scored.slice(0, 5).map((item: any) => ({
          id: item.anime.id,
          title: item.anime.title,
          score: item.anime.score,
          imageUrl: item.anime.imageUrl
        }))
      };
    }
  }

  // Default: return top rated anime
  const { data: topAnime } = await supabase
    .from('Anime')
    .select('id, title, score, imageUrl')
    .not('lastSyncedAt', 'is', null)
    .order('score', { ascending: false })
    .limit(10);

  return {
    question,
    answer: 'Berikut rekomendasi anime top rated dari database kami',
    intent: 'recommendation',
    confidence: 0.7,
    grounding: topAnime?.map(a => ({
      anime: a.title,
      fact: `Score: ${a.score}`,
      source: 'RDF Graph'
    })) || [],
    relatedAnime: topAnime?.map(a => ({
      id: a.id,
      title: a.title,
      score: a.score,
      imageUrl: a.imageUrl
    }))
  };
}

async function handleDescription(question: string, entityName: string | null): Promise<QAResult> {
  if (entityName) {
    const { data: anime } = await supabase
      .from('Anime')
      .select(`
        id, title, description, score, year, type, status,
        AnimeGenre(genre:Genre(name)),
        AnimeStudio(studio:Studio(name)),
        AnimeTheme(theme:Theme(name))
      `)
      .ilike('title', `%${entityName}%`)
      .not('lastSyncedAt', 'is', null)
      .limit(1)
      .single();

    if (anime) {
      const genres = (anime as any).AnimeGenre?.map((ag: any) => ag.genre?.name).filter(Boolean) || [];
      const studios = (anime as any).AnimeStudio?.map((as: any) => as.studio?.name).filter(Boolean) || [];
      const themes = (anime as any).AnimeTheme?.map((at: any) => at.theme?.name).filter(Boolean) || [];

      return {
        question,
        answer: anime.description || 'Tidak ada deskripsi tersedia',
        intent: 'description',
        confidence: 0.95,
        grounding: [{
          anime: anime.title,
          fact: `Entity type: ${anime.type}, Format: ${anime.type}, Genre: ${genres.join(', ')}, Studio: ${studios.join(', ')}, Theme: ${themes.join(', ')}`,
          source: 'RDF Graph'
        }],
        relatedAnime: [{
          id: anime.id,
          title: anime.title,
          score: anime.score,
          imageUrl: anime.imageUrl || null
        }]
      };
    }
  }

  return {
    question,
    answer: 'Tidak dapat menemukan anime yang dimaksud. Coba masukkan nama anime yang lebih spesifik.',
    intent: 'description',
    confidence: 0.3,
    grounding: []
  };
}

async function handleGeneralSearch(question: string): Promise<QAResult> {
  // General search - look for anime matching keywords
  const { data: animeList } = await supabase
    .from('Anime')
    .select('id, title, score, imageUrl, description')
    .or(`title.ilike.%${question}%,titleEnglish.ilike.%${question}%`)
    .not('lastSyncedAt', 'is', null)
    .order('score', { ascending: false })
    .limit(10);

  const answer = animeList && animeList.length > 0
    ? `Ditemukan ${animeList.length} anime yang mungkin relevan dengan pertanyaan Anda`
    : 'Tidak ada hasil yang cocok. Coba gunakan kata kunci yang lebih spesifik.';

  return {
    question,
    answer,
    intent: 'unknown',
    confidence: animeList && animeList.length > 0 ? 0.6 : 0.3,
    grounding: animeList?.map(a => ({
      anime: a.title,
      fact: a.description?.slice(0, 100) + '...' || 'No description',
      source: 'RDF Graph'
    })) || [],
    relatedAnime: animeList?.map(a => ({
      id: a.id,
      title: a.title,
      score: a.score,
      imageUrl: a.imageUrl
    }))
  };
}
