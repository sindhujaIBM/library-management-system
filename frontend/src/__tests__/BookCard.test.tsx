import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CartProvider } from '../contexts/CartContext';
import { BookCard } from '../components/books/BookCard';

const baseBook = {
  ISBN: '978-0-00-000001-0',
  title: 'The Great Gatsby',
  author: 'F. Scott Fitzgerald',
  genre: 'Classic',
  availableCopies: 2,
  totalCopies: 5,
};

function renderCard(bookOverrides: Partial<typeof baseBook & { coverImageUrl?: string; series?: string; formats?: string[] }> = {}) {
  const book = { ...baseBook, ...bookOverrides };
  return render(
    <MemoryRouter>
      <CartProvider>
        <BookCard book={book} />
      </CartProvider>
    </MemoryRouter>,
  );
}

describe('BookCard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders book title and author', () => {
    renderCard();
    // Title appears in both the fallback image area and the card body <h3> — use heading role
    expect(screen.getByRole('heading', { name: 'The Great Gatsby' })).toBeInTheDocument();
    expect(screen.getByText('F. Scott Fitzgerald')).toBeInTheDocument();
  });

  it('renders genre badge', () => {
    renderCard();
    expect(screen.getByText('Classic')).toBeInTheDocument();
  });

  it('shows availability count when copies are available', () => {
    renderCard({ availableCopies: 3 });
    expect(screen.getByText('3 avail.')).toBeInTheDocument();
  });

  it('shows "On loan" when no copies available', () => {
    renderCard({ availableCopies: 0 });
    expect(screen.getByText('On loan')).toBeInTheDocument();
  });

  it('renders "+ Cart" button when copies are available', () => {
    renderCard({ availableCopies: 1 });
    expect(screen.getByText('+ Cart')).toBeInTheDocument();
  });

  it('does not render cart button when book is unavailable', () => {
    renderCard({ availableCopies: 0 });
    expect(screen.queryByText('+ Cart')).not.toBeInTheDocument();
  });

  it('toggles to "✓ In cart" after clicking the cart button', () => {
    renderCard({ availableCopies: 1 });
    fireEvent.click(screen.getByText('+ Cart'));
    expect(screen.getByText('✓ In cart')).toBeInTheDocument();
  });

  it('clicking "✓ In cart" removes it from cart (toggles back)', () => {
    renderCard({ availableCopies: 1 });
    fireEvent.click(screen.getByText('+ Cart'));
    fireEvent.click(screen.getByText('✓ In cart'));
    expect(screen.getByText('+ Cart')).toBeInTheDocument();
  });

  it('renders audiobook icon when audiobook format is present', () => {
    renderCard({ formats: ['physical', 'audiobook'] });
    expect(screen.getByTitle('Audiobook')).toBeInTheDocument();
  });

  it('renders ebook icon when ebook format is present', () => {
    renderCard({ formats: ['ebook'] });
    expect(screen.getByTitle('eBook / Kindle')).toBeInTheDocument();
  });

  it('does not render format icons when formats array is absent', () => {
    renderCard();
    expect(screen.queryByTitle('Audiobook')).not.toBeInTheDocument();
    expect(screen.queryByTitle('eBook / Kindle')).not.toBeInTheDocument();
  });

  it('renders a cover image when coverImageUrl is provided', () => {
    renderCard({ coverImageUrl: 'https://example.com/cover.jpg' });
    const img = screen.getByRole('img', { name: 'The Great Gatsby' });
    expect(img).toHaveAttribute('src', 'https://example.com/cover.jpg');
  });

  it('renders series name when provided', () => {
    renderCard({ series: 'American Dream Series' });
    expect(screen.getByText('American Dream Series')).toBeInTheDocument();
  });

  it('renders a link to the book detail page', () => {
    renderCard();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', `/books/${baseBook.ISBN}`);
  });
});
