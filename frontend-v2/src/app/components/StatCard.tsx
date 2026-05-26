import { TrendingUp, TrendingDown, LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: LucideIcon;
}

export function StatCard({ label, value, change, trend, icon: Icon }: StatCardProps) {
  const trendColor =
    trend === 'up' ? 'text-success' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground';
  const TrendIcon = trend === 'up' ? TrendingUp : TrendingDown;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3 hover:shadow-sm transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-accent" />
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-2xl font-bold text-foreground tracking-tight">{value}</div>
        {trend !== 'neutral' && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            <TrendIcon className="w-3 h-3" />
            <span>{change}</span>
          </div>
        )}
        {trend === 'neutral' && (
          <div className="text-xs text-muted-foreground">{change}</div>
        )}
      </div>
    </div>
  );
}
