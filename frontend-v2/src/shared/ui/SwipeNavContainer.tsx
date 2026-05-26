/**
 * SwipeNavContainer
 *
 * Performance contract:
 * - Only the CURRENT route is ever mounted (lazy-loading preserved).
 * - During a gesture the container translates with the finger (GPU-only).
 * - On navigation AnimatePresence keeps the exiting element alive for ≤260ms,
 *   then fully removes it. No two pages are simultaneously mounted beyond that.
 * - All animations use translateX + opacity only (GPU-composited, no layout).
 * - Desktop: wrapper is transparent — no handlers attached, no overhead.
 */
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useSwipeNav, getSwipeDir, clearSwipeDir } from '@/shared/hooks/useSwipeNav';

interface SwipeNavContainerProps {
  /** Content to render — typically <Outlet /> */
  children: React.ReactNode;
  /** Ordered list of route paths controlled by this swipe gesture */
  routes: string[];
  /** Extra class names on the outer clipping div */
  className?: string;
}

/** Easing that mimics iOS spring deceleration */
const EASE = [0.36, 0.66, 0.04, 1] as const;
const DURATION = 0.26; // seconds

type Dir = 'forward' | 'back' | null;

/**
 * Named variants hoisted outside the component — zero allocation on each render.
 * Each variant function receives the `custom` value (swipe direction).
 */
const PAGE_VARIANTS = {
  enter: (d: Dir) => ({
    x: d === 'forward' ? '30%' : d === 'back' ? '-30%' : 0,
    opacity: d ? 0.82 : 1,
  }),
  center: { x: 0, opacity: 1 },
  exit: (d: Dir) => ({
    x: d === 'forward' ? '-20%' : d === 'back' ? '20%' : 0,
    opacity: d ? 0.55 : 1,
  }),
};

export function SwipeNavContainer({ children, routes, className = '' }: SwipeNavContainerProps) {
  const { pathname } = useLocation();
  const { dragX, isDragging, handlers } = useSwipeNav({ routes });

  // Read direction set by the swipe gesture (module-level, zero overhead)
  const dir = getSwipeDir();

  return (
    // Clip so no horizontal overflow during gesture or animation
    <div className={`overflow-x-hidden ${className}`}>
      {/*
        Drag-feedback layer — follows the finger during gesture.
        On release dragX snaps back to 0 via a fast CSS transition.
        Kept on the compositor thread with transform-gpu.
      */}
      <div
        className="transform-gpu"
        style={{
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? 'none' : 'transform 0.18s ease-out',
          willChange: isDragging ? 'transform' : undefined,
        }}
        {...handlers}
      >
        {/*
          Route-keyed AnimatePresence.
          mode="popLayout" removes the exiting element from layout flow
          immediately so content does not double in height, while the
          exit animation still plays visually.
          Only the current + briefly-exiting page are ever in the DOM.
        */}
        <AnimatePresence
          mode="popLayout"
          initial={false}
          custom={dir}
          onExitComplete={clearSwipeDir}
        >
          <motion.div
            key={pathname}
            custom={dir}
            variants={PAGE_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: DURATION, ease: EASE }}
            className="transform-gpu"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
