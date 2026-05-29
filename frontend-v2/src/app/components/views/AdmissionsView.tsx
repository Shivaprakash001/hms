import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BedDouble,
  CheckCircle2,
  ClipboardList,
  Flame,
  Mail,
  MessageSquareText,
  Phone,
  Plus,
  RefreshCcw,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { admissionsService } from '@features/admissions/api';
import { roomService } from '@features/rooms/api';
import { queryKeys } from '@lib/queryKeys';
import { toast } from 'sonner';

const statuses = [
  ['NEW', 'New Leads'],
  ['INTERESTED', 'Interested'],
  ['FOLLOW_UP', 'Follow Up'],
  ['READY_TO_JOIN', 'Ready To Join'],
  ['INVITED', 'Invited'],
  ['JOINED', 'Joined'],
  ['LOST', 'Lost'],
];

const lostReasons = [
  'TOO_EXPENSIVE',
  'NO_VACANCY',
  'FOOD_CONCERN',
  'LOCATION',
  'PARENT_REJECTED',
  'JOINED_OTHER_HOSTEL',
  'NO_RESPONSE',
  'COLLEGE_CHANGED',
  'OTHER',
];

function statusTone(status: string) {
  if (status === 'JOINED') return 'bg-emerald-50 text-emerald-700';
  if (status === 'LOST') return 'bg-slate-100 text-slate-600';
  if (status === 'READY_TO_JOIN' || status === 'INVITED') return 'bg-orange-50 text-orange-700';
  if (status === 'INTERESTED' || status === 'FOLLOW_UP') return 'bg-cyan-50 text-cyan-700';
  return 'bg-muted text-muted-foreground';
}

function temperatureTone(temp: string) {
  if (temp === 'Hot') return 'bg-red-50 text-red-700';
  if (temp === 'Warm') return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-600';
}

function LeadCard({ lead, active, onClick }: { lead: any; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border bg-card p-3 text-left shadow-sm active:scale-[0.99] ${
        active ? 'border-accent ring-2 ring-accent/15' : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold">{lead.student_name}</h3>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" /> {lead.student_phone}
          </p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${temperatureTone(lead.lead_temperature)}`}>
          {lead.lead_temperature}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{lead.hostel?.name || 'Hostel'}</span>
        <span className="font-semibold">{lead.lead_score} pts</span>
      </div>
      {lead.parent_phone && (
        <p className="mt-2 rounded-lg bg-muted px-2 py-1 text-[11px] text-muted-foreground">
          Parent: {lead.parent_name || lead.parent_phone}
        </p>
      )}
    </button>
  );
}

function LeadDetail({ leadId, onClose }: { leadId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [email, setEmail] = useState('');
  const [roomId, setRoomId] = useState('');
  const [lostReason, setLostReason] = useState('NO_RESPONSE');

  const { data: lead, isLoading } = useQuery({
    queryKey: leadId ? queryKeys.admissions.detail(leadId) : ['admissions', 'empty'],
    queryFn: () => admissionsService.detail(leadId!),
    enabled: Boolean(leadId),
    staleTime: 30_000,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: lead?.hostel?.id ? queryKeys.rooms.list(lead.hostel.id, { admissions: true }) : ['rooms', 'empty'],
    queryFn: () => roomService.getAll(lead.hostel.id),
    enabled: Boolean(lead?.hostel?.id),
    staleTime: 60_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.admissions.all() });
    if (leadId) qc.invalidateQueries({ queryKey: queryKeys.admissions.detail(leadId) });
  };

  const updateStatus = useMutation({
    mutationFn: (payload: any) => admissionsService.updateStatus(leadId!, payload),
    onSuccess: () => {
      toast.success('Lead updated');
      invalidate();
    },
  });

  const addNote = useMutation({
    mutationFn: () => admissionsService.addNote(leadId!, note),
    onSuccess: () => {
      setNote('');
      toast.success('Note added');
      invalidate();
    },
  });

  const reserve = useMutation({
    mutationFn: () => admissionsService.reserveRoom(leadId!, { room_id: roomId }),
    onSuccess: () => {
      toast.success('Room reserved');
      invalidate();
    },
  });

  const convert = useMutation({
    mutationFn: () =>
      admissionsService.convertToInvitation(leadId!, {
        email: email || lead?.student_email,
        room_id: roomId,
      }),
    onSuccess: () => {
      toast.success('Invitation created');
      invalidate();
    },
  });

  if (!leadId) {
    return (
      <aside className="rounded-2xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">
        Select a lead to view the admission workspace.
      </aside>
    );
  }
  if (isLoading || !lead) {
    return <aside className="h-96 rounded-2xl border border-border bg-muted animate-pulse" />;
  }

  return (
    <aside className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div>
          <p className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${statusTone(lead.status)}`}>{lead.status.replaceAll('_', ' ')}</p>
          <h2 className="mt-2 text-xl font-black">{lead.student_name}</h2>
          <p className="text-sm text-muted-foreground">{lead.hostel?.name}</p>
        </div>
        <button type="button" onClick={onClose} className="md:hidden">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4 p-4">
        <section className="grid gap-2 text-sm">
          <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-accent" /> {lead.student_phone}</div>
          <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-accent" /> {lead.student_email || 'Email needed before invitation'}</div>
          <div className="flex items-center gap-2"><Users className="h-4 w-4 text-accent" /> Decision maker: {lead.decision_maker_type}</div>
          {lead.parent_phone && <div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-accent" /> Parent: {lead.parent_name || 'Parent'} · {lead.parent_phone}</div>}
        </section>

        <section className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-muted p-3">
            <Flame className="h-4 w-4 text-accent" />
            <b className="mt-1 block">{lead.lead_temperature}</b>
            <span className="text-[11px] text-muted-foreground">Temperature</span>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <ClipboardList className="h-4 w-4 text-accent" />
            <b className="mt-1 block">{lead.lead_score}</b>
            <span className="text-[11px] text-muted-foreground">Score</span>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <BedDouble className="h-4 w-4 text-accent" />
            <b className="mt-1 block">{lead.reservations?.filter((r: any) => r.status === 'ACTIVE').length || 0}</b>
            <span className="text-[11px] text-muted-foreground">Reservations</span>
          </div>
        </section>

        <section className="space-y-2">
          <label className="text-xs font-bold uppercase text-muted-foreground">Room for reservation or invitation</label>
          <select className="h-11 w-full rounded-xl border px-3 text-sm" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">Select room</option>
            {rooms.map((room: any) => (
              <option key={room.id} value={room.id}>Room {room.room_no} · {room.vacant_count ?? 0} beds open</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <button disabled={!roomId || reserve.isPending} onClick={() => reserve.mutate()} className="h-10 rounded-xl border border-border text-sm font-semibold disabled:opacity-50">
              Reserve bed
            </button>
            <button onClick={() => updateStatus.mutate({ status: 'READY_TO_JOIN' })} className="h-10 rounded-xl border border-border text-sm font-semibold">
              Ready to join
            </button>
          </div>
        </section>

        <section className="space-y-2 rounded-xl border border-border p-3">
          <h3 className="text-sm font-bold">Convert to invitation</h3>
          <input
            type="email"
            placeholder="Student email required"
            className="h-11 w-full rounded-xl border px-3 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            disabled={(!email && !lead.student_email) || !roomId || convert.isPending}
            onClick={() => convert.mutate()}
            className="h-11 w-full rounded-xl bg-accent text-sm font-bold text-accent-foreground disabled:opacity-50"
          >
            Send invitation
          </button>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-bold">Follow-up note</h3>
          <textarea className="min-h-20 w-full rounded-xl border p-3 text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Parent callback, pricing concern, visit context..." />
          <button disabled={!note.trim() || addNote.isPending} onClick={() => addNote.mutate()} className="h-10 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50">
            Add note
          </button>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-bold">Status actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => updateStatus.mutate({ status: 'FOLLOW_UP', parent_follow_up_required: true })} className="h-10 rounded-xl border border-border text-sm font-semibold">
              Parent follow-up
            </button>
            <button onClick={() => updateStatus.mutate({ status: 'INTERESTED' })} className="h-10 rounded-xl border border-border text-sm font-semibold">
              Mark interested
            </button>
          </div>
          <div className="flex gap-2">
            <select className="h-10 min-w-0 flex-1 rounded-xl border px-2 text-xs" value={lostReason} onChange={(e) => setLostReason(e.target.value)}>
              {lostReasons.map((reason) => <option key={reason} value={reason}>{reason.replaceAll('_', ' ')}</option>)}
            </select>
            <button onClick={() => updateStatus.mutate({ status: 'LOST', lost_reason: lostReason })} className="h-10 rounded-xl border border-border px-3 text-sm font-semibold">
              Mark lost
            </button>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-bold">Activity timeline</h3>
          <div className="mt-2 space-y-2">
            {(lead.activities || []).slice(0, 8).map((item: any) => (
              <div key={item.id} className="rounded-xl bg-muted p-2 text-xs">
                <b>{item.activity_type.replaceAll('_', ' ')}</b>
                <span className="ml-2 text-muted-foreground">{new Date(item.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}

export function AdmissionsView() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filters = useMemo(() => ({ status: status || undefined, search: search || undefined, limit: 50 }), [status, search]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.admissions.list(filters),
    queryFn: () => admissionsService.list(filters),
    staleTime: 30_000,
  });
  const { data: analytics } = useQuery({
    queryKey: queryKeys.admissions.analytics({}),
    queryFn: () => admissionsService.analytics({}),
    staleTime: 120_000,
  });

  const leads = data?.items || [];
  const grouped = useMemo(() => {
    const map = new Map(statuses.map(([key]) => [key, [] as any[]]));
    for (const lead of leads) {
      const bucket = map.get(lead.status) || [];
      bucket.push(lead);
      map.set(lead.status, bucket);
    }
    return map;
  }, [leads]);

  return (
    <div className="px-4 py-5 md:px-6 md:py-6">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-accent">Admissions CRM</p>
            <h1 className="text-2xl font-black tracking-normal">Convert visitors into tenants</h1>
          </div>
          <button onClick={() => refetch()} className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card">
            <RefreshCcw className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">Track students, parent decision makers, follow-ups, reservations, and invitation readiness.</p>
      </header>

      <section className="mt-4 grid grid-cols-3 gap-2">
        {[
          ['Visitors', analytics?.funnel?.visitors ?? 0],
          ['Viewed rooms', analytics?.funnel?.viewed_rooms ?? 0],
          ['Joined', analytics?.funnel?.joined ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-3">
            <b className="block text-lg">{value}</b>
            <span className="text-[11px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </section>

      <section className="mt-4 flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setStatus('')} className={`h-10 shrink-0 rounded-xl px-4 text-sm font-semibold ${!status ? 'bg-accent text-accent-foreground' : 'bg-card border border-border'}`}>
          All
        </button>
        {statuses.map(([key, label]) => (
          <button key={key} onClick={() => setStatus(key)} className={`h-10 shrink-0 rounded-xl px-4 text-sm font-semibold ${status === key ? 'bg-accent text-accent-foreground' : 'bg-card border border-border'}`}>
            {label}
          </button>
        ))}
      </section>

      <section className="mt-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, email" className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm" />
      </section>

      {isError && (
        <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          Could not load admissions leads.
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0">
          {isLoading ? (
            <div className="h-80 rounded-2xl bg-muted animate-pulse" />
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-3 lg:grid lg:grid-cols-3 xl:grid-cols-4">
              {(status ? statuses.filter(([key]) => key === status) : statuses).map(([key, label]) => {
                const items = grouped.get(key) || [];
                return (
                  <div key={key} className="w-[82vw] shrink-0 rounded-2xl border border-border bg-muted/40 p-3 md:w-80 lg:w-auto">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-sm font-bold">{label}</h2>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusTone(key)}`}>{items.length}</span>
                    </div>
                    <div className="space-y-2">
                      {items.map((lead: any) => (
                        <LeadCard key={lead.id} lead={lead} active={selectedId === lead.id} onClick={() => setSelectedId(lead.id)} />
                      ))}
                      {items.length === 0 && (
                        <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                          No leads here yet
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className={`${selectedId ? 'fixed inset-0 z-50 overflow-auto bg-background p-4 lg:static lg:block lg:p-0' : 'hidden lg:block'}`}>
          <LeadDetail leadId={selectedId} onClose={() => setSelectedId(null)} />
        </div>
      </div>
    </div>
  );
}
