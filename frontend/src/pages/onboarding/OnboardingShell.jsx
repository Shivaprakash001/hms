import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import { activationService } from '../../api/services';

const STEPS = [
  { path: '/onboarding/welcome',  label: 'Welcome', step: 'WELCOME'   },
  { path: '/onboarding/plans',    label: 'Plan',    step: 'PLAN'      },
  { path: '/onboarding/hostel',   label: 'Hostel',  step: 'HOSTEL'    },
  { path: '/onboarding/rooms',    label: 'Rooms',   step: 'ROOMS'     },
  { path: '/onboarding/tenant',   label: 'Tenant',  step: 'TENANT'    },
  { path: '/onboarding/done',     label: 'Done',    step: 'COMPLETED' },
];

const BACK_MAP = {
  '/onboarding/plans':    '/onboarding/welcome',
  '/onboarding/hostel':   '/onboarding/plans',
  '/onboarding/rooms':    '/onboarding/hostel',
  '/onboarding/tenant':   '/onboarding/rooms',
};

export default function OnboardingShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentIdx = STEPS.findIndex(s => location.pathname.startsWith(s.path));
  const canGoBack = BACK_MAP[location.pathname];
  const isDone = location.pathname === '/onboarding/done';

  useEffect(() => {
    const match = STEPS.find(s => location.pathname.startsWith(s.path));
    if (!match) return;
    activationService.persistStep(match.step).catch(() => {});
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50 relative flex flex-col overflow-x-hidden">
      {/* Premium Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-200/40 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-200/40 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      {!isDone && (
        <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-100 shadow-sm">
          <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              {canGoBack ? (
                <button
                  onClick={() => navigate(BACK_MAP[location.pathname])}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all active:scale-95"
                >
                  <ChevronLeft size={20} />
                </button>
              ) : (
                <div className="w-10 h-10 bg-brand-gradient rounded-xl flex items-center justify-center shadow-md">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
              )}

              {/* Progress Dots */}
              <div className="flex items-center gap-1.5 flex-1 max-w-[200px]">
                {STEPS.map((step, i) => {
                  const isComplete = i < currentIdx;
                  const isActive = i === currentIdx;
                  return (
                    <div
                      key={step.path}
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        isActive ? 'flex-1 bg-purple-600 shadow-[0_0_8px_rgba(124,58,237,0.4)]' :
                        isComplete ? 'w-3 bg-purple-300' : 'w-1.5 bg-slate-200'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:block">
                Step {currentIdx + 1} of {STEPS.length}
              </span>
              <div className="h-4 w-px bg-slate-200 hidden sm:block" />
              <div className="text-[11px] font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                {STEPS[currentIdx]?.label}
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={`flex-1 w-full max-w-4xl mx-auto px-4 py-8 relative z-10 ${isDone ? 'flex items-center justify-center' : ''}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

