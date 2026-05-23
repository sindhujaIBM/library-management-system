import { useEffect, useState } from 'react';
import { booksClient } from '../../api/client';
import { BookForm } from '../../components/books/BookForm';

interface Book {
  ISBN: string; title: string; author: string; genre: string;
  totalCopies: number; availableCopies: number; copiesOnLoan: number;
  series?: string; seriesPosition?: number; releaseDate?: string; coverImageUrl?: string;
}

type Modal = { type: 'add' } | { type: 'edit'; book: Book };

export function ManageBooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Modal | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<Record<string, boolean>>({});  // isbn → loading
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const filtered = books.filter(b =>
    !query ||
    b.title.toLowerCase().includes(query.toLowerCase()) ||
    b.author.toLowerCase().includes(query.toLowerCase())
  );

  function showToast(type: 'ok' | 'err', text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  }

  function setBusyFor(isbn: string, val: boolean) {
    setBusy(b => ({ ...b, [isbn]: val }));
  }

  useEffect(() => {
    booksClient.get('/books')
      .then(res => setBooks(res.data.data.books))
      .finally(() => setLoading(false));
  }, []);

  // ── Copy management ──────────────────────────────────────────────────────

  async function adjustCopies(book: Book, delta: 1 | -1) {
    const newTotal = book.totalCopies + delta;
    setBusyFor(book.ISBN, true);
    try {
      await booksClient.put(`/books/${book.ISBN}`, { totalCopies: newTotal });
      setBooks(bs => bs.map(b =>
        b.ISBN === book.ISBN
          ? { ...b, totalCopies: newTotal, availableCopies: b.availableCopies + delta }
          : b
      ));
      showToast('ok', delta > 0 ? `Added 1 copy — ${book.title} now has ${newTotal}` : `Removed 1 copy — ${book.title} now has ${newTotal}`);
    } catch (err: unknown) {
      const msg = apiError(err);
      showToast('err', msg);
    } finally {
      setBusyFor(book.ISBN, false);
    }
  }

  // ── Add / Edit ───────────────────────────────────────────────────────────

  async function handleAdd(data: Parameters<typeof BookForm>[0]['onSubmit'] extends (d: infer D) => unknown ? D : never) {
    await booksClient.post('/books', data);
    const res = await booksClient.get('/books');
    setBooks(res.data.data.books);
    setModal(null);
    showToast('ok', `"${data.title}" added to catalog`);
  }

  async function handleEdit(data: Parameters<typeof BookForm>[0]['onSubmit'] extends (d: infer D) => unknown ? D : never) {
    await booksClient.put(`/books/${data.ISBN}`, data);
    setBooks(bs => bs.map(b => b.ISBN === data.ISBN ? { ...b, ...data } : b));
    setModal(null);
    showToast('ok', `"${data.title}" updated`);
  }

  // ── Delete ───────────────────────────────────────────────────────────────

  async function handleDelete(book: Book) {
    if (!confirm(`Delete "${book.title}"?\n\nThis cannot be undone.`)) return;
    setBusyFor(book.ISBN, true);
    try {
      await booksClient.delete(`/books/${book.ISBN}`);
      setBooks(bs => bs.filter(b => b.ISBN !== book.ISBN));
      showToast('ok', `"${book.title}" removed from catalog`);
    } catch (err: unknown) {
      showToast('err', apiError(err));
    } finally {
      setBusyFor(book.ISBN, false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-stone-900">Manage Books</h1>
          <p className="text-stone-500 text-sm mt-0.5">{books.length} titles in catalog</p>
        </div>
        <button
          onClick={() => setModal({ type: 'add' })}
          className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Add Book
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${toast.type === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {toast.text}
        </div>
      )}

      {/* Search */}
      <input
        className="w-full border border-stone-200 rounded-lg px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-500"
        placeholder="Search by title or author…"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-xs text-stone-500 uppercase tracking-wide">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Title</th>
                <th className="px-5 py-3 text-left font-medium">Author</th>
                <th className="px-5 py-3 text-left font-medium">Genre</th>
                <th className="px-5 py-3 text-left font-medium w-48">Copies</th>
                <th className="px-5 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filtered.map(book => (
                <tr key={book.ISBN} className="hover:bg-stone-50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-medium text-stone-800">{book.title}</p>
                    <p className="text-xs text-stone-400">{book.ISBN}</p>
                  </td>
                  <td className="px-5 py-3 text-stone-600">{book.author}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs bg-stone-100 px-2 py-0.5 rounded-full text-stone-600">
                      {book.genre}
                    </span>
                  </td>

                  {/* Copy controls */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {/* Remove copy */}
                      <button
                        onClick={() => adjustCopies(book, -1)}
                        disabled={busy[book.ISBN] || book.availableCopies < 1}
                        title={book.availableCopies < 1 ? 'No available copies to remove' : 'Remove 1 copy'}
                        className="w-6 h-6 rounded border border-stone-200 text-stone-500 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-base leading-none"
                      >
                        −
                      </button>

                      {/* Copy count */}
                      <span className="text-sm font-medium w-20 text-center">
                        <span className={book.availableCopies > 0 ? 'text-green-700' : 'text-red-600'}>
                          {book.availableCopies}
                        </span>
                        <span className="text-stone-400"> / {book.totalCopies}</span>
                      </span>

                      {/* Add copy */}
                      <button
                        onClick={() => adjustCopies(book, 1)}
                        disabled={busy[book.ISBN]}
                        title="Add 1 copy"
                        className="w-6 h-6 rounded border border-stone-200 text-stone-500 hover:bg-green-50 hover:border-green-300 hover:text-green-600 transition-colors disabled:opacity-30 flex items-center justify-center text-base leading-none"
                      >
                        +
                      </button>

                      {book.copiesOnLoan > 0 && (
                        <span className="text-xs text-amber-600 whitespace-nowrap">
                          {book.copiesOnLoan} on loan
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-5 py-3">
                    <div className="flex gap-3">
                      <button
                        onClick={() => setModal({ type: 'edit', book })}
                        className="text-xs text-brand-600 hover:text-brand-800 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(book)}
                        disabled={busy[book.ISBN]}
                        title={book.copiesOnLoan > 0 ? 'Cannot delete — copies are on loan' : 'Delete book'}
                        className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-40"
                      >
                        {busy[book.ISBN] ? '…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center text-stone-400 py-10">
              {query ? 'No books match your search.' : 'No books in catalog yet.'}
            </p>
          )}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-serif font-bold text-stone-900 mb-5">
              {modal.type === 'add' ? 'Add New Book' : `Edit: ${modal.book.title}`}
            </h2>
            <BookForm
              initial={modal.type === 'edit' ? modal.book : undefined}
              isEdit={modal.type === 'edit'}
              onSubmit={modal.type === 'add' ? handleAdd : handleEdit}
              onCancel={() => setModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function apiError(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    return (err as { response?: { data?: { error?: { message?: string } } } })
      .response?.data?.error?.message ?? 'An error occurred';
  }
  return 'An error occurred';
}
