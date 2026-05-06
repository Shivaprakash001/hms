import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css'
import App from './App.jsx'

// REPLACE WITH YOUR ACTUAL GOOGLE CLIENT ID
// Use Vite environment variable `VITE_GOOGLE_CLIENT_ID`.
// Set this in a `.env` file at the project root (see .env template added).
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_HERE";

import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './config/queryClient';
import ErrorBoundary from './components/shared/ErrorBoundary';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
          <BrowserRouter>
            <App />
            <Toaster 
              position="top-right" 
              toastOptions={{
                className: 'bg-neutral-800 text-neutral-100 border border-neutral-700 shadow-xl',
                style: {
                  background: '#262626',
                  color: '#f5f5f5',
                  border: '1px solid #404040',
                  borderRadius: '8px',
                },
              }}
            />
            {import.meta.env.DEV && (
              <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
            )}
          </BrowserRouter>
        </GoogleOAuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
