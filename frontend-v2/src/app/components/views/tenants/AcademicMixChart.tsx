import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const YEAR_COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#8b5cf6', '#94a3b8'];

interface Props {
  distribution: { name: string; value: number }[];
  activeStudentCount: number;
}

export function AcademicMixChart({ distribution, activeStudentCount }: Props) {
  if (distribution.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-6 w-full">
        No active students matching academic year range (1 to 4)
      </div>
    );
  }

  return (
    <>
      <div className="h-28 w-28 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={distribution}
              cx="50%"
              cy="50%"
              innerRadius={28}
              outerRadius={48}
              dataKey="value"
              strokeWidth={0}
              isAnimationActive={false}
            >
              {distribution.map((_, i) => (
                <Cell key={i} fill={YEAR_COLORS[i % YEAR_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number) => [v, 'Tenants']}
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '11px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-1.5 min-w-0">
        {distribution.map((item, i) => (
          <div key={item.name} className="flex items-center gap-2">
            <div
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ background: YEAR_COLORS[i % YEAR_COLORS.length] }}
            />
            <span className="text-xs text-foreground flex-1 min-w-0 truncate">
              {item.name}
            </span>
            <span className="text-xs font-semibold text-muted-foreground shrink-0">
              {item.value} ({activeStudentCount > 0 ? Math.round((item.value / activeStudentCount) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Tip: use this to plan renewal conversations and group notices by academic year.
      </p>
    </>
  );
}
