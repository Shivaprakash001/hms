import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export function DashboardErrorState({ message = 'Failed to load dashboard data.', onRetry }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="bg-ops-danger/10 border border-ops-danger/20 rounded-xl p-6 text-center space-y-4">
        <AlertCircle className="w-8 h-8 text-ops-danger mx-auto" />
        <p className="text-sm font-medium text-foreground">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border text-sm font-medium hover:bg-secondary transition-colors"
          >
            <RefreshCw size={14} />
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
