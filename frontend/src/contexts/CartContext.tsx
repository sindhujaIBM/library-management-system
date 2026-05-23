import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface CartBook {
  ISBN: string;
  title: string;
  author: string;
  genre: string;
  availableCopies: number;
  coverImageUrl?: string;
}

interface CartContextValue {
  cart: CartBook[];
  addToCart: (book: CartBook) => void;
  removeFromCart: (isbn: string) => void;
  clearCart: () => void;
  isInCart: (isbn: string) => boolean;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'library_cart';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartBook[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as CartBook[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  const addToCart = useCallback((book: CartBook) => {
    setCart(prev => prev.some(b => b.ISBN === book.ISBN) ? prev : [...prev, book]);
  }, []);

  const removeFromCart = useCallback((isbn: string) => {
    setCart(prev => prev.filter(b => b.ISBN !== isbn));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const isInCart = useCallback((isbn: string) => cart.some(b => b.ISBN === isbn), [cart]);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, isInCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
