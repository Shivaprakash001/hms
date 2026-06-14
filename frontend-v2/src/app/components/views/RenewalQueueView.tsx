import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, FileText, Loader2, ShieldAlert } from 'lucide-react';
import { ownerService } from '@features/owners/api';
import { agreementService } from '@features/agreements/api';

type QueueFilter = 'all' | 'expiring' | 'expired' | 'overdue' | 'move_out';

function readHostels(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const obj = payload as Record<string, unknown> | undefined;
  if (Array.isArray(obj?.hostels)) return obj.hostels as Record<string, unknown>[];
  if (Array.isArray((obj?.data as Record<string, unknown>)?.hostels))
    return (obj.data as Record<string, unknown>).hostels as Record<string, unknown>[];
  return [];
}

function fmtDate(value: unknown) {
  if (!value) return 'Not set';
  return new Date(String(value)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function stateLabel(state: string) {
  switch (state) {
    case 'EXPIRED_AND_RENT_OVERDUE': return 'Expired + Rent Overdue';
    case 'RENEWAL_OVERDUE_CRITICAL': return 'Overdue Critical';
    case 'RENEWAL_DECISION_PENDING': return 'Renewal Pending';
    case 'MOVE_OUT_IN_PROGRESS': return 'Move-out Conflict';
    case 'EXPIRING_SOON': return 'Expiring Soon';
    case 'RENEWAL_AVAILABLE': return 'Renewal Available';
    default: return state.replace(/_/g, ' ');
  }
}

export function RenewalQueueView() {
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [selectedHostelId, setSelectedHostelId] = useState('');

  const { data: hostelsRaw } = useQuery({
    queryKey: ['owner', 'hostels'],
    queryFn: () => ownerService.getHostels(),
    staleTime: 5 * 60_000,
  });
  const hostels = readHostels(hostelsRaw);
  const hostelId = selectedHostelId || (hostels[0]?.id ? String(hostels[0].id) : '');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['agreements', 'renewal-queue', hostelId, filter],
    queryFn: () => agreementService.getRenewalQueue({ hostelId, filter }),
    enabled: Boolean(hostelId),
    staleTime: 30_000,
  });

  const rows = Array.isArray(data?.renewals) ? data.renewals : [];
  const counts = data?.counts || {};
  const filters = useMemo(() => [
    ['all', `All ${counts.total ?? 0}`],
    ['expiring', `Expiring ${counts.expiring ?? 0}`],
    ['expired', `Expired ${counts.expired ?? 0}`],
    ['overdue', `Overdue ${counts.overdue ?? 0}`],
    ['move_out', `Move-out ${counts.move_out ?? 0}`],
  ] as [QueueFilter, string][], [counts]);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Agreement Lifecycle</p>
          <h1 className="text-2xl font-bold text-foreground">Renewal Queue</h1>
          <p className="text-sm text-muted-foreground">Review expiring agreements, expired stays, and move-out conflicts.</p>
        </div>
        <select
          value={hostelId}
          onChange={(event) => setSelectedHostelId(event.target.value)}
          className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
        >
          {hostels.map((hostel) => (
            <option key={String(hostel.id)} value={String(hostel.id)}>{String(hostel.name || 'Hostel')}</option>
          ))}
        </select>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Expiring Soon" value={Number(counts.expiring || 0)} icon={<CalendarDays className="h-4 w-4" />} />
        <Metric label="Expired" value={Number(counts.expired || 0)} icon={<AlertTriangle className="h-4 w-4" />} />
        <Metric label="Overdue" value={Number(counts.overdue || 0)} icon={<ShieldAlert className="h-4 w-4" />} />
        <Metric label="Move-out Conflicts" value={Number(counts.move_out || 0)} icon={<FileText className="h-4 w-4" />} />
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${filter === id ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-card text-muted-foreground'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading renewal queue
          </div>
        ) : isError ? (
          <div className="py-12 text-center">
            <p className="text-sm font-semibold text-foreground">Could not load renewals</p>
            <button type="button" onClick={() => refetch()} className="mt-2 text-xs font-bold text-accent">Retry</button>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-semibold text-foreground">No renewal work in this bucket</p>
            <p className="mt-1 text-xs text-muted-foreground">Agreement lifecycle is clear for now.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((row: any) => {
              const agreement = row.current_agreement || {};
              const tenant = row.tenant || {};
              const critical = ['EXPIRED_AND_RENT_OVERDUE', 'RENEWAL_OVERDUE_CRITICAL'].includes(row.decision_state);
              return (
                <article key={agreement.id} className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-foreground">{tenant.name || 'Tenant'}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${critical ? 'bg-rose-500/10 text-rose-700' : 'bg-amber-500/10 text-amber-700'}`}>
                          {stateLabel(row.decision_state)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Room {tenant.room?.room_no || 'N/A'} · Agreement v{agreement.agreement_version || 1} · Ends {fmtDate(agreement.agreement_end_date)}
                      </p>
                      {row.overdue_rent?.count > 0 && (
                        <p className="mt-1 text-xs font-semibold text-rose-700">
                          Rent overdue: ₹{Number(row.overdue_rent.amount || 0).toLocaleString('en-IN')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/hostels/${agreement.hostel_id}/tenants/${tenant.id}`}
                        className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground"
                      >
                        Tenant
                      </Link>
                      {agreement.pdf_url && (
                        <a
                          href={String(agreement.pdf_url)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-accent-foreground"
                        >
                          PDF
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <p className="text-xs font-bold uppercase tracking-wide">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-black text-foreground">{value}</p>
    </div>
  );
}
