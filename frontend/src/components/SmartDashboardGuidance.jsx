import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Circle, ArrowRight, Sparkles,
  Loader2, AlertCircle, Zap, TrendingUp
} from 'lucide-react';
import { useActivation } from '../hooks/useActivation';

// ── Step meta for the visual timeline ────────────────────────────────────────
const STEP_META = {
  ACCOUNT_CREATED:        { emoji: '👤', label: 'Account created',            alwaysDone: true },
  HOSTEL_CREATED:         { emoji: '🏠', label: 'Hostel set up',              alwaysDone: false },
  BILLING_CONFIGURED:     { emoji: '⚡', label: 'Rent automation configured', alwaysDone: false },
  FIRST_ROOM_ADDED:       { emoji: '🚪', label: 'First room added',           alwaysDone: false },
  FIRST_TENANT_ADDED:     { emoji: '👥', label: 'First tenant added',         alwaysDone: false },
  PAYMENT_SETUP_ENABLED:  { emoji: '💳', label: 'Payments enabled',           alwaysDone: false },
  FIRST_RENT_GENERATED:   { emoji: '📋', label: 'First rent generated',       alwaysDone: false },
};

const ALL_STEPS = Object.keys(STEP_META);

// ── Priority badge colours ─────────────────────────────────────────────────
const PRIORITY_STYLES = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  HIGH:     'bg-amber-100 text-amber-700 border-amber-200',
  MEDIUM:   'bg-indigo-100 text-indigo-700 border-indigo-200',
  LOW:      'bg-slate-100 text-slate-600 border-slate-200',
};

// ── Activation score arc (SVG) ────────────────────────────────────────────────
function ScoreArc({ score }) {
  const r = 36;
  const circumference = 2 * Math.PI * r;
  const dash = (score / 100) * circumference;
  const color = score < 40 ? '#f59e0b' : score < 75 ? '#6366f1' : '#10b981';

  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
        <motion.circle
          cx="44" cy="44" r={r}
          fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - dash }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black text-slate-900 leading-none">{score}</span>
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">/ 100</span>
      </div>
    </div>
  );
}

// ── Primary next-action card ──────────────────────────────────────────────────
function NextActionCard({ action, onNavigate }) {
  if (!action) return null;
  const priorityStyle = PRIORITY_STYLES[action.priority] ?? PRIORITY_STYLES.MEDIUM;

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onNavigate(action.path)}
      id={`smart-guidance-${action.id}`}
      className="w-full text-left flex items-center gap-4 p-5 bg-gradient-to-r from-indigo-600 to-violet-700 rounded-2xl text-white shadow-2xl shadow-indigo-600/25 active:scale-[0.99] transition-all"
    >
      <span className="text-3xl shrink-0">{action.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${priorityStyle}`}>
            {action.priority}
          </span>
        </div>
        <p className="font-black text-base leading-tight">{action.title}</p>
        <p className="text-indigo-200 text-xs mt-1 font-medium">{action.subtitle}</p>
      </div>
      <div className="shrink-0 w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center">
        <ArrowRight size={18} />
      </div>
    </motion.button>
  );
}

// ── Activation timeline ───────────────────────────────────────────────────────
function ActivationTimeline({ completedSteps, missingSteps }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-50 flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">
          Setup Progress
        </p>
        <span className="text-xs font-black text-indigo-600">
          {completedSteps.length}/{ALL_STEPS.length} steps
        </span>
      </div>
      <div className="divide-y divide-slate-50">
        {ALL_STEPS.map((step, i) => {
          const meta    = STEP_META[step];
          const isDone  = completedSteps.includes(step);
          const isPending = !isDone && missingSteps.includes(step);
          const isNext  = missingSteps[0] === step;

          return (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`flex items-center gap-3 px-5 py-3.5 ${isNext ? 'bg-indigo-50/60' : ''}`}
            >
              {isDone ? (
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
              ) : isNext ? (
                <div className="w-[18px] h-[18px] rounded-full border-2 border-indigo-400 flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                </div>
              ) : (
                <Circle size={18} className="text-slate-200 shrink-0" />
              )}
              <span className="text-base leading-none">{meta.emoji}</span>
              <p className={`flex-1 text-sm font-semibold ${isDone ? 'text-slate-400 line-through' : isNext ? 'text-indigo-700 font-black' : 'text-slate-600'}`}>
                {meta.label}
              </p>
              {isNext && (
                <span className="text-[10px] font-black text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0">
                  Next
                </span>
              )}
              {isDone && (
                <span className="text-[10px] font-black text-emerald-600 shrink-0">✓</span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── Additional recommendations list ──────────────────────────────────────────
function RecommendationList({ recommendations, onNavigate }) {
  // Skip the first (already shown as NextActionCard)
  const rest = recommendations.slice(1);
  if (rest.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">
        More to do
      </p>
      {rest.map((rec, i) => (
        <motion.button
          key={rec.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + i * 0.06 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate(rec.path)}
          id={`recommendation-${rec.id}`}
          className="w-full flex items-center gap-3 p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 hover:bg-indigo-50/30 active:scale-[0.99] transition-all text-left shadow-sm"
        >
          <span className="text-xl shrink-0">{rec.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-slate-900 truncate">{rec.title}</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">{rec.subtitle}</p>
          </div>
          <ArrowRight size={14} className="text-slate-400 shrink-0" />
        </motion.button>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SmartDashboardGuidance() {
  const navigate = useNavigate();
  const {
    activation, loading, error, score,
    operational_state, isFullySetup,
    nextAction, completedSteps, missingSteps, recommendations,
    raw,
  } = useActivation();

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse pt-2">
        <div className="h-28 bg-slate-100 rounded-2xl" />
        <div className="h-40 bg-slate-100 rounded-2xl" />
        <div className="h-16 bg-slate-100 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100">
        <AlertCircle size={18} className="shrink-0" />
        <p className="text-sm font-medium">Could not load setup status. Please refresh.</p>
      </div>
    );
  }

  if (isFullySetup) return null; // Dashboard renders normally when fully operational

  const stateLabel = {
    NEW:               'Just getting started',
    HOSTEL_READY:      'Hostel configured',
    ROOM_READY:        'Rooms ready, no tenants yet',
    TENANT_READY:      'Tenants added, ready to generate rent',
    RENT_ACTIVE:       'Rent active — collect your first payment',
    COLLECTING:        'Collecting — almost fully operational',
    FULLY_OPERATIONAL: 'Fully operational',
  };

  return (
    <div className="space-y-4 pt-2">
      {/* Header card with score + state */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-5 p-5 bg-white border border-slate-100 rounded-2xl shadow-sm"
      >
        <ScoreArc score={score} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles size={13} className="text-indigo-500" />
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
              Activation Score
            </span>
          </div>
          <p className="text-base font-black text-slate-900 leading-snug">
            {stateLabel[operational_state] ?? 'Setting up'}
          </p>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {missingSteps.length} step{missingSteps.length !== 1 ? 's' : ''} left to go fully operational
          </p>
          {score >= 70 && (
            <div className="flex items-center gap-1.5 mt-2">
              <TrendingUp size={12} className="text-emerald-500" />
              <span className="text-xs font-black text-emerald-600">Almost there!</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Primary next action */}
      {nextAction && (
        <NextActionCard action={nextAction} onNavigate={navigate} />
      )}

      {/* Activation timeline */}
      <ActivationTimeline
        completedSteps={completedSteps}
        missingSteps={missingSteps}
      />

      {/* Secondary recommendations */}
      <RecommendationList
        recommendations={recommendations}
        onNavigate={navigate}
      />

      {/* Operational stats when partially set up */}
      {(raw.room_count > 0 || raw.active_tenant_count > 0) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-2 gap-3"
        >
          <div className="bg-white border border-slate-100 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-black text-slate-900">{raw.room_count}</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Rooms</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-black text-slate-900">{raw.active_tenant_count}</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Active Tenants</p>
          </div>
        </motion.div>
      )}

      {/* Automation trust builder */}
      {operational_state === 'TENANT_READY' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-start gap-3 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-2xl"
        >
          <Zap size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-amber-800 leading-relaxed">
            <span className="font-black">Automation is ready.</span> Rent will generate automatically on your configured day.
            You don't need to do anything — the system handles it.
          </p>
        </motion.div>
      )}
    </div>
  );
}
