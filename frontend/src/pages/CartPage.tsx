import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { booksClient } from '../api/client';
import { useCart } from '../contexts/CartContext';

interface CheckoutResult {
  succeeded: { ISBN: string; bookTitle: string; bookAuthor: string; checkoutDate: string; returnDueDate: string }[];
  failed: { ISBN: string; title?: string; reason: string }[];
}

export function CartPage() {
  const { cart, removeFromCart, clearCart } = useCart();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [error, setError] = useState('');

  async function handleCheckout() {
    if (cart.length === 0) return;
    setLoading(true);
    setError('');
    try {
      const res = await booksClient.post('/loans/checkout/bulk', {
        ISBNs: cart.map(b => b.ISBN),
      });
      const data = res.data.data as CheckoutResult;
      setResult(data);
      if (data.succeeded.length > 0) clearCart();
    } catch {
      setError('Checkout failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-serif font-bold text-stone-900 mb-6">Checkout Complete</h1>

        {result.succeeded.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-4">
            <p className="font-semibold text-green-800 mb-3">
              {result.succeeded.length} book{result.succeeded.length > 1 ? 's' : ''} borrowed successfully
            </p>
            <p className="text-sm text-green-700 mb-4">A confirmation email has been sent to your inbox.</p>
            <div className="space-y-3">
              {result.succeeded.map(b => (
                <div key={b.ISBN} className="bg-white rounded-lg border border-green-100 p-3">
                  <p className="font-medium text-stone-900 text-sm">{b.bookTitle}</p>
                  <p className="text-xs text-stone-500">{b.bookAuthor}</p>
                  <div className="flex gap-4 mt-1.5 text-xs text-stone-500">
                    <span>Checked out: {new Date(b.checkoutDate).toLocaleDateString()}</span>
                    <span>Due: {new Date(b.returnDueDate).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.failed.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-4">
            <p className="font-semibold text-red-800 mb-3">
              {result.failed.length} book{result.failed.length > 1 ? 's' : ''} could not be checked out
            </p>
            <div className="space-y-2">
              {result.failed.map(f => (
                <div key={f.ISBN} className="flex items-start justify-between text-sm">
                  <span className="text-stone-700">{f.title ?? f.ISBN}</span>
                  <span className="text-red-600 text-xs ml-4 shrink-0">{f.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={() => navigate('/my-loans')}
            className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
            View My Loans
          </button>
          <button onClick={() => navigate('/')}
            className="bg-stone-100 hover:bg-stone-200 text-stone-700 px-5 py-2 rounded-lg text-sm font-medium transition-colors">
            Browse More Books
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-stone-900">
          Cart {cart.length > 0 && <span className="text-stone-400 font-sans text-lg font-normal">({cart.length})</span>}
        </h1>
        <Link to="/" className="text-sm text-brand-600 hover:text-brand-800">← Browse</Link>
      </div>

      {cart.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-100 p-12 text-center">
          <div className="text-4xl mb-3">🛒</div>
          <p className="text-stone-500 mb-4">Your cart is empty.</p>
          <Link to="/" className="text-brand-600 hover:underline text-sm">Browse books</Link>
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-6">
            {cart.map(book => (
              <div key={book.ISBN} className="bg-white rounded-xl border border-stone-100 p-4 flex items-center gap-4">
                <div className="w-12 h-16 flex-shrink-0 bg-gradient-to-br from-brand-100 to-brand-200 rounded-lg flex items-center justify-center overflow-hidden">
                  {book.coverImageUrl ? (
                    <img src={book.coverImageUrl} alt={book.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl">📖</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-stone-900 text-sm truncate">{book.title}</p>
                  <p className="text-xs text-stone-500">{book.author}</p>
                  <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full mt-1 inline-block">{book.genre}</span>
                </div>
                <button onClick={() => removeFromCart(book.ISBN)}
                  className="text-xs text-red-500 hover:text-red-700 transition-colors shrink-0 px-2 py-1">
                  Remove
                </button>
              </div>
            ))}
          </div>

          {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg mb-4">{error}</div>}

          <div className="bg-white rounded-xl border border-stone-100 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-medium text-stone-900">{cart.length} book{cart.length > 1 ? 's' : ''}</p>
                <p className="text-xs text-stone-500 mt-0.5">Each loan is 21 days, with one auto-renewal if no holds</p>
              </div>
            </div>
            <button onClick={handleCheckout} disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
              {loading ? 'Checking out…' : `Checkout ${cart.length} book${cart.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
