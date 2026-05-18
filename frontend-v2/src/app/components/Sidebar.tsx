import { NavLink, useNavigate } from 'react-router-dom';
import { Building2, Home, Bell, CreditCard, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@context/AuthContext';

const navItems = [
  { to: '/dashboard', icon: Home, label: 'Portfolio' },
  { to: '/hostels', icon: Building2, label: 'Hostels' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/billing', icon: CreditCard, label: 'Billing' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const { user, logout } = useAuth();

  const initials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen bg-card border-r border-border fixed left-0 top-0 bottom-0 z-40">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <Building2 className="w-4 h-4 text-accent-foreground" />
          </div>
          <span className="font-semibold text-foreground text-sm">HMS</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="px-3 py-4 border-t border-border space-y-1">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-7 h-7 bg-accent rounded-full flex items-center justify-center shrink-0">
            <span className="text-[10px] font-semibold text-accent-foreground">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-foreground truncate">{user?.name || 'Owner'}</div>
            <div className="text-[10px] text-muted-foreground truncate">{user?.email || ''}</div>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Log out
        </button>
      </div>
    </aside>
  );
}
