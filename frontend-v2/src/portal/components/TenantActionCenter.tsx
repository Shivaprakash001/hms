import { Link } from 'react-router-dom';
import { DoorOpen, Download, FileText, User } from 'lucide-react';

const actions = [
  { to: '/tenant/financials', icon: Download, label: 'Receipts & pay', desc: 'Payment history' },
  { to: '/tenant/profile#documents', icon: FileText, label: 'Documents', desc: 'Upload & status' },
  { to: '/tenant/move-out', icon: DoorOpen, label: 'Move-out', desc: 'Exit workflow' },
  { to: '/tenant/profile', icon: User, label: 'My profile', desc: 'Contact & records' },
];

export function TenantActionCenter({ resStatus }: { resStatus?: string }) {
  const filteredActions = actions.filter(
    (action) => action.to !== '/tenant/move-out' || resStatus !== 'PAYMENT_PENDING'
  );

  return (
    <section>
      <h2 className="text-sm font-semibold text-foreground mb-3">Quick actions</h2>
      <div className="grid grid-cols-2 gap-2">
        {filteredActions.map(({ to, icon: Icon, label, desc }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col gap-1 p-3 rounded-xl border border-border bg-card hover:border-accent/50 transition-colors touch-manipulation"
          >
            <Icon className="w-5 h-5 text-accent" />
            <span className="text-sm font-medium text-foreground">{label}</span>
            <span className="text-[10px] text-muted-foreground">{desc}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
