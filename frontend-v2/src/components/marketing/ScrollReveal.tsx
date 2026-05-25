import { useEffect, useRef, useState } from 'react';

interface ScrollRevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export function ScrollReveal({ children, delay = 0, className = '' }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [reducedBlur, setReducedBlur] = useState(false);

  useEffect(() => {
    setReducedBlur(window.matchMedia('(max-width: 768px)').matches);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisible(true), delay);
          observer.unobserve(el);
        }
      },
      { threshold: 0.05, rootMargin: '0px 0px -20px 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  const blurAmount = reducedBlur ? '4px' : '8px';

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        filter: visible ? 'blur(0px)' : `blur(${blurAmount})`,
        WebkitFilter: visible ? 'blur(0px)' : `blur(${blurAmount})`,
        transform: visible ? 'translate3d(0, 0px, 0)' : 'translate3d(0, 28px, 0)',
        transition: `opacity 0.7s ease-out ${delay}ms, filter 0.7s ease-out ${delay}ms, -webkit-filter 0.7s ease-out ${delay}ms, transform 0.7s ease-out ${delay}ms`,
        willChange: visible ? 'auto' : 'transform, opacity, filter',
      }}
    >
      {children}
    </div>
  );
}
