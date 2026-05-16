import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert, Play, RefreshCw, AlertTriangle, AlertCircle, Info,
  CheckCircle2, EyeOff, Eye, Search, Loader2, FileText,
} from 'lucide-react';
import { adminReconciliationService } from '../../api/services';
import { useAppPreferences } from '../../context/AppPreferencesContext';
import { formatDate } from '../../utils/format';

// Severity ranking — CRITICAL is loudest. Used for both sort order and pill styling.
const SEVERITY_META = {
  CRITICAL: { rank: 0, className: 'bg-rose-50 text-rose-700 border-rose-200',     Icon: AlertTriangle },
  HIGH:     { rank: 1, className: 'bg-orange-50 text-orange-700 border-orange-200', Icon: AlertCircle },
  MEDIUM:   { rank: 2, className: 'bg-amber-50 text-amber-700 border-amber-200',   Icon: Info },
  LOW:      { rank: 3, className: 'bg-sky-50 text-sky-700 border-sky-200',         Icon: Info },
};

const STATUS_META = {
  OPEN:          { className: 'bg-slate-100 text-slate-700 border-slate-200',   label: 'Open' },
  INVESTIGATING: { className: 'bg-indigo-50 text-indigo-700 border-indigo-200', label: 'Investigating' },
  RESOLVED:      { className: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Resolved' },
  IGNORED:       { className: 'bg-slate-50 text-slate-500 border-slate-200',     label: 'Ignored' },
};

function SeverityPill({ severity }) {
  const meta = SEVERITY_META[severity] || SEVERITY_META.LOW;
  const Icon = meta.Icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${meta.className}`}>
      <Icon size={12} />
      {severity}
    </span>
  );
}

function StatusPill({ status }) {
  const meta = STATUS_META[status] || { className: 'bg-slate-100 text-slate-700 border-slate-200', label: status };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function IssueRow({ issue, onTransition, isTransitioning, expanded, onToggle, preferences }) {
  return (
    <>
      <tr className="border-t border-slate-50 transition hover:bg-slate-50/50">
        <td className="px-5 py-3"><SeverityPill severity={issue.severity} /></td>
        <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-700">{issue.issue_type}</td>
        <td className="px-5 py-3 max-w-md text-sm text-slate-700">
          <div className="line-clamp-2">{issue.description}</div>
        </td>
        <td className="px-5 py-3 text-xs text-slate-500">
          {formatDate(issue.detected_at, preferences, '') || new Date(issue.detected_at).toLocaleString('en-IN')}
        </td>
        <td className="px-5 py-3"><StatusPill status={issue.status} /></td>
        <td className="px-5 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => onToggle(issue.id)}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
              title={expanded ? 'Hide details' : 'Show details'}
            >
              {expanded ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            {issue.status === 'OPEN' && (
              <button
                disabled={isTransitioning}
                onClick={() => onTransition(issue.id, 'INVESTIGATING')}
                className="rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
              >
                Investigate
              </button>
            )}
            {(issue.status === 'OPEN' || issue.status === 'INVESTIGATING') && (
              <>
                <button
                  disabled={isTransitioning}
                  onClick={() => onTransition(issue.id, 'RESOLVED')}
                  className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                >
                  Resolve
                </button>
                <button
                  disabled={isTransitioning}
                  onClick={() => onTransition(issue.id, 'IGNORED')}
                  className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50"
                >
                  Ignore
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50/30">
          <td colSpan={6} className="px-5 py-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Scope</div>
                <dl className="mt-2 space-y-1 text-xs">
                  <ScopeRow label="Owner ID"        value={issue.owner_id} />
                  <ScopeRow label="Hostel ID"       value={issue.hostel_id} />
                  <ScopeRow label="Payment ID"      value={issue.payment_id} />
                  <ScopeRow label="Ledger Entry ID" value={issue.ledger_entry_id} />
                  <ScopeRow label="Batch ID"        value={issue.batch_id} />
                  <ScopeRow label="Batch Item ID"   value={issue.batch_item_id} />
                  <ScopeRow label="Fingerprint"     value={issue.fingerprint} mono />
                </dl>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Reproduction Metadata</div>
                <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
                  {JSON.stringify(issue.metadata || {}, null, 2)}
                </pre>
                {issue.resolution_notes && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs">
                    <div className="font-bold text-slate-600">Resolution Notes</div>
                    <p className="mt-1 text-slate-700">{issue.resolution_notes}</p>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ScopeRow({ label, value, mono }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-32 shrink-0 font-semibold text-slate-500">{label}</span>
      <span className={`text-slate-800 ${mono ? 'font-mono' : ''} break-all`}>{value}</span>
    </div>
  );
}

export default function AdminReconciliation() {
  const queryClient = useQueryClient();
  const { preferences } = useAppPreferences();
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [severityFilter, setSeverityFilter] = useState('');
  const [issueTypeFilter, setIssueTypeFilter] = useState('');
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [lastScan, setLastScan] = useState(null);

  const issuesQ = useQuery({
    queryKey: ['admin-recon-issues', { status: statusFilter, severity: severityFilter, issueType: issueTypeFilter }],
    queryFn: () => adminReconciliationService.listIssues({
      status: statusFilter,
      ...(severityFilter && { severity: severityFilter }),
      ...(issueTypeFilter && { issueType: issueTypeFilter }),
      limit: 200,
    }),
    staleTime: 30_000,
  });

  const scanMut = useMutation({
    mutationFn: ({ persist }) => adminReconciliationService.scan({ persist }),
    onSuccess: (data) => {
      setLastScan(data.report || data);
      queryClient.invalidateQueries({ queryKey: ['admin-recon-issues'] });
    },
  });

  const transitionMut = useMutation({
    mutationFn: ({ issueId, status }) => adminReconciliationService.transitionIssue(issueId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-recon-issues'] });
    },
  });

  const issues = (issuesQ.data?.issues || []).slice().sort((a, b) => {
    const ra = SEVERITY_META[a.severity]?.rank ?? 9;
    const rb = SEVERITY_META[b.severity]?.rank ?? 9;
    if (ra !== rb) return ra - rb;
    return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime();
  });

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Aggregate counts by severity for the headline tiles.
  const sevCounts = issues.reduce((acc, i) => {
    acc[i.severity] = (acc[i.severity] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-rose-600">
              <ShieldAlert size={20} />
              <span className="text-xs font-bold uppercase tracking-wider">Admin · Treasury</span>
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Financial Reconciliation
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Detects and classifies invariant violations in the append-only owner settlement ledger,
              settlement batches, and batch items. Read-only by default — persist to write deduped audit rows.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={scanMut.isPending}
              onClick={() => scanMut.mutate({ persist: false })}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50"
            >
              {scanMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Dry-run scan
            </button>
            <button
              disabled={scanMut.isPending}
              onClick={() => scanMut.mutate({ persist: true })}
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {scanMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              Scan & persist
            </button>
          </div>
        </header>

        {/* Last scan banner */}
        {lastScan && (
          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Last Scan</div>
                <div className="mt-1 text-sm font-semibold text-slate-700">
                  {lastScan.total_issues ?? lastScan.issues?.length ?? 0} issues found in {lastScan.total_ms ?? 0}ms
                </div>
              </div>
              <details className="text-xs text-slate-600">
                <summary className="cursor-pointer font-semibold text-indigo-600">Per-detector breakdown</summary>
                <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
                  {(lastScan.summary || []).map((s) => (
                    <div key={s.detector_kind} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                      <div className="font-mono text-[10px] text-slate-500">{s.detector_kind}</div>
                      <div className="font-bold text-slate-800">{s.count} <span className="text-[10px] font-normal text-slate-400">in {s.ms}ms</span></div>
                      {s.error && <div className="mt-1 text-[10px] text-rose-600">{s.error}</div>}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </div>
        )}

        {/* Severity tiles */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(severityFilter === sev ? '' : sev)}
              className={`rounded-3xl border p-5 text-left shadow-sm transition ${
                severityFilter === sev
                  ? 'border-indigo-300 bg-indigo-50/60 ring-2 ring-indigo-100'
                  : 'border-slate-100 bg-white hover:border-slate-200'
              }`}
            >
              <SeverityPill severity={sev} />
              <div className="mt-3 text-2xl font-black text-slate-900">{sevCounts[sev] || 0}</div>
              <div className="mt-1 text-xs font-medium text-slate-500">issues in current view</div>
            </button>
          ))}
        </section>

        {/* Filters */}
        <section className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Filter</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            <option value="OPEN">Open</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="RESOLVED">Resolved</option>
            <option value="IGNORED">Ignored</option>
          </select>
          <select
            value={issueTypeFilter}
            onChange={(e) => setIssueTypeFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            <option value="">All issue types</option>
            <option value="DUPLICATE_SETTLEMENT">Duplicate settlement</option>
            <option value="PAYMENT_WITHOUT_LEDGER">Payment without ledger</option>
            <option value="LEDGER_WITHOUT_PAYMENT">Ledger without payment</option>
            <option value="SETTLED_EXCEEDS_COLLECTED">Settled exceeds collected</option>
            <option value="NEGATIVE_BALANCE">Negative balance</option>
            <option value="HOSTEL_ISOLATION_VIOLATION">Hostel isolation violation</option>
            <option value="BATCH_AMOUNT_DRIFT">Batch amount drift</option>
            <option value="BALANCE_AFTER_DRIFT">Balance after drift</option>
          </select>
          {(severityFilter || issueTypeFilter) && (
            <button
              onClick={() => { setSeverityFilter(''); setIssueTypeFilter(''); }}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Clear filters
            </button>
          )}
          <button
            onClick={() => issuesQ.refetch()}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </section>

        {/* Issues table */}
        <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/60 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Severity</th>
                  <th className="px-5 py-3">Issue Type</th>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Detected</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {issuesQ.isLoading && (
                  <tr><td colSpan={6} className="px-5 py-6 text-center text-slate-400">Loading…</td></tr>
                )}
                {!issuesQ.isLoading && issues.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center">
                      <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400" />
                      <p className="text-sm font-semibold text-slate-700">No {statusFilter.toLowerCase()} issues</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Run a scan to detect new invariant violations.
                      </p>
                    </td>
                  </tr>
                )}
                {issues.map((issue) => (
                  <IssueRow
                    key={issue.id}
                    issue={issue}
                    expanded={expandedIds.has(issue.id)}
                    onToggle={toggleExpand}
                    onTransition={(id, status) => transitionMut.mutate({ issueId: id, status })}
                    isTransitioning={transitionMut.isPending}
                    preferences={preferences}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="flex items-center justify-center gap-2 text-xs text-slate-400">
          <FileText size={12} />
          Read-only by default. Dry-run scans never write to the issues table.
        </footer>
      </div>
    </div>
  );
}
