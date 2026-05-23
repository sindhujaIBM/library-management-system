import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useState } from 'react';

export function Navbar() {
  const { user, isLibrarian, logout } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();
  const [adminOpen, setAdminOpen] = useState(false);

  return (
    <nav className="bg-brand-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-xl font-serif font-bold tracking-wide text-amber-400 hover:text-amber-300 transition-colors">
              📚 Library
            </Link>
            <div className="hidden md:flex items-center gap-6 text-sm font-medium">
              <Link to="/" className="text-stone-200 hover:text-white transition-colors">Browse</Link>
              {user && <Link to="/my-loans" className="text-stone-200 hover:text-white transition-colors">My Loans</Link>}
              {user && <Link to="/chat" className="text-stone-200 hover:text-white transition-colors">Ask AI</Link>}
              {isLibrarian && (
                <div className="relative">
                  <button
                    onClick={() => setAdminOpen(o => !o)}
                    className="text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
                  >
                    Admin ▾
                  </button>
                  {adminOpen && (
                    <div className="absolute top-8 left-0 bg-white text-stone-800 rounded-lg shadow-xl py-1 w-44 z-50" onMouseLeave={() => setAdminOpen(false)}>
                      {[
                        { to: '/admin', label: 'Dashboard' },
                        { to: '/admin/books', label: 'Manage Books' },
                        { to: '/admin/alerts', label: 'AI Alerts' },
                        { to: '/admin/insights', label: 'Insights' },
                      ].map(({ to, label }) => (
                        <Link key={to} to={to} onClick={() => setAdminOpen(false)}
                          className="block px-4 py-2 text-sm hover:bg-stone-100 transition-colors">
                          {label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <Link to="/cart" className="relative text-stone-200 hover:text-white transition-colors">
                <span className="text-xl">🛒</span>
                {cart.length > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-amber-500 text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                    {cart.length}
                  </span>
                )}
              </Link>
            )}
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-stone-300 hidden sm:block">{user.name}</span>
                {isLibrarian && <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full">Librarian</span>}
                <button onClick={() => { logout(); navigate('/'); }}
                  className="text-sm text-stone-300 hover:text-white transition-colors">
                  Sign out
                </button>
              </div>
            ) : (
              <Link to="/login" className="text-sm bg-amber-500 hover:bg-amber-400 text-white px-4 py-1.5 rounded-lg transition-colors font-medium">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
