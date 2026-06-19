import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// SHACL-like validation for data quality
// Implements constraints from proposal section 11.5

interface ValidationResult {
  valid: boolean;
  totalEntities: number;
  validatedEntities: number;
  violations: {
    entityId: string;
    entityTitle: string;
    constraint: string;
    severity: 'error' | 'warning';
    message: string;
  }[];
  summary: {
    errors: number;
    warnings: number;
    passed: number;
  };
  shapes: {
    name: string;
    description: string;
    passed: number;
    failed: number;
  }[];
}

// GET /api/shacl - Validate data against SHACL shapes
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get('format') || 'summary';

  try {
    const result = await validateData();

    if (format === 'shapes') {
      return NextResponse.json({
        ok: true,
        format: 'shacl-turtle',
        data: generateSHACLShapes()
      });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('GET /api/shacl error:', error);
    return NextResponse.json(
      { ok: false, error: 'Validation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function validateData(): Promise<ValidationResult> {
  const violations: ValidationResult['violations'] = [];
  const shapeResults: ValidationResult['shapes'] = [];

  // Get total synced anime count
  const { count: syncedCount } = await supabase
    .from('Anime')
    .select('*', { count: 'exact', head: true })
    .not('lastSyncedAt', 'is', null);

  const totalEntities = syncedCount || 0;

  // Validate EntityTypeRequired
  const { count: noType } = await supabase
    .from('Anime')
    .select('*', { count: 'exact', head: true })
    .is('type', null);

  shapeResults.push({
    name: 'EntityTypeRequired',
    description: 'Setiap ag:Entity wajib memiliki ag:entityType',
    passed: totalEntities - (noType || 0),
    failed: noType || 0
  });

  if (noType && noType > 0) {
    const { data: samples } = await supabase
      .from('Anime')
      .select('id, title')
      .is('type', null)
      .limit(5);

    for (const sample of samples || []) {
      violations.push({
        entityId: sample.id,
        entityTitle: sample.title,
        constraint: 'EntityTypeRequired',
        severity: 'error',
        message: 'Setiap ag:Entity wajib memiliki ag:entityType'
      });
    }
  }

  // Validate DescriptionRequired
  const { count: noDesc } = await supabase
    .from('Anime')
    .select('*', { count: 'exact', head: true })
    .is('description', null);

  shapeResults.push({
    name: 'DescriptionRequired',
    description: 'Setiap ag:Entity wajib memiliki ag:description',
    passed: totalEntities - (noDesc || 0),
    failed: noDesc || 0
  });

  // Validate ScoreRecommended
  const { count: noScore } = await supabase
    .from('Anime')
    .select('*', { count: 'exact', head: true })
    .or('score.is.null,score.eq.0');

  shapeResults.push({
    name: 'ScoreRecommended',
    description: 'Setiap anime sebaiknya memiliki score',
    passed: totalEntities - (noScore || 0),
    failed: noScore || 0
  });

  // Validate MalIdRecommended
  const { count: noMalId } = await supabase
    .from('Anime')
    .select('*', { count: 'exact', head: true })
    .is('malId', null);

  shapeResults.push({
    name: 'MalIdRecommended',
    description: 'Setiap anime sebaiknya memiliki MAL ID',
    passed: totalEntities - (noMalId || 0),
    failed: noMalId || 0
  });

  // Validate ImageRecommended
  const { count: noImage } = await supabase
    .from('Anime')
    .select('*', { count: 'exact', head: true })
    .is('imageUrl', null);

  shapeResults.push({
    name: 'ImageRecommended',
    description: 'Setiap anime sebaiknya memiliki image URL',
    passed: totalEntities - (noImage || 0),
    failed: noImage || 0
  });

  // Get genre coverage
  const { data: allAnime } = await supabase
    .from('Anime')
    .select('id, AnimeGenre(genre:Genre(id))')
    .not('lastSyncedAt', 'is', null)
    .limit(1000);

  let withGenre = 0;
  for (const anime of allAnime || []) {
    const genreData = (anime as any).AnimeGenre;
    if (genreData && genreData.length > 0) {
      const hasGenre = genreData.some((g: any) => g.genre?.id);
      if (hasGenre) withGenre++;
    }
  }

  shapeResults.push({
    name: 'GenreRecommended',
    description: 'Setiap ag:Anime sebaiknya memiliki genre',
    passed: withGenre,
    failed: (allAnime?.length || 0) - withGenre
  });

  // Get studio coverage
  const { data: allAnimeStudio } = await supabase
    .from('Anime')
    .select('id, AnimeStudio(studio:Studio(id))')
    .not('lastSyncedAt', 'is', null)
    .limit(1000);

  let withStudio = 0;
  for (const anime of allAnimeStudio || []) {
    const studioData = (anime as any).AnimeStudio;
    if (studioData && studioData.length > 0) {
      const hasStudio = studioData.some((s: any) => s.studio?.id);
      if (hasStudio) withStudio++;
    }
  }

  shapeResults.push({
    name: 'StudioRecommended',
    description: 'Setiap ag:Anime sebaiknya memiliki studio',
    passed: withStudio,
    failed: (allAnimeStudio?.length || 0) - withStudio
  });

  const summary = {
    errors: shapeResults.filter(s => s.description.includes('wajib')).reduce((acc, s) => acc + s.failed, 0),
    warnings: shapeResults.filter(s => s.description.includes('sebaiknya')).reduce((acc, s) => acc + s.failed, 0),
    passed: shapeResults.reduce((acc, s) => acc + s.passed, 0)
  };

  return {
    valid: summary.errors === 0,
    totalEntities,
    validatedEntities: totalEntities,
    violations,
    summary,
    shapes: shapeResults
  };
}

function generateSHACLShapes(): string {
  return `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ag: <http://example.org/animegraph#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# AnimeGraph Nexus - SHACL Shapes
# Based on Proposal Section 11.5

## Entity Shape
ag:EntityShape a sh:NodeShape ;
  sh:targetClass ag:Entity ;
  sh:property [
    sh:path ag:entityType ;
    sh:severity sh:Violation ;
    sh:message "Setiap ag:Entity wajib memiliki ag:entityType" ;
    sh:minCount 1
  ] ;
  sh:property [
    sh:path ag:description ;
    sh:severity sh:Violation ;
    sh:message "Setiap ag:Entity wajib memiliki ag:description" ;
    sh:minCount 1
  ] .

## CreativeWork Shape
ag:CreativeWorkShape a sh:NodeShape ;
  sh:targetClass ag:CreativeWork ;
  sh:property [
    sh:path ag:genre ;
    sh:severity sh:Warning ;
    sh:message "Setiap ag:CreativeWork sebaiknya memiliki genre" ;
    sh:minCount 1
  ] .

## Anime Shape
ag:AnimeShape a sh:NodeShape ;
  sh:targetClass ag:Anime ;
  sh:property [
    sh:path ag:producedBy ;
    sh:severity sh:Warning ;
    sh:message "Setiap ag:Anime sebaiknya memiliki studio produksi" ;
    sh:minCount 1
  ] .`;
}

// POST /api/shacl - Validate specific entity
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const entityId = body.id;

    if (!entityId) {
      return NextResponse.json(
        { ok: false, error: 'Entity ID is required' },
        { status: 400 }
      );
    }

    const { data: entity } = await supabase
      .from('Anime')
      .select('id, title, type, description, score, year, malId, imageUrl')
      .eq('id', entityId)
      .single();

    if (!entity) {
      return NextResponse.json(
        { ok: false, error: 'Entity not found' },
        { status: 404 }
      );
    }

    const violations: ValidationResult['violations'] = [];

    if (!entity.type) {
      violations.push({
        entityId: entity.id,
        entityTitle: entity.title,
        constraint: 'EntityTypeRequired',
        severity: 'error',
        message: 'Setiap ag:Entity wajib memiliki ag:entityType'
      });
    }

    if (!entity.description) {
      violations.push({
        entityId: entity.id,
        entityTitle: entity.title,
        constraint: 'DescriptionRequired',
        severity: 'error',
        message: 'Setiap ag:Entity wajib memiliki ag:description'
      });
    }

    if (!entity.score) {
      violations.push({
        entityId: entity.id,
        entityTitle: entity.title,
        constraint: 'ScoreRecommended',
        severity: 'warning',
        message: 'Setiap anime sebaiknya memiliki score'
      });
    }

    if (!entity.malId) {
      violations.push({
        entityId: entity.id,
        entityTitle: entity.title,
        constraint: 'MalIdRecommended',
        severity: 'warning',
        message: 'Setiap anime sebaiknya memiliki MAL ID'
      });
    }

    return NextResponse.json({
      ok: true,
      valid: violations.filter(v => v.severity === 'error').length === 0,
      entity: {
        id: entity.id,
        title: entity.title
      },
      violations,
      summary: {
        errors: violations.filter(v => v.severity === 'error').length,
        warnings: violations.filter(v => v.severity === 'warning').length
      }
    });
  } catch (error) {
    console.error('POST /api/shacl error:', error);
    return NextResponse.json(
      { ok: false, error: 'Validation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
