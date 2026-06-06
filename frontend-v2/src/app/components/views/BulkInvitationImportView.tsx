import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Send, Upload } from 'lucide-react';
import { bulkImportService, ownerService } from '@features/owners/api';
import { TenantsLayout } from '@features/tenants/components/layout/TenantsLayout';
import { useQuery } from '@tanstack/react-query';

type Step = 'upload' | 'preview' | 'sent';

function unwrap<T = any>(value: any): T {
  return (value?.data ?? value) as T;
}

export function BulkInvitationImportView() {
  const [step, setStep] = useState<Step>('upload');
  const [hostelId, setHostelId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [batch, setBatch] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [confirmHistorical, setConfirmHistorical] = useState(false);
  const [editedData, setEditedData] = useState<Record<number, any>>({});
  const [revalidating, setRevalidating] = useState(false);

  const { data: hostelsRaw } = useQuery({
    queryKey: ['owner-hostels-for-bulk-invite'],
    queryFn: () => ownerService.getHostels(),
  });

  const { data: batchStatusRaw } = useQuery({
    queryKey: ['bulk-invitation-batch-status', batch?.batch_id],
    queryFn: () => bulkImportService.getBatchStatus(batch.batch_id),
    enabled: step === 'sent' && Boolean(batch?.batch_id),
    refetchInterval: step === 'sent' ? 15000 : false,
  });

  const hostels = useMemo(() => {
    const value = unwrap<any>(hostelsRaw);
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.hostels)) return value.hostels;
    return [];
  }, [hostelsRaw]);

  const validation = batch?.validation || {};
  const previewValidRows = Array.isArray(batch?.preview?.valid) ? batch.preview.valid : [];
  const previewInvalidRows = Array.isArray(batch?.preview?.invalid) ? batch.preview.invalid : [];
  const previewDuplicateRows = Array.isArray(batch?.preview?.duplicates) ? batch.preview.duplicates : [];
  const hasPendingEdits = Object.keys(editedData).length > 0;
  const requiresHistorical = Boolean(
    validation.requires_historical_join_date_confirmation ??
      previewValidRows.some((row: any) =>
        (row.warnings || []).some((warning: string) => warning.toLowerCase().includes('historical joining date')),
      ),
  );
  const readyCount = Number(validation.valid_rows ?? previewValidRows.length);
  const blockedCount =
    Number(validation.invalid_rows ?? previewInvalidRows.length) +
    Number(validation.duplicate_rows ?? previewDuplicateRows.length);
  const sendDisabledReason = sending
    ? ''
    : hasPendingEdits
      ? 'Revalidate your edited rows before sending invitations.'
      : readyCount === 0
        ? 'No rows are ready to invite yet. Fix validation issues and revalidate.'
        : requiresHistorical && !confirmHistorical
          ? 'Confirm historical joining dates before sending invitations.'
          : '';
  const batchStatus = unwrap<any>(batchStatusRaw);
  const funnel = batchStatus?.funnel || {};
  const trackedRows = batchStatus?.rows || result?.results || [];

  const downloadTemplate = async () => {
    const blob = await bulkImportService.downloadTemplate();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'tenant-invitation-import-template.csv';
    anchor.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 250);
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError('');
    setFile(event.target.files?.[0] || null);
  };

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (!hostelId || !file) {
      setError('Choose a hostel and spreadsheet before validation.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('hostel_id', hostelId);
      formData.append('file', file);
      const response = unwrap<any>(await bulkImportService.uploadTenantIdentityFile(formData));
      setBatch(response);
      setConfirmHistorical(false);
      setStep('preview');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Unable to validate spreadsheet.');
    } finally {
      setUploading(false);
    }
  };

  const sendInvitations = async () => {
    if (!batch?.batch_id) return;
    if (requiresHistorical && !confirmHistorical) {
      setError('Confirm historical joining dates before sending invitations.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const response = unwrap<any>(
        await bulkImportService.confirmInvitationBatch(batch.batch_id, {
          confirm_historical_join_dates: confirmHistorical,
        }),
      );
      setResult(response.result || response);
      setStep('sent');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Unable to send invitations.');
    } finally {
      setSending(false);
    }
  };

  const handleRowEdit = (rowId: number, field: string, value: string) => {
    setEditedData((prev) => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] || {}),
        [field]: value,
      },
    }));
  };

  const revalidateEdits = async () => {
    if (!hostelId) return;
    setRevalidating(true);
    setError('');
    try {
      const allOriginalRows = [
        ...(batch?.preview?.valid || []),
        ...(batch?.preview?.invalid || []),
        ...(batch?.preview?.duplicates || []),
      ].sort((a, b) => a.row - b.row);

      const rowsToRevalidate = allOriginalRows.map((r) => {
        const originalData = r.data || r;
        const edits = editedData[r.row] || {};
        return {
          ...originalData,
          ...edits,
        };
      });

      const response = unwrap<any>(
        await bulkImportService.revalidateRows({
          hostel_id: hostelId,
          filename: batch?.filename,
          rows: rowsToRevalidate,
        }),
      );
      const nextRequiresHistorical = Boolean(
        response?.validation?.requires_historical_join_date_confirmation ??
          (Array.isArray(response?.preview?.valid)
            ? response.preview.valid.some((row: any) =>
                (row.warnings || []).some((warning: string) => warning.toLowerCase().includes('historical joining date')),
              )
            : false),
      );
      setBatch(response);
      setEditedData({});
      setConfirmHistorical((previous) => (nextRequiresHistorical ? previous : false));
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Unable to revalidate edits.');
    } finally {
      setRevalidating(false);
    }
  };

  return (
    <TenantsLayout
      title="Bulk tenant invitations"
      subtitle="Validate, preview, and invite tenants without creating active accounts."
      backTo="/tenants"
      actions={
        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground"
        >
          <Download className="h-4 w-4" />
          Template
        </button>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ['1', 'Upload spreadsheet'],
            ['2', 'Review validation'],
            ['3', 'Send invitations'],
          ].map(([number, label], index) => (
            <div
              key={label}
              className={`rounded-lg border p-4 ${
                (step === 'upload' && index === 0) || (step === 'preview' && index === 1) || (step === 'sent' && index === 2)
                  ? 'border-accent bg-accent/10'
                  : 'border-border bg-card'
              }`}
            >
              <p className="text-xs font-bold uppercase text-muted-foreground">Step {number}</p>
              <p className="mt-1 font-semibold text-foreground">{label}</p>
            </div>
          ))}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {step === 'upload' && (
          <form onSubmit={upload} className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-accent/10 p-3 text-accent">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Upload invitation spreadsheet</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Required columns: Name, Email, Phone, Room. No passwords, profiles, allocations, or payments are created.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-foreground">Hostel</span>
                <select
                  value={hostelId}
                  onChange={(event) => setHostelId(event.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="">Select hostel</option>
                  {hostels.map((hostel: any) => (
                    <option key={hostel.id} value={hostel.id}>
                      {hostel.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-foreground">Spreadsheet</span>
                <input
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  onChange={onFileChange}
                  className="mt-2 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-bold text-accent-foreground disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Validating...' : 'Validate spreadsheet'}
            </button>
          </form>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Metric label="Ready to invite" value={readyCount} tone="success" />
              <Metric label="Needs review" value={blockedCount} tone={blockedCount ? 'warn' : 'neutral'} />
              <Metric label="Duplicate rows" value={validation.duplicate_rows || 0} tone="warn" />
              <Metric label="Warnings" value={validation.warnings || 0} tone="neutral" />
            </div>

            {requiresHistorical && (
              <label className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                <input
                  type="checkbox"
                  checked={confirmHistorical}
                  onChange={(event) => setConfirmHistorical(event.target.checked)}
                  className="mt-1"
                />
                <span>
                  This spreadsheet contains historical joining dates. I confirm these dates are intentional.
                </span>
              </label>
            )}

            <PreviewTable title="Ready rows" rows={previewValidRows} isEditable={true} editedData={editedData} onEdit={handleRowEdit} />
            <PreviewTable title="Invalid rows" rows={previewInvalidRows} isEditable={true} editedData={editedData} onEdit={handleRowEdit} />
            <PreviewTable title="Duplicate rows" rows={previewDuplicateRows} isEditable={true} editedData={editedData} onEdit={handleRowEdit} />

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={sendInvitations}
                disabled={sending || Boolean(sendDisabledReason)}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-bold text-accent-foreground disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {sending ? 'Sending invitations...' : 'Send invitations'}
              </button>
              
              {hasPendingEdits && (
                <button
                  type="button"
                  onClick={revalidateEdits}
                  disabled={revalidating}
                  className="inline-flex items-center gap-2 rounded-lg border border-accent bg-accent/10 px-4 py-3 text-sm font-bold text-accent disabled:opacity-60 transition-colors hover:bg-accent/20"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  {revalidating ? 'Revalidating...' : 'Revalidate edits'}
                </button>
              )}
            </div>
            {sendDisabledReason && (
              <p className="text-sm font-medium text-muted-foreground">{sendDisabledReason}</p>
            )}
          </div>
        )}

        {step === 'sent' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                <div>
                  <h2 className="text-lg font-bold text-foreground">Invitation batch processed</h2>
                  <p className="text-sm text-muted-foreground">
                    {result?.success_count || 0} sent, {result?.failure_count || 0} failed, {result?.email_failure_count || 0} email delivery failures.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-5">
              <Metric label="Invited" value={funnel.invited || result?.success_count || 0} tone="neutral" />
              <Metric label="Opened" value={funnel.opened || 0} tone="neutral" />
              <Metric label="Started" value={funnel.activation_started || 0} tone="neutral" />
              <Metric label="Activated" value={funnel.activated || 0} tone="success" />
              <Metric label="Expired" value={funnel.expired || 0} tone="warn" />
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-bold text-foreground">Conversion funnel</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Open rate {funnel.open_rate || 0}% · Activation-start rate {funnel.activation_start_rate || 0}% · Activation rate {funnel.activation_rate || 0}% · Expiry rate {funnel.expiry_rate || 0}%
              </p>
            </div>

            <PreviewTable title="Row results" rows={trackedRows} />
          </div>
        )}
      </div>
    </TenantsLayout>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: 'success' | 'warn' | 'neutral' }) {
  const color = tone === 'success' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : 'text-foreground';
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{Number(value || 0)}</p>
    </div>
  );
}

function PreviewTable({
  title,
  rows,
  isEditable = false,
  editedData = {},
  onEdit,
}: {
  title: string;
  rows: any[];
  isEditable?: boolean;
  editedData?: Record<number, any>;
  onEdit?: (rowId: number, field: string, value: string) => void;
}) {
  if (!rows.length) return null;
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <h3 className="font-bold text-foreground">{title}</h3>
        {isEditable && <span className="text-xs text-muted-foreground">Click on cells to edit inline</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Row</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Rent</th>
              <th className="px-4 py-3">Deposit</th>
              <th className="px-4 py-3">Join Date</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const data = row.data || row;
              const rowId = row.row || row.row_number || index;
              const currentData = isEditable ? { ...data, ...(editedData[rowId] || {}) } : data;
              const isEdited = !!editedData[rowId];

              const status =
                row.success === false
                  ? row.error
                  : row.invitation_status ||
                    row.execution_status ||
                    row.reason ||
                    row.action ||
                    row.errors?.[0]?.message ||
                    'Ready';

              const renderCell = (field: string, fallback: string) => {
                if (!isEditable) return fallback;
                return (
                  <input
                    type="text"
                    value={currentData[field] === undefined || currentData[field] === null ? '' : currentData[field]}
                    onChange={(e) => onEdit?.(rowId, field, e.target.value)}
                    className="w-full min-w-[80px] bg-transparent outline-none border-b border-transparent focus:border-accent focus:bg-background/50 px-1 py-0.5 rounded transition-all text-sm"
                    placeholder="Empty"
                  />
                );
              };

              return (
                <tr key={`${rowId}-${data.email || index}`} className={`border-t border-border focus-within:bg-muted/30 ${isEdited ? 'bg-accent/5' : ''}`}>
                  <td className="px-4 py-3">
                    {rowId}
                    {isEdited && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-accent"></span>}
                  </td>
                  <td className="px-4 py-2">{renderCell('name', currentData.name || '-')}</td>
                  <td className="px-4 py-2">{renderCell('email', currentData.email || '-')}</td>
                  <td className="px-4 py-2">{renderCell('phone', currentData.phone || '-')}</td>
                  <td className="px-4 py-2 w-28">{renderCell('room_no', currentData.room_no || row.room || '-')}</td>
                  <td className="px-4 py-2 w-28">{renderCell('monthly_rent', currentData.monthly_rent != null ? `₹${currentData.monthly_rent}` : '-')}</td>
                  <td className="px-4 py-2 w-28">{renderCell('advance_deposit', currentData.advance_deposit != null ? `₹${currentData.advance_deposit}` : '-')}</td>
                  <td className="px-4 py-2 w-32">{renderCell('joining_date', currentData.joining_date || '-')}</td>
                  <td className="px-4 py-2 max-w-[200px] truncate" title={currentData.notes}>
                    {renderCell('notes', currentData.notes || '-')}
                  </td>
                  <td className="px-4 py-3 max-w-[300px] truncate text-xs" title={status}>
                    {status}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
