import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Full SPARQL 1.1 Endpoint (Simulated)
// Converts SPARQL-like queries to Supabase SQL

interface SPARQLResult {
  head: {
    vars: string[];
  };
  results: {
    bindings: Record<string, { type: string; value: string }>[];
  };
}

// SPARQL Query Templates
const queryTemplates: Record<string, {
  description: string;
  query: string;
  params?: string[];
}> = {
  // Search by label
  'search_label': {
    description: 'Search anime by label/title',
    query: `
      SELECT ?anime ?label ?type ?year ?score
      WHERE {
        ?anime a ag:Anime .
        ?anime rdfs:label ?label .
        FILTER(CONTAINS(LCASE(?label), LCASE($keyword)))
        OPTIONAL { ?anime ag:entityType ?type }
        OPTIONAL { ?anime ag:releaseYear ?year }
        OPTIONAL { ?anime ag:score ?score }
      }
      LIMIT $limit
    `,
    params: ['keyword', 'limit']
  },

  // Anime by genre
  'anime_by_genre': {
    description: 'Get anime by genre',
    query: `
      SELECT ?anime ?label ?type ?score
      WHERE {
        ?anime a ag:Anime .
        ?anime rdfs:label ?label .
        ?anime ag:hasGenre ag:$genre .
        OPTIONAL { ?anime ag:entityType ?type }
        OPTIONAL { ?anime ag:score ?score }
      }
      LIMIT $limit
    `,
    params: ['genre', 'limit']
  },

  // Anime by studio
  'anime_by_studio': {
    description: 'Get anime by studio',
    query: `
      SELECT ?anime ?label ?type ?score
      WHERE {
        ?anime a ag:Anime .
        ?anime rdfs:label ?label .
        ?anime ag:producedBy ag:$studio .
        OPTIONAL { ?anime ag:entityType ?type }
        OPTIONAL { ?anime ag:score ?score }
      }
      LIMIT $limit
    `,
    params: ['studio', 'limit']
  },

  // Anime by theme
  'anime_by_theme': {
    description: 'Get anime by theme',
    query: `
      SELECT ?anime ?label ?type ?score
      WHERE {
        ?anime a ag:Anime .
        ?anime rdfs:label ?label .
        ?anime ag:hasTheme ag:$theme .
        OPTIONAL { ?anime ag:entityType ?type }
        OPTIONAL { ?anime ag:score ?score }
      }
      LIMIT $limit
    `,
    params: ['theme', 'limit']
  },

  // Count by entity type
  'count_by_type': {
    description: 'Count anime by entity type',
    query: `
      SELECT ?type (COUNT(?anime) AS ?count)
      WHERE {
        ?anime a ag:Anime .
        OPTIONAL { ?anime ag:entityType ?type }
      }
      GROUP BY ?type
    `,
    params: []
  },

  // Count by genre
  'count_by_genre': {
    description: 'Count anime by genre',
    query: `
      SELECT ?genre (COUNT(?anime) AS ?count)
      WHERE {
        ?anime ag:hasGenre ?genre .
      }
      GROUP BY ?genre
      ORDER BY DESC(?count)
    `,
    params: []
  },

  // Most connected nodes
  'most_connected': {
    description: 'Get most connected anime nodes',
    query: `
      SELECT ?anime ?label (COUNT(?relation) AS ?degree)
      WHERE {
        ?anime a ag:Anime .
        ?anime rdfs:label ?label .
        ?anime ?relation ?target .
        FILTER(?relation != a)
      }
      GROUP BY ?anime ?label
      ORDER BY DESC(?degree)
      LIMIT $limit
    `,
    params: ['limit']
  },

  // RAG context
  'rag_context': {
    description: 'Get RAG grounding context',
    query: `
      SELECT ?anime ?label ?description ?genre ?studio
      WHERE {
        ?anime a ag:Anime .
        ?anime rdfs:label ?label .
        OPTIONAL { ?anime ag:description ?description }
        OPTIONAL { ?anime ag:hasGenre ?genre }
        OPTIONAL { ?anime ag:producedBy ?studio }
      }
      LIMIT $limit
    `,
    params: ['limit']
  },

  // Anime details
  'anime_details': {
    description: 'Get anime details',
    query: `
      SELECT ?anime ?label ?type ?year ?score ?description ?genre ?studio ?theme
      WHERE {
        ?anime a ag:Anime .
        ?anime rdfs:label ?label .
        OPTIONAL { ?anime ag:entityType ?type }
        OPTIONAL { ?anime ag:releaseYear ?year }
        OPTIONAL { ?anime ag:score ?score }
        OPTIONAL { ?anime ag:description ?description }
        OPTIONAL { ?anime ag:hasGenre ?genre }
        OPTIONAL { ?anime ag:producedBy ?studio }
        OPTIONAL { ?anime ag:hasTheme ?theme }
      }
      LIMIT $limit
    `,
    params: ['limit']
  }
};

// GET /api/sparql/endpoint - Full SPARQL-like endpoint
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query')?.trim();
  const format = searchParams.get('format') || 'json';

  if (!query) {
    return NextResponse.json({
      ok: false,
      error: 'SPARQL query is required. Use ?query=YOUR_SPARQL or use predefined templates.',
      availableQueries: Object.keys(queryTemplates),
      example: '/api/sparql/endpoint?query=search_label&keyword=Naruto&limit=10'
    }, { status: 400 });
  }

  try {
    const result = await executeSPARQL(query, searchParams, format);
    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/sparql/endpoint error:', error);
    return NextResponse.json({
      ok: false,
      error: 'Query execution failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function executeSPARQL(query: string, params: URLSearchParams, format: string): Promise<SPARQLResult | string> {
  // Parse query type from query parameter or extract from full SPARQL
  const queryLower = query.toLowerCase();

  // Try predefined query templates first
  for (const [key, template] of Object.entries(queryTemplates)) {
    if (query === key || query.startsWith(key)) {
      return executeTemplateQuery(key, template, params);
    }
  }

  // Parse full SPARQL query (simplified)
  if (queryLower.includes('select')) {
    return executeSelectQuery(query, params);
  }

  // Default: return available queries
  return {
    head: { vars: ['query', 'description'] },
    results: {
      bindings: Object.entries(queryTemplates).map(([key, template]) => ({
        query: { type: 'literal', value: key },
        description: { type: 'literal', value: template.description }
      }))
    }
  };
}

async function executeTemplateQuery(
  key: string,
  template: typeof queryTemplates[string],
  params: URLSearchParams
): Promise<SPARQLResult> {
  const limit = parseInt(params.get('limit') || '10');

  switch (key) {
    case 'search_label': {
      const keyword = params.get('keyword') || '';
      const { data: results } = await supabase
        .from('Anime')
        .select('id, title, type, year, score')
        .or(`title.ilike.%${keyword}%,titleEnglish.ilike.%${keyword}%`)
        .not('lastSyncedAt', 'is', null)
        .limit(limit);

      return {
        head: { vars: ['anime', 'label', 'type', 'year', 'score'] },
        results: {
          bindings: (results || []).map(r => ({
            anime: { type: 'uri', value: `ag:${r.id}` },
            label: { type: 'literal', value: r.title },
            type: { type: 'literal', value: r.type || '' },
            year: r.year ? { type: 'literal', value: String(r.year) } : undefined as any,
            score: r.score ? { type: 'literal', value: String(r.score) } : undefined as any
          }))
        }
      };
    }

    case 'anime_by_genre': {
      const genre = params.get('genre') || '';
      const { data: results } = await supabase
        .from('Anime')
        .select('id, title, type, score, AnimeGenre(genre:Genre(name))')
        .contains('AnimeGenre.genre.name', genre)
        .not('lastSyncedAt', 'is', null)
        .limit(limit);

      return {
        head: { vars: ['anime', 'label', 'type', 'score'] },
        results: {
          bindings: (results || []).map((r: any) => ({
            anime: { type: 'uri', value: `ag:${r.id}` },
            label: { type: 'literal', value: r.title },
            type: { type: 'literal', value: r.type || '' },
            score: r.score ? { type: 'literal', value: String(r.score) } : undefined as any
          }))
        }
      };
    }

    case 'anime_by_studio': {
      const studio = params.get('studio') || '';
      const { data: results } = await supabase
        .from('Anime')
        .select('id, title, type, score, AnimeStudio(studio:Studio(name))')
        .contains('AnimeStudio.studio.name', studio)
        .not('lastSyncedAt', 'is', null)
        .limit(limit);

      return {
        head: { vars: ['anime', 'label', 'type', 'score'] },
        results: {
          bindings: (results || []).map((r: any) => ({
            anime: { type: 'uri', value: `ag:${r.id}` },
            label: { type: 'literal', value: r.title },
            type: { type: 'literal', value: r.type || '' },
            score: r.score ? { type: 'literal', value: String(r.score) } : undefined as any
          }))
        }
      };
    }

    case 'count_by_genre': {
      const { data: genres } = await supabase
        .from('Genre')
        .select('name, AnimeGenre(animeId)');

      const counts: Record<string, number> = {};
      for (const g of genres || []) {
        counts[g.name] = (g.AnimeGenre?.length || 0);
      }

      return {
        head: { vars: ['genre', 'count'] },
        results: {
          bindings: Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([name, count]) => ({
              genre: { type: 'uri', value: `ag:${name.toLowerCase().replace(/\s+/g, '_')}` },
              count: { type: 'literal', value: String(count) }
            }))
        }
      };
    }

    case 'most_connected': {
      const { data: results } = await supabase
        .from('Anime')
        .select('id, title, AnimeGenre(id), AnimeStudio(id), AnimeTheme(id)')
        .not('lastSyncedAt', 'is', null)
        .limit(limit);

      const scored = (results || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        degree: ((r.AnimeGenre?.length || 0) + (r.AnimeStudio?.length || 0) + (r.AnimeTheme?.length || 0))
      }))
        .sort((a, b) => b.degree - a.degree)
        .slice(0, limit);

      return {
        head: { vars: ['anime', 'label', 'degree'] },
        results: {
          bindings: scored.map(r => ({
            anime: { type: 'uri', value: `ag:${r.id}` },
            label: { type: 'literal', value: r.title },
            degree: { type: 'literal', value: String(r.degree) }
          }))
        }
      };
    }

    default: {
      return {
        head: { vars: [] },
        results: { bindings: [] }
      };
    }
  }
}

async function executeSelectQuery(query: string, params: URLSearchParams): Promise<SPARQLResult> {
  // Simple SPARQL parser - extracts basic SELECT queries
  const vars = extractVariables(query);
  const limit = parseInt(params.get('limit') || '10');

  // Execute basic query
  const { data: results } = await supabase
    .from('Anime')
    .select('id, title, type, year, score, description')
    .not('lastSyncedAt', 'is', null)
    .limit(limit);

  return {
    head: { vars },
    results: {
      bindings: (results || []).map(r => {
        const binding: Record<string, { type: string; value: string }> = {};
        for (const v of vars) {
          switch (v.toLowerCase()) {
            case 'anime':
              binding[v] = { type: 'uri', value: `ag:${r.id}` };
              break;
            case 'label':
              binding[v] = { type: 'literal', value: r.title };
              break;
            case 'type':
              binding[v] = { type: 'literal', value: r.type || '' };
              break;
            case 'year':
              binding[v] = r.year ? { type: 'literal', value: String(r.year) } : undefined as any;
              break;
            case 'score':
              binding[v] = r.score ? { type: 'literal', value: String(r.score) } : undefined as any;
              break;
            case 'description':
              binding[v] = r.description ? { type: 'literal', value: r.description } : undefined as any;
              break;
          }
        }
        return binding;
      })
    }
  };
}

function extractVariables(query: string): string[] {
  const selectMatch = query.match(/SELECT\s+(DISTINCT\s+)?(.+?)\s+WHERE/i);
  if (!selectMatch) return [];

  const varsStr = selectMatch[2];
  const vars = varsStr.match(/\?[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
  return vars.map(v => v.substring(1)); // Remove ?
}

// POST /api/sparql/endpoint - Execute predefined query
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { queryType, params, format } = body;

    if (!queryType || !queryTemplates[queryType]) {
      return NextResponse.json({
        ok: false,
        error: 'Invalid query type',
        availableQueries: Object.keys(queryTemplates)
      }, { status: 400 });
    }

    const template = queryTemplates[queryType];
    const searchParams = new URLSearchParams(params || {});

    const result = await executeTemplateQuery(queryType, template, searchParams);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('POST /api/sparql/endpoint error:', error);
    return NextResponse.json({
      ok: false,
      error: 'Query execution failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
