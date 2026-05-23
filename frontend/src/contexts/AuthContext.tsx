import React, { createContext, useContext, useState, useEffect } from 'react';
import { getStoredUser, clearSession } from '../api/client';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'member' | 'librarian';
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isLibrarian: boolean;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) setUser(stored as User);
    setIsLoading(false);
  }, []);

  function login(u: User) { setUser(u); }
  function logout() { clearSession(); setUser(null); }

  return (
    <AuthContext.Provider value={{ user, isLoading, isLibrarian: user?.role === 'librarian', login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
