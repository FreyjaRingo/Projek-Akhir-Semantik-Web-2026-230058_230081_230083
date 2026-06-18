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

      <div className="grid gap-6">
        {/* Search */}
        <div className="panel p-4 max-w-3xl">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-5 w-5 text-muted pointer-events-none" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchAnime()}
                placeholder="Search anime to explore its neighborhood..." className="field pl-10" />
            </div>
            <button onClick={searchAnime} disabled={searching} className="primary-btn sm:w-auto w-full">
              {searching ? 'Searching...' : 'Search Anime'}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Search Results */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-black text-ink">Search Results</h2>
            <div className="flex flex-col gap-3">
              {searchResults.length === 0 && !searching && (
                <div className="soft-card p-6 text-center text-muted text-sm">
                  Search for an anime to see results
                </div>
              )}
              {searchResults.map((anime) => (
                <button key={anime.id} onClick={() => fetchNeighborhood(anime)}
                  className={`p-3 rounded-xl border text-left transition ${
                    selectedAnime?.id === anime.id ? 'border-teal/50 bg-teal/15' : 'soft-card hover:border-amber/70 hover:bg-[#211f1a]'
                  }`}>
                  <div className="flex gap-3">
                    <img src={anime.imageUrl || '/placeholder.png'} className="w-12 h-16 object-cover rounded-md bg-[#14120f]" />
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

          {/* Neighborhood */}
          <div className="lg:col-span-2">
            {selectedAnime ? (
              <div className="panel p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Network className="w-5 h-5 text-teal" />
                  <h2 className="text-xl font-black text-ink">Exploring: {selectedAnime.title}</h2>
                </div>

                <div className="p-4 rounded-xl bg-[#14120f] border border-line mb-6">
                  <div className="flex gap-4">
                    <img src={selectedAnime.imageUrl || '/placeholder.png'} className="w-20 h-28 object-cover rounded-lg" />
                    <div className="flex-1">
                      <h3 className="text-lg font-black text-ink">{selectedAnime.title}</h3>
                      <div className="flex gap-3 mt-1.5 text-xs font-bold text-muted">
                        <span className="text-amber">{selectedAnime.score?.toFixed(2) || 'N/A'}</span>
                        <span>{selectedAnime.type}</span>
                        <span>{selectedAnime.year || 'N/A'}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {selectedAnime.genres?.map((g: string) => (
                          <span key={g} className="chip">{g}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="text-center py-10 font-bold text-muted">Loading neighborhood...</div>
                ) : neighborhood?.related.length ? (
                  <div>
                    <h3 className="text-sm font-black text-muted uppercase tracking-wider mb-4">Related Anime ({neighborhood.related.length})</h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {neighborhood.related.map((anime: any) => (
                        <div key={anime.id} className="soft-card p-3 flex gap-3 hover:border-amber transition">
                          <img src={anime.imageUrl || '/placeholder.png'} className="w-14 h-20 object-cover rounded-md bg-[#14120f]" />
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-ink truncate text-sm">{anime.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-amber text-xs font-black">{anime.score?.toFixed(2) || 'N/A'}</span>
                              <span className="text-[10px] font-black uppercase text-teal bg-teal/10 px-1.5 rounded">+{anime.matchScore} edges</span>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {anime.relations?.map((r: string) => (
                                <span key={r} className="text-[10px] px-1.5 py-0.5 rounded border border-line bg-[#14120f] text-muted">{r}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 text-muted font-bold">No related anime found in the graph.</div>
                )}
              </div>
            ) : (
              <div className="panel p-12 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-[#14120f] border border-line flex items-center justify-center mb-4 text-teal">
                  <Network className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-ink mb-2">Graph Neighborhood</h3>
                <p className="text-muted leading-6 max-w-sm">
                  Select an anime from the search results to explore its connections in the knowledge graph.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
