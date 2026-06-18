import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-page">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-line/90 bg-[#11100e]/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-4 px-5">
          <Link className="flex items-center gap-3" href="/">
            <span className="nexus-mark scale-75" aria-hidden="true">
              <span className="nexus-dot" />
              <span className="nexus-dot" />
              <span className="nexus-dot" />
            </span>
            <span>
              <strong className="block text-sm font-black tracking-wide text-ink">AnimeGraph Nexus</strong>
              <span className="block text-[0.68rem] font-bold uppercase tracking-[0.18em] text-muted">Semantic workbench</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/admin" className="primary-btn min-h-10 px-3 text-sm">
              Admin Panel
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero & Search */}
      <section className="border-b border-line bg-[#15130f]">
        <div className="mx-auto max-w-[1440px] px-5 py-16 lg:py-24">
          <div className="text-center mb-12">
            <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-line bg-[#1f1c17] px-3 py-1 text-xs font-black uppercase text-amber">
              <span className="w-2 h-2 rounded-full bg-amber animate-pulse"></span>
              Semantic Web Database
            </div>

            <h1 className="text-5xl md:text-6xl font-black text-ink mb-6 leading-tight">
              Anime Data
              <span className="block text-teal mt-2">Made Intelligent</span>
            </h1>

            <p className="text-lg text-muted mb-10 max-w-2xl mx-auto leading-8">
              Semantic anime database with RDF export, powered by MyAnimeList data.
              Explore relationships, export linked data, and build semantic web applications.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/admin" className="primary-btn text-lg px-8 py-4">
                Explore Dashboard
              </Link>
              <a href="/api/rdf?format=turtle" className="ghost-btn text-lg px-8 py-4">
                Download RDF Data
              </a>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mt-16">
            <StatCard value="14,078" label="Entities" code="E" color="teal" />
            <StatCard value="64,649" label="Relations" code="R" color="amber" />
            <StatCard value="12,195" label="Anime" code="A" color="rose" />
            <StatCard value="RDF" label="Export Ready" code="X" color="green" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-[1440px] px-5 py-20">
        <div className="mb-10 flex flex-col items-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-teal">Capabilities</p>
          <h2 className="mt-2 text-3xl font-black text-ink">Features</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            title="Semantic Search"
            description="Search anime by name, genre, studio, year, and more. Find connections between anime through shared attributes."
            icon="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
          <FeatureCard
            title="RDF Export"
            description="Export your entire database as RDF/Turtle or JSON-LD. Perfect for semantic web applications."
            icon="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
          />
          <FeatureCard
            title="Data Sync"
            description="Sync anime data from MyAnimeList via Jikan API. Keep your database up-to-date."
            icon="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </div>
      </section>

      {/* Quick Links */}
      <section className="mx-auto max-w-[1440px] px-5 pb-20">
        <div className="mb-10 flex flex-col items-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-teal">Shortcuts</p>
          <h2 className="mt-2 text-3xl font-black text-ink">Quick Access</h2>
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          <QuickLink href="/admin/anime" title="Anime" desc="Manage entries" />
          <QuickLink href="/admin/sync" title="Sync" desc="Jikan API" />
          <QuickLink href="/admin/compare" title="Compare" desc="Semantic compare" />
          <QuickLink href="/admin/analytics" title="Analytics" desc="Database insights" />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line bg-[#15130f]">
        <div className="mx-auto max-w-[1440px] px-5 py-8 text-center">
          <p className="text-muted text-sm font-black tracking-wide">
            AnimeGraph Nexus - Semantic Web Anime Database
          </p>
        </div>
      </footer>
    </main>
  );
}

function StatCard({ value, label, code, color }: { value: string; label: string; code: string; color: string }) {
  const colorMap: Record<string, string> = {
    teal: 'text-teal',
    amber: 'text-amber',
    rose: 'text-rose',
    green: 'text-green',
  };

  return (
    <div className="panel p-6 text-center lg:text-left flex flex-col lg:flex-row items-center gap-4">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line bg-[#14120f] font-mono text-sm font-black ${colorMap[color]}`}>
        {code}
      </span>
      <div>
        <strong className="block text-2xl font-black text-ink">{value}</strong>
        <span className="mt-1 block text-xs font-black uppercase tracking-[0.14em] text-muted">{label}</span>
      </div>
    </div>
  );
}

function FeatureCard({ title, description, icon }: { title: string; description: string; icon: string; }) {
  return (
    <div className="card-hover p-8">
      <div className="w-12 h-12 rounded-xl border border-line bg-[#14120f] flex items-center justify-center mb-6 text-teal">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
        </svg>
      </div>
      <h3 className="text-xl font-black text-ink mb-3">{title}</h3>
      <p className="text-muted leading-relaxed">{description}</p>
    </div>
  );
}

function QuickLink({ href, title, desc }: { href: string; title: string; desc: string; }) {
  return (
    <Link href={href} className="card-hover p-6 text-center block">
      <h3 className="text-lg font-black text-ink mb-1">{title}</h3>
      <p className="text-sm text-muted">{desc}</p>
    </Link>
  );
}
