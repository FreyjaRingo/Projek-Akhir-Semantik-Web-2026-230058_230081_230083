import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/[;\s]/g, '_');
}

function escapeRDFString(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

// GET /api/rdf - Export all data as RDF/Turtle
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get('format') || 'turtle';

  try {
    // Fetch all anime with relations
    const { data: anime } = await supabase
      .from('Anime')
      .select(`
        *,
        AnimeStudio(studio:Studio(*)),
        AnimeGenre(genre:Genre(*)),
        AnimeTheme(theme:Theme(*)),
        Character(*)
      `);

    const { data: studios } = await supabase.from('Studio').select('*');
    const { data: genres } = await supabase.from('Genre').select('*');
    const { data: themes } = await supabase.from('Theme').select('*');

    let rdf = generateRDF(anime || [], studios || [], genres || [], themes || []);

    if (format === 'turtle' || format === 'ttl') {
      return new NextResponse(rdf, {
        headers: {
          'Content-Type': 'application/turtle',
          'Content-Disposition': 'attachment; filename="animegraph-export.ttl"',
        },
      });
    }

    if (format === 'jsonld') {
      const jsonld = generateJSONLD(anime || [], studios || [], genres || [], themes || []);
      return new NextResponse(JSON.stringify(jsonld, null, 2), {
        headers: {
          'Content-Type': 'application/ld+json',
          'Content-Disposition': 'attachment; filename="animegraph-export.jsonld"',
        },
      });
    }

    return NextResponse.json(
      { error: 'Unsupported format. Use: turtle, ttl, or jsonld' },
      { status: 400 }
    );
  } catch (error) {
    console.error('GET /api/rdf error:', error);
    return NextResponse.json(
      { error: 'Failed to generate RDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function generateRDF(anime: any[], studios: any[], genres: any[], themes: any[]): string {
  const lines: string[] = [];

  lines.push('# AnimeGraph Nexus - RDF Export');
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push(`# Total Anime: ${anime.length}`);
  lines.push('');
  lines.push('@prefix ag: <http://example.org/animegraph#>.');
  lines.push('@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.');
  lines.push('@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.');
  lines.push('@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.');
  lines.push('');

  for (const a of anime) {
    const id = slugify(a.title);
    lines.push(`ag:${id} a ag:Anime ;`);
    lines.push(`    rdfs:label "${escapeRDFString(a.title)}" ;`);

    if (a.type) {
      lines.push(`    ag:entityType ag:${a.type} ;`);
      lines.push(`    ag:format "${a.type}" ;`);
    }

    const genreNames = a.AnimeGenre?.map((g: any) => g.genre?.name).filter(Boolean) || [];
    if (genreNames.length > 0) {
      lines.push(`    ag:genre "${escapeRDFString(genreNames[0])}" ;`);
      for (const genreName of genreNames) {
        lines.push(`    ag:hasGenre ag:${slugify(genreName)} ;`);
      }
    }

    if (a.year) {
      lines.push(`    ag:releaseYear "${a.year}"^^xsd:gYear ;`);
    }

    if (a.score) {
      lines.push(`    ag:score "${a.score}"^^xsd:decimal ;`);
    }

    if (a.description) {
      lines.push(`    ag:description "${escapeRDFString(a.description)}" ;`);
    }

    for (const s of a.AnimeStudio || []) {
      const studioId = slugify(s.studio?.name || '');
      if (studioId) lines.push(`    ag:producedBy ag:${studioId} ;`);
    }

    for (const t of a.AnimeTheme || []) {
      const themeId = slugify(t.theme?.name || '');
      if (themeId) lines.push(`    ag:hasTheme ag:${themeId} ;`);
    }

    for (const c of a.Character || []) {
      const charId = slugify(c.name);
      lines.push(`    ag:featuresCharacter ag:${charId} ;`);
    }

    const degree = (a.AnimeStudio?.length || 0) + (a.AnimeGenre?.length || 0) + (a.AnimeTheme?.length || 0) + (a.Character?.length || 0);
    lines.push(`    ag:degree "${degree}"^^xsd:integer .`);
    lines.push('');
  }

  for (const s of studios) {
    const id = slugify(s.name);
    lines.push(`ag:${id} a ag:Studio ;`);
    lines.push(`    rdfs:label "${escapeRDFString(s.name)}" .`);
    lines.push('');
  }

  for (const g of genres) {
    const id = slugify(g.name);
    lines.push(`ag:${id} a ag:Genre ;`);
    lines.push(`    rdfs:label "${escapeRDFString(g.name)}" .`);
    lines.push('');
  }

  for (const t of themes) {
    const id = slugify(t.name);
    lines.push(`ag:${id} a ag:Theme ;`);
    lines.push(`    rdfs:label "${escapeRDFString(t.name)}" .`);
    lines.push('');
  }

  return lines.join('\n');
}

function generateJSONLD(anime: any[], studios: any[], genres: any[], themes: any[]): any {
  const graph: any[] = [];
  const context = {
    '@vocab': 'http://example.org/animegraph#',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    ag: 'http://example.org/animegraph#',
  };

  for (const a of anime) {
    const id = slugify(a.title);
    graph.push({
      '@id': `ag:${id}`,
      '@type': 'Anime',
      'rdfs:label': a.title,
      'ag:entityType': a.type,
      'ag:format': a.type,
      'ag:genre': a.AnimeGenre?.[0]?.genre?.name,
      'ag:releaseYear': a.year,
      'ag:score': a.score,
      'ag:description': a.description,
    });
  }

  for (const s of studios) {
    graph.push({
      '@id': `ag:${slugify(s.name)}`,
      '@type': 'Studio',
      'rdfs:label': s.name,
    });
  }

  for (const g of genres) {
    graph.push({
      '@id': `ag:${slugify(g.name)}`,
      '@type': 'Genre',
      'rdfs:label': g.name,
    });
  }

  for (const t of themes) {
    graph.push({
      '@id': `ag:${slugify(t.name)}`,
      '@type': 'Theme',
      'rdfs:label': t.name,
    });
  }

  return { '@context': context, '@graph': graph };
}
