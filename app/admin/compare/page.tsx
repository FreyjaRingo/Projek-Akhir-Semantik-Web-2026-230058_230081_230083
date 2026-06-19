'use client';

import { useState } from 'react';
import Link from 'next/link';
import { GitCompare, Search } from 'lucide-react';

interface Anime {
  id: string; title: string; imageUrl: string; score: number | null;
  genres: string[]; studios: string[]; themes: string[]; type: string; year: number | null;
}

export default function ComparePage() {
  const [search1, setSearch1] = useState('');
  const [search2, setSearch2] = useState('');
  const [results1, setResults1] = useState<Anime[]>([]);
  const [results2, setResults2] = useState<Anime[]>([]);
  const [selected1, setSelected1] = useState<Anime | null>(null);
  const [selected2, setSelected2] = useState<Anime | null>(null);
  const [comparison, setComparison] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState<1 | 2 | null>(null);

  async function searchAnime(query: string, slot: 1 | 2) {
    if (!query.trim()) return;
    setSearching(slot);
    try {
      const params = new URLSearchParams({ q: query, limit: '8' });
      const response = await fetch(`/api/anime?${params}`);
      const data = await response.json();
      if (slot === 1) setResults1(data.data || []);
      else setResults2(data.data || []);
    } catch (err) { console.error('Search failed:', err); }
    finally { setSearching(null); }
  }

  async function compare() {
    if (!selected1 || !selected2) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/compare?id1=${selected1.id}&id2=${selected2.id}`);
      const data = await response.json();
      setComparison(data);
    } catch (err) { console.error('Compare failed:', err); }
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
          <h1 className="mt-2 text-3xl font-black text-ink md:text-4xl">Semantic Compare</h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted">
            Compare two anime entities to find shared graph attributes and semantic similarity.
          </p>
        </div>
      </header>

      <div className="grid gap-6">
        {/* Anime Selection */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Anime 1 */}
          <div className="panel p-5">
            <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
              <div>
                <p className="text-xs font-black uppercase text-teal">Entity A</p>
                <h2 className="mt-1 text-xl font-black text-ink">Anime 1</h2>
              </div>
            </div>

            <div className="flex gap-3 mb-5">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-5 w-5 text-muted pointer-events-none" />
                <input
                  type="text"
                  value={search1}
                  onChange={(e) => setSearch1(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchAnime(search1, 1)}
                  placeholder="Search anime..."
                  className="field pl-10"
                />
              </div>
              <button onClick={() => searchAnime(search1, 1)} disabled={searching === 1} className="primary-btn">
                {searching === 1 ? '...' : 'Search'}
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {results1.length === 0 && !searching && (
                <div className="soft-card p-4 text-center text-muted text-sm">
                  Search to select Anime 1
                </div>
              )}
              {results1.map((anime) => (
                <button
                  key={anime.id}
                  onClick={() => { setSelected1(anime); setComparison(null); }}
                  className={`p-3 rounded-xl border text-left transition ${
                    selected1?.id === anime.id ? 'border-teal/50 bg-teal/15' : 'soft-card hover:border-amber/70 hover:bg-[#211f1a]'
                  }`}
                >
                  <div className="flex gap-3">
                    <img src={anime.imageUrl || '/placeholder.png'} className="w-12 h-16 object-cover rounded-md bg-[#14120f]" />
                    <div className="flex-1">
                      <p className="font-black text-ink text-sm truncate">{anime.title}</p>
                      <p className="text-xs font-bold text-amber mt-1">{anime.score?.toFixed(2) || 'N/A'}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {anime.genres?.slice(0, 3).map((g) => (
                          <span key={g} className="text-[10px] px-1.5 py-0.5 rounded border border-line bg-[#14120f] text-muted">{g}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Anime 2 */}
          <div className="panel p-5">
            <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
              <div>
                <p className="text-xs font-black uppercase text-amber">Entity B</p>
                <h2 className="mt-1 text-xl font-black text-ink">Anime 2</h2>
              </div>
            </div>

            <div className="flex gap-3 mb-5">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-5 w-5 text-muted pointer-events-none" />
                <input
                  type="text"
                  value={search2}
                  onChange={(e) => setSearch2(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchAnime(search2, 2)}
                  placeholder="Search anime..."
                  className="field pl-10"
                />
              </div>
              <button
                onClick={() => searchAnime(search2, 2)}
                disabled={searching === 2}
                className="ghost-btn border-amber/30 text-amber hover:bg-amber/10 hover:border-amber/60"
              >
                {searching === 2 ? '...' : 'Search'}
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {results2.length === 0 && !searching && (
                <div className="soft-card p-4 text-center text-muted text-sm">
                  Search to select Anime 2
                </div>
              )}
              {results2.map((anime) => (
                <button
                  key={anime.id}
                  onClick={() => { setSelected2(anime); setComparison(null); }}
                  className={`p-3 rounded-xl border text-left transition ${
                    selected2?.id === anime.id ? 'border-amber/50 bg-amber/15' : 'soft-card hover:border-amber/70 hover:bg-[#211f1a]'
                  }`}
                >
                  <div className="flex gap-3">
                    <img src={anime.imageUrl || '/placeholder.png'} className="w-12 h-16 object-cover rounded-md bg-[#14120f]" />
                    <div className="flex-1">
                      <p className="font-black text-ink text-sm truncate">{anime.title}</p>
                      <p className="text-xs font-bold text-amber mt-1">{anime.score?.toFixed(2) || 'N/A'}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {anime.genres?.slice(0, 3).map((g) => (
                          <span key={g} className="text-[10px] px-1.5 py-0.5 rounded border border-line bg-[#14120f] text-muted">{g}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Compare Button */}
        <div className="text-center py-4">
          <button
            onClick={compare}
            disabled={!selected1 || !selected2 || loading}
            className="primary-btn min-h-14 px-10 text-lg shadow-lift"
          >
            <GitCompare className="w-5 h-5 mr-2" />
            {loading ? 'Comparing...' : 'Compare Entities'}
          </button>
        </div>

        {/* Comparison Results */}
        {comparison && (
          <div className="panel p-6 mt-4">
            {/* Header */}
            <div className="text-center border-b border-line pb-6 mb-6">
              <div className="inline-flex items-center gap-8 bg-[#14120f] border border-line rounded-xl px-8 py-4">
                {/* Anime 1 Mini */}
                <div className="text-center">
                  <img
                    src={selected1?.imageUrl || '/placeholder.png'}
                    className="w-12 h-16 object-cover rounded-lg mx-auto mb-2"
                  />
                  <p className="text-xs font-black text-teal truncate max-w-24">{selected1?.title?.slice(0, 15)}</p>
                </div>

                {/* VS + Score */}
                <div className="text-center">
                  <span className="text-3xl font-black text-amber">{comparison.comparison.similarityScore}%</span>
                  <p className="text-xs text-muted mt-1">Similarity</p>
                </div>

                {/* Anime 2 Mini */}
                <div className="text-center">
                  <img
                    src={selected2?.imageUrl || '/placeholder.png'}
                    className="w-12 h-16 object-cover rounded-lg mx-auto mb-2"
                  />
                  <p className="text-xs font-black text-amber truncate max-w-24">{selected2?.title?.slice(0, 15)}</p>
                </div>
              </div>
            </div>

            {/* Shared & Unique */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Intersection */}
              <div className="soft-card p-5">
                <h3 className="text-lg font-black text-green mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green"></span>
                  Shared Attributes
                </h3>

                {comparison.comparison.commonGenres?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-black text-muted mb-2 uppercase">Genres</p>
                    <div className="flex flex-wrap gap-2">
                      {comparison.comparison.commonGenres.map((g: string) => (
                        <span key={g} className="chip bg-green/15 border-green/30 text-green">{g}</span>
                      ))}
                    </div>
                  </div>
                )}

                {comparison.comparison.commonStudios?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-black text-muted mb-2 uppercase">Studios</p>
                    <div className="flex flex-wrap gap-2">
                      {comparison.comparison.commonStudios.map((s: string) => (
                        <span key={s} className="chip bg-green/15 border-green/30 text-green">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {comparison.comparison.commonThemes?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-black text-muted mb-2 uppercase">Themes</p>
                    <div className="flex flex-wrap gap-2">
                      {comparison.comparison.commonThemes.slice(0, 5).map((t: string) => (
                        <span key={t} className="chip bg-green/15 border-green/30 text-green">{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {comparison.comparison.commonGenres?.length === 0 &&
                 comparison.comparison.commonStudios?.length === 0 &&
                 comparison.comparison.commonThemes?.length === 0 && (
                  <p className="text-sm text-muted">No shared attributes found.</p>
                )}
              </div>

              {/* Difference */}
              <div className="soft-card p-5">
                <h3 className="text-lg font-black text-rose mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose"></span>
                  Unique to Each
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-black text-teal mb-2 uppercase truncate" title={selected1?.title || ''}>
                      Only in {selected1?.title?.slice(0, 12)}...
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {comparison.comparison.uniqueGenres1?.length > 0 ? (
                        comparison.comparison.uniqueGenres1.map((g: string) => (
                          <span key={g} className="text-[10px] px-2 py-0.5 rounded border border-teal/20 bg-teal/5 text-teal/80">{g}</span>
                        ))
                      ) : <span className="text-xs text-muted">None</span>}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-black text-amber mb-2 uppercase truncate" title={selected2?.title || ''}>
                      Only in {selected2?.title?.slice(0, 12)}...
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {comparison.comparison.uniqueGenres2?.length > 0 ? (
                        comparison.comparison.uniqueGenres2.map((g: string) => (
                          <span key={g} className="text-[10px] px-2 py-0.5 rounded border border-amber/20 bg-amber/5 text-amber/80">{g}</span>
                        ))
                      ) : <span className="text-xs text-muted">None</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
