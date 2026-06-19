'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Network, Search } from 'lucide-react';

export default function NeighborhoodPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedAnime, setSelectedAnime] = useState<any>(null);
  const [neighborhood, setNeighborhood] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  async function searchAnime() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const params = new URLSearchParams({ q: searchQuery, limit: '10' });
      const response = await fetch(`/api/anime?${params}`);
      const data = await response.json();
      setSearchResults(data.data || []);
    } catch (err) { console.error('Search failed:', err); }
    finally { setSearching(false); }
  }

  async function fetchNeighborhood(anime: any) {
    setSelectedAnime(anime);
    setLoading(true);
    try {
      const response = await fetch(`/api/neighborhood?id=${anime.id}&limit=15`);
      const data = await response.json();
      setNeighborhood(data);
    } catch (err) { console.error('Fetch neighborhood failed:', err); }
    finally { setLoading(false); }
  }

  // Generate positions for graph visualization
  function generateGraphLayout(related: any[], sourceTitle: string) {
    if (!related || related.length === 0) return { nodes: [], edges: [] };

    const nodes: any[] = [
      { id: 'source', label: sourceTitle, type: 'source', x: 200, y: 200, r: 25 }
    ];
    const edges: any[] = [];

    const centerX = 200;
    const centerY = 200;
    const radius = 120;

    related.forEach((anime, i) => {
      const angle = (2 * Math.PI * i) / related.length;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      nodes.push({
        id: anime.id,
        label: anime.title.slice(0, 20),
        type: 'related',
        x,
        y,
        r: 12 + Math.min(anime.matchScore * 2, 10),
        score: anime.score,
        matchScore: anime.matchScore,
        relations: anime.relations
      });
      edges.push({
        id: `edge-${i}`,
        source: 'source',
        target: anime.id,
        relations: anime.relations
      });
    });

    return { nodes, edges };
  }

  const graphData = neighborhood?.related ? generateGraphLayout(neighborhood.related, selectedAnime?.title) : null;

  return (
    <div className="min-h-screen bg-page grid gap-6 p-5">
      <header className="flex flex-col justify-between gap-5 rounded-xl border border-line bg-[#15130f] p-5 shadow-workbench lg:flex-row lg:items-end">
        <div>
          <Link className="mb-4 inline-flex items-center gap-2 rounded-md border border-line bg-[#1f1c17] px-3 py-1 text-xs font-black uppercase text-[#c8bfaa]" href="/admin">
            <span className="nexus-mark scale-75" aria-hidden="true">
              <span className="nexus-dot" />
              <span className="nexus-dot" />
              <span className="nexus-dot" />
            </span>
            Back to Dashboard
          </Link>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-teal">Knowledge Graph</p>
          <h1 className="mt-2 text-3xl font-black text-ink md:text-4xl">Graph Neighborhood</h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted">
            Find related anime based on shared entities (studios, genres, themes) in the Semantic Web data.
          </p>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Search */}
        <div className="lg:col-span-1 panel p-4">
          <h2 className="text-lg font-black text-ink mb-4">Search Anime</h2>
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchAnime()}
                placeholder="Search anime..."
                className="field pl-10"
              />
            </div>
            <button onClick={searchAnime} disabled={searching} className="primary-btn">
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Search Results */}
          <div className="flex flex-col gap-3 mt-6">
            <h3 className="text-sm font-black text-muted uppercase tracking-wider">Results</h3>
            {searchResults.length === 0 && !searching && (
              <p className="text-sm text-muted">Search for an anime to begin</p>
            )}
            {searchResults.map((anime) => (
              <button
                key={anime.id}
                onClick={() => fetchNeighborhood(anime)}
                className={`p-3 rounded-xl border text-left transition ${
                  selectedAnime?.id === anime.id ? 'border-teal/50 bg-teal/15' : 'soft-card hover:border-amber/70 hover:bg-[#211f1a]'
                }`}
              >
                <div className="flex gap-3">
                  <img
                    src={anime.imageUrl || '/placeholder.png'}
                    className="w-12 h-16 object-cover rounded-md bg-[#14120f]"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-ink truncate text-sm">{anime.title}</p>
                    <p className="text-xs font-bold text-muted mt-1">
                      {anime.score ? `${anime.score.toFixed(2)} • ` : ''}{anime.year || 'N/A'}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {anime.genres?.slice(0, 2).map((g: string) => (
                        <span key={g} className="text-[10px] px-1.5 py-0.5 rounded border border-line bg-[#14120f] text-muted">{g}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Graph Visualization */}
        <div className="lg:col-span-2">
          {selectedAnime ? (
            <div className="panel p-6">
              <div className="flex items-center gap-2 mb-4">
                <Network className="w-5 h-5 text-teal" />
                <h2 className="text-xl font-black text-ink">Graph: {selectedAnime.title}</h2>
              </div>

              {loading ? (
                <div className="text-center py-10 font-bold text-muted">Loading...</div>
              ) : graphData && graphData.nodes.length > 1 ? (
                <div>
                  {/* SVG Graph */}
                  <svg className="w-full h-80 bg-[#14120f] rounded-xl border border-line mb-6">
                    {/* Edges */}
                    {graphData.edges.map((edge: any) => {
                      const src = graphData.nodes.find((n: any) => n.id === edge.source);
                      const tgt = graphData.nodes.find((n: any) => n.id === edge.target);
                      if (!src || !tgt) return null;
                      return (
                        <line
                          key={edge.id}
                          x1={src.x}
                          y1={src.y}
                          x2={tgt.x}
                          y2={tgt.y}
                          stroke={edge.relations?.includes('genre') ? '#14b8a6' : edge.relations?.includes('studio') ? '#f59e0b' : '#6b7280'}
                          strokeWidth={2}
                          strokeOpacity={0.5}
                        />
                      );
                    })}
                    {/* Nodes */}
                    {graphData.nodes.map((node: any) => (
                      <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                        <circle
                          r={node.r}
                          fill={node.type === 'source' ? '#14b8a6' : '#f59e0b'}
                          stroke={node.type === 'source' ? '#fff' : 'transparent'}
                          strokeWidth={2}
                        />
                        {node.type === 'source' && (
                          <text dy={-node.r - 8} textAnchor="middle" fontSize={10} fill="#c8bfaa" className="font-black">
                            {node.label.slice(0, 15)}
                          </text>
                        )}
                        {node.type !== 'source' && (
                          <text dy={node.r + 12} textAnchor="middle" fontSize={8} fill="#8a8070">
                            {node.label?.slice(0, 12)}
                          </text>
                        )}
                      </g>
                    ))}
                  </svg>

                  {/* Legend */}
                  <div className="flex gap-4 text-xs text-muted mb-4">
                    <div className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-[#14b8a6]" />
                      <span>Source</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                      <span>Related</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-3 h-1 bg-[#14b8a6]" />
                      <span>Genre</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-3 h-1 bg-[#f59e0b]" />
                      <span>Studio</span>
                    </div>
                  </div>

                  {/* Related Anime List */}
                  <h3 className="text-sm font-black text-muted uppercase tracking-wider mb-4">
                    Related Anime ({neighborhood.related?.length || 0})
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {neighborhood.related?.slice(0, 10).map((anime: any) => (
                      <div key={anime.id} className="soft-card p-3 flex gap-3">
                        <img
                          src={anime.imageUrl || '/placeholder.png'}
                          className="w-14 h-20 object-cover rounded-md bg-[#14120f]"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-ink truncate text-sm">{anime.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-amber text-xs font-black">{anime.score?.toFixed(2) || 'N/A'}</span>
                            <span className="text-[10px] font-black uppercase text-teal bg-teal/10 px-1.5 rounded">
                              +{anime.matchScore} match{anime.matchScore > 1 ? 'es' : ''}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {anime.relations?.map((r: string) => (
                              <span
                                key={r}
                                className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                  r === 'genre' ? 'border-teal/50 text-teal' :
                                  r === 'studio' ? 'border-amber/50 text-amber' :
                                  'border-line text-muted'
                                }`}
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 text-muted font-bold">
                  No related anime found. Try selecting an anime with genres or studios.
                </div>
              )}
            </div>
          ) : (
            <div className="panel p-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-[#14120f] border border-line flex items-center justify-center mb-4 text-teal">
                <Network className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-ink mb-2">Graph Neighborhood</h3>
              <p className="text-muted leading-6 max-w-sm">
                Select an anime from the search results to see its connections in the knowledge graph.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
