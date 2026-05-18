import React from 'react';

export function DashboardPageSkeleton() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-4">
      <div className="w-10 h-10 rounded-xl bg-secondary animate-pulse" />
      <p className="text-xs text-muted-foreground font-medium">Loading dashboard…</p>
    </div>
  );
}

export function DashboardTabSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-10 w-40 bg-secondary rounded-lg" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 bg-secondary rounded-xl" />
        <div className="h-24 bg-secondary rounded-xl" />
        <div className="h-24 bg-secondary rounded-xl" />
        <div className="h-24 bg-secondary rounded-xl" />
      </div>
      <div className="h-48 bg-secondary rounded-xl" />
      <div className="h-32 bg-secondary rounded-xl" />
    </div>
  );
}

export function DashboardStatGridSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-24 bg-secondary rounded-xl" />
      ))}
    </div>
  );
}
