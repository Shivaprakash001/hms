import { Link } from 'react-router-dom';
import { Eye, Bell, LogOut, Send } from 'lucide-react';
import { TenantStatusBadge } from '@features/tenants/components/badges/TenantStatusBadge';
import { getInitials, type NormalizedTenant } from '@features/tenants/utils/normalize';

const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;

interface Props {
  tenants: NormalizedTenant[];
  hostelId: string;
  onReminder?: (t: NormalizedTenant) => void;
  onMoveOut?: (t: NormalizedTenant) => void;
  onResend?: (t: NormalizedTenant) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (tenantId: string) => void;
}

export function TenantTable({ tenants, hostelId, onReminder, onMoveOut, onResend, selectedIds, onToggleSelect }: Props) {
  if (tenants.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-12">No tenants match your filters</p>
    );
  }

  return (
    <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-secondary/50 text-left text-xs text-muted-foreground">
            {onToggleSelect && <th className="px-4 py-3 w-10 font-medium">Pick</th>}
            <th className="px-4 py-3 font-medium">Tenant</th>
            <th className="px-4 py-3 font-medium">Room</th>
            <th className="px-4 py-3 font-medium">Rent</th>
            <th className="px-4 py-3 font-medium">Due</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Joined</th>
            <th className="px-4 py-3 font-medium text-right">Outstanding</th>
            <th className="px-4 py-3 w-10" />
          </tr>
        </thead>
        <tbody>
          {tenants.map((t) => {
            const overdue =
              t.outstandingAmount > 0 &&
              ['PENDING', 'PARTIAL'].includes(String(t.paymentStatus).toUpperCase());
            return (
              <tr key={t.id} className="border-t border-border hover:bg-secondary/30">
                {onToggleSelect && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(t.id) ?? false}
                      onChange={() => onToggleSelect(t.id)}
                      className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                      aria-label={`Select ${t.name}`}
                    />
                  </td>
                )}
                <td className="px-4 py-3">
                  <Link
                    to={`/hostels/${hostelId}/tenants/${t.id}`}
                    className="flex items-center gap-2 min-w-0 group"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent/15 overflow-hidden flex items-center justify-center text-xs font-semibold text-accent shrink-0">
                      {t.photoUrl ? (
                        <img src={t.photoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        getInitials(t.name)
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate group-hover:text-accent">
                        {t.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{t.phone}</p>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-foreground">{t.room}</td>
                <td className="px-4 py-3">{fmt(t.rent)}/mo</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      overdue ? 'text-destructive font-medium' : 'text-muted-foreground'
                    }
                  >
                    {String(t.paymentStatus)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <TenantStatusBadge status={t.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {t.joinDate ? new Date(t.joinDate).toLocaleDateString('en-IN') : '—'}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {t.outstandingAmount > 0 ? (
                    <span className="text-destructive">{fmt(t.outstandingAmount)}</span>
                  ) : (
                    <span className="text-emerald-600">Clear</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      to={`/hostels/${hostelId}/tenants/${t.id}`}
                      className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                    {onReminder && t.status === 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={() => onReminder(t)}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
                        title="Send reminder"
                      >
                        <Bell className="w-4 h-4" />
                      </button>
                    )}
                    {onMoveOut && t.status === 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={() => onMoveOut(t)}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
                        title="Start move-out"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    )}
                    {onResend && t.status === 'INVITED' && (
                      <button
                        type="button"
                        onClick={() => onResend(t)}
                        className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600"
                        title="Resend invitation"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
