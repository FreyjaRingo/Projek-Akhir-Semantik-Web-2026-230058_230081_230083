import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

interface GraphNode {
  id: string;
  label?: string;
  type: string;
  malId?: number;
  entityType?: string;
  source?: string;
}

interface GraphRelation {
  id: string;
  type?: string;
  from?: string;
  to?: string;
  predicate?: string;
  label?: string;
}

interface AnimeGraphData {
  entities?: GraphNode[];
  relations?: GraphRelation[];
  metadata?: Record<string, any>;
}

export async function GET() {
  try {
    // Try animegraph.json first (from Jikan sync)
    const graphPath = resolve(process.cwd(), 'public', 'data', 'animegraph.json');

    if (existsSync(graphPath)) {
      const content = readFileSync(graphPath, 'utf-8');
      const data: AnimeGraphData = JSON.parse(content);

      // Transform to graph format
      const nodes = (data.entities || []).map(e => ({
        id: e.id,
        label: e.label || e.id,
        type: e.type?.toLowerCase() || e.entityType?.toLowerCase() || 'unknown',
        malId: e.malId,
        source: e.source,
      }));

      const edges = (data.relations || []).map((r, i) => ({
        id: r.id || `edge-${i}`,
        source: r.from || r.id?.split('_')[0] || '',
        target: r.to || r.id?.split('_')[1] || '',
        predicate: r.predicate || 'related',
        label: r.label,
      })).filter(e => e.source && e.target);

      return NextResponse.json({
        nodes,
        edges,
        metadata: data.metadata,
      });
    }

    // Fallback: try RDF Turtle and parse basic info
    const ttlPath = resolve(process.cwd(), 'public', 'data', 'data.ttl');
    if (existsSync(ttlPath)) {
      return NextResponse.json({
        nodes: [
          { id: 'placeholder', label: 'RDF data available - run sync:data', type: 'anime' }
        ],
        edges: [],
        metadata: { source: 'data.ttl' }
      });
    }

    return NextResponse.json({ error: 'No graph data found. Run npm run sync:data first.' }, { status: 404 });
  } catch (error) {
    console.error('GET /api/rdf/graph error:', error);
    return NextResponse.json(
      { error: 'Failed to load graph', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
