import React from 'react';
import { IndianRupee, TrendingUp, AlertCircle } from 'lucide-react';

export function FinancialSummaryStrip() {
  const kpis = [
    { label: 'Collected This Month', value: '₹1.5L', icon: IndianRupee, color: 'text-[#10B981]' },
    { label: 'Pending Dues', value: '₹45K', icon: AlertCircle, color: 'text-[#F59E0B]' },
    { label: 'Overdue Amount', value: '₹12K', icon: AlertCircle, color: 'text-destructive' },
    { label: 'Expected Revenue', value: '₹2.07L', icon: TrendingUp, color: 'text-foreground' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {kpis.map((kpi, idx) => (
        <div key={idx} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">{kpi.label}</span>
            <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
          </div>
          <div className="text-xl md:text-2xl font-semibold text-foreground">{kpi.value}</div>
        </div>
      ))}
    </div>
  );
}
