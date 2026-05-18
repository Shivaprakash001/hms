import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Trophy } from 'lucide-react';
import { useIsMobile } from '@/app/components/ui/use-mobile';

const COLORS = ['#14B8A6', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#84CC16'];

const fmt = (n: number) => {
  const v = Number(n || 0);
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v.toLocaleString('en-IN')}`;
};

interface MonthTrend {
  month: string;
  month_key: string;
  hostels: {
    hostel_id: string;
    hostel_name: string;
    revenue: number;
  }[];
}

interface Props {
  monthlyTrends: MonthTrend[];
  topPerformerId?: string | null;
  topPerformerName?: string;
}

export function PortfolioRevenueChart({
  monthlyTrends,
  topPerformerId,
  topPerformerName,
}: Props) {
  const isMobile = useIsMobile();
  const [isolatedId, setIsolatedId] = useState<string | null>(null);

  const hostelMeta = useMemo(() => {
    const map = new Map<string, string>();
    monthlyTrends.forEach((m) =>
      m.hostels.forEach((h) => map.set(h.hostel_id, h.hostel_name))
    );
    return Array.from(map.entries()).map(([id, name], i) => ({
      id,
      name,
      color: COLORS[i % COLORS.length],
    }));
  }, [monthlyTrends]);

  const chartData = useMemo(() => {
    return monthlyTrends.map((m) => {
      const row: Record<string, string | number> = { month: m.month };
      m.hostels.forEach((h) => {
        row[h.hostel_id] = h.revenue;
      });
      return row;
    });
  }, [monthlyTrends]);

  const visibleHostels = isolatedId
    ? hostelMeta.filter((h) => h.id === isolatedId)
    : hostelMeta;

  if (chartData.length === 0 || hostelMeta.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground rounded-xl border border-dashed border-border">
        Add hostels to see revenue trends
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Portfolio revenue performance</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Collected rent by property · last {chartData.length} months
          </p>
        </div>
        {topPerformerName && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600 text-[10px] font-semibold shrink-0 max-w-[40%] truncate">
            <Trophy className="w-3 h-3 shrink-0" />
            <span className="truncate">{topPerformerName}</span>
          </span>
        )}
      </div>

      {isMobile && hostelMeta.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-3 pb-1">
          <button
            type="button"
            onClick={() => setIsolatedId(null)}
            className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium touch-manipulation ${
              !isolatedId ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground'
            }`}
          >
            All
          </button>
          {hostelMeta.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setIsolatedId(h.id)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium touch-manipulation ${
                isolatedId === h.id
                  ? 'text-white'
                  : 'bg-secondary text-muted-foreground'
              }`}
              style={isolatedId === h.id ? { backgroundColor: h.color } : undefined}
            >
              {h.name}
            </button>
          ))}
        </div>
      )}

      <div className={isMobile ? 'h-52' : 'h-72'}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickFormatter={(v) => fmt(Number(v))}
              width={52}
            />
            <Tooltip formatter={(v: number) => fmt(v)} />
            {!isMobile && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {visibleHostels.map((h) => (
              <Line
                key={h.id}
                type="monotone"
                dataKey={h.id}
                name={h.name}
                stroke={h.color}
                strokeWidth={h.id === topPerformerId ? 2.5 : 1.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
