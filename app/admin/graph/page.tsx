'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ZoomIn, ZoomOut, RefreshCw, Search, Loader2 } from 'lucide-react';

interface GNode {
  id: string;
  label: string;
  type: string;
  x?: number;
  y?: number;
}

interface GEdge {
  id: string;
  source: string;
  target: string;
  predicate: string;
}

interface GraphData {
  nodes: GNode[];
  edges: GEdge[];
  metadata?: Record<string, unknown>;
}

const COLORS: Record<string, string> = {
  anime: '#14b8a6',
  studio: '#f59e0b',
  genre: '#3b82f6',
  theme: '#f43f5e',
  character: '#a855f7',
  default: '#6b7280',
};

export default function GraphPage() {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [drag, setDrag] = useState({ active: false, sx: 0, sy: 0 });

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch('/api/rdf/graph')
      .then((r) => r.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((t) => ({ ...t, k: Math.max(0.1, Math.min(3, t.k * factor)) }));
  }

  function onMouseDown(e: React.MouseEvent) {
    setDrag({ active: true, sx: e.clientX, sy: e.clientY });
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!drag.active) return;
    const dx = e.clientX - drag.sx;
    const dy = e.clientY - drag.sy;
    setDrag({ active: true, sx: e.clientX, sy: e.clientY });
    setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
  }

  function onMouseUp() {
    setDrag((d) => ({ ...d, active: false }));
  }

  const nodes = (data?.nodes || []).filter((n) => filter === 'all' || n.type === filter);
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = (data?.edges || []).filter(
    (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
  );

  const layout = nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    const r = 200 + nodes.length * 2;
    return { ...n, x: 400 + r * Math.cos(angle), y: 300 + r * Math.sin(angle) };
  });

  return (
    <div className="flex flex-col h-screen bg-[#0a0908] text-[#c8bfaa]">
      <header className="flex items-center justify-between px-5 py-3 border-b border-[#2a2520] bg-[#11100e]">
        <Link href="/admin" className="flex items-center gap-2 text-sm hover:text-[#14b8a6]">
          Back
        </Link>
        <h1 className="font-black text-lg">RDF Graph</h1>
        <button
          onClick={() => window.location.reload()}
          className="text-xs px-3 py-1.5 rounded-lg border border-[#2a2520] hover:border-[#14b8a6]"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 border-r border-[#2a2520] bg-[#15130f] p-4 flex flex-col gap-4">
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-[#8a8070] block mb-2">
              Filter Type
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-[#14120f] border border-[#2a2520] rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Types</option>
              <option value="anime">Anime</option>
              <option value="studio">Studio</option>
              <option value="genre">Genre</option>
              <option value="theme">Theme</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-[#8a8070] block mb-2">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a8070]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search nodes..."
                className="w-full bg-[#14120f] border border-[#2a2520] rounded-lg pl-9 pr-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-[#8a8070] mb-3">Legend</p>
            {Object.entries(COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-2 text-sm">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="capitalize">{type}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto pt-4 border-t border-[#2a2520] text-xs text-[#8a8070]">
            {layout.length} nodes - {edges.length} edges
          </div>
        </aside>

        <main className="flex-1 relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
              <Loader2 className="w-8 h-8 animate-spin text-[#14b8a6]" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-[#f43f5e]">
              {error}
            </div>
          )}

          {!loading && !error && layout.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-[#8a8070]">
              No graph data available
            </div>
          )}

          <svg
            onWheel={onWheel}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            className="w-full h-full select-none"
          >
            <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
              {edges.map((edge, i) => {
                const src = layout.find((n) => n.id === edge.source);
                const tgt = layout.find((n) => n.id === edge.target);
                if (!src?.x || !tgt?.x) return null;
                return (
                  <line
                    key={i}
                    x1={src.x}
                    y1={src.y}
                    x2={tgt.x}
                    y2={tgt.y}
                    stroke="#4a4540"
                    strokeWidth={1}
                    strokeOpacity={0.5}
                  />
                );
              })}
              {layout.map((node) => (
                <g key={node.id} transform={`translate(${node.x || 0},${node.y || 0})`}>
                  <circle
                    r={selected === node.id ? 12 : 8}
                    fill={COLORS[node.type] || COLORS.default}
                    stroke={selected === node.id ? '#fff' : 'transparent'}
                    strokeWidth={2}
                    className="cursor-pointer"
                    onClick={() => setSelected(selected === node.id ? null : node.id)}
                  />
                  {node.type === 'anime' && (
                    <text dy={20} textAnchor="middle" fontSize={8} fill="#8a8070" pointerEvents="none">
                      {(node.label || node.id).slice(0, 15)}
                    </text>
                  )}
                </g>
              ))}
            </g>
          </svg>

          <div className="absolute bottom-4 right-4 flex flex-col gap-2">
            <button
              onClick={() => setTransform((t) => ({ ...t, k: t.k * 1.2 }))}
              className="p-2 rounded-lg bg-[#15130f] border border-[#2a2520] hover:border-[#14b8a6]"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTransform((t) => ({ ...t, k: t.k * 0.8 }))}
              className="p-2 rounded-lg bg-[#15130f] border border-[#2a2520] hover:border-[#14b8a6]"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTransform({ x: 0, y: 0, k: 1 })}
              className="p-2 rounded-lg bg-[#15130f] border border-[#2a2520] hover:border-[#14b8a6]"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
