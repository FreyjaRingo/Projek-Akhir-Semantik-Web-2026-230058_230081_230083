'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageSquare, Search, Loader2, ChevronRight, Database } from 'lucide-react';

interface QAResult {
  question: string;
  answer: string;
  intent: string;
  confidence: number;
  grounding: {
    anime: string;
    fact: string;
    source: string;
  }[];
  relatedAnime?: {
    id: string;
    title: string;
    score: number | null;
    imageUrl: string | null;
  }[];
}

const exampleQuestions = [
  'anime apa yang bergenre Action?',
  'anime dari studio MAPPA',
  'karakter yang muncul di Naruto',
  'anime tahun 2024',
  'anime yang mirip dengan Frieren',
  'deskripsi anime One Piece'
];

export default function QAPage() {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<QAResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<QAResult[]>([]);

  async function askQuestion(q: string = question) {
    if (!q.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch(`/api/qa?q=${encodeURIComponent(q)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'QA failed');
      }

      setResult(data);
      setHistory(prev => [data, ...prev.slice(0, 9)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to answer question');
    } finally {
      setLoading(false);
    }
  }

  function askExample(q: string) {
    setQuestion(q);
    void askQuestion(q);
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
          <p className="text-xs font-black uppercase tracking-[0.2em] text-teal">Semantic Web</p>
          <h1 className="mt-2 text-3xl font-black text-ink md:text-4xl">Grounded QA</h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted">
            Ask questions in natural language. Every answer is grounded in RDF facts from the knowledge graph.
          </p>
        </div>
      </header>

      {/* Example Questions */}
      <div className="panel p-4">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-muted mb-3">Example Questions</p>
        <div className="flex flex-wrap gap-2">
          {exampleQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => askExample(q)}
              className="rounded-lg border border-line bg-[#14120f] px-3 py-1.5 text-xs text-muted hover:border-teal/50 hover:text-teal transition"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Question Input */}
      <div className="panel p-5">
        <form onSubmit={(e) => { e.preventDefault(); void askQuestion(); }} className="flex gap-3">
          <div className="relative flex-1">
            <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted pointer-events-none" />
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about anime... (e.g., 'anime apa yang diproduksi MAPPA?')"
              className="field pl-12 text-lg py-4"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="primary-btn px-8"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
            {loading ? 'Thinking...' : 'Ask'}
          </button>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl border border-rose/50 bg-rose/10 text-rose text-sm">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="grid gap-6">
          {/* Answer Card */}
          <div className="panel p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs font-black uppercase px-2 py-1 rounded ${
                result.confidence > 0.7 ? 'bg-green/20 text-green' :
                result.confidence > 0.4 ? 'bg-amber/20 text-amber' :
                'bg-rose/20 text-rose'
              }`}>
                {result.intent.replace('_', ' ')}
              </span>
              <span className="text-xs text-muted">
                Confidence: {Math.round(result.confidence * 100)}%
              </span>
            </div>

            <h2 className="text-2xl font-black text-ink mb-4">{result.answer}</h2>

            {/* Related Anime */}
            {result.relatedAnime && result.relatedAnime.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-black uppercase text-muted mb-3">Related Anime</p>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {result.relatedAnime.slice(0, 5).map((anime) => (
                    <div key={anime.id} className="soft-card p-3">
                      <img
                        src={anime.imageUrl || '/placeholder.png'}
                        alt={anime.title}
                        className="w-full h-24 object-cover rounded-lg mb-2 bg-[#14120f]"
                      />
                      <p className="text-xs font-black text-ink truncate">{anime.title}</p>
                      {anime.score && (
                        <p className="text-xs text-amber mt-1">{anime.score.toFixed(2)}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Grounding Facts */}
          <div className="panel p-5">
            <div className="flex items-center gap-2 mb-4">
              <Database className="h-5 w-5 text-teal" />
              <h3 className="text-lg font-black text-ink">RDF Grounding Facts</h3>
            </div>

            <div className="space-y-3">
              {result.grounding.map((fact, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[#14120f] border border-line">
                  <ChevronRight className="h-4 w-4 text-teal mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-ink truncate">{fact.anime}</p>
                    <p className="text-xs text-muted mt-1 font-mono">{fact.fact}</p>
                    <p className="text-[10px] text-teal/70 mt-1 uppercase tracking-wider">{fact.source}</p>
                  </div>
                </div>
              ))}

              {result.grounding.length === 0 && (
                <p className="text-sm text-muted text-center py-4">No grounding facts available</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="panel p-5">
          <p className="text-xs font-black uppercase text-muted mb-3">Recent Questions</p>
          <div className="space-y-2">
            {history.slice(1, 6).map((h, i) => (
              <button
                key={i}
                onClick={() => {
                  setQuestion(h.question);
                  setResult(h);
                }}
                className="w-full text-left p-3 rounded-lg bg-[#14120f] border border-line hover:border-teal/50 transition"
              >
                <p className="text-sm text-ink">{h.question}</p>
                <p className="text-xs text-muted mt-1 truncate">{h.answer}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
