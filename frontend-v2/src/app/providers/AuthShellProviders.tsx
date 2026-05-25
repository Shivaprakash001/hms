import type { PropsWithChildren } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from '@context/AuthContext';
import { queryClient } from '@lib/queryClient';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID_HERE';

export function AuthShellProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <AuthProvider>
          {children}
          <Toaster position="top-center" richColors closeButton />
        </AuthProvider>
      </GoogleOAuthProvider>
    </QueryClientProvider>
  );
}

