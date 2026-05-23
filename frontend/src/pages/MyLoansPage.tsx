import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { booksClient } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

type Tab = 'active' | 'history';

interface Loan {
  loanId: string; ISBN: string; bookTitle: string; bookAuthor: string;
  checkoutDate: string; returnDueDate: string; returnedDate?: string;
  status: string; renewalCount: number; loanSK: string; isOverdue: boolean;
}

function daysUntil(iso: string): number {
  const due = new Date(iso);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function RenewalBadge({ loan }: { loan: Loan }) {
  if (loan.isOverdue) {
    const daysOver = Math.abs(daysUntil(loan.returnDueDate));
    return (
      <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
        {daysOver}d overdue
      </span>
    );
  }

  const days = daysUntil(loan.returnDueDate);

  if (loan.renewalCount === 0) {
    if (days === 0) {
      return <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Auto-renewing today</span>;
    }
    if (days <= 3) {
      return <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Auto-renews in {days}d</span>;
    }
    return <span className="text-xs font-medium bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Auto-renews in {days}d</span>;
  }

  // renewalCount === 1 — final term
  if (days <= 7) {
    return <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Final due — {days}d left</span>;
  }
  return <span className="text-xs font-medium bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">Final due — {days}d left</span>;
}

export function MyLoansPage() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [returning, setReturning] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<Tab>('active');

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
      setLoans(ls => ls.map(l => l.loanId === loan.loanId
        ? { ...l, status: 'returned', returnedDate: new Date().toISOString() }
        : l
      ));
      setMessage('Book returned successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage('Failed to return book.');
    } finally {
      setReturning(null);
    }
  }

  const active  = loans.filter(l => l.status === 'active');
  const history = loans.filter(l => l.status !== 'active');

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-serif font-bold text-stone-900 mb-5">My Loans</h1>

      {message && (
        <div className="bg-green-50 text-green-800 px-4 py-2 rounded-lg text-sm mb-4">{message}</div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-stone-200 mb-5">
        <button
          onClick={() => setTab('active')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'active'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          Active
          {active.length > 0 && (
            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${tab === 'active' ? 'bg-brand-100 text-brand-700' : 'bg-stone-100 text-stone-500'}`}>
              {active.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'history'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          History
          {history.length > 0 && (
            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${tab === 'history' ? 'bg-brand-100 text-brand-700' : 'bg-stone-100 text-stone-500'}`}>
              {history.length}
            </span>
          )}
        </button>
      </div>

      {/* Active tab */}
      {tab === 'active' && (
        active.length === 0 ? (
          <div className="bg-white rounded-xl border border-stone-100 p-10 text-center text-stone-400">
            <p>No active loans.</p>
            <Link to="/" className="text-brand-600 hover:underline text-sm mt-2 inline-block">Browse books</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {active.map(loan => (
              <div key={loan.loanId}
                className={`bg-white rounded-xl border p-4 flex items-start gap-4 ${loan.isOverdue ? 'border-red-200' : 'border-stone-100'}`}>
                <div className="text-3xl mt-0.5">📖</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-stone-900">{loan.bookTitle}</p>
                  <p className="text-sm text-stone-500 mb-2">{loan.bookAuthor}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <RenewalBadge loan={loan} />
                    {loan.renewalCount > 0 && (
                      <span className="text-xs text-brand-600 font-medium">Renewed once</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-stone-400">
                    <span>Checked out {new Date(loan.checkoutDate).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    <span>·</span>
                    <span>Due {new Date(loan.returnDueDate).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
                <button onClick={() => handleReturn(loan)} disabled={returning === loan.loanId}
                  className="text-sm bg-stone-100 hover:bg-stone-200 text-stone-700 px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50 shrink-0 mt-0.5">
                  {returning === loan.loanId ? '…' : 'Return'}
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {/* History tab */}
      {tab === 'history' && (
        history.length === 0 ? (
          <div className="bg-white rounded-xl border border-stone-100 p-10 text-center text-stone-400">
            <p>No borrowing history yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map(loan => (
              <div key={loan.loanId} className="bg-white rounded-xl border border-stone-100 p-4 flex items-center gap-4">
                <div className="text-2xl">📗</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-stone-700 text-sm truncate">{loan.bookTitle}</p>
                  <p className="text-xs text-stone-400">{loan.bookAuthor}</p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Checked out {new Date(loan.checkoutDate).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <span className="text-xs text-stone-400 shrink-0">
                  Returned {loan.returnedDate
                    ? new Date(loan.returnedDate).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
                    : '—'}
                </span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
