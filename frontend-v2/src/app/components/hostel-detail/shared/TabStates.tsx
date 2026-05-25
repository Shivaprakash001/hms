import { AlertCircle } from 'lucide-react';

export function TabSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-4 h-20" />
      ))}
    </div>
  );
}

export function TabError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <AlertCircle className="w-8 h-8 text-destructive" />
      <p className="text-sm text-muted-foreground">Failed to load data</p>
      <button onClick={onRetry} className="text-xs text-accent font-medium">
        Retry
      </button>
    </div>
  );
}

