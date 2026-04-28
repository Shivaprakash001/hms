import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const GoogleCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const { loginWithGoogle } = useAuth();

  useEffect(() => {
    if (code) {
      const handleCallback = async () => {
        try {
          // The redirect_uri must match the one used in the initial Google auth request.
          // We compute it dynamically so it works across all deployment environments.
          const redirectUri = `${window.location.origin}/callback`;
          const user = await loginWithGoogle(code, redirectUri);
          const role = (user?.role || '').toLowerCase();
          
          if (role === 'owner' || role === 'admin') {
            navigate('/owner/dashboard');
          } else if (role === 'tenant') {
            navigate('/tenant/dashboard');
          } else {
            navigate('/login');
          }
        } catch (err) {
          console.error('Google callback error:', err);
          navigate('/login');
        }
      };

      handleCallback();
    }
  }, [code, loginWithGoogle, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-slate-700">Authenticating with Google...</h2>
        <p className="text-slate-500 mt-2">Please wait while we verify your account.</p>
      </div>
    </div>
  );
};
