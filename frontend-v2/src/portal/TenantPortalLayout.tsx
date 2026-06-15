import { NavLink, Outlet } from 'react-router-dom';
import { Building2, Home, IndianRupee, DoorOpen, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { tenantService } from '@features/tenants/api';

const nav = [
  { to: '/tenant/dashboard', icon: Home, label: 'Home' },
  { to: '/tenant/financials', icon: IndianRupee, label: 'Money' },
  { to: '/tenant/room', icon: Building2, label: 'Room' },
  { to: '/tenant/move-out', icon: DoorOpen, label: 'Move Out' },
  { to: '/tenant/profile', icon: User, label: 'Profile' },
];

export function TenantPortalLayout() {
  const { data: profile } = useQuery({
    queryKey: ['tenant', 'me', 'profile'],
    queryFn: () => tenantService.getMyProfile(),
    staleTime: 60_000,
  });

  const resStatus = profile?.reservation_status?.status ?? 'PAYMENT_PENDING';
  const filteredNav = nav.filter(({ to }) => to !== '/tenant/move-out' || resStatus !== 'PAYMENT_PENDING');
  return (
    <div className="min-h-screen pb-[calc(4rem+env(safe-area-inset-bottom))]" style={{ backgroundColor: '#FFFDF5' }}>
      <main className="max-w-lg mx-auto px-4 py-5">
        <Outlet />
      </main>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40"
        aria-label="Tenant navigation"
        style={{ backgroundColor: '#FFFFFF', borderTop: '1px solid #E8E4DC', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex justify-around max-w-lg mx-auto items-stretch" style={{ height: '64px' }}>
          {filteredNav.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className="flex-1">
              {({ isActive }) => (
                <div
                  className="relative flex flex-col items-center justify-center h-full gap-0.5 touch-manipulation"
                  style={{ color: isActive ? '#F07B1D' : '#6B6B6B' }}
                >
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-0.5 rounded-full" style={{ backgroundColor: '#F07B1D' }} />
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
