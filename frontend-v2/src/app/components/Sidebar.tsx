import { NavLink } from 'react-router-dom';
import { Home, Bell, CreditCard, Settings, LogOut, Users, ClipboardList, Activity } from 'lucide-react';
import { useAuth } from '@context/AuthContext';

const navItems = [
  { to: '/dashboard', icon: Home, label: 'Home' },
  { to: '/admissions', icon: ClipboardList, label: 'Admissions' },
  { to: '/tenants', icon: Users, label: 'Tenants' },
  { to: '/billing', icon: CreditCard, label: 'Billing' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
];

export function Sidebar() {
  const { user, logout } = useAuth();

  const initials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen bg-sidebar fixed left-0 top-0 bottom-0 z-40 shadow-[4px_0_24px_rgba(0,0,0,0.12)]">
      {/* Brand logo */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img
            src="/android-chrome-512x512.png"
            alt="Sri Adithya Hostels"
            className="h-9 w-auto object-contain"
          />
          <div className="min-w-0">
            <span className="block text-sm font-bold text-white leading-tight truncate">
              Sri Adithya
            </span>
            <span className="block text-[10px] text-sidebar-foreground/60 leading-tight">
              Hostels — Owner
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-0.5" aria-label="Main navigation">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-sidebar-primary text-white shadow-sm'
                  : 'text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User profile + logout */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-0.5">
        <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl">
          <div className="w-8 h-8 bg-sidebar-primary rounded-full flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-xs font-bold text-white">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">{user?.name || 'Owner'}</div>
            <div className="text-[10px] text-sidebar-foreground/50 truncate">{user?.email || ''}</div>
          </div>
        </div>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
              isActive
                ? 'bg-sidebar-primary text-white shadow-sm'
                : 'text-sidebar-foreground/60 hover:text-white hover:bg-sidebar-accent'
            }`
          }
        >
          <Settings className="w-4 h-4 shrink-0" />
          Settings
        </NavLink>
        <NavLink
          to="/activity"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
              isActive
                ? 'bg-sidebar-primary text-white shadow-sm'
                : 'text-sidebar-foreground/60 hover:text-white hover:bg-sidebar-accent'
            }`
          }
        >
          <Activity className="w-4 h-4 shrink-0" />
          System Logs
        </NavLink>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/60 hover:text-white hover:bg-sidebar-accent transition-all duration-150"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
