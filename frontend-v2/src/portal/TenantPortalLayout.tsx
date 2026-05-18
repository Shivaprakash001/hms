import { NavLink, Outlet } from 'react-router-dom';
import { Home, Wallet, User, DoorOpen } from 'lucide-react';

const nav = [
  { to: '/tenant/dashboard', icon: Home, label: 'Home' },
  { to: '/tenant/payments', icon: Wallet, label: 'Payments' },
  { to: '/tenant/profile', icon: User, label: 'Profile' },
  { to: '/tenant/move-out', icon: DoorOpen, label: 'Move-out' },
];

export function TenantPortalLayout() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <main className="max-w-lg mx-auto px-4 py-5">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40">
        <div className="flex justify-around h-16 max-w-lg mx-auto">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 px-2 min-w-[64px] text-[10px] font-medium ${
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
