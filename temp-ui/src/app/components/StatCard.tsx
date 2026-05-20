import { TrendingUp, TrendingDown, LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: LucideIcon;
}

export function StatCard({ label, value, change, trend, icon: Icon }: StatCardProps) {
  const trendColor = trend === 'up' ? 'text-[#10B981]' : trend === 'down' ? 'text-[#EF4444]' : 'text-muted-foreground';
  const TrendIcon = trend === 'up' ? TrendingUp : TrendingDown;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <div className="text-xl font-semibold text-foreground">{value}</div>
        {trend !== 'neutral' && (
          <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
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
