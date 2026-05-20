import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { MessageSquare, Smartphone, Banknote, CreditCard } from 'lucide-react';

const METHOD_COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];

const methodLabel = (m: string) => {
  switch ((m || '').toLowerCase()) {
    case 'upi': return 'UPI';
    case 'cash': return 'Cash';
    case 'bank_transfer': case 'neft': case 'imps': return 'Bank Transfer';
    case 'card': return 'Card';
    case 'cheque': return 'Cheque';
    default: return m || 'Other';
  }
};

const methodIcon = (m: string) => {
  switch ((m || '').toLowerCase()) {
    case 'upi': return <Smartphone className="h-3 w-3" />;
    case 'cash': return <Banknote className="h-3 w-3" />;
    case 'bank_transfer': case 'neft': return <CreditCard className="h-3 w-3" />;
    default: return <CreditCard className="h-3 w-3" />;
  }
};

interface Props {
  payments: any[];
  funnel: any;
}

export function CollectionAnalytics({ payments, funnel }: Props) {
  const methodMap = new Map<string, number>();
  (payments || []).forEach((p) => {
    const methods: string[] = Array.isArray(p.paymentMethods) ? p.paymentMethods : p.paymentMethod ? [p.paymentMethod] : [];
    methods.forEach((m) => {
      const k = m.toLowerCase();
      methodMap.set(k, (methodMap.get(k) || 0) + Number(p.rentAmount ?? p.amount ?? 0));
    });
  });

  const pieData = Array.from(methodMap.entries())
    .map(([method, amount]) => ({ name: methodLabel(method), value: amount }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const totalPie = pieData.reduce((s, d) => s + d.value, 0);

  const remindersSent = funnel?.reminders_sent ?? 0;
  const conversionRate = funnel?.conversion_rate ?? 0;
  const channels: any[] = Array.isArray(funnel?.channel_performance) ? funnel.channel_performance : [];
  const bestChannel = channels.sort((a, b) => (b.conversion_rate ?? 0) - (a.conversion_rate ?? 0))[0];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Collection Analytics</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Payment methods & reminder effectiveness</p>
      </div>

      <div className="p-4 space-y-4">
        {pieData.length > 0 ? (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Payment Method Split</div>
            <div className="flex items-center gap-3">
              <div className="h-28 w-28 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={28}
                      outerRadius={48}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={METHOD_COLORS[i % METHOD_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => [`₹${Math.round(v).toLocaleString('en-IN')}`, '']}
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
              <div className="flex-1 space-y-1.5">
                {pieData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: METHOD_COLORS[i % METHOD_COLORS.length] }}
                    />
                    <span className="text-xs text-foreground flex items-center gap-1 flex-1 min-w-0">
                      {methodIcon(item.name)}
                      <span className="truncate">{item.name}</span>
                    </span>
                    <span className="text-xs font-medium text-muted-foreground shrink-0">
                      {totalPie > 0 ? `${Math.round((item.value / totalPie) * 100)}%` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground text-center py-4">No payment method data</div>
        )}

        {remindersSent > 0 && (
          <div className="pt-2 border-t border-border space-y-2">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Reminder Funnel
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-muted/40 px-3 py-2">
                <div className="text-xs text-muted-foreground">Sent</div>
                <div className="text-base font-bold text-foreground">{remindersSent}</div>
              </div>
              <div className="rounded-lg bg-emerald-500/10 px-3 py-2">
                <div className="text-xs text-muted-foreground">Converted</div>
                <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {conversionRate}%
                </div>
              </div>
            </div>
            {bestChannel && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                Best channel:
                <span className="font-medium text-foreground">{bestChannel.channel}</span>
                <span>({bestChannel.conversion_rate ?? 0}% conversion)</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
