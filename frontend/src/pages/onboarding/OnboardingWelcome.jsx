import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Sparkles, CalendarCheck, Bell, TrendingUp, Zap, ArrowRight } from 'lucide-react';
import { setStoredStep } from '../../hooks/useOnboardingState';
import { useAuth } from '../../context/AuthContext';

const features = [
  { icon: CalendarCheck, color: 'bg-indigo-100 text-indigo-600', text: 'Rent generates itself every month' },
  { icon: Bell,          color: 'bg-violet-100 text-violet-600', text: 'Reminders send automatically to tenants' },
  { icon: TrendingUp,    color: 'bg-emerald-100 text-emerald-600', text: 'Dues tracked in real-time' },
  { icon: Zap,           color: 'bg-amber-100 text-amber-600',  text: 'Collections in a single tap' },
];

export default function OnboardingWelcome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] || 'there';

  const handleStart = () => {
    setStoredStep('ACCOUNT_CREATED');
    navigate('/onboarding/plans');
  };

  return (
    <div className="flex flex-col items-center text-center pt-4">
      {/* Hero icon */}
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/30 mb-6"
      >
        <Sparkles className="w-10 h-10 text-white" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
          Welcome, {firstName}! 👋
        </h1>
        <p className="mt-2 text-slate-500 font-medium text-base leading-relaxed">
          Your hostel command center is almost ready.
        </p>
      </motion.div>

      {/* Feature list */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="w-full mt-8 space-y-3"
      >
        {features.map(({ icon: Icon, color, text }, i) => (
          <motion.div
            key={text}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.08 }}
            className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm text-left"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
              <Icon size={18} />
            </div>
            <p className="text-sm font-semibold text-slate-700">{text}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Time indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.65 }}
        className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-400"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Setup takes ~5 minutes · You'll be ready to collect rent today
      </motion.div>

      {/* Sticky CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="fixed bottom-8 left-4 right-4 max-w-lg mx-auto"
        style={{ left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 32px)', maxWidth: '512px' }}
      >
        <button
          onClick={handleStart}
          id="onboarding-welcome-start"
          className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-black rounded-2xl shadow-2xl shadow-indigo-600/30 active:scale-[0.98] transition-all text-base"
        >
          Let's Get Started <ArrowRight size={18} />
        </button>
      </motion.div>
    </div>
  );
}
