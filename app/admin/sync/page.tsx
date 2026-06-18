'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Loader2, Plus, RefreshCw, Search, XCircle } from 'lucide-react';

type TabType = 'sync' | 'search' | 'history';

interface SyncStatus {
  latest: any;
  totalSynced: number;
  stats?: { COMPLETED?: number; FAILED?: number; RUNNING?: number };
}

interface JikanAnime {
  malId: number;
  title: string;
  titleEnglish: string | null;
  imageUrl: string;
  score: number | null;
  rank: number | null;
  type: string;
  status: string;
  episodes: number | null;
  year: number | null;
  studios: Array<{ malId: number; name: string }>;
  genres: Array<{ malId: number; name: string }>;
  synopsis: string | null;
}

const tabs: Array<{ key: TabType; label: string; hint: string }> = [
  { key: 'sync', label: 'Quick sync', hint: 'Jalankan pipeline Jikan' },
  { key: 'search', label: 'Search & add', hint: 'Cari anime dari MAL' },
  { key: 'history', label: 'History', hint: 'Audit proses terakhir' },
];

export default function SyncPage() {
  const [activeTab, setActiveTab] = useState<TabType>('sync');
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncType, setSyncType] = useState('incremental');
  const [malId, setMalId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<JikanAnime[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchPagination, setSearchPagination] = useState<any>(null);
  const [syncingIds, setSyncingIds] = useState<Set<number>>(new Set());
  const [syncQueue, setSyncQueue] = useState<number[]>([]);
  const [queueRunning, setQueueRunning] = useState(false);
  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    void fetchSyncStatus();
    const interval = window.setInterval(fetchSyncStatus, 5000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'history') void fetchSyncHistory();
  }, [activeTab]);

  useEffect(() => {
    if (syncQueue.length === 0 || queueRunning) return;

    const nextId = syncQueue[0];
    setQueueRunning(true);
    void syncSingleAnime(nextId)
      .then((success) => {
        if (success) {
          setSearchResults((current) => current.filter((anime) => anime.malId !== nextId));
        } else {
          setError(`Gagal menyinkronkan MAL ID ${nextId}. Coba ulang item tersebut.`);
        }

        setSyncQueue((current) => {
          if (current.length === 1) {
            setMessage('Queue sinkronisasi selesai diproses.');
            void fetchSyncStatus();
          }
          return current.slice(1);
        });
        setSyncingIds((current) => {
          const next = new Set(current);
          next.delete(nextId);
          return next;
        });
      })
      .finally(() => {
        window.setTimeout(() => setQueueRunning(false), 400);
      });
  }, [syncQueue, queueRunning]);

  async function fetchSyncStatus() {
    try {
      const response = await fetch('/api/sync');
      const data = await response.json();
      setSyncStatus(data);
    } catch (err) {
      console.error('Failed to fetch sync status:', err);
    }
  }

  async function fetchSyncHistory() {
    setHistoryLoading(true);
    try {
      const response = await fetch('/api/sync/history');
      if (response.ok) {
        const data = await response.json();
        setSyncHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to fetch sync history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function startSync() {
    setLoading(true);
    setError('');
    setMessage('Menyiapkan sinkronisasi...');
    try {
      if (syncType === 'single') {
        const payload: any = { type: syncType };
        if (malId) payload.malId = parseInt(malId, 10);
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) setError(data.error || data.details || 'Sync failed');
        else {
          setMessage(data.message || 'Sync completed');
          void fetchSyncStatus();
        }
      } else {
        // Full / Incremental Mode with Pagination
        let currentPage = 1;
        let hasNextPage = true;
        let currentSyncId: string | undefined = undefined;
        let totalProcessed = 0;
        const MAX_PAGES = syncType === 'full' ? 10 : 2; // limit full sync to 10 pages, incremental to 2

        while (hasNextPage && currentPage <= MAX_PAGES) {
          setMessage(`Memproses halaman ${currentPage}... (Disinkronkan: ${totalProcessed})`);
          const payload: any = { type: syncType, page: currentPage, syncId: currentSyncId };
          
          const response = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await response.json();
          
          if (!response.ok) {
            setError(data.error || data.details || `Gagal di halaman ${currentPage}`);
            break;
          }

          currentSyncId = data.syncId;
          totalProcessed += (data.itemsProcessed || 0);
          hasNextPage = data.hasNextPage;
          
          void fetchSyncStatus(); // Update dashboard counter
          
          if (hasNextPage && currentPage < MAX_PAGES) {
            currentPage++;
          } else {
            // Selesai, tandai sync log sebagai COMPLETED
            await fetch('/api/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: syncType, syncId: currentSyncId, complete: true }),
            });
            setMessage(`Sync selesai. Total diproses: ${totalProcessed} anime.`);
            void fetchSyncStatus();
            break;
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function searchJikan(page = 1) {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        page: page.toString(),
        limit: '10',
        order_by: 'score',
        sort: 'desc',
      });
      const response = await fetch(`/api/jikan/search?${params}`);
      const data = await response.json();
      if (response.ok) {
        setSearchResults(data.results || []);
        setSearchPagination(data.pagination);
      } else {
        setError(data.error || 'Search failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSearchLoading(false);
    }
  }

  async function syncSingleAnime(malId: number) {
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'single', malId }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  function addToQueue(malId: number) {
    if (!syncingIds.has(malId)) {
      setMessage('');
      setSyncQueue((current) => [...current, malId]);
      setSyncingIds((current) => new Set([...current, malId]));
    }
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-5 rounded-xl border border-line bg-[#15130f] p-5 shadow-workbench lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-teal">External data pipeline</p>
          <h1 className="mt-2 text-3xl font-black text-ink sm:text-4xl">Jikan data sync</h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted">
            Sinkronkan metadata MyAnimeList ke database Supabase dengan tampilan yang sama seperti workbench utama.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MiniMetric label="Total synced" value={syncStatus?.totalSynced || 0} />
          <MiniMetric label="Running" value={syncStatus?.stats?.RUNNING || 0} />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={RefreshCw} label="Total synced" value={syncStatus?.totalSynced || 0} tone="teal" />
        <StatCard icon={CheckCircle2} label="Completed" value={syncStatus?.stats?.COMPLETED || 0} tone="green" />
        <StatCard icon={XCircle} label="Failed" value={syncStatus?.stats?.FAILED || 0} tone="rose" />
        <StatCard icon={Clock3} label="Running" value={syncStatus?.stats?.RUNNING || 0} tone="amber" />
      </section>

      <section className="panel overflow-hidden">
        <div className="grid gap-2 border-b border-line p-3 md:grid-cols-3">
          {tabs.map((tab) => (
            <button
              className={`rounded-lg border p-4 text-left transition ${
                activeTab === tab.key
                  ? 'border-teal/60 bg-teal/15 text-ink'
                  : 'border-line bg-[#14120f] text-muted hover:border-amber/70 hover:text-ink'
              }`}
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              <strong className="block text-sm font-black">{tab.label}</strong>
              <span className="mt-1 block text-xs">{tab.hint}</span>
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6">
          {error && <Message tone="rose">{error}</Message>}
          {message && <Message tone="green">{message}</Message>}

          {activeTab === 'sync' && (
            <div className="grid gap-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-teal">Mode sinkronisasi</p>
                <h2 className="mt-2 text-xl font-black text-ink">Pilih sumber update</h2>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {[
                  { value: 'single', label: 'Single', desc: 'Ambil satu anime dengan MAL ID.' },
                  { value: 'incremental', label: 'Incremental', desc: 'Ambil anime yang sedang tayang.' },
                  { value: 'full', label: 'Full', desc: 'Ambil daftar top anime. Proses lebih lama.' },
                ].map((option) => (
                  <button
                    className={`soft-card grid gap-3 p-4 text-left transition hover:border-amber/70 ${
                      syncType === option.value ? 'border-teal/70 bg-teal/15' : ''
                    }`}
                    key={option.value}
                    onClick={() => setSyncType(option.value)}
                    type="button"
                  >
                    <strong className="text-lg text-ink">{option.label}</strong>
                    <span className="text-sm leading-6 text-muted">{option.desc}</span>
                  </button>
                ))}
              </div>

              {syncType === 'single' && (
                <label className="grid max-w-sm gap-2 text-sm font-black text-muted">
                  MAL ID
                  <input
                    className="field"
                    onChange={(event) => setMalId(event.target.value)}
                    placeholder="Contoh: 21 untuk One Piece"
                    type="number"
                    value={malId}
                  />
                </label>
              )}

              <button
                className="primary-btn w-full sm:w-fit"
                disabled={loading || (syncType === 'single' && !malId)}
                onClick={startSync}
                type="button"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {loading ? 'Menyinkronkan...' : 'Mulai sinkronisasi'}
              </button>
            </div>
          )}

          {activeTab === 'search' && (
            <div className="grid gap-5">
              <form
                className="soft-card grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  void searchJikan();
                }}
              >
                <label className="relative">
                  <span className="sr-only">Cari anime di Jikan</span>
                  <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-muted" />
                  <input
                    className="field pl-10"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Cari judul anime dari MyAnimeList..."
                    value={searchQuery}
                  />
                </label>
                <button className="primary-btn" disabled={searchLoading || !searchQuery.trim()} type="submit">
                  {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {searchLoading ? 'Mencari...' : 'Cari'}
                </button>
              </form>

              {syncQueue.length > 0 && (
                <div className="rounded-xl border border-teal/40 bg-teal/10 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-black text-teal">Queue sedang diproses</p>
                      <p className="mt-1 text-sm text-muted">{syncQueue.length} item tersisa</p>
                    </div>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-teal border-t-transparent" />
                  </div>
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="panel overflow-hidden">
                  <div className="flex items-center justify-between border-b border-line p-4">
                    <p className="text-sm font-black text-muted">{searchPagination?.total || searchResults.length} hasil</p>
                    <span className="text-xs uppercase tracking-[0.16em] text-muted">Jikan API</span>
                  </div>
                  <div className="divide-y divide-line">
                    {searchResults.map((anime) => (
                      <article className="grid gap-4 p-4 transition hover:bg-[#211f1a] sm:grid-cols-[72px_minmax(0,1fr)_auto]" key={anime.malId}>
                        <img className="h-24 w-18 rounded-lg bg-[#14120f] object-cover" src={anime.imageUrl} alt={anime.title} />
                        <div className="min-w-0">
                          <h3 className="font-black text-ink">{anime.title}</h3>
                          {anime.titleEnglish && anime.titleEnglish !== anime.title && (
                            <p className="mt-1 truncate text-sm text-muted">{anime.titleEnglish}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2">
                            {anime.score && <span className="chip">Score {anime.score.toFixed(2)}</span>}
                            <span className="chip">{anime.type || 'Unknown'}</span>
                            <span className="chip">{anime.year || 'No year'}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {anime.genres.slice(0, 3).map((genre) => (
                              <span className="rounded-md border border-line bg-[#14120f] px-2 py-1 text-xs text-muted" key={genre.malId}>
                                {genre.name}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          className="ghost-btn h-fit self-center text-sm"
                          disabled={syncingIds.has(anime.malId)}
                          onClick={() => addToQueue(anime.malId)}
                          type="button"
                        >
                          <Plus className="h-4 w-4" />
                          {syncingIds.has(anime.malId) ? 'Queued' : 'Add'}
                        </button>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="panel overflow-hidden">
              {historyLoading ? (
                <div className="flex items-center justify-center gap-2 p-10 text-muted">
                  <Loader2 className="h-5 w-5 animate-spin" /> Memuat riwayat...
                </div>
              ) : syncHistory.length === 0 ? (
                <div className="p-10 text-center text-muted">Belum ada riwayat sinkronisasi.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead className="bg-[#15130f] text-xs uppercase tracking-[0.1em] text-muted">
                      <tr>
                        <th className="px-5 py-4 font-black">Type</th>
                        <th className="px-5 py-4 font-black">Status</th>
                        <th className="px-5 py-4 font-black">Items</th>
                        <th className="px-5 py-4 font-black">Started</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncHistory.map((log) => (
                        <tr className="border-t border-line hover:bg-[#211f1a]" key={log.id}>
                          <td className="px-5 py-4 font-black text-ink">{log.syncType}</td>
                          <td className="px-5 py-4"><StatusBadge status={log.status} /></td>
                          <td className="px-5 py-4 text-muted">{log.itemsProcessed}</td>
                          <td className="px-5 py-4 text-muted">{new Date(log.startedAt).toLocaleString('id-ID')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="soft-card p-4">
      <strong className="block text-2xl font-black text-ink">{value.toLocaleString('id-ID')}</strong>
      <span className="mt-1 block text-xs font-black uppercase tracking-[0.14em] text-muted">{label}</span>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof RefreshCw; label: string; value: number; tone: string }) {
  const colors: Record<string, string> = {
    teal: 'text-teal',
    green: 'text-green',
    rose: 'text-rose',
    amber: 'text-amber',
  };

  return (
    <article className="panel p-4 sm:p-5">
      <Icon className={`h-5 w-5 ${colors[tone]}`} />
      <strong className="mt-5 block text-2xl font-black text-ink sm:text-3xl">{value.toLocaleString('id-ID')}</strong>
      <span className="mt-1 block text-xs font-black uppercase tracking-[0.14em] text-muted">{label}</span>
    </article>
  );
}

function Message({ children, tone }: { children: React.ReactNode; tone: 'green' | 'rose' }) {
  const color = tone === 'green' ? 'border-green/50 bg-green/10 text-green' : 'border-rose/50 bg-rose/10 text-rose';
  return <div className={`mb-5 rounded-lg border p-3 text-sm ${color}`}>{children}</div>;
}

function StatusBadge({ status }: { status: string }) {
  const color = status === 'COMPLETED'
    ? 'border-green/40 bg-green/10 text-green'
    : status === 'FAILED'
      ? 'border-rose/40 bg-rose/10 text-rose'
      : 'border-amber/40 bg-amber/10 text-amber';

  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${color}`}>{status}</span>;
}
