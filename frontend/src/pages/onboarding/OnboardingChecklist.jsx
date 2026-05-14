import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, BedDouble, CheckCircle2, ClipboardList, CreditCard,
  LayoutDashboard, Loader2, ReceiptText, Users
} from 'lucide-react';
import { ownerService, paymentService, roomService, tenantService } from '../../api/services';
import { setStoredStep } from '../../hooks/useOnboardingState';

const checklistCopy = [
  {
    id: 'rooms',
    label: 'Add Rooms',
    title: 'Build your room inventory',
    subtitle: 'Create floors, rooms, bed capacity, and rent defaults.',
    icon: BedDouble,
    cta: 'Add rooms',
  },
  {
    id: 'tenant',
    label: 'Add First Tenant',
    title: 'Invite or add your first resident',
    subtitle: 'Assign a room and set the monthly rent.',
    icon: Users,
    cta: 'Add tenant',
  },
  {
    id: 'rent',
    label: 'Generate First Rent',
    title: 'Create the first rent cycle',
    subtitle: 'Turn tenant rent into payable dues.',
    icon: ReceiptText,
    cta: 'Generate rent',
  },
  {
    id: 'payment',
    label: 'Collect First Payment',
    title: 'Record or collect your first payment',
    subtitle: 'Confirm UPI/cash or let tenants pay online.',
    icon: CreditCard,
    cta: 'Collect payment',
  },
];

function ChecklistItem({ item, done, onClick }) {
  const Icon = item.icon;
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      className={`w-full rounded-3xl border p-4 text-left shadow-sm transition ${
        done ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white hover:border-indigo-200'
      }`}
    >
      <div className="flex items-start gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
          done ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-50 text-indigo-600'
        }`}>
          {done ? <CheckCircle2 size={22} /> : <Icon size={22} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <p className={`text-sm font-black ${done ? 'text-emerald-900' : 'text-slate-950'}`}>{item.title}</p>
            {done && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">Done</span>}
          </div>
          <p className={`text-xs font-semibold leading-relaxed ${done ? 'text-emerald-700' : 'text-slate-500'}`}>{item.subtitle}</p>
        </div>
        <ArrowRight size={16} className={done ? 'text-emerald-500' : 'text-slate-300'} />
      </div>
    </motion.button>
  );
}

export default function OnboardingChecklist() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hostelId, setHostelId] = useState('');
  const [state, setState] = useState({ rooms: 0, tenants: 0, obligations: 0, payments: 0 });

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const hostelsRes = await ownerService.getHostels();
        const hostels = hostelsRes?.hostels || [];
        const hostel = hostels.find((h) => h?.is_active !== false) || hostels[0];
        const nextHostelId = hostel?.id || '';
        if (!mounted) return;
        setHostelId(nextHostelId);

        if (!nextHostelId) return;
        const [roomsRes, tenantsRes, ledgerRes] = await Promise.allSettled([
          roomService.getAll(nextHostelId, { limit: 1 }),
          tenantService.getAll(nextHostelId, { limit: 1 }),
          paymentService.getAll(nextHostelId, { limit: 200 }),
        ]);

        const roomsVal = roomsRes.status === 'fulfilled' ? roomsRes.value : null;
        const tenantsVal = tenantsRes.status === 'fulfilled' ? tenantsRes.value : null;
        const ledgerVal = ledgerRes.status === 'fulfilled' ? ledgerRes.value : null;

        const roomCount = Array.isArray(roomsVal) ? roomsVal.length : Number(roomsVal?.total ?? roomsVal?.rooms?.length ?? roomsVal?.data?.length ?? 0);
        const tenantCount = Array.isArray(tenantsVal) ? tenantsVal.length : Number(tenantsVal?.total ?? tenantsVal?.tenants?.length ?? 0);
        const obligationCount = Number(ledgerVal?.total ?? ledgerVal?.payments?.length ?? 0);
        const paymentCount = Number(ledgerVal?.payment_records?.length ?? 0);

        if (mounted) setState({ rooms: roomCount, tenants: tenantCount, obligations: obligationCount, payments: paymentCount });
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const doneMap = useMemo(() => ({
    rooms: state.rooms > 0,
    tenant: state.tenants > 0,
    rent: state.obligations > 0,
    payment: state.payments > 0,
  }), [state]);

  const completed = Object.values(doneMap).filter(Boolean).length;
  const progress = Math.round((completed / checklistCopy.length) * 100);
  const hostelBase = hostelId ? `/hostels/${hostelId}` : '/owner';

  const go = (id) => {
    if (id === 'rooms') navigate('/onboarding/rooms');
    if (id === 'tenant') navigate('/onboarding/tenant');
    if (id === 'rent') navigate(`${hostelBase}/payments`);
    if (id === 'payment') navigate(`${hostelBase}/payments`);
  };

  const openDashboard = () => {
    setStoredStep('COMPLETED');
    navigate(hostelId ? `/hostels/${hostelId}/dashboard` : '/owner/portfolio', { replace: true });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-36 animate-pulse rounded-[2rem] bg-slate-100" />
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 animate-pulse rounded-3xl bg-slate-100" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-900/20">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
          <ClipboardList size={24} />
        </div>
        <p className="text-xs font-black uppercase tracking-widest text-indigo-200">Business setup checklist</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">Get your hostel ready for daily operations</h1>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-300">
          Finish these first business actions, then open your Today dashboard.
        </p>
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs font-black text-slate-300">
            <span>{completed}/{checklistCopy.length} completed</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full rounded-full bg-emerald-400"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {checklistCopy.map((item) => (
          <ChecklistItem
            key={item.id}
            item={item}
            done={doneMap[item.id]}
            onClick={() => go(item.id)}
          />
        ))}
      </div>

      <div className="fixed bottom-8 left-4 right-4" style={{ left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 32px)', maxWidth: '512px' }}>
        <button
          type="button"
          onClick={openDashboard}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 text-base font-black text-white shadow-2xl shadow-indigo-600/25 active:scale-[0.98]"
        >
          <LayoutDashboard size={18} /> Open Owner Today Dashboard
        </button>
      </div>
    </div>
  );
}
