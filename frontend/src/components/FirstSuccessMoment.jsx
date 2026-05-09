import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight } from 'lucide-react';

/**
 * FirstSuccessMoment
 *
 * Lightweight celebration overlay for key lifecycle milestones.
 * Triggered by checking unread milestone notifications from the server
 * (type: FIRST_TENANT_MILESTONE | FIRST_RENT_MILESTONE | FIRST_PAYMENT_MILESTONE | FIRST_REMINDER_MILESTONE)
 *
 * Usage:
 *   <FirstSuccessMoment notifications={unreadNotifications} onDismiss={markAsRead} />
 */

const MILESTONE_CONFIG = {
  FIRST_TENANT_MILESTONE: {
    emoji:    '🎉',
    title:    'First tenant added!',
    subtitle: 'Your hostel is live. Rent will generate automatically from now on.',
    cta:      'View Dashboard',
    path:     '/owner/dashboard',
    color:    'from-emerald-500 to-teal-600',
    confetti: ['🎊', '✨', '🏠', '👤', '🎉'],
  },
  FIRST_RENT_MILESTONE: {
    emoji:    '📋',
    title:    'First rent cycle generated!',
    subtitle: 'This will now happen automatically every month. No manual work needed.',
    cta:      'View Collections',
    path:     '/owner/payments',
    color:    'from-indigo-500 to-violet-600',
    confetti: ['📋', '✨', '💰', '🎊', '⚡'],
  },
  FIRST_PAYMENT_MILESTONE: {
    emoji:    '💰',
    title:    'First payment collected!',
    subtitle: 'Congratulations — you just automated your first rent collection.',
    cta:      'View Payments',
    path:     '/owner/payments',
    color:    'from-violet-500 to-purple-700',
    confetti: ['💰', '🎊', '✨', '🏆', '💎'],
  },
  FIRST_REMINDER_MILESTONE: {
    emoji:    '🔔',
    title:    'Reminders are working!',
    subtitle: 'Owners who use reminders collect 40% faster. Keep them enabled.',
    cta:      'View Dashboard',
    path:     '/owner/dashboard',
    color:    'from-amber-500 to-orange-600',
    confetti: ['🔔', '✨', '📱', '🎊', '💬'],
  },
};

const MILESTONE_TYPES = Object.keys(MILESTONE_CONFIG);

// ── Confetti particle ─────────────────────────────────────────────────────────
function ConfettiParticle({ emoji, delay, x, y }) {
  return (
    <motion.div
      className="absolute text-2xl pointer-events-none select-none"
      style={{ left: `${x}%`, top: '-20px' }}
      initial={{ opacity: 1, y: 0, rotate: 0 }}
      animate={{
        opacity: [1, 1, 0],
        y: ['0vh', '90vh'],
        rotate: [0, Math.random() > 0.5 ? 360 : -360],
        x: [`${x}%`, `${x + (Math.random() - 0.5) * 40}%`],
      }}
      transition={{ duration: 2.5 + Math.random(), delay, ease: 'easeIn' }}
    >
      {emoji}
    </motion.div>
  );
}

export default function FirstSuccessMoment({ notifications = [], onDismiss }) {
  const [visible, setVisible] = useState(null);  // the milestone notification obj
  const [config, setConfig]   = useState(null);
  const shownRef = useRef(new Set()); // prevent re-showing within session

  useEffect(() => {
    if (!notifications?.length) return;

    // Find the first unread milestone notification not yet shown this session
    const milestone = notifications.find(n =>
      MILESTONE_TYPES.includes(n.type) &&
      !n.is_read &&
      !shownRef.current.has(n.id)
    );

    if (milestone) {
      shownRef.current.add(milestone.id);
      setConfig(MILESTONE_CONFIG[milestone.type]);
      setVisible(milestone);
    }
  }, [notifications]);

  const handleDismiss = () => {
    if (visible) onDismiss?.(visible.id);
    setVisible(null);
    setConfig(null);
  };

  // Generate confetti positions once per render
  const particles = config
    ? Array.from({ length: 18 }, (_, i) => ({
        emoji: config.confetti[i % config.confetti.length],
        x:     5 + (i / 18) * 90,
        delay: i * 0.08,
      }))
    : [];

  return (
    <AnimatePresence>
      {visible && config && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={handleDismiss}
          />

          {/* Confetti */}
          <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none">
            {particles.map((p, i) => (
              <ConfettiParticle key={i} {...p} y={-5} />
            ))}
          </div>

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="fixed inset-x-4 bottom-8 z-50 max-w-sm mx-auto"
          >
            <div className={`relative bg-gradient-to-br ${config.color} rounded-3xl p-6 shadow-2xl text-white overflow-hidden`}>
              {/* Dismiss button */}
              <button
                onClick={handleDismiss}
                id="first-success-dismiss"
                className="absolute top-4 right-4 w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <X size={16} />
              </button>

              {/* Glow blob */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />

              {/* Content */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="text-5xl mb-4"
              >
                {config.emoji}
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="text-2xl font-black mb-2 leading-tight"
              >
                {config.title}
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="text-white/80 font-medium text-sm mb-5 leading-relaxed"
              >
                {config.subtitle}
              </motion.p>

              <motion.button
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleDismiss}
                id="first-success-cta"
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-white/20 hover:bg-white/30 text-white font-black rounded-2xl transition-all text-sm border border-white/20"
              >
                {config.cta} <ArrowRight size={16} />
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
