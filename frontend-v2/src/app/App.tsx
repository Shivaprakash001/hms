import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { Sidebar } from './components/Sidebar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OwnerQuickActions } from './components/OwnerQuickActions';

function RouteSectionFallback() {
  return (
    <div className="px-4 py-5">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="h-10 w-48 rounded-lg bg-muted animate-pulse" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="h-20 rounded-xl bg-muted animate-pulse" />
          <div className="h-20 rounded-xl bg-muted animate-pulse" />
          <div className="h-20 rounded-xl bg-muted animate-pulse" />
        </div>
        <div className="h-40 rounded-xl bg-muted animate-pulse" />
      </div>
    </div>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex overflow-x-hidden">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col md:ml-60 min-w-0 overflow-x-hidden">
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0">
          <div className="w-full max-w-5xl mx-auto min-w-0">
            <ErrorBoundary key={location.pathname}>
              <Suspense fallback={<RouteSectionFallback />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>

        {/* Mobile bottom nav */}
        <BottomNav />
        {location.pathname !== '/activity' && <OwnerQuickActions />}
      </div>
    </div>
  );
}
