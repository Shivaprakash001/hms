import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { useEffect } from 'react';
import { activationService } from '../../api/services';

// Step definitions for the progress bar
const STEPS = [
  { path: '/onboarding/welcome',  label: 'Welcome', step: 'WELCOME'   },
  { path: '/onboarding/plans',    label: 'Plan',    step: 'PLAN'      },
  { path: '/onboarding/hostel',   label: 'Hostel',  step: 'HOSTEL'    },
  { path: '/onboarding/checklist', label: 'Launch', step: 'CHECKLIST' },
  { path: '/onboarding/rooms',    label: 'Rooms',   step: 'ROOMS'     },
  { path: '/onboarding/tenant',   label: 'Tenant',  step: 'TENANT'    },
  { path: '/onboarding/payments', label: 'Pay',     step: 'PAYMENTS'  },
  { path: '/onboarding/done',     label: 'Done',    step: 'COMPLETED' },
];

const BACK_MAP = {
  '/onboarding/plans':    '/onboarding/welcome',
  '/onboarding/hostel':   '/onboarding/plans',
  '/onboarding/checklist': '/onboarding/hostel',
  '/onboarding/billing':  '/onboarding/hostel',
  '/onboarding/rooms':    '/onboarding/checklist',
  '/onboarding/tenant':   '/onboarding/checklist',
  '/onboarding/payments': '/onboarding/checklist',
};

export default function OnboardingShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentIdx = STEPS.findIndex(s => location.pathname.startsWith(s.path));
  const canGoBack = BACK_MAP[location.pathname];
  const isDone = location.pathname === '/onboarding/done';

  // ── Server-side step persistence (cross-device sync) ─────────────────────
  // Fires silently on every route change — never blocks navigation.
  useEffect(() => {
    const match = STEPS.find(s => location.pathname.startsWith(s.path));
    if (!match) return;
    activationService.persistStep(match.step).catch(() => {
      // Non-critical — localStorage already has the step locally
    });
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex flex-col">
      {/* Fixed top header with progress */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          {canGoBack && !isDone ? (
            <button
              onClick={() => navigate(BACK_MAP[location.pathname])}
              className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
          ) : (
            <div className="w-9" />
          )}

          {/* Progress dots */}
          <div className="flex-1 flex items-center gap-1.5">
            {STEPS.map((step, i) => {
              const isComplete = i < currentIdx;
              const isActive   = i === currentIdx;
              return (
                <div
                  key={step.path}
                  className={`transition-all duration-300 rounded-full ${
                    isActive   ? 'flex-1 h-1.5 bg-indigo-600' :
                    isComplete ? 'w-4 h-1.5 bg-indigo-300' :
                                 'w-2 h-1.5 bg-slate-200'
                  }`}
                />
              );
            })}
          </div>

          {!isDone && currentIdx >= 0 && (
            <span className="text-[11px] font-black text-slate-400 tabular-nums shrink-0">
              {currentIdx + 1}/{STEPS.length}
            </span>
          )}
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 pb-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

