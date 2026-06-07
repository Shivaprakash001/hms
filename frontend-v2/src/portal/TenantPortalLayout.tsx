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
      <nav
        className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40"
        aria-label="Tenant navigation"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex justify-around h-16 max-w-lg mx-auto items-stretch">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className="flex-1">
              {({ isActive }) => (
                <div
                  className={`relative flex flex-col items-center justify-center h-full gap-0.5 touch-manipulation ${
                    isActive ? 'text-[#243A72]' : 'text-muted-foreground'
                  }`}
                >
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-0.5 rounded-full bg-[#243A72]" />
                  )}
                  <Icon className="w-5 h-5" />
                  <span className={`text-[10px] ${isActive ? 'font-semibold' : 'font-medium'}`}>{label}</span>
                </div>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
