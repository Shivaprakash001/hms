import React from 'react';
import { AlertCircle, ArrowUpRight } from 'lucide-react';

export function OverdueIntelligence() {
  return (
    <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-destructive flex items-center gap-2 mb-4">
        <AlertCircle className="w-4 h-4" /> Overdue Intelligence
      </h3>
      
      <div className="space-y-4">
        <div className="bg-background border border-border rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Repeat Offenders</div>
          <div className="font-semibold text-sm">3 Tenants in Watchlist</div>
          <button className="text-xs text-primary font-medium flex items-center gap-1 mt-2">
            View List <ArrowUpRight className="w-3 h-3"/>
          </button>
        </div>
        
        <div className="bg-background border border-border rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Longest Pending</div>
          <div className="font-semibold text-sm truncate">Rahul S. (45 Days)</div>
          <button className="text-xs text-primary font-medium flex items-center gap-1 mt-2">
            Send Reminder <ArrowUpRight className="w-3 h-3"/>
          </button>
        </div>
      </div>
    </div>
  );
}
