import { Outlet } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';

export default function App() {
  return (
    <div className="h-screen flex flex-col bg-background">
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
