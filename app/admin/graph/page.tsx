'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ZoomIn, ZoomOut, RotateCcw, RefreshCw, Loader2, Search } from 'lucide-react';

interface GraphNode {
  id: string;
  label: string;
  type: 'anime' | 'studio' | 'genre' | 'theme' | 'character';
  x?: number;
  y?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  predicate: string;
}

interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const COLORS: Record<string, string> = {
  anime: '#14b8a6',
  studio: '#f59e0b',
  genre: '#3b82f6',
  theme: '#f43f5e',
  character: '#a855f7',
};

export default function GraphPage() {
  const [data, setData] = useState<GraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/rdf/graph');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(t => ({ ...t, k: Math.max(0.1, Math.min(3, t.k * delta) }));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
  }, []);

  const handleMouseUp = useCallback(() => { isDragging.current = false; }, []);

  // Compute layout
  const computed = useMemo(() => {
    if (!data) return { nodes: [], edges: [] };
    const nodes = data.nodes.filter(n => {
      if (filter !== 'all' && n.type !== filter) return false;
      if (search && !n.label.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    // Simple circular layout with force simulation
    const result = nodes.map((n, i) => {
      const angle = (2 * Math.PI * i) / nodes.length;
      const r = 200 + nodes.length * 2;
      return { ...n, x: 400 + r * Math.cos(angle), y: 300 + r * Math.sin(angle) };
    });

    // Light force push
    for (let pass = 0; pass < 50; pass++) {
      for (let i = 0; i < result.length; i++) {
        for (let j = i + 1; j < result.length; j++) {
          const dx = result[j].x! - result[i].x!;
          const dy = result[j].y! - result[i].y!;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 800 / (dist * dist);
          result[i].x! -= (dx / dist) * force * 0.1;
          result[i].y! -= (dy / dist) * force * 0.1;
          result[j].x! += (dx / dist) * force * 0.1;
          result[j].y! += (dy / dist) * force * 0.1;
        }
      }
      // Center gravity
      for (const n of result) {
        n.x! += (400 - n.x!) * 0.01;
        n.y! += (300 - n.y!) * 0.01;
      }
    }

    const ids = new Set(result.map(n => n.id));
    const edges = data.edges.filter(e => ids.has(e.source) && ids.has(e.target));

    return { nodes: result, edges };
  }, [data, filter, search]);

  return (
    <div className="flex flex-col h-screen bg-[#0a0908] text-[#c8bfaa]">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-[#2a2520] bg-[#11100e]">
        <Link href="/admin" className="flex items-center gap-2 text-sm hover:text-[#14b8a6] transition">
          ← Back
        </Link>
        <h1 className="font-black text-lg">RDF Graph Visualization</h1>
        <button onClick={loadGraph} disabled={loading} className="p-2 rounded-lg border border-[#2a2520] hover:border-[#14b8a6] transition">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-[#2a2520] bg-[#15130f] p-4 flex flex-col gap-4 overflow-y-auto">
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-[#8a8070] block mb-2">Filter Type</label>
            <select value={filter} onChange={e => setFilter(e.target.value)} className="w-full bg-[#14120f] border border-[#2a2520] rounded-lg px-3 py-2 text-sm">
              <option value="all">All Types</option>
              <option value="anime">Anime</option>
              <option value="studio">Studio</option>
              <option value="genre">Genre</option>
              <option value="theme">Theme</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-wider text-[#8a8070] block mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a8070]" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-[#14120f] border border-[#2a2520] rounded-lg pl-9 pr-3 py-2 text-sm" placeholder="Cari node..." />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[#2a2520]">
            <p className="text-xs font-black uppercase tracking-wider text-[#8a8070] mb-3">Legend</p>
            <div className="space-y-2">
              {Object.entries(COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2 text-sm capitalize">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  {type}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-[#2a2520] text-xs text-[#8a8070]">
            {computed.nodes.length} nodes · {computed.edges.length} edges
          </div>
        </aside>

        {/* Canvas */}
        <main className="flex-1 relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
              <Loader2 className="w-8 h-8 animate-spin text-[#14b8a6]" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-[#f43f5e]">{error}</div>
          )}

          <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing select-none"
            onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
            <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
              {computed.edges.map((edge, i) => {
                const src = computed.nodes.find(n => n.id === edge.source);
                const tgt = computed.nodes.find(n => n.id === edge.target);
                if (!src?.x || !tgt?.x) return null;
                return (
                  <line key={i} x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                    stroke="#4a4540" strokeWidth={1} strokeOpacity={0.5} />
                );
              })}
              {computed.nodes.map(node => (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <circle r={selectedNode === node.id ? 12 : 8} fill={COLORS[node.type] || '#14b8a6'}
                    stroke={selectedNode === node.id ? '#fff' : 'transparent'} strokeWidth={2}
                    className="cursor-pointer" onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)} />
                  {node.type === 'anime' && (
                    <text dy={20} textAnchor="middle" className="text-[8px] fill-[#8a8070] pointer-events-none">
                      {(node.label || node.id).slice(0, 15)}
                    </text>
                  )}
                </g>
              ))}
            </g>
          </svg>

          {/* Zoom controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-2">
            <button onClick={() => setTransform(t => ({ ...t, k: t.k * 1.2 })} className="p-2 rounded-lg bg-[#15130f] border border-[#2a2520] hover:border-[#14b8a6]">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={() => setTransform(t => ({ ...t, k: t.k * 0.8 })} className="p-2 rounded-lg bg-[#15130f] border border-[#2a2520] hover:border-[#14b8a6]">
              <ZoomOut className="w-4 h-4" />
            </button>
            <button onClick={() => setTransform({ x: 0, y: 0, k: 1 })} className="p-2 rounded-lg bg-[#15130f] border border-[#2a2520] hover:border-[#14b8a6]">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
