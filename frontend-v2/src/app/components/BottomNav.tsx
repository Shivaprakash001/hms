import { NavLink } from 'react-router-dom';
import { LayoutGrid, Bell, Coins, Users } from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutGrid, label: 'Home' },
  { to: '/tenants', icon: Users, label: 'Tenants' },
  { to: '/billing', icon: Coins, label: 'Money' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
];

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 md:hidden"
      aria-label="Main navigation"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch justify-around h-16 px-1 max-w-lg mx-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className="flex-1"
          >
            {({ isActive }) => (
              <div
                className={`relative flex flex-col items-center justify-center h-full gap-0.5 touch-manipulation ${
                  isActive ? 'text-accent' : 'text-muted-foreground'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-0.5 rounded-full bg-accent" />
                )}
                <Icon className="w-5 h-5" />
                <span className={`text-[10px] ${isActive ? 'font-semibold' : 'font-medium'}`}>{label}</span>
              </div>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
