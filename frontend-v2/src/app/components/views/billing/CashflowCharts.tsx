import React from 'react';
import { BarChart, Activity } from 'lucide-react';

export function CashflowCharts() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 w-full h-[300px] flex flex-col">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4" /> Collection Timeline
      </h3>
      <div className="flex-1 flex items-center justify-center border border-dashed border-border rounded-lg bg-muted/20">
        <div className="text-center">
          <BarChart className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">Chart visualizes expected vs actual cashflow.</p>
        </div>
      </div>
    </div>
  );
}
