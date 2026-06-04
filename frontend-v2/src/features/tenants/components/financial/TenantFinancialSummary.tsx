const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

interface Props {
  summary?: Record<string, unknown> | null;
  advance?: Record<string, unknown> | null;
}

export function TenantFinancialSummary({ summary, advance }: Props) {
  const s = summary ?? {};
  const cards = [
    { label: 'Total paid', value: fmt(Number(s.total_paid ?? s.totalPaid ?? 0)) },
    { label: 'Pending dues', value: fmt(Number(s.pending_amount ?? s.pendingAmount ?? s.outstanding ?? s.total_due ?? 0)) },
    { label: 'Overdue', value: fmt(Number(s.overdue_amount ?? s.overdueAmount ?? 0)) },
    { label: 'Total credit balance', value: fmt(Number(advance?.balance ?? advance?.current_balance ?? 0)) },
    { label: 'Paid deposit', value: fmt(Number(advance?.security_deposit_paid ?? 0)) },
    { label: 'Rent advance (available)', value: fmt(Number(advance?.available_rent_advance ?? 0)) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map(({ label, value }) => (
        <div key={label} className="bg-card border border-border rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-base font-bold text-foreground mt-0.5">{value}</p>
        </div>
      ))}
    </div>
  );
}
