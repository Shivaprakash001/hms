import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, Phone, CheckCircle, Building2, CreditCard, ChevronDown, FileText, MessageSquare } from 'lucide-react';
import { ownerService } from '@features/owners/api';
import { paymentService } from '@features/payments/api';
import { tenantService } from '@features/tenants/api';
import { queryKeys } from '@lib/queryKeys';
import { RecordPaymentModal } from '../modals/RecordPaymentModal';

function fmt(n: unknown): string {
  const v = Number(n || 0);
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  // Using exact formatting below 1L to avoid rounding errors (e.g. 8500 becoming 9K)
  return `₹${v.toLocaleString('en-IN')}`;
}

function daysOverdue(dueDateStr: unknown): number {
  if (!dueDateStr) return 0;
  const diff = Date.now() - new Date(String(dueDateStr)).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function daysUntilDue(dueDateStr: unknown): number {
  if (!dueDateStr) return 0;
  const diff = new Date(String(dueDateStr)).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function AlertsView() {
  const [selectedHostelId, setSelectedHostelId] = useState<string | null>(null);
  const [showHostelPicker, setShowHostelPicker] = useState(false);
  const [recordPayment, setRecordPayment] = useState<{ hostelId: string; dueId?: string; amount?: string } | null>(null);

  const { data: hostelsData } = useQuery({
    queryKey: queryKeys.owner.hostels(),
    queryFn: ownerService.getHostels,
    staleTime: 5 * 60 * 1000,
  });

  const hostels: Record<string, unknown>[] = Array.isArray(hostelsData)
    ? hostelsData
    : Array.isArray((hostelsData as Record<string, unknown>)?.hostels)
    ? ((hostelsData as Record<string, unknown>).hostels as Record<string, unknown>[])
    : [];

  const activeHostelId = selectedHostelId ?? (hostels.length > 0 ? String(hostels[0].id ?? '') : null);
  const activeHostel = hostels.find((h) => String(h.id) === activeHostelId);

  const { data: duesData, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.payments.dues(activeHostelId ?? 'none'),
    queryFn: () => paymentService.getAllDues(activeHostelId!),
    enabled: !!activeHostelId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: pendingDocsData, isLoading: isDocsLoading } = useQuery({
    queryKey: ['tenants', 'pending-documents', activeHostelId ?? 'none'],
    queryFn: () => tenantService.getPendingDocuments(activeHostelId || ''),
    enabled: !!activeHostelId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const pendingDocs: Record<string, unknown>[] = Array.isArray(pendingDocsData)
    ? pendingDocsData
    : [];

  const dues: Record<string, unknown>[] = Array.isArray(duesData)
    ? duesData
    : Array.isArray((duesData as Record<string, unknown>)?.dues)
    ? ((duesData as Record<string, unknown>).dues as Record<string, unknown>[])
    : [];

  const now = Date.now();

  const sortedDues = [...dues].sort((a, b) => {
    const aDate = a.due_date ? new Date(String(a.due_date)).getTime() : 0;
    const bDate = b.due_date ? new Date(String(b.due_date)).getTime() : 0;
    const aOverdue = aDate < now;
    const bOverdue = bDate < now;
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    const aAmt = Number(a.amount ?? a.outstanding ?? 0);
    const bAmt = Number(b.amount ?? b.outstanding ?? 0);
    return bAmt - aAmt;
  });

  const overdueList = sortedDues.filter((d) => d.due_date && new Date(String(d.due_date)).getTime() < now);
  const pendingList = sortedDues.filter((d) => !d.due_date || new Date(String(d.due_date)).getTime() >= now);
  const totalOutstanding = sortedDues.reduce((sum, d) => sum + Number(d.amount ?? d.outstanding ?? 0), 0);

  return (
    <div className="px-4 py-5 space-y-5 min-w-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">Alerts & Verifications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading ? 'Loading…' : (
              <>
                {dues.length > 0 && `${fmt(totalOutstanding)} outstanding · ${overdueList.length} overdue`}
                {dues.length > 0 && pendingDocs.length > 0 && ' · '}
                {pendingDocs.length > 0 && `${pendingDocs.length} document verifications pending`}
                {dues.length === 0 && pendingDocs.length === 0 && 'All clear'}
              </>
            )}
          </p>
        </div>
        {hostels.length > 1 && (
          <div className="relative shrink-0">
            <button
              onClick={() => setShowHostelPicker((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 bg-card border border-border rounded-lg text-xs font-medium text-foreground touch-manipulation"
            >
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate max-w-[100px]">{activeHostel ? String(activeHostel.name ?? '') : 'Hostel'}</span>
              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            </button>
            {showHostelPicker && (
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg z-20 min-w-[160px] overflow-hidden">
                {hostels.map((h) => (
                  <button
                    key={String(h.id)}
                    onClick={() => { setSelectedHostelId(String(h.id)); setShowHostelPicker(false); }}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                      String(h.id) === activeHostelId ? 'bg-accent/10 text-accent font-medium' : 'text-foreground hover:bg-secondary'
                    }`}
                  >
                    {String(h.name ?? '')}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary bar */}
      {!isLoading && (dues.length > 0 || pendingDocs.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className={`rounded-xl p-3 min-w-0 ${
            overdueList.length > 0 ? 'bg-[#EF4444]/8 border border-[#EF4444]/25' : 'bg-card border border-border'
          }`}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <AlertCircle className={`w-3.5 h-3.5 shrink-0 ${overdueList.length > 0 ? 'text-[#EF4444]' : 'text-muted-foreground'}`} />
              <span className="text-xs text-muted-foreground">Overdue</span>
            </div>
            <div className={`text-xl font-semibold ${overdueList.length > 0 ? 'text-[#EF4444]' : 'text-foreground'}`}>{overdueList.length}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{fmt(overdueList.reduce((s, d) => s + Number(d.amount ?? d.outstanding ?? 0), 0))}</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#F59E0B]" />
              <span className="text-xs text-muted-foreground">Upcoming</span>
            </div>
            <div className="text-xl font-semibold text-foreground">{pendingList.length}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{fmt(pendingList.reduce((s, d) => s + Number(d.amount ?? d.outstanding ?? 0), 0))}</div>
          </div>
          <div className={`bg-card border rounded-xl p-3 min-w-0 ${
            pendingDocs.length > 0 ? 'border-accent/35 bg-accent/5' : 'border-border'
          }`}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <FileText className={`w-3.5 h-3.5 shrink-0 ${pendingDocs.length > 0 ? 'text-accent' : 'text-muted-foreground'}`} />
              <span className="text-xs text-muted-foreground">Pending Docs</span>
            </div>
            <div className={`text-xl font-semibold ${pendingDocs.length > 0 ? 'text-accent' : 'text-foreground'}`}>{pendingDocs.length}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{pendingDocs.length > 0 ? 'Awaiting verification' : 'All verified'}</div>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 h-20 animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <AlertCircle className="w-8 h-8 text-destructive" />
          <p className="text-sm text-muted-foreground">Failed to load dues</p>
          <button onClick={() => refetch()} className="text-xs text-accent font-medium active:scale-95 transition-transform">Retry</button>
        </div>
      )}

      {/* Empty — all clear */}
      {!isLoading && !isError && dues.length === 0 && pendingDocs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-14 h-14 bg-[#10B981]/10 rounded-full flex items-center justify-center">
            <CheckCircle className="w-7 h-7 text-[#10B981]" />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">All clear</p>
            <p className="text-sm text-muted-foreground mt-1">No outstanding payments or pending verifications</p>
          </div>
        </div>
      )}

      {/* Overdue section — highest urgency */}
      {!isLoading && overdueList.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#EF4444] uppercase tracking-wider">Overdue</span>
            <span className="text-xs bg-[#EF4444]/10 text-[#EF4444] px-2 py-0.5 rounded-full font-medium">{overdueList.length}</span>
          </div>
          {overdueList.map((due, i) => {
            const days = daysOverdue(due.due_date);
            const amount = Number(due.amount ?? due.outstanding ?? 0);
            const dueId = String(due.obligation_id ?? due.id ?? i);
            return (
              <DueCard
                key={dueId}
                due={due}
                isOverdue
                urgencyLabel={days > 0 ? `${days}d overdue` : 'Overdue'}
                urgencyColor="text-[#EF4444]"
                cardBorder="border-[#EF4444]/20"
                onRecordPayment={() =>
                  activeHostelId && setRecordPayment({
                    hostelId: activeHostelId,
                    dueId,
                    amount: String(amount),
                  })
                }
              />
            );
          })}
        </div>
      )}

      {/* Upcoming section */}
      {!isLoading && pendingList.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#F59E0B] uppercase tracking-wider">Upcoming</span>
            <span className="text-xs bg-[#F59E0B]/10 text-[#F59E0B] px-2 py-0.5 rounded-full font-medium">{pendingList.length}</span>
          </div>
          {pendingList.map((due, i) => {
            const days = daysUntilDue(due.due_date);
            const amount = Number(due.amount ?? due.outstanding ?? 0);
            const dueId = String(due.obligation_id ?? due.id ?? i);
            return (
              <DueCard
                key={dueId}
                due={due}
                isOverdue={false}
                urgencyLabel={days > 0 ? `due in ${days}d` : 'Due today'}
                urgencyColor="text-[#F59E0B]"
                cardBorder="border-[#F59E0B]/15"
                onRecordPayment={() =>
                  activeHostelId && setRecordPayment({
                    hostelId: activeHostelId,
                    dueId,
                    amount: String(amount),
                  })
                }
              />
            );
          })}
        </div>
      )}

      {/* Pending Documents Verification Section */}
      {!isLoading && pendingDocs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-accent uppercase tracking-wider">Verification Requests</span>
            <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium">{pendingDocs.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingDocs.map((doc) => {
              const docId = String(doc.id);
              const tenantId = String(doc.tenant_id);
              const hostelId = String(doc.hostel_id || activeHostelId || '');
              const name = String(doc.tenant_name || 'Tenant');
              const docType = String(doc.doc_type || 'Document');
              const room = String(doc.room_no || 'N/A');
              const uploadedAt = doc.uploaded_at ? new Date(String(doc.uploaded_at)) : null;
              const avatarUrl = doc.avatar ?? doc.tenant_avatar ?? doc.tenant_avatar_url ?? doc.avatar_url;

              return (
                <div key={docId} className="bg-card border border-border rounded-xl p-3 flex flex-col justify-between gap-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    {avatarUrl ? (
                      <img src={String(avatarUrl)} alt={name} className="w-10 h-10 rounded-full object-cover shrink-0 border border-border" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-accent">{name.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground truncate text-sm">{name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Room {room} · {docType}
                      </p>
                      {uploadedAt && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Uploaded {uploadedAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                  <Link
                    to={`/hostels/${hostelId}/tenants/${tenantId}?tab=documents`}
                    className="w-full bg-accent text-accent-foreground py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-98 transition-all"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Verify & Chat
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {recordPayment && (
        <RecordPaymentModal
          hostelId={recordPayment.hostelId}
          initialDueId={recordPayment.dueId}
          initialAmount={recordPayment.amount}
          onClose={() => setRecordPayment(null)}
        />
      )}
    </div>
  );
}

interface DueCardProps {
  due: Record<string, unknown>;
  isOverdue: boolean;
  urgencyLabel: string;
  urgencyColor: string;
  cardBorder: string;
  onRecordPayment: () => void;
}

function DueCard({ due, isOverdue, urgencyLabel, urgencyColor, cardBorder, onRecordPayment }: DueCardProps) {
  const amount = Number(due.amount ?? due.outstanding ?? 0);
  const tenantName = String(due.tenant_name ?? due.name ?? 'Tenant');
  const room = due.room_no ?? due.room_number;
  const rawPhone = due.phone ?? due.tenant_phone ?? due.tenantPhone;
  const phone = rawPhone ? String(rawPhone).trim() : null;
  const telPhone = phone ? phone.replace(/[^\d+]/g, '') : null;
  const avatarUrl = due.avatar ?? due.tenant_avatar ?? due.tenant_avatar_url ?? due.avatar_url;

  return (
    <div className={`bg-card border ${cardBorder} rounded-xl p-3 flex items-center gap-3 min-w-0 shadow-sm transition-all hover:shadow-md`}>
      {/* Profile Pic / Initial */}
      {avatarUrl ? (
        <img src={String(avatarUrl)} alt={tenantName} className="w-10 h-10 rounded-full object-cover shrink-0 border border-border" />
      ) : (
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
          isOverdue ? 'bg-[#EF4444]/10 text-[#EF4444]' : 'bg-[#F59E0B]/10 text-[#F59E0B]'
        }`}>
          <span className="text-sm font-bold">{tenantName.charAt(0).toUpperCase()}</span>
        </div>
      )}

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-foreground truncate text-sm">{tenantName}</h4>
          {room && <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline-block">· Room {String(room)}</span>}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
            isOverdue ? 'bg-[#EF4444]/10 text-[#EF4444]' : 'bg-[#F59E0B]/10 text-[#F59E0B]'
          }`}>
            {urgencyLabel}
          </span>
          <span className="text-xs font-bold text-foreground">{fmt(amount)}</span>
          <span className="text-[10px] text-muted-foreground uppercase">due</span>
        </div>
      </div>

      {/* Actions (Minimal Icons) */}
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {telPhone && (
          <a
            href={`tel:${telPhone}`}
            aria-label={`Call ${tenantName}`}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-95 transition-all"
          >
            <Phone className="w-4 h-4" />
          </a>
        )}
        <button
          onClick={onRecordPayment}
          aria-label="Record Payment"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm hover:opacity-90 active:scale-95 transition-all"
        >
          <CreditCard className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
