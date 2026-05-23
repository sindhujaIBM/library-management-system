import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  children: React.ReactNode;
  librarian?: boolean;
}

export function ProtectedRoute({ children, librarian }: Props) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (librarian && user.role !== 'librarian') return <Navigate to="/" replace />;

  return <>{children}</>;
}
