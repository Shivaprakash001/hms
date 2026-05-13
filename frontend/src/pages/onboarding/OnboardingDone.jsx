import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, CalendarCheck, Bell, LayoutDashboard } from 'lucide-react';
import { ownerService } from '../../api/services';
import { setStoredStep } from '../../hooks/useOnboardingState';

function computeNextRentDate(autoRentDay) {
  const now = new Date();
  const day = autoRentDay || 1;
  let candidate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), day));
  if (candidate <= now) {
    candidate = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, day));
  }
  return candidate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

export default function OnboardingDone() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ rooms: 0, tenants: 0, rentDay: 1, hostelName: '', hostelId: '' });

  useEffect(() => {
    Promise.all([
      ownerService.getProfile().catch(() => ({})),
      ownerService.getHostels().catch(() => ({ hostels: [] })),
    ]).then(([p, hostelsResponse]) => {
      const hostels = hostelsResponse?.hostels || p?.hostels || (p?.hostel?.id ? [p.hostel] : []);
      const hostel = hostels.find((item) => item?.is_active !== false) || hostels[0] || p?.hostel || {};
      setStats({
        rooms:      hostel?.total_rooms     ?? p?.hostel?.total_rooms ?? 0,
        tenants:    hostel?.total_tenants   ?? p?.hostel?.total_tenants ?? 0,
        rentDay:    p?.preferences?.auto_rent_day ?? 1,
        hostelName: hostel?.name ?? p?.hostel?.name ?? 'your hostel',
        hostelId:   hostel?.id || p?.hostel?.id || '',
      });
    }).catch(() => {});
    setStoredStep('COMPLETED');
  }, []);

  const goToDashboard = () => {
    setStoredStep('COMPLETED');
    navigate(stats.hostelId ? `/hostels/${stats.hostelId}/dashboard` : '/owner/portfolio', { replace: true });
  };

  const nextRent = computeNextRentDate(stats.rentDay);

  const items = [
    { icon: '🏠', label: 'Hostel created',         detail: stats.hostelName,              ok: true },
    { icon: '🚪', label: 'Rooms added',             detail: `${stats.rooms} room${stats.rooms !== 1 ? 's' : ''}`, ok: stats.rooms > 0 },
    { icon: '👤', label: 'Tenants added',           detail: `${stats.tenants} tenant${stats.tenants !== 1 ? 's' : ''}`, ok: stats.tenants > 0 },
    { icon: '⚡', label: 'Billing schedule saved', detail: `Cycle starts on the ${stats.rentDay}${['st','nd','rd'][((stats.rentDay % 10) - 1)] ?? 'th'} every month`, ok: true },
  ];

  return (
    <div className="flex flex-col items-center text-center pt-4 space-y-6">
      {/* Celebration icon */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.1 }}
      >
        <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-indigo-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/30 mx-auto">
          <span className="text-5xl">🎉</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          Your hostel is live!
        </h1>
        <p className="text-slate-500 mt-2 font-medium">
          You're now fully operational. Here's what's set up:
        </p>
      </motion.div>

      {/* Setup summary checklist */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="w-full bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden"
      >
        {items.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.08 }}
            className={`flex items-center gap-4 px-5 py-4 ${i < items.length - 1 ? 'border-b border-slate-50' : ''}`}
          >
            <span className="text-xl">{item.icon}</span>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-black text-slate-900">{item.label}</p>
              <p className="text-xs text-slate-500 font-medium truncate">{item.detail}</p>
            </div>
            {item.ok
              ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
              : <span className="text-xs font-black text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full shrink-0">Add later</span>
            }
          </motion.div>
        ))}
      </motion.div>

      {/* Next rent date highlight */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.7 }}
        className="w-full bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-5 text-left"
      >
        <div className="flex items-center gap-2 mb-3">
          <CalendarCheck size={16} className="text-indigo-200" />
          <p className="text-xs font-black text-indigo-200 uppercase tracking-widest">Next Automation</p>
        </div>
        <p className="text-xl font-black text-white">📋 Rent generates on {nextRent}</p>
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
          <Bell size={14} className="text-indigo-300" />
          <p className="text-xs text-indigo-200 font-medium">
            Automatic reminders are available after upgrading to Starter.
          </p>
        </div>
      </motion.div>

      {/* Padding for sticky button */}
      <div className="h-20" />

      {/* Sticky CTA */}
      <div className="fixed bottom-8 left-4 right-4" style={{ left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 32px)', maxWidth: '512px' }}>
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.9 }}
          whileTap={{ scale: 0.98 }}
          onClick={goToDashboard}
          id="onboarding-go-dashboard"
          className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-black rounded-2xl shadow-2xl shadow-indigo-600/30 transition-all text-base"
        >
          <LayoutDashboard size={18} /> Go to Dashboard
        </motion.button>
      </div>
    </div>
  );
}
