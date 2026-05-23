import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authClient, saveSession } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) { navigate('/login'); return; }

    const redirectUri = `${window.location.origin}/auth/callback`;

    authClient.post('/auth/google', { code, redirectUri })
      .then(res => {
        const { accessToken, user } = res.data.data;
        saveSession(accessToken, user);
        login(user);
        navigate('/');
      })
      .catch(() => navigate('/login'));
  }, [navigate, login]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" />
      <p className="text-stone-500 text-sm">Signing you in…</p>
    </div>
  );
}
