import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Code2,
  ExternalLink,
  GitCompare,
  ImageIcon,
  Link2,
  Loader2,
  Network,
  Play,
  Route,
  Search,
  Server,
  Target
} from "lucide-react";
import {
  answerQuestion,
  animeEntities,
  buildIndex,
  compareEntities,
  correlationCandidates,
  entityFacts,
  relationLabels,
  runSparqlDemoQuery,
  searchEntities,
  sparqlDemoQueries
} from "./lib/animegraph.js";

const DEFAULT_FILTERS = { type: "", format: "", genre: "" };
const QUICK_SEARCHES = ["Death Note", "Naruto", "One Piece", "Attack on Titan", "Jujutsu Kaisen", "Frieren"];
const REMOTE_QUICK_SEARCHES = ["Naruto", "One Piece", "Your Name", "Demon Slayer"];

export default function App() {
  const [graph, setGraph] = useState(null);
  const [searchDraft, setSearchDraft] = useState("Steins;Gate");
  const [query, setQuery] = useState("Steins;Gate");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState("");
  const [compareDraft, setCompareDraft] = useState("Death Note");
  const [question, setQuestion] = useState("Apa tema Death Note?");
  const [answer, setAnswer] = useState(null);
  const [sparqlQueryId, setSparqlQueryId] = useState("search-title");
  const [executedSparqlQueryId, setExecutedSparqlQueryId] = useState("search-title");
  const [remoteQuery, setRemoteQuery] = useState("Naruto");
  const [remoteResults, setRemoteResults] = useState([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState("");
  const [remoteTouched, setRemoteTouched] = useState(false);

  useEffect(() => {
    fetch("/data/animegraph.json")
      .then((response) => response.json())
      .then((data) => {
        setGraph(data);
        const steins = data.entities.find((entity) => entity.label === "Steins;Gate");
        setSelectedId(steins?.id || data.entities[0]?.id || "");
      })
      .catch((error) => {
        setAnswer({
          title: "Data gagal dimuat",
          body: error.message,
          facts: []
        });
      });
  }, []);

  const index = useMemo(() => buildIndex(graph), [graph]);
  const selected = selectedId ? index.byId.get(selectedId) : null;
  const results = useMemo(() => searchEntities(index.entities, query, filters), [index.entities, query, filters]);
  const animeList = useMemo(() => animeEntities(index), [index]);
  const correlations = useMemo(() => selected ? correlationCandidates(selected, index, 14) : [], [selected, index]);
  const compareMatches = useMemo(() => {
    if (!compareDraft.trim()) return [];
    return searchEntities(animeList, compareDraft, { type: "", format: "", genre: "" })
      .filter((entity) => entity.id !== selectedId)
      .slice(0, 8);
  }, [animeList, compareDraft, selectedId]);
  const compareTarget = compareMatches[0] || correlations[0]?.entity || null;
  const comparison = useMemo(() => compareEntities(selected, compareTarget), [selected, compareTarget]);
  const sparqlQueries = useMemo(() => sparqlDemoQueries(selected), [selected]);
  const sparqlResult = useMemo(() => runSparqlDemoQuery(executedSparqlQueryId, index, selected), [executedSparqlQueryId, index, selected]);

  const typeOptions = graph?.types || [];
  const formatOptions = graph?.formats || [];
  const genreOptions = graph?.genres || [];

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchDraft), 220);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  useEffect(() => {
    if (!results.length) return;
    setSelectedId((current) => results.some((entity) => entity.id === current) ? current : results[0].id);
  }, [results]);

  function askGraph(event) {
    event.preventDefault();
    setAnswer(answerQuestion(question, index));
  }

  function submitSearch(event) {
    event.preventDefault();
    setQuery(searchDraft);
  }

  async function searchRemoteAnime(event) {
    event?.preventDefault();

    const keyword = remoteQuery.trim();
    setRemoteTouched(true);

    if (keyword.length < 2) {
      setRemoteResults([]);
      setRemoteError("Masukkan minimal 2 karakter untuk mencari data Wikidata.");
      return;
    }

    setRemoteLoading(true);
    setRemoteError("");

    try {
      const response = await fetch(`/api/sparql?q=${encodeURIComponent(keyword)}`);
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "SPARQL endpoint belum bisa diakses.");
      }

      setRemoteResults(result.data || []);
    } catch (error) {
      setRemoteResults([]);
      setRemoteError(error instanceof Error ? error.message : "Unknown SPARQL error");
    } finally {
      setRemoteLoading(false);
    }
  }

  if (!graph) {
    return (
      <main className="grid min-h-screen place-items-center bg-page p-6">
        <section className="panel max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <NexusMark />
          </div>
          <h1 className="text-2xl font-black">Memuat RDF AnimeGraph</h1>
          <p className="mt-2 text-muted">React app sedang membaca data hasil sinkronisasi dari Turtle RDF.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-page">
      <section className="border-b border-line bg-[#15130f]">
        <div className="mx-auto grid max-w-[1440px] gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-stretch">
          <div className="flex min-h-[250px] flex-col justify-between gap-6">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-line bg-[#1f1c17] px-3 py-1 text-xs font-black uppercase text-[#c8bfaa]">
                <NexusMark compact />
                AnimeGraph Workbench
              </div>
              <h1 className="text-3xl font-black tracking-normal text-ink md:text-5xl">AnimeGraph Nexus</h1>
              <p className="mt-3 max-w-2xl leading-7 text-muted">
                Jelajahi hubungan antar anime berdasarkan genre, studio, tema, karakter, dan rekomendasi berbasis graph dari data Semantic Web.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Metric code="E" label="Entities" value={graph.totalEntities} />
              <Metric code="R" label="Relations" value={graph.relationCount} />
              <Metric code="A" label="Anime" value={graph.types.find((item) => item.label === "Anime")?.count || 0} />
            </div>
          </div>
          <HeroGraph selected={selected} correlations={correlations} />
        </div>
      </section>

      <section className="border-b border-line bg-[#12100d]">
        <div className="mx-auto grid max-w-[1440px] gap-3 px-5 py-4 md:grid-cols-4">
          <ProcessStep number="1" title="Search" body="User memilih anime atau resource." />
          <ProcessStep number="2" title="SPARQL" body="Data RDF atau Wikidata dibaca server-side." />
          <ProcessStep number="3" title="Graph" body="Resource diubah menjadi node dan edge." />
          <ProcessStep number="4" title="Explore" body="Relasi dan rekomendasi divisualkan." />
        </div>
      </section>

      <section className="mx-auto grid max-w-[1440px] gap-5 px-5 py-5 xl:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="grid gap-5">
          <section className="panel overflow-hidden">
            <div className="border-b border-line p-4">
              <p className="text-xs font-black uppercase text-teal">Semantic Search</p>
              <h2 className="mt-1 text-xl font-black">Cari Resource Lokal</h2>
            </div>
            <form className="grid gap-3 p-4" onSubmit={submitSearch}>
              <label className="grid gap-2 text-sm font-black text-muted">
                Keyword
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-muted" />
                  <input
                    className="h-11 w-full rounded-lg border border-line bg-[#14120f] pl-10 pr-3 text-ink outline-none placeholder:text-muted focus:border-amber"
                    value={searchDraft}
                    onChange={(event) => setSearchDraft(event.target.value)}
                    placeholder="Steins;Gate, MAPPA, Time Travel"
                  />
                </div>
              </label>
              <FilterSelect label="Type" value={filters.type} options={typeOptions} onChange={(value) => setFilters({ ...filters, type: value })} />
              <FilterSelect label="Format" value={filters.format} options={formatOptions} onChange={(value) => setFilters({ ...filters, format: value })} />
              <FilterSelect label="Genre" value={filters.genre} options={genreOptions.slice(0, 90)} onChange={(value) => setFilters({ ...filters, genre: value })} />
              <button className="primary-btn" type="submit">
                Cari Resource
              </button>
              <button className="ghost-btn" type="button" onClick={() => setFilters(DEFAULT_FILTERS)}>
                Reset Filter
              </button>
              <div className="flex flex-wrap gap-2">
                {QUICK_SEARCHES.map((item) => (
                  <button
                    className="rounded-md border border-line bg-[#14120f] px-2.5 py-1.5 text-xs font-black text-muted transition hover:border-amber hover:text-amber"
                    key={item}
                    type="button"
                    onClick={() => {
                      setSearchDraft(item);
                      setQuery(item);
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <p className="text-xs leading-5 text-muted">
                Query aktif: <strong className="text-ink">{query || "semua resource"}</strong>. Detail kanan otomatis mengikuti hasil paling relevan.
              </p>
            </form>
          </section>

          <RemoteSparqlSearch
            error={remoteError}
            loading={remoteLoading}
            query={remoteQuery}
            results={remoteResults}
            touched={remoteTouched}
            onQueryChange={setRemoteQuery}
            onSearch={searchRemoteAnime}
          />

          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-line p-4">
              <div>
                <p className="text-xs font-black uppercase text-teal">Results</p>
                <h2 className="mt-1 text-xl font-black">{results.length} kandidat</h2>
              </div>
              <BookOpen className="h-6 w-6 text-muted" />
            </div>
            <div className="max-h-[650px] overflow-auto">
              {results.map((entity) => (
                <button
                  className={`grid w-full gap-2 border-b border-line px-4 py-3 text-left transition hover:bg-amber/10 ${selectedId === entity.id ? "bg-teal/15" : "bg-panel"}`}
                  key={entity.id}
                  type="button"
                  onClick={() => setSelectedId(entity.id)}
                >
                  <span className="font-mono text-xs text-muted">{entity.resource}</span>
                  <strong className="text-base leading-5">{entity.label}</strong>
                  <span className="line-clamp-2 text-sm leading-5 text-muted">{entity.description}</span>
                  <span className="flex flex-wrap gap-1.5">
                    <span className="chip">{entity.format}</span>
                    <span className="chip">{entity.entityType}</span>
                    <span className="chip">{entity.genre}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="grid gap-5">
          {selected && <EntityDetail entity={selected} />}

          {selected && (
            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
              <CorrelationPanel correlations={correlations} selected={selected} onSelect={setSelectedId} />
              <ComparePanel
                compareDraft={compareDraft}
                compareMatches={compareMatches}
                comparison={comparison}
                onDraftChange={setCompareDraft}
                onSelect={setSelectedId}
              />
            </section>
          )}

          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
            {selected && <GraphPreview entity={selected} onSelect={setSelectedId} />}
            <GroundedQa question={question} setQuestion={setQuestion} answer={answer} askGraph={askGraph} />
          </section>

          <SparqlLab
            queries={sparqlQueries}
            queryId={sparqlQueryId}
            result={sparqlResult}
            onQueryChange={setSparqlQueryId}
            onExecute={() => setExecutedSparqlQueryId(sparqlQueryId)}
          />

          <section className="grid gap-5 lg:grid-cols-3">
            <Distribution title="Entity Type" rows={graph.types.slice(0, 8)} />
            <Distribution title="Format" rows={graph.formats.slice(0, 8)} />
            <TopConnected rows={graph.topConnected.slice(0, 8)} onSelect={setSelectedId} />
          </section>
        </section>
      </section>
    </main>
  );
}

function NexusMark({ compact = false }) {
  return (
    <span className={`nexus-mark ${compact ? "scale-75" : ""}`} aria-hidden="true">
      <span className="nexus-dot" />
      <span className="nexus-dot" />
      <span className="nexus-dot" />
    </span>
  );
}

function HeroGraph({ selected, correlations }) {
  const nodes = [
    { label: selected?.genre || "Genre", relation: "genre", className: "left-[7%] top-[9%] border-blue/60 text-blue sm:left-[12%] sm:top-[18%]" },
    { label: relationLabels(selected, "producedBy")[0] || "Studio", relation: "studio", className: "right-[7%] top-[11%] border-amber/60 text-amber sm:right-[10%] sm:top-[20%]" },
    { label: relationLabels(selected, "hasTheme")[0] || "Theme", relation: "theme", className: "left-[7%] bottom-[9%] border-rose/60 text-rose sm:left-[8%] sm:bottom-[18%]" },
    { label: correlations[0]?.entity.label || "Related title", relation: "related", className: "right-[7%] bottom-[9%] border-green/60 text-green sm:right-[8%] sm:bottom-[16%]" }
  ];

  return (
    <div className="relative min-h-[250px] overflow-hidden rounded-lg border border-line bg-[#14120f]">
      <div className="absolute inset-0 bg-graph-grid opacity-70" />
      <div className="absolute left-1/2 top-1/2 z-20 grid h-24 w-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-teal bg-teal/20 p-3 text-center text-xs font-black leading-5 text-ink shadow-lift sm:h-28 sm:w-28 sm:text-sm">
        {shortLabel(selected?.label || "AnimeGraph", 30)}
      </div>
      <span className="absolute left-[18%] top-1/2 h-px w-[64%] bg-line" />
      <span className="absolute left-1/2 top-[20%] h-[60%] w-px bg-line" />
      <span className="absolute left-[22%] top-[28%] h-px w-[58%] rotate-[28deg] bg-line" />
      <span className="absolute left-[22%] bottom-[28%] h-px w-[58%] -rotate-[28deg] bg-line" />
      {nodes.map((node) => (
        <div
          className={`absolute z-10 grid w-[118px] gap-1 rounded-lg border bg-[#1d1a15] px-3 py-2 text-center text-xs font-black shadow-sm sm:w-32 ${node.className}`}
          key={node.relation}
        >
          <span className="font-mono text-[0.65rem] uppercase text-muted">{node.relation}</span>
          <span className="leading-4 text-ink">{shortLabel(node.label, 28)}</span>
        </div>
      ))}
    </div>
  );
}

function ProcessStep({ number, title, body }) {
  return (
    <div className="flex gap-3 rounded-lg border border-line bg-[#181611] p-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-teal/15 font-black text-teal">{number}</span>
      <div>
        <h2 className="font-black leading-5">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-muted">{body}</p>
      </div>
    </div>
  );
}

function RemoteSparqlSearch({ error, loading, query, results, touched, onQueryChange, onSearch }) {
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-line p-4">
        <div>
          <p className="text-xs font-black uppercase text-teal">Live SPARQL API</p>
          <h2 className="mt-1 text-xl font-black">Search Wikidata</h2>
        </div>
        <Server className="h-6 w-6 text-muted" />
      </div>

      <form className="grid gap-3 p-4" onSubmit={onSearch}>
        <label className="grid gap-2 text-sm font-black text-muted">
          Anime title
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-muted" />
            <input
              className="h-11 w-full rounded-lg border border-line bg-[#14120f] pl-10 pr-3 text-ink outline-none placeholder:text-muted focus:border-amber"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Naruto, One Piece, Your Name"
            />
          </div>
        </label>

        <button className="primary-btn" disabled={loading} type="submit">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Network className="h-4 w-4" />}
          {loading ? "Querying..." : "Query SPARQL"}
        </button>

        <div className="flex flex-wrap gap-2">
          {REMOTE_QUICK_SEARCHES.map((item) => (
            <button
              className="rounded-md border border-line bg-[#14120f] px-2.5 py-1.5 text-xs font-black text-muted transition hover:border-amber hover:text-amber"
              key={item}
              type="button"
              onClick={() => onQueryChange(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </form>

      <div className="border-t border-line p-4">
        {error && (
          <div className="flex gap-2 rounded-lg border border-rose/50 bg-rose/10 p-3 text-sm leading-5 text-rose">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!error && !loading && touched && !results.length && (
          <p className="text-sm leading-5 text-muted">No anime found. Try another title.</p>
        )}

        {!error && !touched && (
          <p className="text-sm leading-5 text-muted">Gunakan search ini untuk mengetes route serverless Vercel di `/api/sparql`.</p>
        )}

        {!!results.length && (
          <div className="grid gap-3">
            {results.slice(0, 5).map((anime) => (
              <article className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 rounded-lg border border-line bg-[#1f1c17] p-3" key={anime.uri}>
                {anime.image ? (
                  <img className="h-16 w-16 rounded-md object-cover" src={anime.image} alt={anime.title} />
                ) : (
                  <div className="grid h-16 w-16 place-items-center rounded-md bg-[#14120f] text-muted">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="break-words text-sm font-black leading-5">{anime.title}</h3>
                    <a className="shrink-0 text-teal hover:text-ink" href={anime.uri} rel="noreferrer" target="_blank" title="Open Wikidata resource">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{anime.description || "Description not available."}</p>
                  {!!anime.genres?.length && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {anime.genres.slice(0, 3).map((genre) => (
                        <span className="chip" key={genre}>{genre}</span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SparqlLab({ queries, queryId, result, onQueryChange, onExecute }) {
  const active = queries.find((query) => query.id === queryId) || queries[0];
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-line p-4">
        <div>
          <p className="text-xs font-black uppercase text-teal">SPARQL Endpoint</p>
          <h2 className="mt-1 text-xl font-black">Query Lab</h2>
        </div>
        <Server className="h-6 w-6 text-muted" />
      </div>

      <div className="grid gap-5 p-4 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
        <section className="grid gap-3">
          <label className="grid gap-2 text-sm font-black text-muted">
            Query template
            <select
              className="h-11 rounded-lg border border-line bg-[#14120f] px-3 text-ink outline-none focus:border-amber"
              value={queryId}
              onChange={(event) => onQueryChange(event.target.value)}
            >
              {queries.map((query) => (
                <option key={query.id} value={query.id}>
                  {query.label}
                </option>
              ))}
            </select>
          </label>

          <div className="soft-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <span className="flex items-center gap-2 text-xs font-black uppercase text-muted">
                <Code2 className="h-4 w-4" />
                SPARQL
              </span>
              <span className="rounded-md bg-teal/15 px-2 py-1 text-xs font-black text-teal">/sparql</span>
            </div>
            <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap p-3 font-mono text-xs leading-5 text-muted">{active.query}</pre>
          </div>

          <button className="primary-btn" type="button" onClick={onExecute}>
            <Play className="h-4 w-4" />
            Execute Query
          </button>
        </section>

        <section className="soft-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-xs font-black uppercase text-muted">Result Set</span>
            <span className="rounded-md bg-green/15 px-2 py-1 text-xs font-black text-green">{result.rows.length} rows</span>
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[620px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-[#181611] text-xs uppercase text-muted">
                <tr>
                  {result.columns.map((column) => (
                    <th className="border-b border-line px-3 py-2 font-black" key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, index) => (
                  <tr className="border-b border-line/80" key={index}>
                    {result.columns.map((column) => (
                      <td className="max-w-[320px] break-words px-3 py-2 text-muted" key={column}>{row[column]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}

function CorrelationPanel({ correlations, selected, onSelect }) {
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-line p-4">
        <div>
          <p className="text-xs font-black uppercase text-teal">Anime Correlation</p>
          <h2 className="mt-1 text-xl font-black">Anime yang berkorelasi dengan {selected.label}</h2>
        </div>
        <Target className="h-6 w-6 text-muted" />
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-2">
        {correlations.length ? correlations.map((item) => (
          <button
            className="soft-card grid gap-3 p-3 text-left transition hover:border-amber hover:bg-amber/10"
            key={item.entity.id}
            type="button"
            onClick={() => onSelect(item.entity.id)}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <strong className="block leading-5">{item.entity.label}</strong>
                <span className="mt-1 block text-sm text-muted">{item.entity.format} / {item.entity.genre}</span>
              </div>
              <span className="rounded-md bg-teal/20 px-2 py-1 text-sm font-black text-teal">{item.score}%</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {item.reasons.slice(0, 3).map((reason) => (
                <span className="chip" key={reason}>{reason}</span>
              ))}
            </div>
          </button>
        )) : (
          <div className="soft-card p-4 text-muted md:col-span-2">Belum ada korelasi anime yang cukup kuat untuk entitas ini.</div>
        )}
      </div>
    </section>
  );
}

function ComparePanel({ compareDraft, compareMatches, comparison, onDraftChange, onSelect }) {
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-line p-4">
        <div>
          <p className="text-xs font-black uppercase text-teal">Semantic Compare</p>
          <h2 className="mt-1 text-xl font-black">Bandingkan Anime</h2>
        </div>
        <GitCompare className="h-6 w-6 text-muted" />
      </div>
      <div className="grid gap-4 p-4">
        <label className="grid gap-2 text-sm font-black text-muted">
          Anime pembanding
          <input
            className="h-11 w-full rounded-lg border border-line bg-[#14120f] px-3 text-ink outline-none placeholder:text-muted focus:border-amber"
            value={compareDraft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Death Note, Naruto, One Piece"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {compareMatches.slice(0, 5).map((entity) => (
            <button
              className="rounded-md border border-line bg-[#14120f] px-2.5 py-1.5 text-xs font-black text-muted transition hover:border-amber hover:text-amber"
              key={entity.id}
              type="button"
              onClick={() => onDraftChange(entity.label)}
            >
              {entity.label}
            </button>
          ))}
        </div>

        {comparison ? (
          <div className="grid gap-4">
            <div className="soft-card grid gap-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-black uppercase text-muted">Similarity Score</span>
                  <h3 className="mt-1 text-lg font-black">{comparison.first.label} vs {comparison.second.label}</h3>
                </div>
                <span className="grid h-16 w-16 place-items-center rounded-full bg-teal/20 text-xl font-black text-teal">{comparison.score}%</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {comparison.reasons.slice(0, 5).map((reason) => <span className="chip" key={reason}>{reason}</span>)}
              </div>
            </div>

            <div className="soft-card grid gap-2 p-4">
              <div className="flex items-center gap-2 text-sm font-black text-teal">
                <Route className="h-4 w-4" />
                Jalur semantik
              </div>
              <p className="font-mono text-sm leading-6 text-muted">{comparison.path}</p>
            </div>

            <div className="grid gap-2">
              {comparison.sharedGroups.length ? comparison.sharedGroups.map((group) => (
                <div className="soft-card p-3" key={group.label}>
                  <span className="text-xs font-black uppercase text-muted">{group.label} bersama</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {group.values.slice(0, 10).map((value) => <span className="chip" key={value}>{value}</span>)}
                  </div>
                </div>
              )) : (
                <div className="soft-card p-3 text-sm text-muted">Tidak ada irisan relasi RDF yang kuat.</div>
              )}
            </div>

            <button className="ghost-btn" type="button" onClick={() => onSelect(comparison.second.id)}>
              Buka detail {comparison.second.label}
            </button>
          </div>
        ) : (
          <div className="soft-card p-4 text-muted">Ketik judul anime untuk membandingkan korelasi semantiknya.</div>
        )}
      </div>
    </section>
  );
}

function Metric({ code, label, value }) {
  return (
    <div className="soft-card min-w-[112px] px-4 py-3">
      <span className="mb-2 grid h-7 w-7 place-items-center rounded-md border border-line bg-[#171512] font-mono text-xs font-black text-amber">
        {code}
      </span>
      <strong className="block text-2xl font-black">{value}</strong>
      <span className="text-xs font-black uppercase text-muted">{label}</span>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }) {
  return (
    <label className="grid gap-2 text-sm font-black text-muted">
      {label}
      <select
        className="h-11 rounded-lg border border-line bg-[#14120f] px-3 text-ink outline-none focus:border-amber"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Semua</option>
        {options.map((item) => (
          <option key={item.label} value={item.label}>
            {item.label} ({item.count})
          </option>
        ))}
      </select>
    </label>
  );
}

function EntityDetail({ entity }) {
  const facts = entityFacts(entity);
  const themes = relationLabels(entity, "hasTheme").slice(0, 10);
  const characters = relationLabels(entity, "featuresCharacter").slice(0, 8);
  const studios = relationLabels(entity, "producedBy");

  return (
    <section className="panel overflow-hidden">
      <div className="grid gap-4 border-b border-line p-5 lg:grid-cols-[1fr_auto]">
        <div>
          <p className="font-mono text-xs font-black uppercase text-muted">{entity.resource}</p>
          <h2 className="mt-2 text-3xl font-black">{entity.label}</h2>
          <p className="mt-3 max-w-4xl leading-7 text-muted">{entity.description}</p>
        </div>
        <div className="flex flex-wrap content-start gap-2 lg:justify-end">
          <span className="chip">{entity.format}</span>
          <span className="chip">{entity.entityType}</span>
          <span className="chip">{entity.genre}</span>
          <span className="chip">{entity.degree} degree</span>
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-2">
        <section>
          <h3 className="mb-3 font-black">Fact Matrix</h3>
          <div className="grid gap-2">
            {facts.map(([label, value]) => (
              <div className="soft-card grid gap-1 px-3 py-2.5" key={label}>
                <span className="text-xs font-black uppercase text-muted">{label}</span>
                <strong className="break-words leading-5">{value}</strong>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h3 className="mb-3 font-black">Relations</h3>
          <div className="grid gap-3">
            <RelationGroup title="Studio" values={studios} />
            <RelationGroup title="Themes" values={themes} />
            <RelationGroup title="Characters" values={characters} />
          </div>
        </section>
      </div>
    </section>
  );
}

function RelationGroup({ title, values }) {
  return (
    <div className="soft-card p-3">
      <span className="text-xs font-black uppercase text-muted">{title}</span>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.length ? values.map((value) => <span className="chip" key={value}>{value}</span>) : <span className="text-sm text-muted">Belum tersedia</span>}
      </div>
    </div>
  );
}

function GraphPreview({ entity, onSelect }) {
  const edges = entity.relations.slice(0, 14);
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-line p-4">
        <div>
          <p className="text-xs font-black uppercase text-teal">Knowledge Graph</p>
          <h2 className="mt-1 text-xl font-black">Neighborhood</h2>
        </div>
        <Network className="h-6 w-6 text-muted" />
      </div>
      <div className="relative min-h-[360px] overflow-hidden bg-[#14120f] p-5">
        <div className="absolute left-1/2 top-1/2 z-10 grid h-28 w-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-teal p-3 text-center text-sm font-black leading-5 text-white shadow-lift">
          {shortLabel(entity.label, 28)}
        </div>
        {edges.map((edge, index) => {
          const angle = (Math.PI * 2 * index) / Math.max(edges.length, 1);
          const x = 50 + Math.cos(angle) * 34;
          const y = 50 + Math.sin(angle) * 34;
          return (
            <button
              className="absolute z-0 grid max-w-[150px] -translate-x-1/2 -translate-y-1/2 gap-1 rounded-lg border border-line bg-[#1d1a15] px-3 py-2 text-center text-xs font-black shadow-sm transition hover:border-amber hover:bg-amber/10"
              key={`${edge.predicate}-${edge.target}`}
              type="button"
              style={{ left: `${x}%`, top: `${y}%` }}
              title={`${edge.predicateUri} ${edge.targetLabel}`}
              onClick={() => onSelect(edge.target)}
            >
              <span className="flex items-center justify-center gap-1 text-[0.68rem] uppercase text-muted">
                <Link2 className="h-3 w-3" />
                {edge.predicate}
              </span>
              {shortLabel(edge.targetLabel, 32)}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function GroundedQa({ question, setQuestion, answer, askGraph }) {
  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-line p-4">
        <p className="text-xs font-black uppercase text-teal">Grounded QA</p>
        <h2 className="mt-1 text-xl font-black">Tanya Graph</h2>
      </div>
      <form className="grid gap-3 p-4" onSubmit={askGraph}>
        <textarea
          className="min-h-28 rounded-lg border border-line bg-[#14120f] p-3 text-ink outline-none placeholder:text-muted focus:border-amber"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Apa tema Death Note?"
        />
        <button className="primary-btn" type="submit">
          Ask AnimeGraph
        </button>
      </form>
      <div className="border-t border-line p-4">
        {answer ? (
          <div className="grid gap-3">
            <h3 className="text-lg font-black">{answer.title}</h3>
            <p className="leading-6 text-muted">{answer.body}</p>
            <div className="grid gap-2">
              {answer.facts.map((fact, index) => (
                <div className="soft-card grid gap-1 px-3 py-2.5" key={`${fact.predicate}-${index}`}>
                  <span className="font-mono text-xs text-muted">{fact.predicate}</span>
                  <strong>{fact.object}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-muted">Jawaban akan selalu memakai fakta dari RDF-derived graph.</p>
        )}
      </div>
    </section>
  );
}

function Distribution({ title, rows }) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  return (
    <section className="panel p-4">
      <h3 className="mb-4 text-lg font-black">{title}</h3>
      <div className="grid gap-3">
        {rows.map((row) => (
          <div className="grid gap-1.5" key={row.label}>
            <div className="flex justify-between gap-3 text-sm">
              <strong>{row.label}</strong>
              <span className="font-black text-muted">{row.count}</span>
            </div>
            <span className="h-2.5 overflow-hidden rounded-full bg-line">
              <span className="block h-full rounded-full bg-green" style={{ width: `${(row.count / max) * 100}%` }} />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TopConnected({ rows, onSelect }) {
  return (
    <section className="panel p-4">
      <h3 className="mb-4 text-lg font-black">Top Connected</h3>
      <div className="grid gap-2">
        {rows.map((row) => (
          <button className="soft-card grid gap-1 px-3 py-2 text-left transition hover:bg-amber/10" key={row.id} type="button" onClick={() => onSelect(row.id)}>
            <strong>{row.label}</strong>
            <span className="text-sm text-muted">{row.genre} / {row.degree} degree</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function shortLabel(label, limit = 16) {
  return label.length > limit ? `${label.slice(0, limit - 1)}.` : label;
}
