import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMoveOutTimeline, useMoveOutActions } from '../../hooks/useMoveOut';
import MoveOutRequestFlow from '../../components/tenant/moveout/MoveOutRequestFlow';
import MoveOutTracker from '../../components/tenant/moveout/MoveOutTracker';
import { FullPageSkeleton } from '../../components/tenant/moveout/Skeletons';

export default function TenantMoveOut() {
  const { data, loading, error, refetch } = useMoveOutTimeline();
  const actions = useMoveOutActions();
  const [showForm, setShowForm] = useState(false);

  if (loading) return <FullPageSkeleton />;

  if (error && !data) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center px-4">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center"><span className="text-2xl">😕</span></div>
        <p className="text-slate-500 text-sm mb-4">We couldn't load your move-out status right now.</p>
        <button onClick={refetch} className="text-indigo-600 font-medium text-sm hover:underline">Try again</button>
      </div>
    );
  }

  const isActive = data?.active;

  return (
    <div className="max-w-lg mx-auto pb-8">
      <AnimatePresence mode="wait">
        {!isActive && !showForm && (
          <motion.div key="idle" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <IdleState onStart={() => setShowForm(true)} />
          </motion.div>
        )}
        {!isActive && showForm && (
          <motion.div key="form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <MoveOutRequestFlow actions={actions} onSuccess={() => { setShowForm(false); refetch(); }} onBack={() => setShowForm(false)} />
          </motion.div>
        )}
        {isActive && (
          <motion.div key="tracker" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <MoveOutTracker data={data} actions={actions} refetch={refetch} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function IdleState({ onStart }) {
  return (
    <div className="text-center py-16 px-6">
      <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
        <span className="text-3xl">🏠</span>
      </div>
      <h2 className="text-xl font-semibold text-slate-800 mb-2">Planning to move out?</h2>
      <p className="text-slate-500 text-sm mb-2 max-w-xs mx-auto leading-relaxed">
        We'll guide you through the process step by step — inspection, settlement, and refund.
      </p>
      <p className="text-slate-400 text-xs mb-8 max-w-xs mx-auto">
        The whole process usually takes 3–7 days after submission.
      </p>
      <button onClick={onStart}
        className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-600/20">
        Request Move-Out
      </button>
    </div>
  );
}
