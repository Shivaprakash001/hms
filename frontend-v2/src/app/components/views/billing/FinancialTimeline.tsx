import { DollarSign, Receipt, LogOut, UserPlus, Clock } from 'lucide-react';
import { cn } from '../../../components/ui/utils';

const fmt = (n: number) =>
  n >= 1000 ? `₹${(n / 1000).toFixed(1)}K` : `₹${Math.round(n || 0)}`;

function timeAgo(dateStr: string) {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return '';
  }
}

interface ActivityItem {
  type: string;
  tenant_name?: string;
  room_no?: string;
  amount?: number;
  date?: string;
  category?: string;
  description?: string;
  method?: string;
}

interface Props {
  activity: ActivityItem[];
}

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case 'payment':
      return (
        <div className="h-7 w-7 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        </div>
      );
    case 'expense':
      return (
        <div className="h-7 w-7 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
          <Receipt className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
        </div>
      );
    case 'move_out':
    case 'moveout':
      return (
        <div className="h-7 w-7 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
          <LogOut className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        </div>
      );
    case 'allocation':
    case 'move_in':
      return (
        <div className="h-7 w-7 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0">
          <UserPlus className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        </div>
      );
    default:
      return (
        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      );
  }
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const date = item.date ?? '';
  const tenant = item.tenant_name ?? '';
  const room = item.room_no ?? '';
  const amount = Number(item.amount ?? 0);

  let primary = '';
  let secondary = '';
  let amountColor = '';

  switch (item.type) {
    case 'payment':
      primary = tenant ? `${tenant} paid` : 'Payment received';
      secondary = room ? `Room ${room}` : '';
      if (item.method) secondary += (secondary ? ' · ' : '') + item.method;
      amountColor = 'text-emerald-600 dark:text-emerald-400';
      break;
    case 'expense':
      primary = item.description ?? item.category ?? 'Expense recorded';
      secondary = item.category ?? '';
      amountColor = 'text-red-600 dark:text-red-400';
      break;
    case 'move_out':
    case 'moveout':
      primary = tenant ? `${tenant} moved out` : 'Move-out';
      secondary = room ? `Room ${room}` : '';
      break;
    case 'allocation':
    case 'move_in':
      primary = tenant ? `${tenant} moved in` : 'New tenant';
      secondary = room ? `Room ${room}` : '';
      break;
    default:
      primary = item.description ?? item.type ?? 'Activity';
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      <ActivityIcon type={item.type} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{primary}</div>
        {secondary && <div className="text-xs text-muted-foreground">{secondary}</div>}
      </div>
      <div className="text-right shrink-0">
        {amount > 0 && (
          <div className={cn('text-sm font-semibold', amountColor)}>{fmt(amount)}</div>
        )}
        {date && <div className="text-xs text-muted-foreground">{timeAgo(date)}</div>}
      </div>
    </div>
  );
}

export function FinancialTimeline({ activity }: Props) {
  const items = Array.isArray(activity) ? activity.slice(0, 15) : [];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
        <span className="ml-auto text-xs text-muted-foreground">{items.length} events</span>
      </div>
      <div className="divide-y divide-border px-4">
        {items.length > 0 ? (
          items.map((item, i) => <ActivityRow key={i} item={item} />)
        ) : (
          <div className="py-6 text-center text-xs text-muted-foreground">No recent activity</div>
        )}
      </div>
    </div>
  );
}
