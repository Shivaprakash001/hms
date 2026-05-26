import { useCallback, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Module-level swipe direction store.
 * Survives across the navigate() call so the entering page can read it.
 * Zero React overhead — no context, no state.
 */
let _swipeDir: 'forward' | 'back' | null = null;
export const getSwipeDir = (): 'forward' | 'back' | null => _swipeDir;
export const clearSwipeDir = (): void => {
  _swipeDir = null;
};

interface UseSwipeNavOptions {
  /** Ordered list of route paths this swipe gesture maps to */
  routes: string[];
  /** Minimum horizontal travel in px to trigger navigation (default 55) */
  minDistance?: number;
  /** Minimum px/ms velocity to trigger navigation (default 0.18) */
  minVelocity?: number;
  /**
   * Ratio of horizontal / vertical movement required to treat a gesture
   * as horizontal intent (default 1.5 → must be 1.5× more horizontal)
   */
  directionBias?: number;
}

interface SwipeNavHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

export interface UseSwipeNavReturn {
  /** Current finger drag offset in px (apply as translateX for haptic feedback) */
  dragX: number;
  /** True while a valid horizontal gesture is in progress */
  isDragging: boolean;
  /** Attach these handlers to the swipeable container element */
  handlers: SwipeNavHandlers;
}

export function useSwipeNav({
  routes,
  minDistance = 55,
  minVelocity = 0.18,
  directionBias = 1.5,
}: UseSwipeNavOptions): UseSwipeNavReturn {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
  /** null = undecided, true = horizontal, false = vertical */
  const isHoriz = useRef<boolean | null>(null);

  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const currentIndex = routes.indexOf(pathname);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (currentIndex === -1) return;
      const t = e.touches[0];
      touchStart.current = { x: t.clientX, y: t.clientY, t: Date.now() };
      isHoriz.current = null;
    },
    [currentIndex],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current || currentIndex === -1) return;

      const t = e.touches[0];
      const dx = t.clientX - touchStart.current.x;
      const dy = t.clientY - touchStart.current.y;

      // Determine gesture axis on first meaningful movement
      if (isHoriz.current === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        isHoriz.current = Math.abs(dx) > Math.abs(dy) * (1 / directionBias);
      }

      if (!isHoriz.current) return;

      // Don't drag past the first or last tab
      if (dx > 0 && currentIndex === 0) return;
      if (dx < 0 && currentIndex === routes.length - 1) return;

      setIsDragging(true);
      // Rubber-band resistance: feels natural, won't go off-screen
      setDragX(dx * 0.22);
    },
    [currentIndex, routes.length, directionBias],
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return;

      const t = e.changedTouches[0];
      const dx = t.clientX - touchStart.current.x;
      const dt = Math.max(Date.now() - touchStart.current.t, 1);
      const velocity = Math.abs(dx) / dt;

      touchStart.current = null;
      setDragX(0);
      setIsDragging(false);

      if (!isHoriz.current || currentIndex === -1) return;

      const hasDistance = Math.abs(dx) >= minDistance;
      const hasVelocity = velocity >= minVelocity;

      if (!hasDistance && !hasVelocity) return;

      if (dx < 0 && currentIndex < routes.length - 1) {
        // Swipe left → advance to next section
        _swipeDir = 'forward';
        navigate(routes[currentIndex + 1]);
      } else if (dx > 0 && currentIndex > 0) {
        // Swipe right → go back to previous section
        _swipeDir = 'back';
        navigate(routes[currentIndex - 1]);
      }
    },
    [currentIndex, routes, navigate, minDistance, minVelocity],
  );

  return { dragX, isDragging, handlers: { onTouchStart, onTouchMove, onTouchEnd } };
}
