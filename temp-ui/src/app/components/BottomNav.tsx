import { Building2, Home, Bell, CreditCard, Settings } from 'lucide-react';
import type { NavView } from '../App';

interface BottomNavProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
}

const navItems = [
  { id: 'portfolio' as NavView, icon: Home, label: 'Portfolio' },
  { id: 'hostels' as NavView, icon: Building2, label: 'Hostels' },
  { id: 'alerts' as NavView, icon: Bell, label: 'Alerts' },
  { id: 'billing' as NavView, icon: CreditCard, label: 'Billing' },
  { id: 'settings' as NavView, icon: Settings, label: 'Settings' },
];

export function BottomNav({ currentView, onNavigate }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map(({ id, icon: Icon, label }) => {
          const isActive = currentView === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px] ${
                isActive
                  ? 'text-accent'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
