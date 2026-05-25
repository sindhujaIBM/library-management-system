import { Link } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';

interface Book {
  ISBN: string;
  title: string;
  author: string;
  genre: string;
  availableCopies: number;
  totalCopies: number;
  coverImageUrl?: string;
  series?: string;
  formats?: string[];
}

export function BookCard({ book }: { book: Book }) {
  const available = book.availableCopies > 0;
  const { addToCart, removeFromCart, isInCart } = useCart();
  const inCart = isInCart(book.ISBN);

  function handleCartToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
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
    }
  }

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
        {available && (
          <button
            onClick={handleCartToggle}
            className={`absolute bottom-2 right-2 text-xs font-semibold px-2 py-1 rounded-full transition-colors ${
              inCart
                ? 'bg-brand-600 text-white'
                : 'bg-white/90 text-brand-700 hover:bg-brand-600 hover:text-white'
            }`}
          >
            {inCart ? '✓ In cart' : '+ Cart'}
          </button>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-sm text-stone-900 line-clamp-2 group-hover:text-brand-700 transition-colors">{book.title}</h3>
        <p className="text-xs text-stone-500 mt-0.5">{book.author}</p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">{book.genre}</span>
          {book.series && <span className="text-xs text-brand-600 truncate">{book.series}</span>}
        </div>
        {book.formats && book.formats.length > 0 && (
          <div className="flex gap-1 mt-1.5">
            {book.formats.includes('audiobook') && <span title="Audiobook" className="text-xs">🎧</span>}
            {book.formats.includes('ebook') && <span title="eBook / Kindle" className="text-xs">📱</span>}
          </div>
        )}
      </div>
    </Link>
  );
}
