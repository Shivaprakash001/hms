import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bed, CreditCard, Home, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Operational quick nav for hostel workspace on mobile/tablet.
 * Hidden on overview (dashboard has its own tab bar) and on lg+ (sidebar).
 */
export function WorkspaceMobileNav({ hostelId }) {
  const location = useLocation();
  const navigate = useNavigate();

  if (!hostelId) return null;
  if (location.pathname.includes('/overview')) return null;

  const base = `/dashboard/${hostelId}`;
  const tabs = [
    { id: 'overview', label: 'Home', Icon: Home, path: `${base}/overview` },
    { id: 'tenants', label: 'Tenants', Icon: Users, path: `${base}/tenants` },
    { id: 'financials', label: 'Pay', Icon: CreditCard, path: `${base}/financials` },
    { id: 'rooms', label: 'Rooms', Icon: Bed, path: `${base}/rooms` },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border pb-safe">
      <div className="flex h-14 items-center justify-around px-1 max-w-lg mx-auto">
        {tabs.map(({ id, label, Icon, path }) => {
          const active = location.pathname === path || location.pathname.startsWith(`${path}/`);
          return (
            <button
              key={id}
              type="button"
              onClick={() => navigate(path)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 min-w-[64px] py-1 rounded-lg',
                active ? 'text-ops-accent' : 'text-muted-foreground',
              )}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.25 : 2} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
