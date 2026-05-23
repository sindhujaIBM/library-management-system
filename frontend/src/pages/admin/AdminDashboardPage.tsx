import { useEffect, useState } from 'react';
import { adminClient } from '../../api/client';
import { Link } from 'react-router-dom';

interface Loan {
  loanId: string; ISBN: string; bookTitle: string; bookAuthor: string;
  userId: string; userEmail: string; userName: string;
  checkoutDate: string; returnDueDate: string; isOverdue: boolean; loanSK: string;
}

export function AdminDashboardPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminClient.get('/loans/active')
      .then(res => setLoans(res.data.data.loans))
      .finally(() => setLoading(false));
  }, []);

  const overdue = loans.filter(l => l.isOverdue);
  const active = loans.filter(l => !l.isOverdue);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-stone-900">Admin Dashboard</h1>
        <div className="flex gap-3">
          <Link to="/admin/alerts" className="text-sm bg-amber-50 text-amber-700 border border-amber-200 px-4 py-2 rounded-lg hover:bg-amber-100 transition-colors">AI Alerts</Link>
          <Link to="/admin/insights" className="text-sm bg-brand-50 text-brand-700 border border-brand-200 px-4 py-2 rounded-lg hover:bg-brand-100 transition-colors">Insights</Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Active Loans', value: loans.length, color: 'brand' },
          { label: 'Overdue', value: overdue.length, color: 'red' },
          { label: 'On Time', value: active.length, color: 'green' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-stone-100 shadow-sm p-5">
            <p className="text-sm text-stone-500 mb-1">{label}</p>
            <p className={`text-3xl font-bold text-${color}-600`}>{value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
            <h2 className="font-semibold text-stone-800">All Active Loans</h2>
          </div>
          {loans.length === 0 ? (
            <p className="text-center text-stone-400 py-10">No active loans.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs text-stone-500 uppercase tracking-wide">
                <tr>
                  {['Book', 'Borrower', 'Checkout', 'Due', 'Status'].map(h => (
                    <th key={h} className="px-5 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {loans.map(loan => (
                  <tr key={loan.loanId} className="hover:bg-stone-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-stone-800">{loan.bookTitle}</p>
                      <p className="text-xs text-stone-400">{loan.bookAuthor}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-stone-700">{loan.userName}</p>
                      <p className="text-xs text-stone-400">{loan.userEmail}</p>
                    </td>
                    <td className="px-5 py-3 text-stone-500">{new Date(loan.checkoutDate).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-stone-500">{new Date(loan.returnDueDate).toLocaleDateString()}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${loan.isOverdue ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {loan.isOverdue ? 'Overdue' : 'On time'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
