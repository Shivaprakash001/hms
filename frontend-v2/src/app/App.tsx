import { Outlet } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { Sidebar } from './components/Sidebar';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <div className="min-h-screen bg-background flex overflow-x-hidden">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col md:ml-60 min-w-0 overflow-x-hidden">
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0">
          <div className="w-full max-w-5xl mx-auto min-w-0">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>

        {/* Mobile bottom nav */}
        <BottomNav />
      </div>
    </div>
  );
}
