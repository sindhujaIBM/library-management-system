import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { booksClient } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';

type BookFormat = 'physical' | 'audiobook' | 'ebook';

interface Book {
  ISBN: string; title: string; author: string; genre: string;
  series?: string; seriesPosition?: number; releaseDate?: string;
  totalCopies: number; availableCopies: number; copiesOnLoan: number;
  coverImageUrl?: string; holdCount: number; formats?: BookFormat[];
}

const FORMAT_LABELS: Record<BookFormat, { label: string; icon: string }> = {
  physical: { label: 'Physical', icon: '📚' },
  audiobook: { label: 'Audiobook', icon: '🎧' },
  ebook: { label: 'Kindle / eBook', icon: '📱' },
};

export function BookDetailPage() {
  const { isbn } = useParams<{ isbn: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart, removeFromCart, isInCart } = useCart();

  const [book, setBook] = useState<Book | null>(null);
  const [myHold, setMyHold] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<BookFormat>('physical');

  const inCart = isbn ? isInCart(isbn) : false;

  useEffect(() => {
    if (!isbn) return;
    Promise.all([
      booksClient.get(`/books/${isbn}`),
      user ? booksClient.get(`/holds/${isbn}/me`) : Promise.resolve(null),
    ]).then(([bookRes, holdRes]) => {
      const bookData = bookRes.data.data;
      setBook(bookData);
      const formats: BookFormat[] = bookData.formats ?? ['physical'];
      setSelectedFormat(formats[0]);
      setMyHold(!!holdRes?.data?.data?.hold);
    }).catch(() => navigate('/')).finally(() => setLoading(false));
  }, [isbn, user, navigate]);

  async function handleBorrowNow() {
    if (!isbn) return;
    setActionLoading(true); setMessage(null);
    const isDigital = selectedFormat === 'audiobook' || selectedFormat === 'ebook';
    try {
      await booksClient.post('/loans/checkout', { ISBN: isbn, format: selectedFormat });
      const fmtLabel = FORMAT_LABELS[selectedFormat].label;
      setMessage({ type: 'success', text: `${fmtLabel} borrowed successfully! Due in 21 days.` });
      if (!isDigital) {
        setBook(b => b ? { ...b, availableCopies: b.availableCopies - 1, copiesOnLoan: b.copiesOnLoan + 1 } : b);
      }
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message
        : 'Failed to borrow book';
      setMessage({ type: 'error', text: msg ?? 'Failed to borrow book' });
    } finally { setActionLoading(false); }
  }

  function handleCartToggle() {
    if (!book) return;
    if (inCart) {
      removeFromCart(book.ISBN);
    } else {
      addToCart({
        ISBN: book.ISBN,
        title: book.title,
        author: book.author,
        genre: book.genre,
        availableCopies: book.availableCopies,
        coverImageUrl: book.coverImageUrl,
      });
      setMessage({ type: 'success', text: 'Added to cart! You can checkout all your books at once from the cart.' });
      setTimeout(() => setMessage(null), 3000);
    }
  }

  async function handleHold() {
    if (!isbn) return;
    setActionLoading(true); setMessage(null);
    try {
      if (myHold) {
        await booksClient.delete(`/holds/${isbn}`);
        setMyHold(false);
        setMessage({ type: 'success', text: 'Hold cancelled.' });
        setBook(b => b ? { ...b, holdCount: b.holdCount - 1 } : b);
      } else {
        await booksClient.post('/holds', { ISBN: isbn });
        setMyHold(true);
        setMessage({ type: 'success', text: "Hold placed! We'll notify you when it's available." });
        setBook(b => b ? { ...b, holdCount: b.holdCount + 1 } : b);
      }
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message
        : 'Action failed';
      setMessage({ type: 'error', text: msg ?? 'Action failed' });
    } finally { setActionLoading(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>;
  if (!book) return null;

  const available = book.availableCopies > 0;

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate(-1)} className="text-sm text-brand-600 hover:text-brand-800 mb-6 flex items-center gap-1">
        ← Back
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
        <div className="flex gap-6 p-6">
          <div className="w-36 h-52 flex-shrink-0 bg-gradient-to-br from-brand-100 to-brand-200 rounded-xl flex items-center justify-center overflow-hidden">
            {book.coverImageUrl ? (
              <img src={book.coverImageUrl} alt={book.title} className="w-full h-full object-cover" />
            ) : (
              <span className="text-5xl">📖</span>
            )}
          </div>

          <div className="flex-1">
            <h1 className="text-2xl font-serif font-bold text-stone-900 mb-1">{book.title}</h1>
            <p className="text-stone-600 mb-1">by <span className="font-medium">{book.author}</span></p>
            {book.series && (
              <p className="text-sm text-brand-600 mb-3">
                {book.series}{book.seriesPosition ? ` #${book.seriesPosition}` : ''}
              </p>
            )}

            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-xs bg-stone-100 text-stone-600 px-3 py-1 rounded-full">{book.genre}</span>
              {book.releaseDate && <span className="text-xs text-stone-500">{book.releaseDate.slice(0, 4)}</span>}
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {available ? `${book.availableCopies} of ${book.totalCopies} available` : `All ${book.totalCopies} on loan`}
              </span>
              {book.holdCount > 0 && (
                <span className="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full">
                  {book.holdCount} hold{book.holdCount > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {message && (
              <div className={`text-sm px-3 py-2 rounded-lg mb-4 ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {message.text}
              </div>
            )}

            {user ? (
              <div className="space-y-3">
                {/* Format selector */}
                {book.formats && book.formats.length > 1 && (
                  <div className="flex gap-2">
                    {book.formats.map(fmt => {
                      const f = fmt as BookFormat;
                      const meta = FORMAT_LABELS[f];
                      return (
                        <button key={f} onClick={() => setSelectedFormat(f)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                            selectedFormat === f
                              ? 'bg-brand-50 border-brand-400 text-brand-700'
                              : 'border-stone-200 text-stone-500 hover:border-stone-300'
                          }`}>
                          <span>{meta.icon}</span>
                          <span>{meta.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {book.formats && book.formats.length === 1 && (
                  <div className="flex items-center gap-1.5 text-xs text-stone-500">
                    <span>{FORMAT_LABELS[book.formats[0] as BookFormat]?.icon}</span>
                    <span>{FORMAT_LABELS[book.formats[0] as BookFormat]?.label} only</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  {(selectedFormat !== 'physical' || available) && (
                    <>
                      <button onClick={handleBorrowNow} disabled={actionLoading}
                        className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                        {actionLoading ? '…' : `Borrow ${FORMAT_LABELS[selectedFormat].icon}`}
                      </button>
                      {selectedFormat === 'physical' && (
                        <button onClick={handleCartToggle}
                          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors border ${
                            inCart
                              ? 'bg-brand-50 border-brand-300 text-brand-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600'
                              : 'bg-white border-stone-200 text-stone-700 hover:border-brand-400 hover:text-brand-700'
                          }`}>
                          {inCart ? '✓ In cart — remove' : '+ Add to cart'}
                        </button>
                      )}
                    </>
                  )}
                  {selectedFormat === 'physical' && !available && (
                    <button onClick={handleHold} disabled={actionLoading}
                      className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                        myHold ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-amber-500 hover:bg-amber-600 text-white'
                      }`}>
                      {actionLoading ? '…' : myHold ? 'Cancel Hold' : 'Place Hold'}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-stone-500">
                <a href="/login" className="text-brand-600 hover:underline">Sign in</a> to borrow or place a hold.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
