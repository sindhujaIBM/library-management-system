import { useState, useEffect, useCallback } from 'react';
import { booksClient } from '../api/client';
import { BookCard } from '../components/books/BookCard';

interface Book {
  ISBN: string; title: string; author: string; genre: string;
  availableCopies: number; totalCopies: number; coverImageUrl?: string; series?: string;
}

const GENRES = ['All', 'Fiction', 'Non-Fiction', 'Science Fiction', 'Fantasy', 'Mystery', 'Biography', 'History', 'Science', 'Self-Help', 'Children'];

export function HomePage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (genre && genre !== 'All') params.set('genre', genre);
      if (availableOnly) params.set('available', 'true');
      const res = await booksClient.get(`/books?${params}`);
      setBooks(res.data.data.books);
    } catch {
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, [query, genre, availableOnly]);

  useEffect(() => {
    const t = setTimeout(fetchBooks, 300);
    return () => clearTimeout(t);
  }, [fetchBooks]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-stone-900 mb-1">Browse the Collection</h1>
        <p className="text-stone-500 text-sm">Search by title, author, genre, or series</p>
      </div>

      {/* Search + filters */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-4 mb-6 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-60">
          <input
            className="w-full border border-stone-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Search books, authors, series…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <select
          className="border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={genre} onChange={e => setGenre(e.target.value)}
        >
          {GENRES.map(g => <option key={g} value={g === 'All' ? '' : g}>{g}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
          <input type="checkbox" checked={availableOnly} onChange={e => setAvailableOnly(e.target.checked)}
            className="rounded border-stone-300 text-brand-600" />
          Available only
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-20 text-stone-400">
          <div className="text-5xl mb-3">📭</div>
          <p>No books found. Try a different search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {books.map(book => <BookCard key={book.ISBN} book={book} />)}
        </div>
      )}
    </div>
  );
}
