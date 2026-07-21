import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ChevronDown,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { agreementService } from '@features/agreements/api';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from '@shared/ui';

type RecoveryAgreement = {
  id: string;
  tenant?: { id?: string; name?: string; joined_on?: string | null; room?: { id?: string; room_no?: string } | null } | null;
  hostel?: { id?: string; name?: string } | null;
  current_status?: string;
  status?: string;
  agreement_start_date?: string | null;
  agreement_end_date?: string | null;
  agreement_duration_months?: number | null;
  snapshot_values?: Record<string, unknown>;
  recommended_start_date?: string | null;
  missing_fields?: string[];
  lifecycle_complete?: boolean;
};

type RecoveryCompletion = {
  total?: number;
  completed?: number;
  pending?: number;
  coveragePercent?: number;
  r4Ready?: boolean;
};

function fmtDate(value: unknown) {
  if (!value) return 'Not set';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function inputDate(value: unknown) {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function money(value: unknown) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? `₹${numeric.toLocaleString('en-IN')}` : 'Not set';
}

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function statusText(status: string) {
  return String(status || '').replace(/_/g, ' ');
}

function initials(name: unknown) {
  const str = String(name || '').trim();
  if (!str) return '?';
  const parts = str.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AgreementLifecycleRecoveryView() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<RecoveryAgreement | null>(null);
  const [recoveryFilter, setRecoveryFilter] = useState<'all' | 'needs_recovery'>('all');
  const [hostelFilter, setHostelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortMode, setSortMode] = useState<'missing_fields' | 'tenant' | 'hostel' | 'status'>('missing_fields');
  const [exportError, setExportError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [detailsOverride, setDetailsOverride] = useState<boolean | null>(null);
  const [form, setForm] = useState({
    agreement_start_date: '',
    agreement_end_date: '',
    agreement_duration_months: '12',
  });
  const [formError, setFormError] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['agreements', 'lifecycle-recovery'],
    queryFn: () => agreementService.getLifecycleRecovery(),
    staleTime: 30_000,
  });

  const { data: completionData } = useQuery<RecoveryCompletion>({
    queryKey: ['agreements', 'lifecycle-recovery', 'completion'],
    queryFn: () => agreementService.getLifecycleRecoveryCompletion(),
    staleTime: 30_000,
  });

  const agreements: RecoveryAgreement[] = Array.isArray(data?.agreements) ? data.agreements : [];
  const reportTotal = Number(data?.total || agreements.length || 0);
  const reportCompleted = Number(data?.completed || agreements.filter((item) => item.lifecycle_complete).length || 0);
  const reportPending = Number(data?.pending || Math.max(reportTotal - reportCompleted, 0));
  const total = Number(completionData?.total ?? reportTotal);
  const completed = Number(completionData?.completed ?? reportCompleted);
  const pending = Number(completionData?.pending ?? reportPending);
  const completion = Number(completionData?.coveragePercent ?? percent(completed, total));
  const startCovered = agreements.filter((item) => item.agreement_start_date).length;
  const endCovered = agreements.filter((item) => item.agreement_end_date).length;
  const durationCovered = agreements.filter((item) => item.agreement_duration_months).length;
  const startCoverage = percent(startCovered, reportTotal);
  const endCoverage = percent(endCovered, reportTotal);
  const durationCoverage = percent(durationCovered, reportTotal);
  const r4Ready = Boolean(completionData?.r4Ready ?? (reportTotal > 0 && startCoverage === 100 && endCoverage === 100 && durationCoverage === 100));
  const hostels = useMemo(
    () => {
      const entries = agreements
        .filter((item) => item.hostel?.id)
        .map((item) => [String(item.hostel?.id), item.hostel?.name || 'Hostel'] as const);
      return [...new Map(entries).entries()];
    },
    [agreements]
  );
  const statuses = useMemo(
    () => [...new Set(agreements.map((item) => item.current_status || item.status).filter(Boolean) as string[])].sort(),
    [agreements]
  );
  const rows = useMemo(
    () => agreements
      .filter((item) => recoveryFilter === 'all' || !item.lifecycle_complete)
      .filter((item) => hostelFilter === 'all' || item.hostel?.id === hostelFilter)
      .filter((item) => statusFilter === 'all' || (item.current_status || item.status) === statusFilter)
      .sort((a, b) => {
        if (sortMode === 'tenant') return String(a.tenant?.name || '').localeCompare(String(b.tenant?.name || ''));
        if (sortMode === 'hostel') return String(a.hostel?.name || '').localeCompare(String(b.hostel?.name || ''));
        if (sortMode === 'status') return String(a.current_status || a.status || '').localeCompare(String(b.current_status || b.status || ''));
        const missingDiff = Number(b.missing_fields?.length || 0) - Number(a.missing_fields?.length || 0);
        if (missingDiff !== 0) return missingDiff;
        return Number(a.lifecycle_complete) - Number(b.lifecycle_complete);
      }),
    [agreements, hostelFilter, recoveryFilter, sortMode, statusFilter]
  );

  const recoveryMutation = useMutation({
    mutationFn: ({ agreementId, payload }: { agreementId: string; payload: Record<string, unknown> }) =>
      agreementService.recoverLifecycle(agreementId, payload),
    onSuccess: async () => {
      setSelected(null);
      setFormError('');
      await queryClient.invalidateQueries({ queryKey: ['agreements', 'lifecycle-recovery'] });
      await queryClient.invalidateQueries({ queryKey: ['agreements', 'lifecycle-recovery', 'completion'] });
      await queryClient.invalidateQueries({ queryKey: ['agreements', 'renewal-queue'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.response?.data?.message || error?.message;
      setFormError(message || 'Could not save lifecycle recovery');
    },
  });

  function openRecovery(agreement: RecoveryAgreement) {
    setSelected(agreement);
    setFormError('');
    setForm({
      agreement_start_date: inputDate(agreement.agreement_start_date || agreement.recommended_start_date),
      agreement_end_date: inputDate(agreement.agreement_end_date),
      agreement_duration_months: String(agreement.agreement_duration_months || 12),
    });
  }

  function submitRecovery() {
    if (!selected?.id) return;
    const start = new Date(form.agreement_start_date);
    const end = new Date(form.agreement_end_date);
    const duration = Number(form.agreement_duration_months);
    if (!form.agreement_start_date) return setFormError('Start date is required');
    if (!form.agreement_end_date) return setFormError('End date is required');
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return setFormError('End date must be after start date');
    }
    if (!Number.isFinite(duration) || duration <= 0) return setFormError('Duration must be greater than 0');
    setFormError('');
    recoveryMutation.mutate({
      agreementId: selected.id,
      payload: {
        agreement_start_date: form.agreement_start_date,
        agreement_end_date: form.agreement_end_date,
        agreement_duration_months: duration,
      },
    });
  }

  async function downloadExport() {
    setExportError('');
    setIsExporting(true);
    try {
      const blob = await agreementService.exportLifecycleRecovery({
        hostelId: hostelFilter === 'all' ? undefined : hostelFilter,
      });
      const file = blob instanceof Blob ? blob : new Blob([blob], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'agreement-lifecycle-recovery.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      const message = error?.response?.data?.error?.message || error?.message || 'Could not export recovery CSV';
      setExportError(message);
    } finally {
      setIsExporting(false);
    }
  }

  const banner = r4Ready
    ? { tone: 'green' as const, title: 'All agreements recovered', text: 'Lifecycle data is complete and ready for R4 validation.' }
    : pending > 0
      ? { tone: 'red' as const, title: 'Recovery required', text: `${pending} agreement${pending === 1 ? '' : 's'} pending lifecycle completion.` }
      : { tone: 'yellow' as const, title: 'Recovery in progress', text: 'Review coverage before R4 validation.' };

  // Once fully recovered there's nothing actionable left, so the detail
  // sections (stats, coverage, worklist) default to collapsed — a user can
  // still expand them, but they're no longer the first thing on the page.
  const showDetails = detailsOverride ?? (isLoading || !r4Ready);

  return (
    <div className="space-y-4 px-4 py-4 sm:px-0 sm:py-0">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Agreement Lifecycle</p>
          <h1 className="text-2xl font-bold text-foreground">Lifecycle Recovery</h1>
          <p className="text-sm text-muted-foreground">One-time cleanup of legacy agreement dates before renewal automation runs.</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-bold text-foreground sm:h-10"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </header>

      <button
        type="button"
        onClick={() => setDetailsOverride(!showDetails)}
        className={`w-full rounded-xl border p-4 text-left transition-all ${
          banner.tone === 'green'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'
            : banner.tone === 'yellow'
              ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
              : 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300'
        }`}
      >
        <div className="flex items-center gap-3">
          {banner.tone === 'green' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
          <div className="min-w-0 flex-1">
            <p className="font-bold">{banner.title}</p>
            <p className="text-xs opacity-80">{banner.text}</p>
          </div>
          {pending > 0 && (
            <span className="shrink-0 rounded-lg bg-white/60 px-3 py-1.5 text-xs font-black dark:bg-black/20">
              {pending} left
            </span>
          )}
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {showDetails && (
        <>
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <StatInline label="Total" value={total} />
              <StatInline label="Completed" value={completed} />
              <StatInline label="Pending" value={pending} />
              <StatInline label="Completion" value={`${completion}%`} />
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${completion}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MiniCoverage label="Start Date" value={startCoverage} covered={startCovered} total={total} />
              <MiniCoverage label="End Date" value={endCoverage} covered={endCovered} total={total} />
              <MiniCoverage label="Duration" value={durationCoverage} covered={durationCovered} total={total} />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Recovery Worklist</p>
                <p className="mt-1 text-xs text-muted-foreground">Filter for review and export hostel-specific CSVs.</p>
              </div>
              <button
                type="button"
                onClick={downloadExport}
                disabled={isExporting}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-bold text-foreground disabled:opacity-60 sm:h-9"
              >
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Export CSV
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <select
                value={recoveryFilter}
                onChange={(event) => setRecoveryFilter(event.target.value as 'all' | 'needs_recovery')}
                className="h-10 rounded-lg border border-border bg-background px-2 text-xs font-semibold text-foreground"
              >
                <option value="all">All Agreements</option>
                <option value="needs_recovery">Needs Recovery</option>
              </select>
              <select
                value={hostelFilter}
                onChange={(event) => setHostelFilter(event.target.value)}
                className="h-10 rounded-lg border border-border bg-background px-2 text-xs font-semibold text-foreground"
              >
                <option value="all">All Hostels</option>
                {hostels.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 rounded-lg border border-border bg-background px-2 text-xs font-semibold text-foreground"
              >
                <option value="all">All Statuses</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>{statusText(status)}</option>
                ))}
              </select>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as 'missing_fields' | 'tenant' | 'hostel' | 'status')}
                className="h-10 rounded-lg border border-border bg-background px-2 text-xs font-semibold text-foreground"
              >
                <option value="missing_fields">Sort: Missing Fields</option>
                <option value="tenant">Sort: Tenant</option>
                <option value="hostel">Sort: Hostel</option>
                <option value="status">Sort: Status</option>
              </select>
            </div>

            {exportError && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{exportError}</p>}
          </section>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading recovery data
            </div>
          ) : isError ? (
            <div className="rounded-xl border border-border bg-card py-12 text-center">
              <p className="text-sm font-semibold text-foreground">Could not load lifecycle recovery</p>
              <button type="button" onClick={() => refetch()} className="mt-2 text-xs font-bold text-accent">Retry</button>
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">No agreements match these filters.</div>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {rows.map((agreement) => {
                const complete = Boolean(agreement.lifecycle_complete);
                return (
                  <article key={agreement.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-extrabold text-primary">
                        {initials(agreement.tenant?.name)}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-foreground">{agreement.tenant?.name || 'Tenant'}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${complete ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                            {complete ? 'Completed' : 'Pending'}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-muted-foreground">
                          {agreement.hostel?.name || 'Hostel'} · {agreement.tenant?.room?.room_no ? `Room ${agreement.tenant.room.room_no}` : 'No active room'} · {statusText(agreement.current_status || agreement.status || '')}
                        </p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground sm:grid-cols-4">
                          <span>Recommended: <b className="text-foreground">{fmtDate(agreement.recommended_start_date)}</b></span>
                          <span>Start: <b className="text-foreground">{fmtDate(agreement.agreement_start_date)}</b></span>
                          <span>End: <b className="text-foreground">{fmtDate(agreement.agreement_end_date)}</b></span>
                          <span>Duration: <b className="text-foreground">{agreement.agreement_duration_months || 'Not set'}</b></span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      {complete ? (
                        <span className="flex h-9 flex-1 items-center justify-center rounded-lg bg-muted px-3 text-xs font-bold text-muted-foreground sm:flex-none">Completed</span>
                      ) : (
                        <button type="button" onClick={() => openRecovery(agreement)} className="flex h-10 flex-1 items-center justify-center rounded-lg bg-accent px-3 text-xs font-bold text-accent-foreground sm:h-9 sm:flex-none">Recover</button>
                      )}
                      {agreement.tenant?.id && agreement.hostel?.id && (
                        <Link to={`/hostels/${agreement.hostel.id}/tenants/${agreement.tenant.id}`} className="flex h-10 flex-1 items-center justify-center rounded-lg border border-border px-3 text-xs font-bold text-foreground sm:h-9 sm:flex-none">
                          View Agreement
                        </Link>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      <ResponsiveDialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <ResponsiveDialogContent className="sm:max-w-lg">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Recover Agreement — {selected?.tenant?.name || 'Tenant'}</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <ResponsiveDialogBody className="space-y-4">
            <div className="grid gap-3 rounded-xl border border-border bg-muted/30 p-3 sm:grid-cols-2">
              <ReadOnly label="Rent" value={money(selected?.snapshot_values?.monthly_rent)} />
              <ReadOnly label="Deposit" value={money(selected?.snapshot_values?.advance_deposit)} />
              <ReadOnly label="Maintenance" value={money(selected?.snapshot_values?.maintenance_charge)} />
              <ReadOnly label="Payment Frequency" value={String(selected?.snapshot_values?.payment_frequency || 'Not set')} />
            </div>

            <div className="grid gap-3">
              <Field label="Start Date">
                <input type="date" value={form.agreement_start_date} onChange={(event) => setForm((prev) => ({ ...prev, agreement_start_date: event.target.value }))} className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground" />
              </Field>
              <Field label="End Date">
                <input type="date" value={form.agreement_end_date} onChange={(event) => setForm((prev) => ({ ...prev, agreement_end_date: event.target.value }))} className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground" />
              </Field>
              <Field label="Duration Months">
                <input type="number" inputMode="numeric" min="1" value={form.agreement_duration_months} onChange={(event) => setForm((prev) => ({ ...prev, agreement_duration_months: event.target.value }))} className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground" />
              </Field>
            </div>

            {formError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{formError}</p>}
          </ResponsiveDialogBody>
          <ResponsiveDialogFooter>
            <button type="button" onClick={() => setSelected(null)} className="h-11 rounded-lg border border-border px-4 text-sm font-bold text-foreground">Cancel</button>
            <button type="button" onClick={submitRecovery} disabled={recoveryMutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-bold text-accent-foreground disabled:opacity-60">
              {recoveryMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Recovery
            </button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}

function StatInline({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-xl font-black tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function MiniCoverage({ label, value, covered, total }: { label: string; value: number; covered: number; total: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-bold text-foreground">{label}</p>
        <p className="text-xs font-bold text-muted-foreground">{value}%</p>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">{covered} of {total}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-foreground">
      {label}
      {children}
    </label>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}
