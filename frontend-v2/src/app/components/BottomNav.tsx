import { NavLink } from 'react-router-dom';
import { Building2, Home, Bell, CreditCard, Settings } from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: Home, label: 'Portfolio' },
  { to: '/hostels', icon: Building2, label: 'Hostels' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/billing', icon: CreditCard, label: 'Billing' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px] ${
                isActive ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
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
