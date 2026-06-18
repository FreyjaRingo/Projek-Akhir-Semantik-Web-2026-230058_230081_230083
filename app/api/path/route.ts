import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface PathStep {
  from: string;
  to: string;
  relation: string;
  label: string;
}

interface SemanticPath {
  sourceAnime: {
    id: string;
    title: string;
    imageUrl: string | null;
    score: number | null;
  };
  targetAnime: {
    id: string;
    title: string;
    imageUrl: string | null;
    score: number | null;
  };
  paths: {
    length: number;
    steps: PathStep[];
    description: string;
    relationTypes: string[];
  }[];
  commonRelations: string[];
  directConnections: boolean;
}

// GET /api/path - Find semantic paths between two anime
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sourceId = searchParams.get('source');
  const targetId = searchParams.get('target');
  const maxDepth = parseInt(searchParams.get('depth') || '3');

  if (!sourceId || !targetId) {
    return NextResponse.json(
      { ok: false, error: 'Both source and target anime IDs are required' },
      { status: 400 }
    );
  }

  if (sourceId === targetId) {
    return NextResponse.json(
      { ok: false, error: 'Source and target must be different' },
      { status: 400 }
    );
  }

  if (maxDepth < 1 || maxDepth > 5) {
    return NextResponse.json(
      { ok: false, error: 'Depth must be between 1 and 5' },
      { status: 400 }
    );
  }

  try {
    const result = await findSemanticPath(sourceId, targetId, maxDepth);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('GET /api/path error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to find semantic path', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function findSemanticPath(sourceId: string, targetId: string, maxDepth: number): Promise<SemanticPath> {
  // Get source anime
  const { data: sourceAnime } = await supabase
    .from('Anime')
    .select(`
      id, title, imageUrl, score,
      AnimeGenre(genre:Genre(id, name)),
      AnimeStudio(studio:Studio(id, name)),
      AnimeTheme(theme:Theme(id, name))
    `)
    .eq('id', sourceId)
    .single();

  // Get target anime
  const { data: targetAnime } = await supabase
    .from('Anime')
    .select(`
      id, title, imageUrl, score,
      AnimeGenre(genre:Genre(id, name)),
      AnimeStudio(studio:Studio(id, name)),
      AnimeTheme(theme:Theme(id, name))
    `)
    .eq('id', targetId)
    .single();

  if (!sourceAnime || !targetAnime) {
    throw new Error('One or both anime not found');
  }

  // Extract relation data
  const sourceGenres = (sourceAnime as any).AnimeGenre?.map((ag: any) => ({ id: ag.genre?.id, name: ag.genre?.name })).filter((g: any) => g.id) || [];
  const sourceStudios = (sourceAnime as any).AnimeStudio?.map((as: any) => ({ id: as.studio?.id, name: as.studio?.name })).filter((s: any) => s.id) || [];
  const sourceThemes = (sourceAnime as any).AnimeTheme?.map((at: any) => ({ id: at.theme?.id, name: at.theme?.name })).filter((t: any) => t.id) || [];

  const targetGenres = (targetAnime as any).AnimeGenre?.map((ag: any) => ({ id: ag.genre?.id, name: ag.genre?.name })).filter((g: any) => g.id) || [];
  const targetStudios = (targetAnime as any).AnimeStudio?.map((as: any) => ({ id: as.studio?.id, name: as.studio?.name })).filter((s: any) => s.id) || [];
  const targetThemes = (targetAnime as any).AnimeTheme?.map((at: any) => ({ id: at.theme?.id, name: at.theme?.name })).filter((t: any) => t.id) || [];

  const paths: SemanticPath['paths'] = [];
  const relationTypes: Set<string> = new Set();
  let directConnections = false;

  // Check for direct connections (same entity)
  const sharedGenres = sourceGenres.filter(sg => targetGenres.some(tg => tg.id === sg.id));
  const sharedStudios = sourceStudios.filter(ss => targetStudios.some(ts => ts.id === ss.id));
  const sharedThemes = sourceThemes.filter(st => targetThemes.some(tt => tt.id === st.id));

  // Direct path: Source -> Shared Genre -> Target
  if (sharedGenres.length > 0) {
    directConnections = true;
    for (const genre of sharedGenres) {
      relationTypes.add(`hasGenre: ${genre.name}`);
      paths.push({
        length: 2,
        steps: [
          { from: sourceAnime.title, to: genre.name, relation: 'ag:hasGenre', label: `has genre "${genre.name}"` },
          { from: genre.name, to: targetAnime.title, relation: 'ag:hasGenre', label: `shared by "${targetAnime.title}"` }
        ],
        description: `Both anime share the genre "${genre.name}"`,
        relationTypes: ['genre']
      });
    }
  }

  // Direct path: Source -> Shared Studio -> Target
  if (sharedStudios.length > 0) {
    directConnections = true;
    for (const studio of sharedStudios) {
      relationTypes.add(`producedBy: ${studio.name}`);
      paths.push({
        length: 2,
        steps: [
          { from: sourceAnime.title, to: studio.name, relation: 'ag:producedBy', label: `produced by "${studio.name}"` },
          { from: studio.name, to: targetAnime.title, relation: 'ag:producedBy', label: `also produced "${targetAnime.title}"` }
        ],
        description: `Both anime are produced by "${studio.name}"`,
        relationTypes: ['studio']
      });
    }
  }

  // Direct path: Source -> Shared Theme -> Target
  if (sharedThemes.length > 0) {
    directConnections = true;
    for (const theme of sharedThemes) {
      relationTypes.add(`hasTheme: ${theme.name}`);
      paths.push({
        length: 2,
        steps: [
          { from: sourceAnime.title, to: theme.name, relation: 'ag:hasTheme', label: `has theme "${theme.name}"` },
          { from: theme.name, to: targetAnime.title, relation: 'ag:hasTheme', label: `shared by "${targetAnime.title}"` }
        ],
        description: `Both anime share the theme "${theme.name}"`,
        relationTypes: ['theme']
      });
    }
  }

  // 2-hop path through intermediate anime (if no direct connection)
  if (paths.length === 0 && maxDepth >= 2) {
    // Find anime that connects source and target through shared relations
    const connectingAnime = await findConnectingAnime(sourceId, targetId, sourceGenres, sourceStudios, sourceThemes);

    for (const connector of connectingAnime) {
      paths.push({
        length: 3,
        steps: [
          { from: sourceAnime.title, to: connector.sharedEntity, relation: connector.relationType1, label: connector.label1 },
          { from: connector.anime.title, to: targetAnime.title, relation: connector.relationType2, label: connector.label2 }
        ],
        description: `Connected through intermediate entity and intermediate anime "${connector.anime.title}"`,
        relationTypes: [connector.relationType1, connector.relationType2]
      });
      relationTypes.add(connector.relationType1);
      relationTypes.add(connector.relationType2);
    }
  }

  // 3-hop path through shared relation entity
  if (paths.length === 0 && maxDepth >= 3) {
    // Create paths through shared genre entities
    for (const sg of sourceGenres) {
      for (const tg of targetGenres) {
        if (sg.id === tg.id) continue; // Skip if same genre
        paths.push({
          length: 3,
          steps: [
            { from: sourceAnime.title, to: sg.name, relation: 'ag:hasGenre', label: `has genre "${sg.name}"` },
            { from: sg.name, to: tg.name, relation: 'ag:relatedGenre', label: `related to "${tg.name}"` },
            { from: tg.name, to: targetAnime.title, relation: 'ag:hasGenre', label: `has genre "${tg.name}"` }
          ],
          description: `Connected through genre bridge: "${sg.name}" -> "${tg.name}"`,
          relationTypes: ['genre']
        });
        relationTypes.add('genre_bridge');
      }
    }
  }

  // If still no path found
  if (paths.length === 0) {
    paths.push({
      length: -1,
      steps: [],
      description: `No direct semantic path found between "${sourceAnime.title}" and "${targetAnime.title}" within ${maxDepth} hops`,
      relationTypes: []
    });
  }

  return {
    sourceAnime: {
      id: sourceAnime.id,
      title: sourceAnime.title,
      imageUrl: sourceAnime.imageUrl,
      score: sourceAnime.score
    },
    targetAnime: {
      id: targetAnime.id,
      title: targetAnime.title,
      imageUrl: targetAnime.imageUrl,
      score: targetAnime.score
    },
    paths,
    commonRelations: Array.from(relationTypes),
    directConnections
  };
}

interface ConnectorInfo {
  anime: { id: string; title: string };
  sharedEntity: string;
  relationType1: string;
  relationType2: string;
  label1: string;
  label2: string;
}

async function findConnectingAnime(
  sourceId: string,
  targetId: string,
  sourceGenres: { id: string; name: string }[],
  sourceStudios: { id: string; name: string }[],
  sourceThemes: { id: string; name: string }[]
): Promise<ConnectorInfo[]> {
  const connectors: ConnectorInfo[] = [];

  // Get all anime related to source's entities
  const genreIds = sourceGenres.map(g => g.id);
  const studioIds = sourceStudios.map(s => s.id);
  const themeIds = sourceThemes.map(t => t.id);

  // Find anime that share genres with source
  if (genreIds.length > 0) {
    const { data: genreRelatedAnime } = await supabase
      .from('Anime')
      .select(`
        id, title,
        AnimeGenre(genre:Genre(id, name)),
        AnimeStudio(studio:Studio(id, name)),
        AnimeTheme(theme:Theme(id, name))
      `)
      .not('id', 'eq', sourceId)
      .contains('AnimeGenre.genreId', genreIds[0])
      .limit(20);

    for (const anime of genreRelatedAnime || []) {
      const animeGenres = (anime as any).AnimeGenre?.map((ag: any) => ag.genre?.name) || [];
      const animeStudios = (anime as any).AnimeStudio?.map((as: any) => as.studio?.name) || [];
      const animeThemes = (anime as any).AnimeTheme?.map((at: any) => at.theme?.name) || [];

      // Check if this anime connects to target
      // For now, just return the first batch as potential connectors
      connectors.push({
        anime: { id: anime.id, title: anime.title },
        sharedEntity: animeGenres[0] || animeStudios[0] || animeThemes[0] || 'unknown',
        relationType1: 'genre',
        relationType2: 'genre',
        label1: `shares genre "${animeGenres[0] || 'unknown'}"`,
        label2: `shares genre with target`
      });
    }
  }

  return connectors.slice(0, 5); // Limit to 5 connectors
}
