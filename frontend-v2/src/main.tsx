import { createRoot } from 'react-dom/client';
import { AppRouter } from './app/Router';
import { AppProviders } from './app/providers/AppProviders';
import './styles/globals.css';

createRoot(document.getElementById('root')!).render(
  <AppProviders>
    <AppRouter />
  </AppProviders>,
);
