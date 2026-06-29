const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

interface CompactFinancialStripProps {
  outstandingAmount: number;
  overdueDays: number;
  futureCredit: number;
  depositPaid: number;
  overdueAmount: number;
}

export function CompactFinancialStrip({
  outstandingAmount,
  overdueDays,
  futureCredit,
  depositPaid,
  overdueAmount,
}: CompactFinancialStripProps) {
  const metrics = [
    {
      label: 'Outstanding',
      value: fmt(outstandingAmount),
      subtext: overdueDays > 0 ? `${fmt(overdueAmount)} Overdue` : 'No immediate dues',
      highlight: outstandingAmount > 0,
      type: 'outstanding',
    },
    {
      label: 'Outstanding Since',
      value: overdueDays > 0 ? `${overdueDays} Days` : '0 Days',
      subtext: overdueDays > 0 ? 'Since oldest due date' : 'Paid on time',
      highlight: overdueDays > 0,
      type: 'since',
    },
    {
      label: 'Future Credit',
      value: fmt(futureCredit),
      subtext: 'Advance rent paid',
      highlight: false,
      type: 'credit',
    },
    {
      label: 'Deposit Paid',
      value: fmt(depositPaid),
      subtext: 'Refundable security',
      highlight: false,
      type: 'deposit',
    },
    {
      label: 'Overdue Amount',
      value: fmt(overdueAmount),
      subtext: overdueDays > 0 ? 'Subject to late fees' : 'Healthy status',
      highlight: overdueAmount > 0,
      type: 'overdue',
    },
  ];

  const getCardClasses = (metric: typeof metrics[number]) => {
    let base = 'relative overflow-hidden bg-card border rounded-2xl p-3.5 flex flex-col justify-between transition-all hover:shadow-md';
    if (metric.highlight) {
      if (metric.type === 'outstanding' || metric.type === 'since' || metric.type === 'overdue') {
        return `${base} border-rose-500/20 bg-rose-50/10 dark:bg-rose-950/5`;
      }
    }
    return `${base} border-border`;
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className={`${getCardClasses(metric)} ${
            metric.type === 'outstanding' ? 'col-span-2 md:col-span-1' : ''
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
              {metric.label}
            </span>
            <span
              className={`text-lg font-extrabold tracking-tight block ${
                metric.highlight
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-foreground'
              }`}
            >
              {metric.value}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-2 block font-medium">
            {metric.subtext}
          </span>
        </div>
      ))}
    </div>
  );
}
