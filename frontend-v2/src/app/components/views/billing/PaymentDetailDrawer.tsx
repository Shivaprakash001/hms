import { useQuery } from '@tanstack/react-query';
import { X, Download, CheckCircle, Clock, MessageSquare, User, BedDouble, Star, AlertCircle } from 'lucide-react';
import { queryKeys } from '@lib/queryKeys';
import { cn } from '../../../components/ui/utils';

const fmt = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

function fmtDate(d: string | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs font-medium text-foreground text-right">{value ?? '—'}</span>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
        {icon}
        {title}
      </h4>
      <div className="bg-muted/20 border border-border rounded-xl px-3 py-1">
        {children}
      </div>
    </div>
  );
}

interface Props {
  obligationId: string;
  hostelId: string;
  onClose: () => void;
}

export function PaymentDetailDrawer({ obligationId, hostelId, onClose }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.payments.detail(hostelId, obligationId),
    queryFn: () =>
      import('@features/payments/api').then((m) => m.paymentService.getDetail(obligationId, hostelId)),
    staleTime: 60 * 1000,
    enabled: !!obligationId && !!hostelId,
  });

  const d = data?.data ?? data;
  const tenant = d?.tenant;
  const payments: any[] = Array.isArray(d?.payments) ? d.payments : [];
  const reminders: any[] = Array.isArray(d?.reminders) ? d.reminders : [];
  const status = (d?.status ?? 'PENDING').toUpperCase();

  const statusColor =
    status === 'PAID' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
    status === 'OVERDUE' ? 'bg-red-500/15 text-red-600 dark:text-red-400' :
    status === 'PARTIAL' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' :
    'bg-amber-500/15 text-amber-600 dark:text-amber-400';

  const handleDownloadReceipt = async (paymentId: string) => {
    try {
      const { paymentService } = await import('@features/payments/api');
      const blob = await paymentService.downloadReceipt(paymentId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${paymentId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-background border-l border-border shadow-2xl z-50 flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0 bg-muted/10">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
              {(tenant?.name ?? 'T').charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="font-semibold text-foreground text-sm">{tenant?.name ?? 'Payment Detail'}</h2>
              <p className="text-xs text-muted-foreground">
                {tenant?.room_no ? `Room ${tenant.room_no}` : ''}{d?.rent_month ? ` · ${d.rent_month}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <span className="text-sm text-destructive">Failed to load payment details</span>
            </div>
          )}

          {d && (
            <>
              <div className="rounded-xl border border-border bg-muted/20 p-4 text-center">
                <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3', statusColor)}>
                  {status === 'PAID' ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  {status}
                </span>
                <div className="text-3xl font-bold text-foreground">{fmt(d.total_amount ?? 0)}</div>
                {d.remaining > 0 && (
                  <div className="text-sm text-red-500 mt-1">{fmt(d.remaining)} still outstanding</div>
                )}
                <div className="text-xs text-muted-foreground mt-1">{d.rent_month}</div>
                {d.due_date && (
                  <div className="text-xs text-muted-foreground">Due: {fmtDate(d.due_date)}</div>
                )}
              </div>

              <Section title="Tenant" icon={<User className="h-3.5 w-3.5" />}>
                <Row label="Name" value={tenant?.name} />
                <Row label="Phone" value={tenant?.phone} />
                {tenant?.room_no && <Row label="Room" value={`${tenant.room_no}${tenant.floor ? ` · ${tenant.floor}` : ''}`} />}
                {tenant?.room_type && <Row label="Room Type" value={tenant.room_type} />}
                {tenant?.joined_on && <Row label="Joined" value={fmtDate(tenant.joined_on)} />}
                {tenant?.behavior_score !== null && tenant?.behavior_score !== undefined && (
                  <Row
                    label="Behavior Score"
                    value={
                      <span className={cn(
                        'inline-flex items-center gap-1',
                        tenant.behavior_score >= 70 ? 'text-emerald-600 dark:text-emerald-400' :
                        tenant.behavior_score >= 50 ? 'text-amber-600 dark:text-amber-400' :
                        'text-red-600 dark:text-red-400',
                      )}>
                        <Star className="h-3 w-3" />
                        {tenant.behavior_score}
                      </span>
                    }
                  />
                )}
              </Section>

              <Section title="Obligation" icon={<BedDouble className="h-3.5 w-3.5" />}>
                <Row label="Type" value={d.obligation_type ?? 'RENT'} />
                <Row label="Total Due" value={fmt(d.total_amount ?? 0)} />
                <Row label="Paid" value={<span className="text-emerald-600 dark:text-emerald-400">{fmt(d.amount_paid ?? 0)}</span>} />
                {d.remaining > 0 && <Row label="Remaining" value={<span className="text-red-600 dark:text-red-400">{fmt(d.remaining)}</span>} />}
              </Section>

              {payments.length > 0 && (
                <Section title="Payment History" icon={<CheckCircle className="h-3.5 w-3.5" />}>
                  {payments.map((p: any, i: number) => (
                    <div key={p.id ?? i} className="py-1.5 border-b border-border/50 last:border-0 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-foreground">{fmt(p.amount_paid)}</div>
                        <div className="text-xs text-muted-foreground">
                          {fmtDate(p.payment_date)}
                          {p.payment_method && ` · ${p.payment_method}`}
                        </div>
                        {p.reference_number && (
                          <div className="text-xs font-mono text-muted-foreground truncate">{p.reference_number}</div>
                        )}
                        {p.offline_note && <div className="text-xs text-muted-foreground italic">{p.offline_note}</div>}
                      </div>
                      {p.id && (
                        <button
                          type="button"
                          onClick={() => handleDownloadReceipt(p.id)}
                          className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                          title="Download receipt"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </Section>
              )}

              {reminders.length > 0 && (
                <Section title="Reminder Timeline" icon={<MessageSquare className="h-3.5 w-3.5" />}>
                  {reminders.map((r: any, i: number) => (
                    <div key={r.id ?? i} className="py-1.5 border-b border-border/50 last:border-0 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-medium text-foreground capitalize">{r.channel?.toLowerCase()} reminder</div>
                        <div className="text-xs text-muted-foreground">{fmtDate(r.sent_at)}</div>
                      </div>
                      <span className={cn(
                        'text-xs font-medium px-1.5 py-0.5 rounded',
                        r.converted ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground',
                      )}>
                        {r.converted ? '✓ Converted' : 'Sent'}
                      </span>
                    </div>
                  ))}
                </Section>
              )}
            </>
          )}
        </div>

        {d && tenant && (
          <div className="p-4 border-t border-border bg-muted/10 shrink-0 flex gap-2">
            <a
              href={`/tenants/${tenant.id}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-border bg-background rounded-lg text-xs font-medium hover:bg-muted transition-colors text-foreground"
            >
              <User className="h-3.5 w-3.5" />
              View Profile
            </a>
          </div>
        )}
      </div>
    </>
  );
}
