import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';

/**
 * SSOCallbackPage
 *
 * Handles the redirect from the backend after a successful OAuth2 login.
 * The backend appends `?token=<jwt>&refreshToken=<jwt>` to the redirect URL.
 *
 * Steps (Req 12.4):
 *  1. Parse `token` and `refreshToken` from the URL query string.
 *  2. Persist both tokens to localStorage (matching the pattern used by AuthContext.login).
 *  3. Fetch the current user profile to populate the auth context.
 *  4. Redirect to the dashboard.
 *
 * If the URL contains an `error` param instead, redirect to /login with the error.
 */
export default function SSOCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  // Guard against React StrictMode double-invocation
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refreshToken');
    const error = searchParams.get('error');

    if (error) {
      navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true });
      return;
    }

    if (!token) {
      navigate('/login?error=missing_token', { replace: true });
      return;
    }

    // Store tokens — same keys used by AuthContext
    localStorage.setItem('accessToken', token);
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }

    // Fetch user profile and hydrate auth context
    authService
      .getCurrentUser()
      .then((user) => {
        updateUser(user);
        navigate('/dashboard', { replace: true });
      })
      .catch(() => {
        // Token may be invalid; clear and send to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        navigate('/login?error=auth_failed', { replace: true });
      });
  }, [navigate, searchParams, updateUser]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
        <p className="text-muted-foreground text-sm">Completing sign-in…</p>
      </div>
    </div>
  );
}
