import type { ReactNode } from 'react';

interface ScrollRevealProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
}

export function ScrollReveal({ children, delay = 0, duration = 0.8 }: ScrollRevealProps) {
  void delay;
  void duration;
  return <div>{children}</div>;
}

interface StaggerRevealProps {
  children: ReactNode;
  staggerDelay?: number;
}

export function StaggerReveal({ children, staggerDelay = 0.1 }: StaggerRevealProps) {
  void staggerDelay;
  return <div>{children}</div>;
}

export function StaggerItem({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
