import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { Navbar } from './components/layout/Navbar';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { BookDetailPage } from './pages/BookDetailPage';
import { MyLoansPage } from './pages/MyLoansPage';
import { CartPage } from './pages/CartPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminAlertsPage } from './pages/admin/AdminAlertsPage';
import { AdminInsightsPage } from './pages/admin/AdminInsightsPage';
import { ManageBooksPage } from './pages/admin/ManageBooksPage';
import { ChatPage } from './pages/ChatPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <div className="min-h-screen bg-stone-50">
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="/books/:isbn" element={<BookDetailPage />} />
                <Route path="/cart" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />
                <Route path="/my-loans" element={<ProtectedRoute><MyLoansPage /></ProtectedRoute>} />
                <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute librarian><AdminDashboardPage /></ProtectedRoute>} />
                <Route path="/admin/alerts" element={<ProtectedRoute librarian><AdminAlertsPage /></ProtectedRoute>} />
                <Route path="/admin/insights" element={<ProtectedRoute librarian><AdminInsightsPage /></ProtectedRoute>} />
                <Route path="/admin/books" element={<ProtectedRoute librarian><ManageBooksPage /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
