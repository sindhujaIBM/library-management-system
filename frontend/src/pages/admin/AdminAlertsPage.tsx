import { useEffect, useState } from 'react';
import { adminClient } from '../../api/client';

interface Alert {
  alertId: string;
  type: 'demand_order' | 'stale_auction' | 'series_release';
  status: 'pending' | 'approved' | 'rejected';
  payload: Record<string, unknown>;
  generatedAt: string;
  resolvedAt?: string;
}

const TYPE_LABELS: Record<string, string> = {
  demand_order: '📦 High Demand — Order More',
  stale_auction: '🏷️ Stale Inventory — Consider Auction',
  series_release: '📚 New Series Release',
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
        <h1 className="text-2xl font-serif font-bold text-stone-900">AI Alerts</h1>
        <p className="text-stone-500 text-sm mt-1">AI-generated recommendations — you approve or reject. Nothing happens automatically.</p>
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
          {alerts.map(alert => (
            <div key={alert.alertId} className="bg-white rounded-xl border border-stone-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-stone-800">{TYPE_LABELS[alert.type] ?? alert.type}</span>
                    <span className="text-xs text-stone-400">{new Date(alert.generatedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="bg-stone-50 rounded-lg p-3 text-sm text-stone-700 font-mono whitespace-pre-wrap">
                    {JSON.stringify(alert.payload, null, 2)}
                  </div>
                </div>
                {alert.status === 'pending' && (
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button onClick={() => resolve(alert.alertId, 'approved')} disabled={resolving === alert.alertId}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                      Approve
                    </button>
                    <button onClick={() => resolve(alert.alertId, 'rejected')} disabled={resolving === alert.alertId}
                      className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
