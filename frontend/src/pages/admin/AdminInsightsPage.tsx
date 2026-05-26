import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { adminClient } from '../../api/client';

interface InsightsData {
  insights: string;
  data: {
    totalBooks: number;
    totalLoans: number;
    activeLoans: number;
    overdueLoans: number;
    activeMembers: number;
    overdueBuckets: { '1-7 days': number; '8-14 days': number; '15-30 days': number; '30+ days': number };
    topGenres: [string, number][];
    topAuthors: [string, number][];
    monthlyTrend: [string, number][];
    byFormat: { physical: number; audiobook: number; ebook: number };
    analysisPeriod: { from: string; to: string };
  };
  generatedAt: string;
}

function StatCard({ value, label, sub, accent }: { value: string | number; label: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-4">
      <p className={`text-3xl font-bold ${accent ?? 'text-stone-900'}`}>{value}</p>
      <p className="text-xs text-stone-400 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
    </div>
  );
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

  const d = result?.data;
  const maxGenreCount = d?.topGenres[0]?.[1] ?? 1;
  const maxMonthCount = d ? Math.max(...d.monthlyTrend.map(([, c]) => c)) : 1;
  const totalOverdue = d ? Object.values(d.overdueBuckets).reduce((a, b) => a + b, 0) : 0;
  const overdueRate = d?.activeLoans ? ((d.overdueLoans / d.activeLoans) * 100).toFixed(1) : '0';

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

      {result && d && (
        <div className="space-y-5">

          {/* Stats — row 1 */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard value={d.totalBooks} label="Books in Catalog" />
            <StatCard value={d.activeMembers} label="Active Members" sub="unique borrowers" />
            <StatCard
              value={`${d.analysisPeriod.from} → ${d.analysisPeriod.to}`}
              label="Analysis Period"
            />
          </div>

          {/* Stats — row 2 */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard value={d.totalLoans} label="Total Loans" />
            <StatCard value={d.activeLoans} label="Active Loans" />
            <StatCard
              value={d.overdueLoans}
              label="Overdue Loans"
              sub={`${overdueRate}% of active`}
              accent={d.overdueLoans > 0 ? 'text-red-600' : 'text-stone-900'}
            />
          </div>

          {/* Format breakdown */}
          <div className="grid grid-cols-3 gap-4">
            {([
              { key: 'physical', label: 'Physical', icon: '📚' },
              { key: 'audiobook', label: 'Audiobook', icon: '🎧' },
              { key: 'ebook',    label: 'Ebook / Kindle', icon: '📱' },
            ] as const).map(({ key, label, icon }) => {
              const count = d.byFormat[key];
              const pct = d.totalLoans > 0 ? ((count / d.totalLoans) * 100).toFixed(0) : '0';
              return (
                <div key={key} className="bg-white rounded-xl border border-stone-100 shadow-sm p-4 flex items-center gap-4">
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <p className="text-2xl font-bold text-stone-900">{count}</p>
                    <p className="text-xs text-stone-400">{label} · {pct}%</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Overdue severity */}
          {totalOverdue > 0 && (
            <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-5">
              <h3 className="font-semibold text-stone-700 text-sm mb-4">Overdue Severity</h3>
              <div className="grid grid-cols-4 gap-3">
                {([
                  { key: '1-7 days',   label: '1–7 days',   color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
                  { key: '8-14 days',  label: '8–14 days',  color: 'bg-orange-50 border-orange-200 text-orange-700' },
                  { key: '15-30 days', label: '15–30 days', color: 'bg-red-50 border-red-200 text-red-700' },
                  { key: '30+ days',   label: '30+ days',   color: 'bg-red-100 border-red-300 text-red-800' },
                ] as const).map(({ key, label, color }) => (
                  <div key={key} className={`rounded-lg border p-3 text-center ${color}`}>
                    <p className="text-2xl font-bold">{d.overdueBuckets[key]}</p>
                    <p className="text-xs mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
              {/* Stacked proportion bar */}
              <div className="mt-4 h-2 rounded-full overflow-hidden flex gap-0.5">
                {([
                  { key: '1-7 days',   bg: 'bg-yellow-400' },
                  { key: '8-14 days',  bg: 'bg-orange-400' },
                  { key: '15-30 days', bg: 'bg-red-400' },
                  { key: '30+ days',   bg: 'bg-red-700' },
                ] as const).map(({ key, bg }) => {
                  const w = totalOverdue > 0 ? (d.overdueBuckets[key] / totalOverdue) * 100 : 0;
                  return w > 0 ? <div key={key} className={`h-full ${bg}`} style={{ width: `${w}%` }} /> : null;
                })}
              </div>
            </div>
          )}

          {/* Genre + Monthly charts */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-5">
              <h3 className="font-semibold text-stone-700 text-sm mb-4">Top Genres</h3>
              <div className="space-y-3">
                {d.topGenres.map(([genre, count]) => (
                  <div key={genre}>
                    <div className="flex justify-between text-xs text-stone-500 mb-1">
                      <span>{genre}</span>
                      <span className="font-medium text-stone-700">
                        {count} · {d.totalLoans > 0 ? ((count / d.totalLoans) * 100).toFixed(0) : 0}%
                      </span>
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

            <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-5">
              <h3 className="font-semibold text-stone-700 text-sm mb-4">Checkouts per Month</h3>
              <div className="flex items-end gap-2 h-28">
                {d.monthlyTrend.map(([month, count]) => (
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
              {d.topAuthors.map(([author, count], i) => (
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
              prose-ol:my-1
              prose-table:w-full prose-table:text-xs
              prose-thead:bg-stone-50
              prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:text-stone-700 prose-th:border prose-th:border-stone-200
              prose-td:px-3 prose-td:py-2 prose-td:text-stone-600 prose-td:border prose-td:border-stone-100
              prose-tr:even:bg-stone-50/50">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.insights}</ReactMarkdown>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
