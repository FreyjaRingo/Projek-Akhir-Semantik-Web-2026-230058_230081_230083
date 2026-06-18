'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { Database, Plus, Search } from 'lucide-react';

type Anime = {
  id: string; malId: number | null; title: string; titleEnglish: string | null;
  description: string | null; imageUrl: string | null; score: number | null;
  episodes: number | null; type: string; status: string; year: number | null;
  studios: string[]; genres: string[]; themes: string[];
};

type Pagination = { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
type Filters = { page: number; limit: number; type: string; status: string; q: string };

const emptyPagination: Pagination = { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false };

export default function AnimeManagementPage() {
  const [anime, setAnime] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState<Pagination>(emptyPagination);
  const [searchDraft, setSearchDraft] = useState('');
  const [filters, setFilters] = useState<Filters>({ page: 1, limit: 20, type: '', status: '', q: '' });
  const [editingAnime, setEditingAnime] = useState<Anime | null | undefined>(undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => ({ ...current, q: searchDraft.trim(), page: 1 }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchAnime(controller.signal);
    return () => controller.abort();
  }, [filters]);

  async function fetchAnime(signal?: AbortSignal) {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({
        page: String(filters.page), limit: String(filters.limit),
      });
      if (filters.type) params.set('type', filters.type);
      if (filters.status) params.set('status', filters.status);
      if (filters.q) params.set('q', filters.q);

      const response = await fetch(`/api/anime?${params}`, { signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.details || data.error || 'Failed to load anime');
      setAnime(data.data || []);
      setPagination(data.pagination || emptyPagination);
    } catch (fetchError) {
      if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load anime');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  async function deleteAnime(item: Anime) {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    setError('');
    try {
      const response = await fetch(`/api/anime/${item.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.details || data.error || 'Failed to delete');
      await fetchAnime();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete');
    }
  }

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value, page: key === 'page' ? Number(value) : 1 }));
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
          <p className="text-xs font-black uppercase tracking-[0.2em] text-teal">Database Management</p>
          <h1 className="mt-2 text-3xl font-black text-ink md:text-4xl">Anime Library</h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted">
            View, edit, and manage anime entries. {pagination.total.toLocaleString('id-ID')} entries found.
          </p>
        </div>
        <div className="flex sm:justify-end">
          <button onClick={() => setEditingAnime(null)} className="primary-btn">
            <Plus className="w-4 h-4" /> Add Anime
          </button>
        </div>
      </header>

      <div className="grid gap-6">
        {/* Filters */}
        <div className="panel p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-3 h-5 w-5 text-muted pointer-events-none" />
              <input type="text" value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Search anime..." className="field pl-10" />
            </div>
            <select className="field w-auto" value={filters.type} onChange={(e) => updateFilter('type', e.target.value)}>
              <option value="">All Types</option>
              <option value="TV">TV</option>
              <option value="MOVIE">Movie</option>
              <option value="OVA">OVA</option>
              <option value="SPECIAL">Special</option>
              <option value="ONA">ONA</option>
              <option value="MUSIC">Music</option>
            </select>
            <select className="field w-auto" value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
              <option value="">All Status</option>
              <option value="AIRING">Airing</option>
              <option value="COMPLETED">Completed</option>
              <option value="TO_BE_AIRED">Upcoming</option>
            </select>
            <button onClick={() => { setSearchDraft(''); setFilters({ page: 1, limit: 20, type: '', status: '', q: '' }); }}
              className="ghost-btn px-6">Reset</button>
          </div>
        </div>

        {error && <div className="p-4 rounded-lg bg-rose/10 border border-rose/30 text-rose text-sm font-bold">{error}</div>}

        {/* Table */}
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[#15130f] text-xs uppercase tracking-[0.1em] text-muted border-b border-line">
                <tr>
                  <th className="px-5 py-4 font-black">Title</th>
                  <th className="px-4 py-4 font-black">Type</th>
                  <th className="px-4 py-4 font-black">Year</th>
                  <th className="px-4 py-4 font-black">Score</th>
                  <th className="px-4 py-4 font-black">Relations</th>
                  <th className="px-5 py-4 text-right font-black">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {loading ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-muted font-bold">Loading...</td></tr>
                ) : anime.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-muted font-bold">No anime found</td></tr>
                ) : anime.map((item) => (
                  <tr key={item.id} className="hover:bg-[#211f1a] transition">
                    <td className="px-5 py-4">
                      <strong className="block text-ink max-w-md truncate">{item.title}</strong>
                      {item.titleEnglish && item.titleEnglish !== item.title && (
                        <span className="mt-1 block text-xs text-muted truncate">{item.titleEnglish}</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="chip">{item.type}</span>
                    </td>
                    <td className="px-4 py-4 text-muted">{item.year || '-'}</td>
                    <td className="px-4 py-4 font-black text-amber">{item.score?.toFixed(2) || '-'}</td>
                    <td className="px-4 py-4 text-xs text-muted">{item.studios[0] || item.genres[0] || 'None'}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingAnime(item)} className="ghost-btn min-h-8 px-2 text-xs">Edit</button>
                        <button onClick={() => deleteAnime(item)} className="ghost-btn min-h-8 px-2 text-xs border-rose/30 text-rose hover:bg-rose/10 hover:border-rose/50">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 mt-2 px-1">
            <p className="text-sm font-bold text-muted">Page {pagination.page} of {pagination.totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => updateFilter('page', filters.page - 1)} disabled={!pagination.hasPrev || loading} className="ghost-btn">
                Previous
              </button>
              <button onClick={() => updateFilter('page', filters.page + 1)} disabled={!pagination.hasNext || loading} className="ghost-btn">
                Next
              </button>
            </div>
          </div>
        )}

        {/* Modal */}
        {editingAnime !== undefined && (
          <AnimeFormModal anime={editingAnime} onClose={() => setEditingAnime(undefined)} onSaved={async () => {
            setEditingAnime(undefined);
            await fetchAnime();
          }} />
        )}
      </div>
    </div>
  );
}

function AnimeFormModal({ anime, onClose, onSaved }: { anime: Anime | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({
    title: anime?.title || '', titleEnglish: anime?.titleEnglish || '', description: anime?.description || '',
    imageUrl: anime?.imageUrl || '', score: anime?.score?.toString() || '', episodes: anime?.episodes?.toString() || '',
    type: anime?.type || 'TV', status: anime?.status || 'AIRING', year: anime?.year?.toString() || '',
    malId: anime?.malId?.toString() || '', studios: anime?.studios.join(', ') || '',
    genres: anime?.genres.join(', ') || '', themes: anime?.themes.join(', ') || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', closeOnEscape); };
  }, [onClose]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError('');
    const list = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
    const payload = {
      title: form.title.trim(), titleEnglish: form.titleEnglish.trim() || undefined,
      description: form.description.trim() || undefined, imageUrl: form.imageUrl.trim() || undefined,
      score: form.score ? Number(form.score) : undefined, episodes: form.episodes ? Number(form.episodes) : undefined,
      type: form.type, status: form.status, year: form.year ? Number(form.year) : undefined,
      malId: form.malId ? Number(form.malId) : undefined,
      studios: list(form.studios), genres: list(form.genres), themes: list(form.themes),
    };

    try {
      const response = await fetch(anime ? `/api/anime/${anime.id}` : '/api/anime', {
        method: anime ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.details || data.error || 'Failed to save');
      await onSaved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save');
    } finally { setSaving(false); }
  }

  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="panel my-auto max-h-[92vh] w-full max-w-3xl overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-[#15130f] p-4">
          <div>
            <p className="text-xs font-black text-teal uppercase tracking-wider">Database Editor</p>
            <h2 className="text-xl font-black text-ink">{anime ? 'Edit Anime' : 'Add Anime'}</h2>
          </div>
          <button onClick={onClose} className="ghost-btn min-h-10 w-10 p-0 text-xl font-bold">×</button>
        </div>

        <form className="grid gap-5 p-6 bg-[#14120f]" onSubmit={submit}>
          {error && <div className="p-3 rounded-lg bg-rose/10 border border-rose/30 text-rose text-sm font-bold">{error}</div>}

          <div>
            <label className="block text-sm font-black text-muted mb-2">Title *</label>
            <input autoFocus className="field" value={form.title} onChange={(e) => set('title', e.target.value)} required />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-black text-muted mb-2">English Title</label>
              <input className="field" value={form.titleEnglish} onChange={(e) => set('titleEnglish', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-black text-muted mb-2">MAL ID</label>
              <input type="number" className="field" value={form.malId} onChange={(e) => set('malId', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-black text-muted mb-2">Description</label>
            <textarea className="field min-h-[100px] py-3" value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-black text-muted mb-2">Type</label>
              <select className="field" value={form.type} onChange={(e) => set('type', e.target.value)}>
                {['TV', 'MOVIE', 'OVA', 'SPECIAL', 'ONA', 'MUSIC'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-black text-muted mb-2">Status</label>
              <select className="field" value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="AIRING">Airing</option>
                <option value="COMPLETED">Completed</option>
                <option value="TO_BE_AIRED">Upcoming</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-black text-muted mb-2">Year</label>
              <input type="number" className="field" value={form.year} onChange={(e) => set('year', e.target.value)} />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-black text-muted mb-2">Score</label>
              <input type="number" step="0.01" min="0" max="10" className="field" value={form.score} onChange={(e) => set('score', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-black text-muted mb-2">Episodes</label>
              <input type="number" className="field" value={form.episodes} onChange={(e) => set('episodes', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-black text-muted mb-2">Image URL</label>
              <input type="url" className="field" value={form.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-black text-muted mb-2">Studios (comma-separated)</label>
            <input className="field" placeholder="MAPPA, Madhouse" value={form.studios} onChange={(e) => set('studios', e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-black text-muted mb-2">Genres (comma-separated)</label>
            <input className="field" placeholder="Action, Fantasy" value={form.genres} onChange={(e) => set('genres', e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-black text-muted mb-2">Themes (comma-separated)</label>
            <input className="field" placeholder="Time Travel, School" value={form.themes} onChange={(e) => set('themes', e.target.value)} />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 border-t border-line pt-5 mt-2">
            <button type="button" onClick={onClose} className="ghost-btn">Cancel</button>
            <button type="submit" disabled={saving} className="primary-btn">
              {saving ? 'Saving...' : anime ? 'Save Changes' : 'Add Anime'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
