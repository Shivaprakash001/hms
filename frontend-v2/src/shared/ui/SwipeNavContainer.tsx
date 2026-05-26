import { type ReactNode, type TouchEvent, useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface SwipeNavContainerProps {
  children: ReactNode;
  routes: string[];
  className?: string;
}

const MIN_DISTANCE = 64;
const MIN_VELOCITY = 0.28;
const DIRECTION_BIAS = 1.35;
const EDGE_RESISTANCE = 0.18;
const DRAG_RESISTANCE = 0.32;

export function SwipeNavContainer({ children, routes, className = '' }: SwipeNavContainerProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const paneRef = useRef<HTMLDivElement | null>(null);
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const isHorizontal = useRef<boolean | null>(null);
  const frame = useRef<number | null>(null);
  const dragX = useRef(0);

  const currentIndex = routes.indexOf(pathname);

  const setPaneOffset = useCallback((x: number, dragging: boolean) => {
    dragX.current = x;
    if (frame.current !== null) return;

    frame.current = window.requestAnimationFrame(() => {
      frame.current = null;
      const pane = paneRef.current;
      if (!pane) return;
      pane.style.transition = dragging ? 'none' : 'transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)';
      pane.style.transform = `translate3d(${dragX.current}px, 0, 0)`;
      pane.style.willChange = dragging ? 'transform' : '';
    });
  }, []);

  const resetPane = useCallback(() => {
    setPaneOffset(0, false);
  }, [setPaneOffset]);

  useEffect(() => {
    resetPane();
  }, [pathname, resetPane]);

  useEffect(
    () => () => {
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    },
    [],
  );

  const onTouchStart = useCallback(
    (event: TouchEvent) => {
      if (currentIndex === -1 || event.touches.length !== 1) return;
      const touch = event.touches[0];
      touchStart.current = { x: touch.clientX, y: touch.clientY, t: performance.now() };
      isHorizontal.current = null;
      const pane = paneRef.current;
      if (pane) pane.style.transition = 'none';
    },
    [currentIndex],
  );

  const onTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!touchStart.current || currentIndex === -1 || event.touches.length !== 1) return;

      const touch = event.touches[0];
      const dx = touch.clientX - touchStart.current.x;
      const dy = touch.clientY - touchStart.current.y;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (isHorizontal.current === null && (absX > 8 || absY > 8)) {
        isHorizontal.current = absX > absY * DIRECTION_BIAS;
      }

      if (!isHorizontal.current) return;

      event.preventDefault();

      const atFirst = currentIndex === 0 && dx > 0;
      const atLast = currentIndex === routes.length - 1 && dx < 0;
      const resistance = atFirst || atLast ? EDGE_RESISTANCE : DRAG_RESISTANCE;
      setPaneOffset(dx * resistance, true);
    },
    [currentIndex, routes.length, setPaneOffset],
  );

  const onTouchEnd = useCallback(
    (event: TouchEvent) => {
      if (!touchStart.current) return;

      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchStart.current.x;
      const dt = Math.max(performance.now() - touchStart.current.t, 1);
      const velocity = Math.abs(dx) / dt;

      touchStart.current = null;

      if (!isHorizontal.current || currentIndex === -1) {
        resetPane();
        return;
      }

      const hasDistance = Math.abs(dx) >= MIN_DISTANCE;
      const hasVelocity = velocity >= MIN_VELOCITY;

      if (!hasDistance && !hasVelocity) {
        resetPane();
        return;
      }

      if (dx < 0 && currentIndex < routes.length - 1) {
        navigate(routes[currentIndex + 1]);
      } else if (dx > 0 && currentIndex > 0) {
        navigate(routes[currentIndex - 1]);
      } else {
        resetPane();
      }
    },
    [currentIndex, navigate, resetPane, routes],
  );

  const onTouchCancel = useCallback(() => {
    touchStart.current = null;
    isHorizontal.current = null;
    resetPane();
  }, [resetPane]);

  return (
    <div className={`overflow-x-hidden ${className}`}>
      <div
        ref={paneRef}
        className="min-w-0 transform-gpu"
        style={{ touchAction: 'pan-y' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
      >
        {children}
      </div>
    </div>
  );
}
