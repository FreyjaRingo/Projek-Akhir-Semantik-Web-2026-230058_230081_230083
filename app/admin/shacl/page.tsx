'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shield, CheckCircle2, AlertTriangle, XCircle, Loader2, Database } from 'lucide-react';

interface ValidationResult {
  ok: boolean;
  valid: boolean;
  totalEntities: number;
  validatedEntities: number;
  violations: {
    entityId: string;
    entityTitle: string;
    constraint: string;
    severity: 'error' | 'warning';
    message: string;
  }[];
  summary: {
    errors: number;
    warnings: number;
    passed: number;
  };
  shapes: {
    name: string;
    description: string;
    passed: number;
    failed: number;
  }[];
}

export default function ShaclPage() {
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'summary' | 'shapes' | 'violations'>('summary');

  useEffect(() => {
    void fetchValidation();
  }, []);

  async function fetchValidation() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/shacl');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Validation failed');
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate');
    } finally {
      setLoading(false);
    }
  }

  const getSeverityIcon = (severity: 'error' | 'warning') => {
    switch (severity) {
      case 'error':
        return <XCircle className="h-5 w-5 text-rose" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber" />;
    }
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
          <p className="text-xs font-black uppercase tracking-[0.2em] text-teal">Data Quality</p>
          <h1 className="mt-2 text-3xl font-black text-ink md:text-4xl">SHACL Validation</h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted">
            Validate RDF data quality against SHACL shapes. Ensure every entity meets minimum metadata requirements.
          </p>
        </div>
        <button
          onClick={() => void fetchValidation()}
          disabled={loading}
          className="primary-btn"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
          {loading ? 'Validating...' : 'Run Validation'}
        </button>
      </header>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl border border-rose/50 bg-rose/10 text-rose text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !result && (
        <div className="panel p-20 flex flex-col items-center justify-center">
          <Loader2 className="h-10 w-10 text-teal animate-spin mb-4" />
          <p className="text-muted">Validating data against SHACL shapes...</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Status Banner */}
          <div className={`panel p-6 ${result.valid ? 'border-green/50 bg-green/10' : 'border-rose/50 bg-rose/10'}`}>
            <div className="flex items-center gap-4">
              {result.valid ? (
                <CheckCircle2 className="h-12 w-12 text-green" />
              ) : (
                <XCircle className="h-12 w-12 text-rose" />
              )}
              <div>
                <h2 className={`text-2xl font-black ${result.valid ? 'text-green' : 'text-rose'}`}>
                  {result.valid ? 'All Validations Passed' : 'Validation Failed'}
                </h2>
                <p className="text-muted mt-1">
                  {result.totalEntities.toLocaleString()} entities validated
                </p>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="panel p-5">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-5 w-5 text-rose" />
                <span className="text-xs font-black uppercase text-muted">Errors</span>
              </div>
              <p className={`text-3xl font-black ${result.summary.errors > 0 ? 'text-rose' : 'text-green'}`}>
                {result.summary.errors}
              </p>
            </div>
            <div className="panel p-5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-amber" />
                <span className="text-xs font-black uppercase text-muted">Warnings</span>
              </div>
              <p className="text-3xl font-black text-amber">{result.summary.warnings}</p>
            </div>
            <div className="panel p-5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-green" />
                <span className="text-xs font-black uppercase text-muted">Passed</span>
              </div>
              <p className="text-3xl font-black text-green">{result.summary.passed}</p>
            </div>
            <div className="panel p-5">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-5 w-5 text-teal" />
                <span className="text-xs font-black uppercase text-muted">Entities</span>
              </div>
              <p className="text-3xl font-black text-teal">{result.totalEntities.toLocaleString()}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="panel overflow-hidden">
            <div className="flex border-b border-line">
              {(['summary', 'shapes', 'violations'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 text-sm font-black uppercase tracking-wider transition ${
                    activeTab === tab
                      ? 'border-b-2 border-teal text-teal'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="p-6">
              {activeTab === 'summary' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-black text-ink mb-4">Validation Summary</h3>
                    <p className="text-muted mb-4">
                      Based on SHACL shapes defined in the proposal (Section 11.5):
                    </p>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-3 p-3 rounded-lg bg-[#14120f] border border-line">
                        <XCircle className="h-5 w-5 text-rose shrink-0 mt-0.5" />
                        <div>
                          <p className="font-black text-rose">EntityTypeRequired</p>
                          <p className="text-xs text-muted">Setiap ag:Entity wajib memiliki ag:entityType</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3 p-3 rounded-lg bg-[#14120f] border border-line">
                        <XCircle className="h-5 w-5 text-rose shrink-0 mt-0.5" />
                        <div>
                          <p className="font-black text-rose">DescriptionRequired</p>
                          <p className="text-xs text-muted">Setiap ag:Entity wajib memiliki ag:description</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3 p-3 rounded-lg bg-[#14120f] border border-line">
                        <AlertTriangle className="h-5 w-5 text-amber shrink-0 mt-0.5" />
                        <div>
                          <p className="font-black text-amber">GenreRecommended</p>
                          <p className="text-xs text-muted">Setiap ag:CreativeWork sebaiknya memiliki genre</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3 p-3 rounded-lg bg-[#14120f] border border-line">
                        <AlertTriangle className="h-5 w-5 text-amber shrink-0 mt-0.5" />
                        <div>
                          <p className="font-black text-amber">StudioRecommended</p>
                          <p className="text-xs text-muted">Setiap ag:Anime sebaiknya memiliki studio</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3 p-3 rounded-lg bg-[#14120f] border border-line">
                        <AlertTriangle className="h-5 w-5 text-amber shrink-0 mt-0.5" />
                        <div>
                          <p className="font-black text-amber">ThemeRecommended</p>
                          <p className="text-xs text-muted">Setiap ag:Anime sebaiknya memiliki theme</p>
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === 'shapes' && (
                <div className="space-y-4">
                  {result.shapes.map((shape, i) => (
                    <div key={i} className="p-4 rounded-lg bg-[#14120f] border border-line">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {shape.failed > 0 ? (
                            <XCircle className="h-5 w-5 text-rose" />
                          ) : (
                            <CheckCircle2 className="h-5 w-5 text-green" />
                          )}
                          <h4 className="font-black text-ink">{shape.name}</h4>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-green">{shape.passed} passed</span>
                          <span className={shape.failed > 0 ? 'text-rose' : 'text-muted'}>{shape.failed} failed</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted">{shape.description}</p>
                      <div className="mt-3 h-2 rounded-full bg-[#1a1814] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            shape.failed === 0 ? 'bg-green' :
                            shape.failed > shape.passed ? 'bg-rose' : 'bg-amber'
                          }`}
                          style={{ width: `${Math.min(100, (shape.passed / (shape.passed + shape.failed || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'violations' && (
                <div className="space-y-3">
                  {result.violations.length === 0 ? (
                    <div className="text-center py-10">
                      <CheckCircle2 className="h-10 w-10 text-green mx-auto mb-3" />
                      <p className="text-muted">No violations found!</p>
                    </div>
                  ) : (
                    result.violations.map((v, i) => (
                      <div key={i} className="flex items-start gap-3 p-4 rounded-lg bg-[#14120f] border border-line">
                        {getSeverityIcon(v.severity)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-black text-ink">{v.constraint}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded ${
                              v.severity === 'error' ? 'bg-rose/20 text-rose' : 'bg-amber/20 text-amber'
                            }`}>
                              {v.severity}
                            </span>
                          </div>
                          <p className="text-sm text-muted mt-1">{v.message}</p>
                          <p className="text-xs text-teal mt-2 font-mono">
                            {v.entityTitle} ({v.entityId})
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
