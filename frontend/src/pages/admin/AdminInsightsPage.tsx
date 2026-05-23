import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
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

  const maxGenreCount = result?.data.topGenres[0]?.[1] ?? 1;
  const maxMonthCount = result ? Math.max(...result.data.monthlyTrend.map(([, c]) => c)) : 1;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-stone-900">Loan Pattern Insights</h1>
          <p className="text-stone-500 text-sm mt-1">AI analysis of borrowing trends, powered by Claude Haiku</p>
        </div>
        <button onClick={generate} disabled={loading}
          className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
          {loading
            ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Analyzing…</>
            : result ? '↺ Regenerate' : '✨ Generate Insights'}
        </button>
      </div>

      {!result && !loading && (
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-16 text-center">
          <div className="text-5xl mb-4">📊</div>
          <p className="text-stone-500">Click "Generate Insights" to analyze loan patterns across the collection.</p>
        </div>
      )}

      {loading && !result && (
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-16 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto mb-4" />
          <p className="text-stone-400 text-sm">Claude Haiku is analyzing your loan data…</p>
        </div>
      )}

      {result && (
        <div className="space-y-5">

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-4 text-center">
              <p className="text-3xl font-bold text-stone-900">{result.data.totalLoans}</p>
              <p className="text-xs text-stone-400 mt-0.5">Total Loans</p>
            </div>
            <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-4 text-center">
              <p className="text-3xl font-bold text-stone-900">{result.data.topGenres.length}</p>
              <p className="text-xs text-stone-400 mt-0.5">Active Genres</p>
            </div>
            <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-4 text-center">
              <p className="text-3xl font-bold text-stone-900">{result.data.topAuthors.length}</p>
              <p className="text-xs text-stone-400 mt-0.5">Top Authors</p>
            </div>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-2 gap-4">

            {/* Genre bar chart */}
            <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-5">
              <h3 className="font-semibold text-stone-700 text-sm mb-4">Top Genres</h3>
              <div className="space-y-3">
                {result.data.topGenres.map(([genre, count]) => (
                  <div key={genre}>
                    <div className="flex justify-between text-xs text-stone-500 mb-1">
                      <span>{genre}</span>
                      <span className="font-medium text-stone-700">{count}</span>
                    </div>
                    <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full transition-all duration-500"
                        style={{ width: `${(count / maxGenreCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly trend bar chart */}
            <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-5">
              <h3 className="font-semibold text-stone-700 text-sm mb-4">Checkouts per Month</h3>
              <div className="flex items-end gap-2 h-28">
                {result.data.monthlyTrend.map(([month, count]) => (
                  <div key={month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-medium text-stone-600">{count}</span>
                    <div
                      className="w-full bg-brand-500 rounded-t-sm transition-all duration-500"
                      style={{ height: `${Math.max((count / maxMonthCount) * 80, 4)}%` }}
                    />
                    <span className="text-xs text-stone-400">{month.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top authors */}
          <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-5">
            <h3 className="font-semibold text-stone-700 text-sm mb-3">Top Authors</h3>
            <div className="flex flex-wrap gap-2">
              {result.data.topAuthors.map(([author, count], i) => (
                <span key={author}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                    i === 0 ? 'bg-brand-100 text-brand-800' :
                    i === 1 ? 'bg-stone-100 text-stone-700' :
                    'bg-stone-50 text-stone-500'
                  }`}>
                  {author} · {count}
                </span>
              ))}
            </div>
          </div>

          {/* AI narrative */}
          <div className="bg-white rounded-xl border border-brand-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-base">🤖</span>
              <h2 className="font-semibold text-stone-800 text-sm">AI Analysis</h2>
              <span className="text-xs text-stone-400 ml-auto">
                Generated {new Date(result.generatedAt).toLocaleString()}
              </span>
            </div>
            <div className="prose prose-sm prose-stone max-w-none
              prose-headings:font-semibold prose-headings:text-stone-800
              prose-h2:text-base prose-h2:mt-5 prose-h2:mb-2
              prose-h3:text-sm prose-h3:mt-4 prose-h3:mb-1
              prose-p:text-stone-600 prose-p:leading-relaxed prose-p:my-1
              prose-strong:text-stone-800 prose-strong:font-semibold
              prose-ul:my-1 prose-li:text-stone-600 prose-li:my-0.5
              prose-ol:my-1">
              <ReactMarkdown>{result.insights}</ReactMarkdown>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
