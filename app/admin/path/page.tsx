'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, GitBranch, Loader2, ArrowRight, CircleDot, Network } from 'lucide-react';

interface PathStep {
  from: string;
  to: string;
  relation: string;
  label: string;
}

interface SemanticPath {
  sourceAnime: {
    id: string;
    title: string;
    imageUrl: string | null;
    score: number | null;
  };
  targetAnime: {
    id: string;
    title: string;
    imageUrl: string | null;
    score: number | null;
  };
  paths: {
    length: number;
    steps: PathStep[];
    description: string;
    relationTypes: string[];
  }[];
  commonRelations: string[];
  directConnections: boolean;
}

export default function PathPage() {
  const [sourceQuery, setSourceQuery] = useState('');
  const [targetQuery, setTargetQuery] = useState('');
  const [sourceResults, setSourceResults] = useState<any[]>([]);
  const [targetResults, setTargetResults] = useState<any[]>([]);
  const [selectedSource, setSelectedSource] = useState<any>(null);
  const [selectedTarget, setSelectedTarget] = useState<any>(null);
  const [pathResult, setPathResult] = useState<SemanticPath | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState<'source' | 'target' | null>(null);
  const [error, setError] = useState('');

  async function searchAnime(query: string, type: 'source' | 'target') {
    if (!query.trim()) return;

    setSearching(type);
    try {
      const params = new URLSearchParams({ q: query, limit: '5' });
      const response = await fetch(`/api/anime?${params}`);
      const data = await response.json();

      if (type === 'source') {
        setSourceResults(data.data || []);
      } else {
        setTargetResults(data.data || []);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(null);
    }
  }

  function selectSource(anime: any) {
    setSelectedSource(anime);
    setSourceResults([]);
    setSourceQuery(anime.title);
  }

  function selectTarget(anime: any) {
    setSelectedTarget(anime);
    setTargetResults([]);
    setTargetQuery(anime.title);
  }

  async function findPath() {
    if (!selectedSource || !selectedTarget) return;

    setLoading(true);
    setError('');
    setPathResult(null);

    try {
      const response = await fetch(
        `/api/path?source=${selectedSource.id}&target=${selectedTarget.id}&depth=3`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to find path');
      }

      setPathResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to find path');
    } finally {
      setLoading(false);
    }
  }

  const getRelationColor = (relation: string) => {
    if (relation.includes('genre')) return 'text-blue bg-blue/10 border-blue/30';
    if (relation.includes('studio')) return 'text-amber bg-amber/10 border-amber/30';
    if (relation.includes('theme')) return 'text-rose bg-rose/10 border-rose/30';
    return 'text-teal bg-teal/10 border-teal/30';
  };

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
          <h1 className="mt-2 text-3xl font-black text-ink md:text-4xl">Semantic Path</h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted">
            Find relationship paths between two anime entities in the knowledge graph.
          </p>
        </div>
      </header>

      {/* Anime Selection */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Source Anime */}
        <div className="panel p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-teal"></div>
            <h2 className="text-lg font-black text-ink">Source Anime</h2>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted pointer-events-none" />
            <input
              type="text"
              value={sourceQuery}
              onChange={(e) => setSourceQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void searchAnime(sourceQuery, 'source')}
              placeholder="Search source anime..."
              className="field pl-10"
            />
            <button
              onClick={() => void searchAnime(sourceQuery, 'source')}
              disabled={searching === 'source'}
              className="absolute right-2 top-2 ghost-btn text-xs px-3"
            >
              {searching === 'source' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </button>
          </div>

          {sourceResults.length > 0 && (
            <div className="space-y-2">
              {sourceResults.map((anime) => (
                <button
                  key={anime.id}
                  onClick={() => selectSource(anime)}
                  className={`w-full p-3 rounded-lg border text-left transition ${
                    selectedSource?.id === anime.id
                      ? 'border-teal/50 bg-teal/15'
                      : 'soft-card hover:border-amber/70'
                  }`}
                >
                  <div className="flex gap-3">
                    <img src={anime.imageUrl || '/placeholder.png'} className="w-12 h-16 object-cover rounded-md" />
                    <div>
                      <p className="font-black text-ink text-sm">{anime.title}</p>
                      <p className="text-xs text-amber mt-1">{anime.score?.toFixed(2) || 'N/A'}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedSource && !sourceResults.length && (
            <div className="p-4 rounded-lg bg-teal/10 border border-teal/30">
              <p className="text-sm font-black text-teal">Selected:</p>
              <p className="text-ink">{selectedSource.title}</p>
            </div>
          )}
        </div>

        {/* Target Anime */}
        <div className="panel p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-amber"></div>
            <h2 className="text-lg font-black text-ink">Target Anime</h2>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted pointer-events-none" />
            <input
              type="text"
              value={targetQuery}
              onChange={(e) => setTargetQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void searchAnime(targetQuery, 'target')}
              placeholder="Search target anime..."
              className="field pl-10"
            />
            <button
              onClick={() => void searchAnime(targetQuery, 'target')}
              disabled={searching === 'target'}
              className="absolute right-2 top-2 ghost-btn text-xs px-3"
            >
              {searching === 'target' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </button>
          </div>

          {targetResults.length > 0 && (
            <div className="space-y-2">
              {targetResults.map((anime) => (
                <button
                  key={anime.id}
                  onClick={() => selectTarget(anime)}
                  className={`w-full p-3 rounded-lg border text-left transition ${
                    selectedTarget?.id === anime.id
                      ? 'border-amber/50 bg-amber/15'
                      : 'soft-card hover:border-amber/70'
                  }`}
                >
                  <div className="flex gap-3">
                    <img src={anime.imageUrl || '/placeholder.png'} className="w-12 h-16 object-cover rounded-md" />
                    <div>
                      <p className="font-black text-ink text-sm">{anime.title}</p>
                      <p className="text-xs text-amber mt-1">{anime.score?.toFixed(2) || 'N/A'}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedTarget && !targetResults.length && (
            <div className="p-4 rounded-lg bg-amber/10 border border-amber/30">
              <p className="text-sm font-black text-amber">Selected:</p>
              <p className="text-ink">{selectedTarget.title}</p>
            </div>
          )}
        </div>
      </div>

      {/* Find Path Button */}
      <div className="text-center">
        <button
          onClick={findPath}
          disabled={!selectedSource || !selectedTarget || loading}
          className="primary-btn px-10 py-4 text-lg"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <GitBranch className="h-5 w-5" />
          )}
          {loading ? 'Finding Path...' : 'Find Semantic Path'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl border border-rose/50 bg-rose/10 text-rose text-sm">
          {error}
        </div>
      )}

      {/* Path Result */}
      {pathResult && (
        <div className="panel p-6">
          <div className="flex items-center gap-2 mb-6">
            <Network className="h-6 w-6 text-teal" />
            <h2 className="text-xl font-black text-ink">Semantic Path Results</h2>
          </div>

          {/* Connection Status */}
          <div className="mb-6 p-4 rounded-xl bg-[#14120f] border border-line">
            <p className="text-sm text-muted">
              {pathResult.directConnections ? (
                <span className="text-green">✓ Direct semantic connections found</span>
              ) : (
                <span className="text-amber">○ Indirect paths (no direct connection)</span>
              )}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {pathResult.commonRelations.map((rel, i) => (
                <span key={i} className={`text-xs px-2 py-1 rounded border ${getRelationColor(rel)}`}>
                  {rel}
                </span>
              ))}
            </div>
          </div>

          {/* Anime Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <div className="p-4 rounded-xl bg-teal/10 border border-teal/30">
              <p className="text-xs font-black uppercase text-teal mb-2">Source</p>
              <div className="flex gap-3">
                <img src={pathResult.sourceAnime.imageUrl || '/placeholder.png'} className="w-16 h-20 object-cover rounded-lg" />
                <div>
                  <p className="font-black text-ink text-sm">{pathResult.sourceAnime.title}</p>
                  <p className="text-xs text-amber mt-1">{pathResult.sourceAnime.score?.toFixed(2) || 'N/A'}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <ArrowRight className="h-8 w-8 text-muted" />
            </div>

            <div className="p-4 rounded-xl bg-amber/10 border border-amber/30">
              <p className="text-xs font-black uppercase text-amber mb-2">Target</p>
              <div className="flex gap-3">
                <img src={pathResult.targetAnime.imageUrl || '/placeholder.png'} className="w-16 h-20 object-cover rounded-lg" />
                <div>
                  <p className="font-black text-ink text-sm">{pathResult.targetAnime.title}</p>
                  <p className="text-xs text-amber mt-1">{pathResult.targetAnime.score?.toFixed(2) || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Paths */}
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase text-muted tracking-wider">
              Relationship Paths ({pathResult.paths.length})
            </h3>

            {pathResult.paths.map((path, i) => (
              <div key={i} className="p-4 rounded-xl bg-[#14120f] border border-line">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CircleDot className="h-4 w-4 text-teal" />
                    <span className="text-sm font-black text-ink">
                      Path {i + 1} {path.length > 0 ? `(${path.length} hops)` : ''}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {path.relationTypes.map((rt, j) => (
                      <span key={j} className={`text-[10px] px-2 py-0.5 rounded ${getRelationColor(rt)}`}>
                        {rt}
                      </span>
                    ))}
                  </div>
                </div>

                <p className="text-sm text-muted mb-4">{path.description}</p>

                {/* Path Steps */}
                {path.steps.length > 0 && (
                  <div className="flex items-center flex-wrap gap-2">
                    {path.steps.map((step, j) => (
                      <div key={j} className="flex items-center gap-2">
                        <span className="px-3 py-1.5 rounded-lg bg-[#1a1814] border border-line text-sm text-ink">
                          {step.from}
                        </span>
                        <ArrowRight className="h-4 w-4 text-teal shrink-0" />
                        <span className={`px-3 py-1.5 rounded-lg text-sm font-mono ${
                          step.relation === 'ag:hasGenre' ? 'border border-blue/40 bg-blue/10 text-blue' :
                          step.relation === 'ag:producedBy' ? 'border border-amber/40 bg-amber/10 text-amber' :
                          step.relation === 'ag:hasTheme' ? 'border border-rose/40 bg-rose/10 text-rose' :
                          'border border-line bg-[#1a1814] text-muted'
                        }`}>
                          {step.label}
                        </span>
                        {j < path.steps.length - 1 && (
                          <ArrowRight className="h-4 w-4 text-teal shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {pathResult.paths.length === 0 && (
              <p className="text-center text-muted py-8">No paths found within the specified depth</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
