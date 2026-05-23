import { useState } from 'react';
import { adminClient } from '../../api/client';

interface InsightsData {
  insights: string;
  data: {
    totalLoans: number;
    topGenres: [string, number][];
    topAuthors: [string, number][];
    monthlyTrend: [string, number][];
  };
  generatedAt: string;
}

export function AdminInsightsPage() {
  const [result, setResult] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await adminClient.get('/ai/insights');
      setResult(res.data.data);
    } catch { /* handled */ }
    finally { setLoading(false); }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-stone-900">Loan Pattern Insights</h1>
          <p className="text-stone-500 text-sm mt-1">AI analysis of borrowing trends, powered by Claude Haiku</p>
        </div>
        <button onClick={generate} disabled={loading}
          className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
          {loading ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Analyzing…</> : '✨ Generate Insights'}
        </button>
      </div>

      {!result && !loading && (
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-16 text-center">
          <div className="text-5xl mb-4">📊</div>
          <p className="text-stone-500">Click "Generate Insights" to analyze loan patterns across the collection.</p>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* AI narrative */}
          <div className="bg-white rounded-xl border border-brand-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🤖</span>
              <h2 className="font-semibold text-stone-800">AI Analysis</h2>
              <span className="text-xs text-stone-400 ml-auto">Generated {new Date(result.generatedAt).toLocaleString()}</span>
            </div>
            <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-line">{result.insights}</p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-5">
              <h3 className="font-semibold text-stone-700 text-sm mb-3">Top Genres</h3>
              <div className="space-y-2">
                {result.data.topGenres.map(([genre, count]) => (
                  <div key={genre} className="flex items-center gap-3">
                    <div className="flex-1 bg-stone-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-brand-500 h-full rounded-full" style={{ width: `${(count / result.data.topGenres[0][1]) * 100}%` }} />
                    </div>
                    <span className="text-xs text-stone-600 w-28 text-right">{genre} ({count})</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-5">
              <h3 className="font-semibold text-stone-700 text-sm mb-3">Top Authors</h3>
              <div className="space-y-2">
                {result.data.topAuthors.map(([author, count]) => (
                  <div key={author} className="flex items-center justify-between text-sm">
                    <span className="text-stone-700 truncate">{author}</span>
                    <span className="text-stone-400 ml-2 flex-shrink-0">{count} loans</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-5">
            <h3 className="font-semibold text-stone-700 text-sm mb-3">Monthly Trend (last 6 months)</h3>
            <div className="flex items-end gap-3 h-24">
              {result.data.monthlyTrend.map(([month, count]) => {
                const max = Math.max(...result.data.monthlyTrend.map(([, c]) => c));
                return (
                  <div key={month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-stone-500">{count}</span>
                    <div className="w-full bg-brand-500 rounded-t" style={{ height: `${(count / max) * 80}%` }} />
                    <span className="text-xs text-stone-400">{month.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
