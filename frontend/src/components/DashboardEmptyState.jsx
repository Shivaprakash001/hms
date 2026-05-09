import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, ArrowRight, Sparkles } from 'lucide-react';
import { roomService, tenantService, ownerService } from '../api/services';
import { getStoredStep } from '../hooks/useOnboardingState';

const CHECKLIST = [
  {
    id:    'account',
    label: 'Account created',
    done:  () => true, // always true if we're here
    path:  null,
  },
  {
    id:    'hostel',
    label: 'Hostel set up',
    done:  (data) => Boolean(data?.hostel?.name),
    path:  '/onboarding/hostel',
    cta:   'Set up hostel',
  },
  {
    id:    'billing',
    label: 'Rent automation configured',
    done:  (data) => Boolean(data?.preferences?.auto_rent_day),
    path:  '/onboarding/billing',
    cta:   'Configure billing',
  },
  {
    id:    'rooms',
    label: 'First room added',
    done:  (data) => (data?.rooms ?? 0) > 0,
    path:  '/onboarding/rooms',
    cta:   'Add a room',
  },
  {
    id:    'tenants',
    label: 'First tenant added',
    done:  (data) => (data?.tenants ?? 0) > 0,
    path:  '/onboarding/tenant',
    cta:   'Add a tenant',
  },
  {
    id:    'payments',
    label: 'Online payments enabled',
    done:  (data) => Boolean(data?.hostel?.upi_id),
    path:  '/onboarding/payments',
    cta:   'Set up payments',
  },
];

export default function DashboardEmptyState() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const profile = await ownerService.getProfile().catch(() => ({}));
        const hostelId = profile?.hostel?.id || profile?.hostels?.[0]?.id || null;
        const [roomsRes, tenantsRes] = hostelId ? await Promise.allSettled([
          roomService.getAll(hostelId, { limit: 1 }),
          tenantService.getAll(hostelId, { limit: 1, status: 'ACTIVE' }),
        ]) : [{ status: 'rejected' }, { status: 'rejected' }];
        const p = profile || {};
        const roomCount   = roomsRes.status === 'fulfilled'
          ? (Array.isArray(roomsRes.value) ? roomsRes.value.length : roomsRes.value?.total ?? 0) : 0;
        const tenantCount = tenantsRes.status === 'fulfilled'
          ? (Array.isArray(tenantsRes.value) ? tenantsRes.value.length : tenantsRes.value?.total ?? 0) : 0;
        setData({ ...p, rooms: roomCount, tenants: tenantCount });
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return (
    <div className="space-y-3 animate-pulse pt-4">
      <div className="h-28 bg-slate-100 rounded-2xl" />
      <div className="h-16 bg-slate-100 rounded-2xl" />
      <div className="h-16 bg-slate-100 rounded-2xl" />
    </div>
  );

  const doneItems  = CHECKLIST.filter(c => c.done(data));
  const pendingItems = CHECKLIST.filter(c => !c.done(data));
  const progress   = Math.round((doneItems.length / CHECKLIST.length) * 100);
  const nextAction = pendingItems[0];

  return (
    <div className="space-y-4 pt-2">
      {/* Hero card */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-indigo-200" />
          <p className="text-xs font-black uppercase tracking-widest text-indigo-200">Setup in progress</p>
        </div>
        <h2 className="text-xl font-black leading-snug mb-1">
          Complete setup to unlock your dashboard
        </h2>
        <p className="text-sm text-indigo-200 font-medium mb-4">
          {pendingItems.length} step{pendingItems.length !== 1 ? 's' : ''} left to go fully operational
        </p>

        {/* Progress bar */}
        <div className="h-2 bg-white/20 rounded-full overflow-hidden mb-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full bg-white rounded-full"
          />
        </div>
        <p className="text-xs font-black text-indigo-200 text-right">{progress}% complete</p>
      </div>

      {/* Checklist */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-50">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Setup Checklist</p>
        </div>
        {CHECKLIST.map((item, i) => {
          const done = item.done(data);
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-4 px-5 py-4 ${i < CHECKLIST.length - 1 ? 'border-b border-slate-50' : ''} ${!done && item.path ? 'cursor-pointer active:bg-slate-50 hover:bg-slate-50 transition-colors' : ''}`}
              onClick={() => !done && item.path && navigate(item.path)}
            >
              {done
                ? <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                : <Circle size={20} className="text-slate-200 shrink-0" />
              }
              <p className={`flex-1 text-sm font-semibold ${done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                {item.label}
              </p>
              {!done && item.cta && (
                <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-xl whitespace-nowrap shrink-0">
                  {item.cta}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Primary action CTA */}
      {nextAction && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate(nextAction.path)}
          id="dashboard-empty-state-cta"
          className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-lg shadow-indigo-600/20 transition-all"
        >
          {nextAction.cta} <ArrowRight size={16} />
        </motion.button>
      )}

      {/* All done message (shouldn't show but just in case) */}
      {!nextAction && (
        <div className="text-center py-4">
          <p className="text-sm font-black text-emerald-600">🎉 Setup complete! Refreshing dashboard...</p>
        </div>
      )}
    </div>
  );
}
