import { useEffect, useState } from 'react';
import { adminClient } from '../../api/client';

interface Alert {
  alertId: string;
  type: 'demand_order' | 'stale_auction' | 'series_release' | 'series_missing';
  status: 'pending' | 'approved' | 'rejected';
  payload: Record<string, unknown>;
  generatedAt: string;
  resolvedAt?: string;
}

function DemandOrderCard({ p }: { p: Record<string, unknown> }) {
  const title = String(p.title ?? '');
  const author = String(p.author ?? '');
  const isbn = String(p.ISBN ?? '');
  const holds = Number(p.holdQueueLength ?? 0);
  const copies = Number(p.currentCopies ?? 0);
  const recommended = Number(p.recommendedCopiesOrdered ?? 0);
  const waitRatio = Math.round((holds / Math.max(copies, 1)) * 10) / 10;
  const cost = p.estimatedCostCAD != null ? Number(p.estimatedCostCAD).toFixed(2) : null;
  const reasoning = p.reasoning ? String(p.reasoning) : null;
  const amazonUrl = p.amazonSearchUrl ? String(p.amazonSearchUrl) : null;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-lg font-semibold text-stone-900">{title}</p>
        <p className="text-sm text-stone-500">{author} · ISBN {isbn}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-amber-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">{holds}</p>
          <p className="text-xs text-amber-600 mt-0.5">patrons waiting</p>
        </div>
        <div className="bg-stone-100 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-stone-700">{copies}</p>
          <p className="text-xs text-stone-500 mt-0.5">copies owned</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-700">+{recommended}</p>
          <p className="text-xs text-green-600 mt-0.5">recommended order</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-stone-500">
        <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
        {waitRatio}x wait ratio — {holds} holds for {copies} {copies === 1 ? 'copy' : 'copies'}
      </div>

      {cost && (
        <p className="text-sm text-stone-600">
          Estimated cost: <span className="font-semibold">${cost} CAD</span>
        </p>
      )}

      {reasoning && (
        <p className="text-sm text-stone-500 italic border-l-2 border-stone-200 pl-3">{reasoning}</p>
      )}

      {amazonUrl && (
        <a href={amazonUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          Order on Amazon.ca →
        </a>
      )}
    </div>
  );
}

function StaleAuctionCard({ p }: { p: Record<string, unknown> }) {
  const title = String(p.title ?? '');
  const author = String(p.author ?? '');
  const isbn = String(p.ISBN ?? '');
  const daysIdle = Number(p.daysSinceLastLoan ?? 0);
  const copies = Number(p.currentCopies ?? 0);
  const price = Number(p.suggestedStartingPriceCAD ?? 0);
  const action = String(p.suggestedAction ?? '');
  const reasoning = p.reasoning ? String(p.reasoning) : null;
  const lastDate = p.lastBorrowedDate
    ? new Date(String(p.lastBorrowedDate)).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Never borrowed';

  return (
    <div className="space-y-4">
      <div>
        <p className="text-lg font-semibold text-stone-900">{title}</p>
        <p className="text-sm text-stone-500">{author} · ISBN {isbn}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-red-700">{daysIdle}</p>
          <p className="text-xs text-red-500 mt-0.5">days idle</p>
        </div>
        <div className="bg-stone-100 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-stone-700">{copies}</p>
          <p className="text-xs text-stone-500 mt-0.5">copies owned</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">${price}</p>
          <p className="text-xs text-blue-500 mt-0.5">suggested price</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-stone-500">
        <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
        Last borrowed: {lastDate}
      </div>

      <div className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-700">
        {action}
      </div>

      {reasoning && (
        <p className="text-sm text-stone-500 italic border-l-2 border-stone-200 pl-3">{reasoning}</p>
      )}
    </div>
  );
}

function SeriesReleaseCard({ p }: { p: Record<string, unknown> }) {
  const title = String(p.title ?? '');
  const author = String(p.author ?? '');
  const series = String(p.series ?? '');
  const notif = p.notificationsSent ? Number(p.notificationsSent) : null;
  return (
    <div className="space-y-2">
      <p className="text-lg font-semibold text-stone-900">{title}</p>
      <p className="text-sm text-stone-500">{author} · Series: {series}</p>
      {notif && <p className="text-sm text-stone-600">{notif} patrons notified</p>}
    </div>
  );
}

interface MissingBook { title: string; isbn: string; publishedDate: string }

function SeriesMissingCard({ p }: { p: Record<string, unknown> }) {
  const seriesName = String(p.seriesName ?? '');
  const author = String(p.author ?? '');
  const catalogTitles = (p.catalogTitles as string[] | undefined) ?? [];
  const missingBooks = (p.missingBooks as MissingBook[] | undefined) ?? [];

  return (
    <div className="space-y-4">
      <div>
        <p className="text-lg font-semibold text-stone-900">{seriesName}</p>
        <p className="text-sm text-stone-500">by {author}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{catalogTitles.length}</p>
          <p className="text-xs text-green-600 mt-0.5">in catalog</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">{missingBooks.length}</p>
          <p className="text-xs text-amber-600 mt-0.5">not in catalog</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Missing from catalog</p>
        <ul className="space-y-1">
          {missingBooks.map(b => (
            <li key={b.isbn} className="flex items-start gap-2 text-sm text-stone-700">
              <span className="text-amber-500 mt-0.5">•</span>
              <span>{b.title}{b.publishedDate ? <span className="text-stone-400 ml-1">({b.publishedDate.slice(0, 4)})</span> : null}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="text-xs text-stone-400 border-t border-stone-100 pt-3">
        Currently in catalog: {catalogTitles.join(', ')}
      </div>
    </div>
  );
}

function AlertPayload({ type, payload }: { type: Alert['type']; payload: Record<string, unknown> }) {
  if (type === 'demand_order') return <DemandOrderCard p={payload} />;
  if (type === 'stale_auction') return <StaleAuctionCard p={payload} />;
  if (type === 'series_missing') return <SeriesMissingCard p={payload} />;
  return <SeriesReleaseCard p={payload} />;
}

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  demand_order:   { label: '📦 Order More Copies',         className: 'bg-amber-100 text-amber-800' },
  stale_auction:  { label: '🏷️ Consider Deaccessioning',  className: 'bg-red-100 text-red-700' },
  series_release: { label: '📚 New Series Release',         className: 'bg-blue-100 text-blue-700' },
  series_missing: { label: '📖 Incomplete Series',          className: 'bg-purple-100 text-purple-800' },
};

export function AdminAlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    adminClient.get(`/ai/alerts?status=${filter}`)
      .then(res => setAlerts(res.data.data.alerts))
      .finally(() => setLoading(false));
  }, [filter]);

  async function resolve(alertId: string, decision: 'approved' | 'rejected') {
    setResolving(alertId);
    try {
      await adminClient.post(`/ai/alerts/${alertId}/resolve`, { decision });
      setAlerts(a => a.filter(x => x.alertId !== alertId));
    } catch { /* handled */ }
    finally { setResolving(null); }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-stone-900">Alerts</h1>
        <p className="text-stone-500 text-sm mt-1">Recommendations surfaced by the system — you approve or reject. Nothing happens automatically.</p>
      </div>

      <div className="flex gap-2 mb-6">
        {(['pending', 'approved', 'rejected'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${filter === s ? 'bg-brand-600 text-white' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'}`}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <div className="text-4xl mb-3">✅</div>
          <p>No {filter} alerts.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map(alert => {
            const badge = TYPE_BADGE[alert.type];
            return (
              <div key={alert.alertId} className="bg-white rounded-xl border border-stone-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1 min-w-0 space-y-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.className}`}>
                        {badge.label}
                      </span>
                      <span className="text-xs text-stone-400">
                        {new Date(alert.generatedAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      {alert.status !== 'pending' && alert.resolvedAt && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${alert.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'}`}>
                          {alert.status === 'approved' ? 'Approved' : 'Rejected'} {new Date(alert.resolvedAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <AlertPayload type={alert.type} payload={alert.payload} />
                  </div>

                  {alert.status === 'pending' && (
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button onClick={() => resolve(alert.alertId, 'approved')} disabled={resolving === alert.alertId}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap">
                        ✓ Approve
                      </button>
                      <button onClick={() => resolve(alert.alertId, 'rejected')} disabled={resolving === alert.alertId}
                        className="bg-white hover:bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap">
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
