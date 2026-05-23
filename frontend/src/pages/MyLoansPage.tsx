import { useEffect, useState } from 'react';
import { booksClient } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface Loan {
  loanId: string; ISBN: string; bookTitle: string; bookAuthor: string;
  checkoutDate: string; returnDueDate: string; returnedDate?: string;
  status: string; renewalCount: number; loanSK: string; isOverdue: boolean;
}

export function MyLoansPage() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [returning, setReturning] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user) return;
    booksClient.get(`/loans/user/${user.id}`)
      .then(res => setLoans(res.data.data.loans))
      .finally(() => setLoading(false));
  }, [user]);

  async function handleReturn(loan: Loan) {
    setReturning(loan.loanId);
    try {
      await booksClient.post('/loans/checkin', { ISBN: loan.ISBN, loanSK: loan.loanSK });
      setLoans(ls => ls.map(l => l.loanId === loan.loanId ? { ...l, status: 'returned', returnedDate: new Date().toISOString() } : l));
      setMessage('Book returned successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch { setMessage('Failed to return book.'); }
    finally { setReturning(null); }
  }

  const active = loans.filter(l => l.status === 'active');
  const history = loans.filter(l => l.status !== 'active');

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-serif font-bold text-stone-900 mb-6">My Loans</h1>

      {message && <div className="bg-green-50 text-green-800 px-4 py-2 rounded-lg text-sm mb-4">{message}</div>}

      {active.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">Active ({active.length})</h2>
          <div className="space-y-3">
            {active.map(loan => (
              <div key={loan.loanId} className={`bg-white rounded-xl border p-4 flex items-center gap-4 ${loan.isOverdue ? 'border-red-200' : 'border-stone-100'}`}>
                <div className="text-3xl">📖</div>
                <div className="flex-1">
                  <p className="font-medium text-stone-900">{loan.bookTitle}</p>
                  <p className="text-sm text-stone-500">{loan.bookAuthor}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-xs font-medium ${loan.isOverdue ? 'text-red-600' : 'text-stone-500'}`}>
                      Due {new Date(loan.returnDueDate).toLocaleDateString()}
                      {loan.isOverdue && ' — OVERDUE'}
                    </span>
                    {loan.renewalCount > 0 && <span className="text-xs text-brand-600">Renewed</span>}
                  </div>
                </div>
                <button onClick={() => handleReturn(loan)} disabled={returning === loan.loanId}
                  className="text-sm bg-stone-100 hover:bg-stone-200 text-stone-700 px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                  {returning === loan.loanId ? '…' : 'Return'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {active.length === 0 && <div className="bg-white rounded-xl border border-stone-100 p-8 text-center text-stone-400 mb-8"><p>No active loans.</p></div>}

      {history.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">History ({history.length})</h2>
          <div className="space-y-2">
            {history.map(loan => (
              <div key={loan.loanId} className="bg-white rounded-xl border border-stone-100 p-4 flex items-center gap-4 opacity-70">
                <div className="text-2xl">📗</div>
                <div className="flex-1">
                  <p className="font-medium text-stone-700 text-sm">{loan.bookTitle}</p>
                  <p className="text-xs text-stone-400">{loan.bookAuthor}</p>
                </div>
                <span className="text-xs text-stone-400">
                  Returned {loan.returnedDate ? new Date(loan.returnedDate).toLocaleDateString() : '—'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
