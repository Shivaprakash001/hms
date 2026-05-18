import React from 'react';
import { cn } from '@/lib/utils';

export function DashboardTabBar({ tabs, active, onChange, badge = 0 }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border pb-safe">
      <div className="flex h-16 max-w-lg mx-auto items-center justify-around px-2">
        {tabs.map(({ id, label, Icon }) => {
          const isActive = active === id;
          const showBadge = id === 'tenants' && badge > 0;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                'relative flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]',
                isActive ? 'text-ops-accent' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.25 : 2} />
              {showBadge && (
                <span className="absolute top-0.5 right-2 min-w-[16px] h-4 px-1 bg-ops-danger rounded-full text-[10px] font-medium text-white flex items-center justify-center">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
