import Link from 'next/link';
import { BarChart3, Database, Download, GitBranch, GitCompare, Library, MessageSquare, Network, RefreshCw, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const navItems = [
  { title: 'Anime Management', description: 'View, edit, and manage anime entries.', href: '/admin/anime', icon: Library },
  { title: 'Data Sync', description: 'Sync anime data from MyAnimeList via Jikan API.', href: '/admin/sync', icon: RefreshCw },
  { title: 'Semantic Compare', description: 'Compare two anime entities through shared graph facts.', href: '/admin/compare', icon: GitCompare },
  { title: 'Graph Neighborhood', description: 'Find connected anime in the knowledge graph.', href: '/admin/neighborhood', icon: Network },
  { title: 'Semantic Path', description: 'Find relationship paths between two anime.', href: '/admin/path', icon: GitBranch },
  { title: 'Grounded QA', description: 'Ask questions grounded in RDF facts.', href: '/admin/qa', icon: MessageSquare },
  { title: 'SHACL Validation', description: 'Validate data quality against SHACL shapes.', href: '/admin/shacl', icon: Shield },
  { title: 'Analytics', description: 'Review database insights and top connected entities.', href: '/admin/analytics', icon: BarChart3 },
  { title: 'Export RDF', description: 'Download graph data as Turtle for Semantic Web reuse.', href: '/api/rdf?format=turtle', icon: Download },
];

export default async function AdminPage() {
  const [{ count: animeCount }, { count: studioCount }, { count: genreCount }, { count: themeCount }, { data: latestSync }] =
    await Promise.all([
      supabase.from('Anime').select('id', { count: 'exact', head: true }),
      supabase.from('Studio').select('id', { count: 'exact', head: true }),
      supabase.from('Genre').select('id', { count: 'exact', head: true }),
      supabase.from('Theme').select('id', { count: 'exact', head: true }),
      supabase.from('SyncLog').select('*').order('startedAt', { ascending: false }).limit(1).maybeSingle(),
    ]);

  return (
    <main className="mx-auto grid min-h-screen max-w-[1440px] gap-6 px-5 py-5">
      <header className="flex flex-col justify-between gap-5 rounded-xl border border-line bg-[#15130f] p-5 shadow-workbench lg:flex-row lg:items-end">
        <div>
          <Link className="mb-4 inline-flex items-center gap-2 rounded-md border border-line bg-[#1f1c17] px-3 py-1 text-xs font-black uppercase text-[#c8bfaa]" href="/">
            <span className="nexus-mark scale-75" aria-hidden="true">
              <span className="nexus-dot" />
              <span className="nexus-dot" />
              <span className="nexus-dot" />
            </span>
            Back to workbench
          </Link>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-teal">Control center</p>
          <h1 className="mt-2 text-3xl font-black text-ink md:text-5xl">AnimeGraph Admin</h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted">
            Kelola database, sinkronisasi Jikan, analitik, dan ekspor RDF dengan visual yang selaras dengan landing page.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:min-w-[360px]">
          <MiniMetric label="Anime" value={animeCount || 0} />
          <MiniMetric label="Relations" value={(studioCount || 0) + (genreCount || 0) + (themeCount || 0)} />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Anime" value={animeCount || 0} accent="text-teal" />
        <StatCard label="Studios" value={studioCount || 0} accent="text-amber" />
        <StatCard label="Genres" value={genreCount || 0} accent="text-blue" />
        <StatCard label="Themes" value={themeCount || 0} accent="text-rose" />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {navItems.map((item) => (
          <NavCard key={item.href} {...item} />
        ))}
      </section>

      <section className="panel p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-[#14120f] text-teal">
            <Database className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-muted">Latest sync</p>
            <h2 className="text-xl font-black text-ink">Status sinkronisasi terakhir</h2>
          </div>
        </div>
        {latestSync ? (
          <div className="mt-5 grid gap-3 rounded-lg border border-line bg-[#14120f] p-4 sm:grid-cols-3">
            <Info label="Type" value={latestSync.syncType || '-'} />
            <Info label="Status" value={latestSync.status || '-'} />
            <Info label="Started" value={new Date(latestSync.startedAt).toLocaleString('id-ID')} />
          </div>
        ) : (
          <p className="mt-5 rounded-lg border border-dashed border-line p-5 text-sm text-muted">Belum ada riwayat sinkronisasi.</p>
        )}
      </section>
    </main>
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

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <article className="panel p-5">
      <strong className={`block text-3xl font-black ${accent}`}>{value.toLocaleString('id-ID')}</strong>
      <span className="mt-2 block text-xs font-black uppercase tracking-[0.14em] text-muted">{label}</span>
    </article>
  );
}

function NavCard({ title, description, href, icon: Icon }: { title: string; description: string; href: string; icon: typeof Library }) {
  const content = (
    <>
      <span className="grid h-12 w-12 place-items-center rounded-lg border border-line bg-[#14120f] text-teal">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-5 text-xl font-black text-ink">{title}</h3>
      <p className="mt-2 leading-6 text-muted">{description}</p>
    </>
  );

  if (href.startsWith('/api/')) {
    return <a className="card-hover p-5" href={href}>{content}</a>;
  }

  return <Link className="card-hover p-5" href={href}>{content}</Link>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-black uppercase tracking-[0.14em] text-muted">{label}</span>
      <strong className="mt-1 block text-ink">{value}</strong>
    </div>
  );
}
