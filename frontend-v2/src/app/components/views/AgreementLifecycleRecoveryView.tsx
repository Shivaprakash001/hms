import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { agreementService } from '@features/agreements/api';

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

export function AgreementLifecycleRecoveryView() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<RecoveryAgreement | null>(null);
  const [recoveryFilter, setRecoveryFilter] = useState<'all' | 'needs_recovery'>('all');
  const [hostelFilter, setHostelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortMode, setSortMode] = useState<'missing_fields' | 'tenant' | 'hostel' | 'status'>('missing_fields');
  const [exportError, setExportError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
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
  const missingCount = agreements.filter((item) =>
    !item.agreement_start_date || !item.agreement_end_date || !item.agreement_duration_months
  ).length;
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
    ? { tone: 'green', title: '100% recovered', text: 'Agreement lifecycle data is ready for R4 validation.' }
    : pending > 0
      ? { tone: 'red', title: 'Recovery required', text: `${pending} agreement${pending === 1 ? '' : 's'} pending lifecycle completion.` }
      : { tone: 'yellow', title: 'Recovery in progress', text: 'Review coverage before R4 validation.' };

  return (
    <div className="space-y-5 px-4 py-5 md:px-0">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Agreement Lifecycle</p>
          <h1 className="text-2xl font-bold text-foreground">Lifecycle Recovery</h1>
          <p className="text-sm text-muted-foreground">Complete legacy agreement dates before renewal automation begins.</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-bold text-foreground"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </header>

      <section className={`rounded-xl border p-4 ${
        banner.tone === 'green'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : banner.tone === 'yellow'
            ? 'border-amber-200 bg-amber-50 text-amber-900'
            : 'border-rose-200 bg-rose-50 text-rose-900'
      }`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {banner.tone === 'green' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <div>
            <p className="font-bold">{banner.title}</p>
            <p className="text-sm opacity-80">{banner.text}</p>
          </div>
          <p className="rounded-lg bg-white/60 px-3 py-2 text-sm font-black sm:ml-auto">
            {pending} agreement{pending === 1 ? '' : 's'} remaining
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Total Agreements" value={total} />
        <Metric label="Completed" value={completed} />
        <Metric label="Pending" value={pending} />
        <Metric label="Completion" value={`${completion}%`} />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Coverage label="Start Date Coverage" value={startCoverage} covered={startCovered} total={total} />
        <Coverage label="End Date Coverage" value={endCoverage} covered={endCovered} total={total} />
        <Coverage label="Duration Coverage" value={durationCoverage} covered={durationCovered} total={total} />
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Completion Progress</p>
            <p className="mt-1 text-lg font-bold text-foreground">
              {pending} pending · {completed} completed · {completion}% complete
            </p>
          </div>
          <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${
            r4Ready ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
          }`}>
            <ShieldCheck className="h-4 w-4" />
            R4 Readiness: {r4Ready ? 'READY' : 'NOT READY'}
          </div>
        </div>
        {!r4Ready && (
          <p className="mt-2 text-xs text-muted-foreground">{missingCount} agreement{missingCount === 1 ? '' : 's'} still missing lifecycle data.</p>
        )}
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-accent" style={{ width: `${completion}%` }} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Recovery Worklist</p>
            <p className="mt-1 text-sm text-muted-foreground">Filter the table for owner review and export hostel-specific CSVs.</p>
          </div>
          <button
            type="button"
            onClick={downloadExport}
            disabled={isExporting}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-bold text-foreground disabled:opacity-60"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Export CSV
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Field label="Bulk Filter">
            <select
              value={recoveryFilter}
              onChange={(event) => setRecoveryFilter(event.target.value as 'all' | 'needs_recovery')}
              className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="all">All Agreements</option>
              <option value="needs_recovery">Needs Recovery</option>
            </select>
          </Field>
          <Field label="Hostel">
            <select
              value={hostelFilter}
              onChange={(event) => setHostelFilter(event.target.value)}
              className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="all">All Hostels</option>
              {hostels.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="all">All Statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>{statusText(status)}</option>
              ))}
            </select>
          </Field>
          <Field label="Sort By">
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as 'missing_fields' | 'tenant' | 'hostel' | 'status')}
              className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="missing_fields">Missing Fields</option>
              <option value="tenant">Tenant</option>
              <option value="hostel">Hostel</option>
              <option value="status">Status</option>
            </select>
          </Field>
        </div>

        {exportError && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{exportError}</p>}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading recovery data
          </div>
        ) : isError ? (
          <div className="py-12 text-center">
            <p className="text-sm font-semibold text-foreground">Could not load lifecycle recovery</p>
            <button type="button" onClick={() => refetch()} className="mt-2 text-xs font-bold text-accent">Retry</button>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No agreements match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Tenant</th>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3">Hostel</th>
                  <th className="px-4 py-3">Agreement Status</th>
                  <th className="px-4 py-3">Recommended Start</th>
                  <th className="px-4 py-3">Start Date</th>
                  <th className="px-4 py-3">End Date</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Recovery Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((agreement) => {
                  const complete = Boolean(agreement.lifecycle_complete);
                  return (
                    <tr key={agreement.id} className="align-top">
                      <td className="px-4 py-3 font-semibold text-foreground">{agreement.tenant?.name || 'Tenant'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{agreement.tenant?.room?.room_no || 'N/A'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{agreement.hostel?.name || 'Hostel'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{statusText(agreement.current_status || agreement.status || '')}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(agreement.recommended_start_date)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(agreement.agreement_start_date)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(agreement.agreement_end_date)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{agreement.agreement_duration_months || 'Not set'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${complete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {complete ? 'Completed' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {complete ? (
                            <button type="button" disabled className="rounded-lg bg-muted px-3 py-2 text-xs font-bold text-muted-foreground">Completed</button>
                          ) : (
                            <button type="button" onClick={() => openRecovery(agreement)} className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-accent-foreground">Recover</button>
                          )}
                          {agreement.tenant?.id && agreement.hostel?.id && (
                            <Link to={`/hostels/${agreement.hostel.id}/tenants/${agreement.tenant.id}`} className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground">
                              View Agreement
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-0 sm:items-center sm:justify-center sm:p-4">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-border bg-card p-4 shadow-xl sm:max-w-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Recover Agreement</p>
                <h2 className="text-lg font-bold text-foreground">{selected.tenant?.name || 'Tenant'}</h2>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 rounded-xl border border-border bg-muted/30 p-3 sm:grid-cols-2">
              <ReadOnly label="Rent" value={money(selected.snapshot_values?.monthly_rent)} />
              <ReadOnly label="Deposit" value={money(selected.snapshot_values?.advance_deposit)} />
              <ReadOnly label="Maintenance" value={money(selected.snapshot_values?.maintenance_charge)} />
              <ReadOnly label="Payment Frequency" value={String(selected.snapshot_values?.payment_frequency || 'Not set')} />
            </div>

            <div className="mt-4 grid gap-3">
              <Field label="Start Date">
                <input type="date" value={form.agreement_start_date} onChange={(event) => setForm((prev) => ({ ...prev, agreement_start_date: event.target.value }))} className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground" />
              </Field>
              <Field label="End Date">
                <input type="date" value={form.agreement_end_date} onChange={(event) => setForm((prev) => ({ ...prev, agreement_end_date: event.target.value }))} className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground" />
              </Field>
              <Field label="Duration Months">
                <input type="number" min="1" value={form.agreement_duration_months} onChange={(event) => setForm((prev) => ({ ...prev, agreement_duration_months: event.target.value }))} className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground" />
              </Field>
            </div>

            {formError && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{formError}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-bold text-foreground">Cancel</button>
              <button type="button" onClick={submitRecovery} disabled={recoveryMutation.isPending} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-foreground disabled:opacity-60">
                {recoveryMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Recovery
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-black text-foreground">{value}</p>
    </div>
  );
}

function Coverage({ label, value, covered, total }: { label: string; value: number; covered: number; total: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-black text-foreground">{value}%</p>
      <p className="mt-1 text-xs text-muted-foreground">{covered} of {total} agreements</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
      </div>
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
