import { Link } from 'react-router-dom';

interface Book {
  ISBN: string;
  title: string;
  author: string;
  genre: string;
  availableCopies: number;
  totalCopies: number;
  coverImageUrl?: string;
  series?: string;
}

export function BookCard({ book }: { book: Book }) {
  const available = book.availableCopies > 0;

  return (
    <Link to={`/books/${book.ISBN}`} className="group block bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-stone-100 overflow-hidden">
      <div className="aspect-[3/4] bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center relative">
        {book.coverImageUrl ? (
          <img src={book.coverImageUrl} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <div className="text-center p-4">
            <div className="text-4xl mb-2">📖</div>
            <div className="text-brand-800 text-xs font-medium leading-tight line-clamp-3">{book.title}</div>
          </div>
        )}
        <span className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
          available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {available ? `${book.availableCopies} avail.` : 'On loan'}
        </span>
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-sm text-stone-900 line-clamp-2 group-hover:text-brand-700 transition-colors">{book.title}</h3>
        <p className="text-xs text-stone-500 mt-0.5">{book.author}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">{book.genre}</span>
          {book.series && <span className="text-xs text-brand-600 truncate">{book.series}</span>}
        </div>
      </div>
    </Link>
  );
}
