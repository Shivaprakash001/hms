import { NavLink } from 'react-router-dom';
import { LayoutGrid, Bell, CreditCard, Users, Settings } from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutGrid, label: 'Home' },
  { to: '/tenants', icon: Users, label: 'Tenants' },
  { to: '/billing', icon: CreditCard, label: 'Billing' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-40 md:hidden">
      <div className="flex items-center justify-around h-16 px-1 max-w-lg mx-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 px-1 py-2 rounded-lg transition-colors min-w-[56px] touch-manipulation ${
                isActive ? 'text-accent' : 'text-muted-foreground'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
