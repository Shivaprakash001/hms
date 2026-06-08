import { useQuery } from '@tanstack/react-query';
import { Loader2, UserPlus, Bed, Receipt, CreditCard, FileUp, FileCheck, LogOut, ShieldAlert, Calendar } from 'lucide-react';
import { activityListService } from '@features/activity/api';
import { queryKeys } from '@lib/queryKeys';

interface Props {
  hostelId: string;
  tenantId: string;
  tenantName: string;
  joinedOn?: string;
  profileType?: string;
  documents?: Record<string, any>[];
  allocations?: Record<string, any>[];
  timelineItems?: Record<string, any>[];
  recentPayments?: Record<string, any>[];
  moveOutRequest?: Record<string, any> | null;
}

interface TimelineEvent {
  id: string;
  title: string;
  subtitle?: string;
  date: Date;
  category: 'system' | 'stay' | 'money' | 'documents';
  icon: any;
  color: string;
}

export function ActivityTimeline({
  hostelId,
  tenantId,
  tenantName,
  joinedOn,
  documents = [],
  allocations = [],
  timelineItems = [],
  recentPayments = [],
  moveOutRequest,
}: Props) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.tenants.activity(hostelId, tenantId),
    queryFn: () => activityListService.getList(hostelId, { tenantId, limit: 50 }),
    staleTime: 60_000,
  });

  const systemLogs = (Array.isArray(data) ? data : (data as Record<string, any>)?.items ?? (data as Record<string, any>)?.activity ?? []) as Record<string, any>[];

  const filteredLogs = systemLogs.filter(
    (e) =>
      String(e.tenant_id ?? '') === tenantId ||
      String(e.tenant_name ?? '').toLowerCase().includes(tenantName.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  // Build the chronological lifecycle feed
  const events: TimelineEvent[] = [];

  // 1. Joined Event
  if (joinedOn) {
    const d = new Date(joinedOn);
    if (!isNaN(d.getTime())) {
      events.push({
        id: `join-${joinedOn}`,
        title: 'Joined Hostel & Created Profile',
        subtitle: 'Tenant onboarding initiated',
        date: d,
        category: 'system',
        icon: UserPlus,
        color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      });
    }
  }

  // 2. Room Allocations
  allocations.forEach((alloc, idx) => {
    const createdDate = new Date(alloc.created_at ?? alloc.assigned_at);
    if (!isNaN(createdDate.getTime())) {
      events.push({
        id: `alloc-in-${idx}-${createdDate.getTime()}`,
        title: `Room Allocation: Room ${alloc.room_no || 'Assigned'}`,
        subtitle: `Checked in to floor ${alloc.floor ?? '—'} · Rent: ₹${(alloc.monthly_rent ?? 0).toLocaleString('en-IN')}`,
        date: createdDate,
        category: 'stay',
        icon: Bed,
        color: 'text-accent bg-accent/10 border-accent/20',
      });
    }

    if (alloc.vacated_at) {
      const vacatedDate = new Date(alloc.vacated_at);
      if (!isNaN(vacatedDate.getTime())) {
        events.push({
          id: `alloc-out-${idx}-${vacatedDate.getTime()}`,
          title: `Vacated Room ${alloc.room_no}`,
          subtitle: 'Checked out / changed room allocation',
          date: vacatedDate,
          category: 'stay',
          icon: LogOut,
          color: 'text-zinc-600 bg-zinc-500/10 border-zinc-500/20',
        });
      }
    }
  });

  // 3. Billing Obligations
  timelineItems.forEach((item, idx) => {
    const dueDate = new Date(item.due_date);
    if (!isNaN(dueDate.getTime())) {
      // Do not display future dues (due date in the future)
      if (dueDate.getTime() > Date.now()) {
        return;
      }
      const amt = item.amount ?? item.pending_amount ?? 0;
      events.push({
        id: `bill-${idx}-${dueDate.getTime()}`,
        title: item.label || 'Rent Obligation Generated',
        subtitle: `Due Date: ${dueDate.toLocaleDateString('en-IN')} · Amount: ₹${amt.toLocaleString('en-IN')}`,
        date: new Date(item.created_at ?? item.due_date), // Use generation date if available, fallback to due date
        category: 'money',
        icon: Receipt,
        color: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
      });
    }
  });

  // 4. Payments Received
  recentPayments.forEach((pmt, idx) => {
    const pmtDate = new Date(pmt.date ?? pmt.payment_date);
    if (!isNaN(pmtDate.getTime())) {
      events.push({
        id: `payment-${idx}-${pmtDate.getTime()}`,
        title: 'Payment Confirmed',
        subtitle: `Received ₹${Number(pmt.amount ?? pmt.amount_paid ?? 0).toLocaleString('en-IN')} via ${pmt.method || 'Cash'}${pmt.reference_number ? ` (Ref: ${pmt.reference_number})` : ''}`,
        date: pmtDate,
        category: 'money',
        icon: CreditCard,
        color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      });
    }
  });

  // 5. Document Uploads and Approvals
  documents.forEach((doc, idx) => {
    const createdDate = new Date(doc.created_at);
    const docTypeLabel = String(doc.doc_type ?? doc.type ?? 'Document').replace(/_/g, ' ');
    if (!isNaN(createdDate.getTime())) {
      events.push({
        id: `doc-upload-${idx}-${createdDate.getTime()}`,
        title: `${docTypeLabel} Submitted`,
        subtitle: 'Document uploaded for verification',
        date: createdDate,
        category: 'documents',
        icon: FileUp,
        color: 'text-sky-600 bg-sky-500/10 border-sky-500/20',
      });
    }

    const status = String(doc.document_status ?? doc.status ?? '').toUpperCase();
    if (status === 'APPROVED' || doc.is_verified === true) {
      const verifiedDate = new Date(doc.updated_at ?? doc.created_at);
      events.push({
        id: `doc-verify-${idx}-${verifiedDate.getTime()}`,
        title: `${docTypeLabel} Approved`,
        subtitle: 'Document verified and marked active by hostel owner',
        date: verifiedDate,
        category: 'documents',
        icon: FileCheck,
        color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      });
    }
  });

  // 6. Move Out Request
  if (moveOutRequest) {
    const reqDate = new Date(moveOutRequest.created_at ?? moveOutRequest.requested_at);
    if (!isNaN(reqDate.getTime())) {
      events.push({
        id: 'move-out-request-timeline',
        title: 'Move-out Notice Submitted',
        subtitle: `Requested vacating date: ${moveOutRequest.vacating_date ? new Date(moveOutRequest.vacating_date).toLocaleDateString('en-IN') : 'Not specified'}`,
        date: reqDate,
        category: 'stay',
        icon: LogOut,
        color: 'text-rose-600 bg-rose-500/10 border-rose-500/20',
      });
    }
  }

  // 7. System Activity Logs (excluding duplicate payments/joins if possible)
  filteredLogs.forEach((log, idx) => {
    const logDate = new Date(log.created_at);
    if (!isNaN(logDate.getTime())) {
      // Check if we already have a more descriptive mapped event
      const logMessage = String(log.detail ?? log.message ?? log.type ?? '');
      if (logMessage.toLowerCase().includes('payment') && recentPayments.length > 0) return;
      if (logMessage.toLowerCase().includes('onboard') && joinedOn) return;

      events.push({
        id: `system-log-${idx}-${logDate.getTime()}`,
        title: logMessage,
        subtitle: 'System event log',
        date: logDate,
        category: 'system',
        icon: ShieldAlert,
        color: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20',
      });
    }
  });

  // Sort chronologically (newest first)
  events.sort((a, b) => b.date.getTime() - a.date.getTime());

  if (events.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed border-border rounded-xl bg-muted/20">
        <Calendar className="w-8 h-8 text-muted-foreground opacity-50 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">No chronological history recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="relative pl-6 border-l-2 border-border space-y-6 ml-2 py-2">
      {events.map((event) => {
        const Icon = event.icon;
        return (
          <div key={event.id} className="relative">
            {/* Timeline node */}
            <span className={`absolute -left-[35px] top-1.5 flex h-6 h-6 w-6 items-center justify-center rounded-full border ${event.color} shadow-sm shrink-0`}>
              <Icon className="w-3.5 h-3.5" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-foreground leading-snug">{event.title}</p>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap bg-secondary px-2 py-0.5 rounded-full font-medium">
                  {event.date.toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              {event.subtitle && (
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{event.subtitle}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
