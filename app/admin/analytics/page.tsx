'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAnalytics(); }, []);

  async function fetchAnalytics() {
    setLoading(true);
    try {
      const response = await fetch('/api/analytics/top-connected');
      const result = await response.json();
      setData(result);
    } catch (err) { console.error('Failed to fetch analytics:', err); }
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
          <p className="text-xs font-black uppercase tracking-[0.2em] text-teal">Database Insights</p>
          <h1 className="mt-2 text-3xl font-black text-ink md:text-4xl">Graph Analytics</h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted">
            Explore database metrics, distributions, and discover the most central entities within the Semantic Graph.
          </p>
        </div>
      </header>

      <div className="grid gap-6">
        {loading ? (
          <div className="panel p-20 flex flex-col items-center justify-center text-center">
            <BarChart3 className="w-10 h-10 text-muted mb-4 animate-pulse" />
            <p className="text-sm font-bold text-muted uppercase tracking-[0.2em]">Loading Analytics...</p>
          </div>
        ) : data ? (
          <>
            {/* Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Anime" value={data.stats.totalAnime} color="teal" />
              <StatCard label="Avg Connections" value={data.stats.avgConnectionScore} color="amber" />
              <StatCard label="Unique Genres" value={data.distributions.genres.length} color="blue" />
              <StatCard label="Anime Types" value={data.distributions.types.length} color="rose" />
            </div>

            <div className="grid lg:grid-cols-[minmax(0,1fr)_420px] gap-6">
              {/* Top Connected Anime */}
              <div className="panel p-5">
                <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
                  <div>
                    <p className="text-xs font-black uppercase text-teal">Hubs</p>
                    <h2 className="mt-1 text-xl font-black text-ink">Top Connected Anime</h2>
                  </div>
                </div>
                
                <div className="flex flex-col gap-3">
                  {data.topConnected.slice(0, 10).map((anime: any, idx: number) => (
                    <div key={anime.id} className="soft-card flex items-center gap-4 p-3 transition hover:border-amber/70 hover:bg-amber/5">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line bg-[#14120f] font-mono text-sm font-black text-teal">
                        {idx + 1}
                      </span>
                      <img src={anime.imageUrl || '/placeholder.png'} className="w-12 h-16 object-cover rounded-md bg-[#14120f]" />
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-ink truncate">{anime.title}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs font-bold text-muted">
                          <span className="text-amber">{anime.score?.toFixed(2) || 'N/A'}</span>
                          <span className="px-1.5 py-0.5 rounded border border-line bg-[#14120f]">{anime.genreCount} genres</span>
                          <span className="px-1.5 py-0.5 rounded border border-line bg-[#14120f]">{anime.studioCount} studios</span>
                        </div>
                      </div>
                      <div className="text-right pl-3 pr-2 border-l border-line border-dashed">
                        <p className="text-2xl font-black text-green">{anime.connectionScore}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted">edges</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Distributions */}
              <div className="flex flex-col gap-6">
                {/* Genre Distribution */}
                <div className="panel p-5">
                  <div className="flex items-center justify-between border-b border-line pb-4 mb-5">
                    <div>
                      <p className="text-xs font-black uppercase text-blue">Classification</p>
                      <h2 className="mt-1 text-xl font-black text-ink">Genre Distribution</h2>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-4">
                    {data.distributions.genres.slice(0, 8).map((genre: any) => {
                      const maxCount = data.distributions.genres[0]?.count || 1;
                      const percentage = (genre.count / maxCount) * 100;
                      return (
                        <div key={genre.name}>
                          <div className="flex justify-between text-xs font-black mb-2">
                            <span className="text-muted">{genre.name}</span>
                            <span className="text-blue">{genre.count}</span>
                          </div>
                          <div className="h-2 rounded-full bg-[#14120f] overflow-hidden border border-line">
                            <div className="h-full bg-blue rounded-full"
                              style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Type Distribution */}
                <div className="panel p-5">
                  <div className="flex items-center justify-between border-b border-line pb-4 mb-5">
                    <div>
                      <p className="text-xs font-black uppercase text-rose">Format</p>
                      <h2 className="mt-1 text-xl font-black text-ink">Type Distribution</h2>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {data.distributions.types.map((item: any) => (
                      <div key={item.type} className="soft-card p-4 text-center">
                        <p className="text-2xl font-black text-ink">{item.count}</p>
                        <p className="text-xs font-black uppercase text-muted mt-1 tracking-widest">{item.type}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Year Distribution */}
                <div className="panel p-5">
                  <div className="flex items-center justify-between border-b border-line pb-4 mb-5">
                    <div>
                      <p className="text-xs font-black uppercase text-amber">Timeline</p>
                      <h2 className="mt-1 text-xl font-black text-ink">Decade Distribution</h2>
                    </div>
                  </div>
                  
                  <div className="flex items-end justify-between gap-2 h-32 mt-4 px-2">
                    {data.distributions.years.map((item: any) => {
                      const maxCount = Math.max(...data.distributions.years.map((y: any) => y.count));
                      const height = Math.max(10, (item.count / maxCount) * 100);
                      return (
                        <div key={item.decade} className="flex-1 flex flex-col items-center justify-end gap-2 group">
                          <div className="relative w-full bg-[#14120f] border border-line rounded-t flex flex-col justify-end transition-all hover:border-amber/50"
                            style={{ height: `${height}%` }}>
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-black text-amber">
                              {item.count}
                            </div>
                            <div className="w-full bg-amber/30 rounded-t h-full group-hover:bg-amber/60 transition-colors" />
                          </div>
                          <span className="text-[10px] font-bold text-muted uppercase">{item.decade}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="panel p-20 flex flex-col items-center justify-center text-center">
            <p className="text-sm font-bold text-rose uppercase tracking-[0.2em]">Failed to load analytics</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  const colorMap: Record<string, string> = {
    teal: 'text-teal',
    amber: 'text-amber',
    rose: 'text-rose',
    green: 'text-green',
    blue: 'text-blue',
  };

  return (
    <div className="soft-card p-4">
      <strong className={`block text-3xl font-black ${colorMap[color]}`}>{typeof value === 'number' ? value.toLocaleString() : value}</strong>
      <span className="mt-1 block text-xs font-black uppercase tracking-[0.14em] text-muted">{label}</span>
    </div>
  );
}
