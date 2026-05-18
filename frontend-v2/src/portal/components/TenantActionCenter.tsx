import { Link } from 'react-router-dom';
import {
  AlertCircle,
  DoorOpen,
  Download,
  FileText,
  MessageSquarePlus,
  User,
} from 'lucide-react';

const actions = [
  { to: '/tenant/complaints', icon: MessageSquarePlus, label: 'Raise complaint', desc: 'Report an issue' },
  { to: '/tenant/move-out', icon: DoorOpen, label: 'Request move-out', desc: 'Plan your exit' },
  { to: '/tenant/financials', icon: Download, label: 'Receipts', desc: 'Payment history' },
  { to: '/tenant/documents', icon: FileText, label: 'Documents', desc: 'Upload & verify' },
  { to: '/tenant/profile', icon: User, label: 'Update profile', desc: 'Personal info' },
];

export function TenantActionCenter() {
  return (
    <section>
      <h2 className="text-sm font-semibold text-foreground mb-3">Actions</h2>
      <div className="grid grid-cols-2 gap-2">
        {actions.map(({ to, icon: Icon, label, desc }) => (
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
      <p className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        Complaints sync when your hostel enables the module.
      </p>
    </section>
  );
}
