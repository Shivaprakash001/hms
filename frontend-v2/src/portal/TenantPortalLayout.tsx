import { NavLink, Outlet } from 'react-router-dom';
import { Building2, Home, IndianRupee, DoorOpen, User } from 'lucide-react';

const nav = [
  { to: '/tenant/dashboard', icon: Home, label: 'Home' },
  { to: '/tenant/financials', icon: IndianRupee, label: 'Money' },
  { to: '/tenant/room', icon: Building2, label: 'Room' },
  { to: '/tenant/move-out', icon: DoorOpen, label: 'Exit' },
  { to: '/tenant/profile', icon: User, label: 'Profile' },
];

export function TenantPortalLayout() {
  return (
    <div className="min-h-screen bg-background pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <main className="max-w-lg mx-auto px-4 py-5">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around h-16 max-w-lg mx-auto items-stretch">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 px-1.5 min-w-[56px] text-[10px] font-medium touch-manipulation ${
                  isActive ? 'text-accent' : 'text-muted-foreground'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
