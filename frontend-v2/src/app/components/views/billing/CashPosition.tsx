import { Wallet, Calendar, TrendingDown, Scale } from 'lucide-react';
import { cn } from '../../../components/ui/utils';

const fmt = (n: number) =>
  n >= 100000
    ? `₹${(n / 100000).toFixed(1)}L`
    : n >= 1000
      ? `₹${(n / 1000).toFixed(1)}K`
      : `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

interface Props {
  stats: any;
}

interface CashCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

function CashCard({ icon, label, value, sub, color }: CashCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className={cn('text-lg font-bold tracking-tight', color ?? 'text-foreground')}>{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

export function CashPosition({ stats }: Props) {
  const d = stats?.data ?? stats ?? {};
  const intel = d?.intelligence ?? {};

  const cashInHand = d?.revenue ?? 0;
  const expectedWeek = intel?.dues?.summary?.due_this_week ?? 0;
  const expensesMonth = d?.monthly_expenses ?? d?.expenses ?? 0;
  const netPosition = cashInHand - expensesMonth;

  return (
    <>
      <CashCard
        icon={<Wallet className="h-4 w-4" />}
        label="Cash In Hand"
        value={fmt(cashInHand)}
        sub="collected this month"
        color="text-emerald-600 dark:text-emerald-400"
      />
      <CashCard
        icon={<Calendar className="h-4 w-4" />}
        label="Expected This Week"
        value={fmt(expectedWeek)}
        sub="dues coming due"
        color={expectedWeek > 0 ? 'text-amber-600 dark:text-amber-400' : undefined}
      />
      <CashCard
        icon={<TrendingDown className="h-4 w-4" />}
        label="Expenses MTD"
        value={fmt(expensesMonth)}
        sub="month-to-date spend"
        color={expensesMonth > cashInHand * 0.6 ? 'text-red-600 dark:text-red-400' : undefined}
      />
      <CashCard
        icon={<Scale className="h-4 w-4" />}
        label="Net Position"
        value={fmt(netPosition)}
        sub={netPosition >= 0 ? 'surplus' : 'deficit'}
        color={netPosition >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
      />
    </>
  );
}
