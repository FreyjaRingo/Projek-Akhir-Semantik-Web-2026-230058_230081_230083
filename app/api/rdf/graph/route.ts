import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

interface GraphNode {
  id: string;
  label: string;
  type: string;
  year?: number | null;
  score?: number | null;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  predicate: string;
}

function parseTTL(content: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: Map<string, GraphNode> = new Map();
  const edges: GraphEdge[] = [];
  let edgeId = 0;

  // Split by single newline with whitespace (separator between entities)
  // Skip prefix section (first part)
  const parts = content.split(/\n\s*\n/);
  const entityBlocks = parts.slice(1);

  for (const block of entityBlocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('@prefix'));
    if (lines.length === 0) continue;

    // First line has subject and type: ag:entityId a ag:Type ;
    const firstLine = lines[0];
    const subjectMatch = firstLine.match(/^ag:(\w+)\s+a\s+ag:(\w+)/);
    if (!subjectMatch) continue;

    const subjectId = subjectMatch[1];
    const entityType = subjectMatch[2];

    let label = subjectId.replace(/_/g, ' ');
    let type = 'anime';
    let year: number | null = null;
    const relations: { predicate: string; target: string }[] = [];

    // Combine all lines for regex matching
    const fullBlock = block.replace(/\n/g, ' ').replace(/\s+/g, ' ');

    // Parse label: rdfs:label "..."
    const labelMatch = fullBlock.match(/rdfs:label\s+"([^"]+)"/);
    if (labelMatch) label = labelMatch[1];

    // Parse release year: ag:releaseYear "2024"^^xsd:gYear
    const yearMatch = fullBlock.match(/ag:releaseYear\s+"(\d+)"/);
    if (yearMatch) year = parseInt(yearMatch[1]);

    // Parse entity type: ag:entityType "..."
    const typeMatch = fullBlock.match(/ag:entityType\s+"([^"]+)"/);
    if (typeMatch) type = typeMatch[1].toLowerCase();

    // Determine final type based on entityType in TTL
    const finalType = entityType.toLowerCase().includes('anime') ? 'anime' :
                      entityType.toLowerCase().includes('movie') ? 'anime' : type;

    // Parse relations: ag:predicate ag:targetId
    const relPattern = /ag:(producedBy|hasGenre|hasTheme|featuresCharacter|relatedTo)\s+ag:(\w+)/g;
    let match;
    while ((match = relPattern.exec(fullBlock)) !== null) {
      relations.push({ predicate: match[1], target: match[2] });
    }

    // Add subject node
    if (!nodes.has(subjectId)) {
      nodes.set(subjectId, {
        id: subjectId,
        label,
        type: finalType,
        year,
      });
    }

    // Add related nodes and edges
    for (const rel of relations) {
      const targetId = rel.target;

      // Add target node if not exists
      if (!nodes.has(targetId)) {
        nodes.set(targetId, {
          id: targetId,
          label: targetId.replace(/_/g, ' '),
          type: rel.predicate === 'producedBy' ? 'studio' :
                rel.predicate === 'hasGenre' ? 'genre' :
                rel.predicate === 'hasTheme' ? 'theme' :
                rel.predicate === 'featuresCharacter' ? 'character' : 'entity',
        });
      }

      edges.push({
        id: `edge-${edgeId++}`,
        source: subjectId,
        target: targetId,
        predicate: rel.predicate,
      });
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
  };
}

export async function GET() {
  try {
    const ttlPath = resolve(process.cwd(), 'public', 'data', 'data.ttl');

    if (!existsSync(ttlPath)) {
      return NextResponse.json({
        nodes: [],
        edges: [],
        error: 'No data found. Please ensure data.ttl exists in public/data/'
      }, { status: 404 });
    }

    const content = readFileSync(ttlPath, 'utf-8');
    const { nodes, edges } = parseTTL(content);

    return NextResponse.json({
      nodes,
      edges,
      metadata: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        animeCount: nodes.filter(n => n.type === 'anime').length,
        source: 'data.ttl',
      },
    });
  } catch (error) {
    console.error('GET /api/rdf/graph error:', error);
    return NextResponse.json(
      { error: 'Failed to load graph', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
