import { Link } from 'react-router-dom';
import { ChevronRight, Bell, Phone, Send } from 'lucide-react';
import { TenantStatusBadge } from '@features/tenants/components/badges/TenantStatusBadge';
import { getInitials, type NormalizedTenant } from '@features/tenants/utils/normalize';

const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;

interface Props {
  tenants: NormalizedTenant[];
  hostelId: string;
  onSelect?: (t: NormalizedTenant) => void;
  onReminder?: (t: NormalizedTenant) => void;
  onCall?: (phone: string) => void;
  onResend?: (t: NormalizedTenant) => void;
}

export function TenantCardMobile({ tenants, hostelId, onSelect, onReminder, onCall, onResend }: Props) {
  if (tenants.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-12 md:hidden">No tenants found</p>
    );
  }

  return (
    <div className="md:hidden space-y-3">
      {tenants.map((t) => {
        const overdue = t.outstandingAmount > 0;
        const inner = (
          <>
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-accent/15 overflow-hidden flex items-center justify-center text-sm font-semibold text-accent shrink-0">
                {t.photoUrl ? (
                  <img src={t.photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  getInitials(t.name)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-foreground truncate">{t.name}</p>
                  <TenantStatusBadge status={t.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Room {t.room} · {fmt(t.rent)}/mo
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span
                    className={`text-sm font-medium ${overdue ? 'text-destructive' : 'text-emerald-600'}`}
                  >
                    {overdue ? `Due ${fmt(t.outstandingAmount)}` : 'Paid up'}
                  </span>
                  {!onSelect && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>
            </div>
            {(onCall || onReminder) && (
              <div
                className="flex gap-2 mt-3 pt-3 border-t border-border"
                onClick={(e) => e.stopPropagation()}
              >
                {onCall && (
                  <button
                    type="button"
                    onClick={() => onCall(t.phone)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-secondary text-sm font-medium touch-manipulation"
                  >
                    <Phone className="w-4 h-4" />
                    Call
                  </button>
                )}
                {onReminder && t.status === 'ACTIVE' && (
                  <button
                    type="button"
                    onClick={() => onReminder(t)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-secondary text-sm font-medium touch-manipulation"
                  >
                    <Bell className="w-4 h-4" />
                    Remind
                  </button>
                )}
                {onResend && t.status === 'INVITED' && (
                  <button
                    type="button"
                    onClick={() => onResend(t)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-amber-50 text-amber-700 text-sm font-medium touch-manipulation"
                  >
                    <Send className="w-4 h-4" />
                    Resend Invite
                  </button>
                )}
              </div>
            )}
          </>
        );

        if (onSelect) {
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t)}
              className="w-full text-left bg-card border border-border rounded-xl p-4 active:scale-[0.99] transition-transform touch-manipulation"
            >
              {inner}
            </button>
          );
        }

        return (
          <Link
            key={t.id}
            to={`/hostels/${hostelId}/tenants/${t.id}`}
            className="block bg-card border border-border rounded-xl p-4 active:scale-[0.99] transition-transform touch-manipulation"
          >
            {inner}
          </Link>
        );
      })}
    </div>
  );
}
