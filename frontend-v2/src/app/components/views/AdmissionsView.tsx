import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Bed,
  Bell,
  Calendar,
  CheckCircle,
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Flame,
  Heart,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  QrCode,
  RefreshCw,
  Search,
  Share2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { admissionsService } from '@features/admissions/api';
import { ownerService } from '@features/owners/api';
import { roomService } from '@features/rooms/api';
import { queryKeys } from '@lib/queryKeys';
import { QrCodeImage } from '@/portal/components/QrCodeImage';
import { toast } from 'sonner';

type AdmissionsScreen = 'dashboard' | 'pipeline' | 'qr';

const stages = [
  { status: 'NEW', label: 'NEW', shortLabel: 'New', color: 'var(--neutral-gray)' },
  { status: 'INTERESTED', label: 'INTERESTED', shortLabel: 'Int', color: 'var(--brand-saffron)' },
  { status: 'FOLLOW_UP', label: 'FOLLOW UP', shortLabel: 'Follow', color: 'var(--alert-amber)' },
  { status: 'READY_TO_JOIN', label: 'READY TO JOIN', shortLabel: 'Ready', color: 'var(--success-green)' },
  { status: 'INVITED', label: 'INVITED', shortLabel: 'Inv', color: 'var(--brand-navy)' },
  { status: 'JOINED', label: 'JOINED', shortLabel: 'Join', color: 'var(--success-green)' },
  { status: 'LOST', label: 'LOST', shortLabel: 'Lost', color: 'var(--danger-red)' },
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

function readHostels(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.hostels)) return payload.data.hostels;
  if (Array.isArray(payload?.hostels)) return payload.hostels;
  return [];
}

function statusColor(status: string) {
  return stages.find((stage) => stage.status === status)?.color || 'var(--neutral-gray)';
}

function initials(name?: string) {
  return String(name || 'Lead')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function timeAgo(value?: string | Date | null) {
  if (!value) return 'No activity yet';
  const then = new Date(value).getTime();
  const diff = Math.max(Date.now() - then, 0);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function phoneHref(phone?: string | null) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `tel:${digits}` : '#';
}

function whatsAppHref(phone?: string | null, message?: string) {
  const digits = String(phone || '').replace(/\D/g, '');
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return digits ? `https://wa.me/${digits}${text}` : '#';
}

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

async function downloadAdmissionQr(value: string, hostelName?: string | null) {
  if (!value) {
    toast.error('QR link is not ready yet');
    return;
  }

  const safeName = String(hostelName || 'admission-qr')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'admission-qr';

  try {
    const blob = await admissionsService.downloadQrImage(value);
    downloadBlob(blob, `${safeName}-admission-qr.png`);
    toast.success('Admission QR downloaded');
  } catch {
    toast.error('Could not download QR');
  }
}

function LeadCard({ lead, onOpen }: { lead: any; onOpen: () => void }) {
  const interestedRooms = (lead.reservations || []).map((reservation: any) => reservation.room?.room_no).filter(Boolean);
  return (
    <button type="button" onClick={onOpen} className="w-full rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-black/5 active:scale-[0.98] md:p-4">
      <div className="mb-2 md:mb-3">
        <div className="flex items-start justify-between gap-3">
          <h4 className="truncate font-semibold text-[var(--deep-charcoal)]">{lead.student_name}</h4>
          <span className="rounded-full px-2 py-1 text-[10px] font-bold text-white" style={{ backgroundColor: statusColor(lead.status) }}>
            {lead.lead_temperature}
          </span>
        </div>
        <p className="mt-1 font-mono text-xs text-[var(--neutral-gray)]">{lead.student_phone}</p>
      </div>

      <div className="mb-2 grid grid-cols-2 gap-2 text-xs md:mb-3 md:block md:space-y-1">
        <div className="flex items-center gap-2 text-[var(--neutral-gray)]">
          <Eye className="h-3 w-3" />
          <span>{lead._count?.activities || lead.activities?.length || 0} activities</span>
        </div>
        <div className="flex items-center gap-2 text-[var(--neutral-gray)] md:hidden">
          <Calendar className="h-3 w-3" />
          <span>{timeAgo(lead.last_activity_at)}</span>
        </div>
        {interestedRooms.length > 0 && (
          <div className="col-span-2 flex items-center gap-2 font-medium text-[var(--brand-saffron)]">
            <Heart className="h-3 w-3" />
            <span>Reserved: {interestedRooms.join(', ')}</span>
          </div>
        )}
      </div>

      <div className="mb-3 hidden items-center gap-2 text-xs text-[var(--neutral-gray)] md:flex">
        <Calendar className="h-3 w-3" />
        <span>{timeAgo(lead.last_activity_at)}</span>
      </div>

      <div className="flex gap-2">
        <a href={phoneHref(lead.student_phone)} onClick={(event) => event.stopPropagation()} className="flex h-8 flex-1 items-center justify-center rounded-xl border border-[var(--border)] text-xs font-medium">
          <Phone className="mr-1 h-3 w-3" /> Call
        </a>
        <a href={whatsAppHref(lead.student_phone)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="flex h-8 flex-1 items-center justify-center rounded-xl border border-[var(--border)] text-xs font-medium">
          <MessageCircle className="mr-1 h-3 w-3" /> WhatsApp
        </a>
      </div>
    </button>
  );
}

function AdmissionQrPanel({ compact = false }: { compact?: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.owner.hostels(),
    queryFn: ownerService.getHostels,
    staleTime: 5 * 60 * 1000,
  });

  const hostels = readHostels(data).filter((hostel: any) => hostel.admissions_enabled !== false);
  const [selectedHostelId, setSelectedHostelId] = useState('');
  const selected = hostels.find((hostel: any) => String(hostel.id) === selectedHostelId) || hostels[0];
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = selected?.public_slug ? `${origin}/visit/${selected.public_slug}` : '';

  const copyLink = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Admission QR link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  if (isLoading) return <div className="h-40 rounded-2xl bg-white/70 animate-pulse" />;
  if (!hostels.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white p-5">
        <h2 className="font-semibold text-[var(--brand-navy)]">QR Code Generator</h2>
        <p className="mt-1 text-sm text-[var(--neutral-gray)]">Enable admissions on a hostel to generate QR links.</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-[var(--brand-navy)]">Admission QR</h2>
            <p className="mt-1 text-sm text-[var(--neutral-gray)]">Download or share the visit link.</p>
          </div>
          <QrCode className="h-5 w-5 text-[var(--brand-saffron)]" />
        </div>
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
          {hostels.map((hostel: any) => {
            const itemUrl = hostel.public_slug ? `${origin}/visit/${hostel.public_slug}` : '';
            return (
              <div key={hostel.id} className="w-40 shrink-0 rounded-xl border border-[var(--border)] p-3">
                <div className="mx-auto w-24">
                  <QrCodeImage value={itemUrl} size={160} alt={`${hostel.name} admission QR`} />
                </div>
                <h3 className="mt-2 truncate text-sm font-bold text-[var(--deep-charcoal)]">{hostel.name}</h3>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => copyLink(itemUrl)} className="h-9 rounded-lg border border-[var(--border)] text-xs font-medium">
                    Copy
                  </button>
                  <button type="button" onClick={() => downloadAdmissionQr(itemUrl, hostel.name)} className="h-9 rounded-lg border border-[var(--border)] text-xs font-medium">
                    Save
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-20 lg:pb-6">
      <div className="bg-[var(--brand-navy)] px-6 py-6 text-white">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-2xl font-bold">QR Code Generator</h1>
          <p className="mt-1 text-sm text-white/70">Generate visitor QR codes for your hostels.</p>
        </div>
      </div>
      <div className="mx-auto grid max-w-4xl gap-6 px-6 py-8 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-6 text-lg font-semibold text-[var(--brand-navy)]">Configure QR Code</h2>
          <label className="mb-2 block text-sm font-medium text-[var(--deep-charcoal)]">Select Hostel</label>
          <select value={selected?.id || ''} onChange={(event) => setSelectedHostelId(event.target.value)} className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--warm-ivory)] px-3">
            {hostels.map((hostel: any) => <option key={hostel.id} value={hostel.id}>{hostel.name}</option>)}
          </select>
          <label className="mb-2 mt-6 block text-sm font-medium text-[var(--deep-charcoal)]">Generated URL</label>
          <code className="block break-all rounded-lg border border-[var(--border)] bg-[var(--warm-ivory)] p-3 text-sm text-[var(--brand-navy)]">{url || 'Slug missing'}</code>
          <div className="mt-6 space-y-3">
            <button type="button" onClick={() => copyLink(url)} disabled={!url} className="flex h-12 w-full items-center justify-start rounded-xl bg-[var(--brand-saffron)] px-4 font-semibold text-white disabled:opacity-50">
              <Copy className="mr-3 h-5 w-5" /> Copy QR Link
            </button>
            <button type="button" onClick={() => downloadAdmissionQr(url, selected?.name)} disabled={!url} className="flex h-12 w-full items-center justify-start rounded-xl border-2 border-[var(--border)] px-4 font-semibold disabled:opacity-50">
              <Download className="mr-3 h-5 w-5" /> Download QR
            </button>
          </div>
        </section>
        <section className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5">
          <h3 className="mb-6 text-center text-lg font-semibold text-[var(--brand-navy)]">QR Code Preview</h3>
          <div className="mx-auto max-w-xs rounded-2xl border-4 border-[var(--brand-navy)] bg-white p-8">
            <QrCodeImage value={url} size={260} alt={`${selected?.name || 'Hostel'} admission QR`} />
          </div>
          <div className="mt-5 text-center">
            <h2 className="text-2xl font-bold text-[var(--brand-navy)]" style={{ fontFamily: 'var(--font-hero)' }}>Sri Adithya</h2>
            <p className="mt-2 font-medium text-[var(--neutral-gray)]">{selected?.name}</p>
            <p className="mt-2 text-sm text-[var(--neutral-gray)]">Scan to explore rooms and facilities.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function DashboardOverview({
  analytics,
  leads,
  onViewPipeline,
  onGenerateQr,
}: {
  analytics: any;
  leads: any[];
  onViewPipeline: () => void;
  onGenerateQr: () => void;
}) {
  const funnel = analytics?.funnel || {};
  const kpis = [
    { label: "Today's Visitors", value: funnel.visitors ?? leads.length, color: 'var(--brand-saffron)', icon: Eye },
    { label: 'Interested Leads', value: funnel.interested ?? leads.filter((lead) => ['INTERESTED', 'FOLLOW_UP', 'READY_TO_JOIN'].includes(lead.status)).length, color: 'var(--brand-saffron)', icon: Heart },
    { label: 'Ready to Join', value: leads.filter((lead) => lead.status === 'READY_TO_JOIN').length, color: 'var(--success-green)', icon: UserCheck },
    { label: 'Joined This Month', value: funnel.joined ?? 0, color: 'var(--brand-navy)', icon: Users },
  ];
  const funnelStages = [
    { stage: 'Visitors', count: Number(funnel.visitors || 0), color: 'var(--brand-navy)' },
    { stage: 'Viewed Rooms', count: Number(funnel.viewed_rooms || 0), color: 'var(--brand-saffron)' },
    { stage: 'Interested', count: Number(funnel.interested || 0), color: 'var(--brand-saffron)' },
    { stage: 'Reserved', count: Number(funnel.reserved || 0), color: 'var(--alert-amber)' },
    { stage: 'Invited', count: Number(funnel.invited || 0), color: 'var(--success-green)' },
    { stage: 'Joined', count: Number(funnel.joined || 0), color: 'var(--success-green)' },
  ];
  const maxCount = Math.max(...funnelStages.map((stage) => stage.count), 1);
  const recent = leads.slice(0, 6);

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <div className="bg-[var(--brand-navy)] px-5 py-5 text-white md:px-6 md:py-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between gap-4 md:mb-6">
            <div>
              <h1 className="text-2xl font-bold leading-tight">Admissions Dashboard</h1>
              <p className="mt-1 text-sm text-white/70">Visitor-to-tenant pipeline for Sri Adithya HMS.</p>
            </div>
            <button type="button" className="hidden rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white md:flex">
              <Bell className="mr-2 h-4 w-4" /> Notifications
            </button>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-5 py-5 md:px-6 md:py-6">
        <div className="mb-5 grid grid-cols-2 gap-3 md:mb-6 md:grid-cols-2 md:gap-4 lg:grid-cols-4">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="aspect-square rounded-2xl border-l-4 bg-white p-3 shadow-sm ring-1 ring-black/5 md:aspect-auto md:p-4" style={{ borderLeftColor: kpi.color }}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="text-xs leading-snug text-[var(--neutral-gray)] md:text-sm">{kpi.label}</span>
                  <Icon className="h-4 w-4 shrink-0 md:h-5 md:w-5" style={{ color: kpi.color }} />
                </div>
                <div className="text-3xl font-bold md:text-3xl" style={{ color: kpi.color, fontFamily: 'var(--font-mono)' }}>{kpi.value}</div>
              </div>
            );
          })}
        </div>

        <section className="mb-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 md:mb-6 md:p-6">
          <h2 className="mb-3 text-lg font-semibold text-[var(--brand-navy)] md:mb-4">Admission Funnel</h2>
          <div className="space-y-2.5 md:space-y-3">
            {funnelStages.map((stage) => {
              const width = Math.max((stage.count / maxCount) * 100, stage.count > 0 ? 8 : 0);
              return (
                <div key={stage.stage}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-[var(--deep-charcoal)]">{stage.stage}</span>
                    <span className="font-mono font-semibold" style={{ color: stage.color }}>{stage.count}</span>
                  </div>
                  <div className="h-6 overflow-hidden rounded-lg bg-gray-100 md:h-8">
                    <div className="flex h-full items-center justify-end pr-3 text-xs font-semibold text-white" style={{ width: `${width}%`, backgroundColor: stage.color }}>
                      {stage.count > 0 && `${Math.round((stage.count / maxCount) * 100)}%`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 md:p-6">
            <h2 className="mb-4 text-lg font-semibold text-[var(--brand-navy)]">Recent Activity</h2>
            <div className="max-h-96 space-y-3 overflow-y-auto">
              {recent.map((lead) => (
                <button key={lead.id} type="button" onClick={onViewPipeline} className="flex w-full items-start gap-3 rounded-lg p-3 text-left hover:bg-[var(--warm-ivory)]">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--brand-saffron)]/20 to-[var(--brand-navy)]/20 text-sm font-semibold text-[var(--brand-navy)]">{initials(lead.student_name)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--deep-charcoal)]"><b>{lead.student_name}</b> is in {lead.status.replaceAll('_', ' ').toLowerCase()}</p>
                    <p className="mt-1 text-xs text-[var(--neutral-gray)]">{timeAgo(lead.last_activity_at)}</p>
                  </div>
                  <Heart className="h-4 w-4 text-[var(--brand-saffron)]" />
                </button>
              ))}
              {recent.length === 0 && <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-center text-sm text-[var(--neutral-gray)]">No admissions activity yet.</p>}
            </div>
          </section>
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 md:p-6">
            <h2 className="mb-4 text-lg font-semibold text-[var(--brand-navy)]">Quick Actions</h2>
            <div className="space-y-3">
              <button type="button" onClick={onViewPipeline} className="flex h-12 w-full items-center justify-start rounded-xl bg-[var(--brand-saffron)] px-4 font-semibold text-white">
                <Users className="mr-3 h-5 w-5" /> View All Leads
              </button>
              <button type="button" onClick={onGenerateQr} className="flex h-12 w-full items-center justify-start rounded-xl border-2 border-[var(--border)] px-4 font-semibold">
                <QrCode className="mr-3 h-5 w-5" /> Generate QR Code
              </button>
              <button type="button" onClick={onViewPipeline} className="flex h-12 w-full items-center justify-start rounded-xl border-2 border-[var(--border)] px-4 font-semibold">
                <Phone className="mr-3 h-5 w-5" /> Follow-up Calls
              </button>
            </div>
            <div className="mt-6 border-t border-[var(--border)] pt-6">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-[var(--success-green)]" style={{ fontFamily: 'var(--font-mono)' }}>{analytics?.conversion_rate ?? 0}%</div>
                  <div className="mt-1 text-xs text-[var(--neutral-gray)]">Conversion Rate</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[var(--brand-saffron)]" style={{ fontFamily: 'var(--font-mono)' }}>{leads.filter((lead) => lead.parent_follow_up_required).length}</div>
                  <div className="mt-1 text-xs text-[var(--neutral-gray)]">Parent Follow-ups</div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-6">
          <AdmissionQrPanel compact />
        </div>
      </div>
    </div>
  );
}

function LeadProfile({ leadId, onBack }: { leadId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [email, setEmail] = useState('');
  const [roomId, setRoomId] = useState('');
  const [lostReason, setLostReason] = useState('NO_RESPONSE');

  const { data: lead, isLoading } = useQuery({
    queryKey: queryKeys.admissions.detail(leadId),
    queryFn: () => admissionsService.detail(leadId),
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
    qc.invalidateQueries({ queryKey: queryKeys.admissions.detail(leadId) });
  };

  const updateStatus = useMutation({
    mutationFn: (payload: any) => admissionsService.updateStatus(leadId, payload),
    onSuccess: () => {
      toast.success('Lead updated');
      invalidate();
    },
  });

  const addNote = useMutation({
    mutationFn: () => admissionsService.addNote(leadId, note),
    onSuccess: () => {
      setNote('');
      toast.success('Note added');
      invalidate();
    },
  });

  const reserve = useMutation({
    mutationFn: () => admissionsService.reserveRoom(leadId, { room_id: roomId }),
    onSuccess: () => {
      toast.success('Room reserved');
      invalidate();
    },
  });

  const convert = useMutation({
    mutationFn: () => admissionsService.convertToInvitation(leadId, { email: email || lead?.student_email, room_id: roomId }),
    onSuccess: () => {
      toast.success('Invitation created');
      invalidate();
    },
  });

  if (isLoading || !lead) {
    return <div className="min-h-screen bg-[#F5F5F7] p-6"><div className="h-96 rounded-2xl bg-white animate-pulse" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-20 lg:pb-6">
      <div className="bg-[var(--brand-navy)] px-6 py-6 text-white">
        <div className="mx-auto max-w-7xl">
          <button type="button" onClick={onBack} className="mb-4 flex items-center gap-2 text-white/70 hover:text-white">
            <ArrowLeft className="h-5 w-5" /> Back to Pipeline
          </button>
          <h1 className="text-2xl font-bold">Lead Profile</h1>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="mb-6 flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-[var(--brand-saffron)]/20 to-[var(--brand-navy)]/20 text-xl font-bold text-[var(--brand-navy)]">
                {initials(lead.student_name)}
              </div>
              <div>
                <h2 className="text-xl font-bold text-[var(--deep-charcoal)]">{lead.student_name}</h2>
                <p className="text-sm text-[var(--neutral-gray)]">Lead #{String(lead.id).slice(0, 8)}</p>
              </div>
            </div>
            <div className="space-y-4">
              <InfoLine icon={Phone} label="Student Phone" value={lead.student_phone} />
              <InfoLine icon={Mail} label="Student Email" value={lead.student_email || 'Needed before invitation'} />
              {lead.parent_phone && <InfoLine icon={Phone} label="Parent Phone" value={`${lead.parent_name || 'Parent'} · ${lead.parent_phone}`} />}
              <InfoLine icon={MapPin} label="Source" value={`${lead.source || 'QR'} · ${lead.hostel?.name || 'Hostel'}`} />
              <InfoLine icon={Calendar} label="Created At" value={new Date(lead.created_at).toLocaleString()} />
              <span className="inline-flex rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: statusColor(lead.status) }}>{lead.status.replaceAll('_', ' ')}</span>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <h3 className="mb-4 font-semibold text-[var(--brand-navy)]">Quick Actions</h3>
            <div className="space-y-3">
              <a href={phoneHref(lead.student_phone)} className="flex h-11 w-full items-center justify-start rounded-xl bg-[var(--brand-navy)] px-4 font-semibold text-white">
                <Phone className="mr-3 h-4 w-4" /> Call Student
              </a>
              <a href={whatsAppHref(lead.student_phone)} target="_blank" rel="noreferrer" className="flex h-11 w-full items-center justify-start rounded-xl bg-[var(--success-green)] px-4 font-semibold text-white">
                <MessageCircle className="mr-3 h-4 w-4" /> WhatsApp Student
              </a>
              {lead.parent_phone && (
                <a href={whatsAppHref(lead.parent_phone)} target="_blank" rel="noreferrer" className="flex h-11 w-full items-center justify-start rounded-xl border border-[var(--border)] px-4 font-semibold">
                  <Users className="mr-3 h-4 w-4" /> WhatsApp Parent
                </a>
              )}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <h3 className="mb-4 font-semibold text-[var(--brand-navy)]">Admission Actions</h3>
            <select className="mb-3 h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm" value={roomId} onChange={(event) => setRoomId(event.target.value)}>
              <option value="">Select room</option>
              {rooms.map((room: any) => <option key={room.id} value={room.id}>Room {room.room_no} · {room.vacant_count ?? 0} beds open</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={!roomId || reserve.isPending} onClick={() => reserve.mutate()} className="h-10 rounded-xl border border-[var(--border)] text-sm font-semibold disabled:opacity-50">Reserve</button>
              <button type="button" onClick={() => updateStatus.mutate({ status: 'READY_TO_JOIN' })} className="h-10 rounded-xl border border-[var(--border)] text-sm font-semibold">Ready</button>
            </div>
            <input type="email" placeholder="Student email required" className="mt-3 h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm" value={email} onChange={(event) => setEmail(event.target.value)} />
            <button type="button" disabled={(!email && !lead.student_email) || !roomId || convert.isPending} onClick={() => convert.mutate()} className="mt-3 h-11 w-full rounded-xl bg-[var(--brand-saffron)] text-sm font-bold text-white disabled:opacity-50">
              Send invitation
            </button>
          </section>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <h3 className="mb-6 text-lg font-semibold text-[var(--brand-navy)]">Activity Timeline</h3>
            <div className="space-y-5">
              {(lead.activities || []).map((activity: any, index: number) => (
                <div key={activity.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="grid h-10 w-10 place-items-center rounded-full border-2 border-white bg-[var(--warm-ivory)] shadow-sm">
                      {activity.activity_type === 'MARK_INTEREST' || activity.activity_type === 'REQUEST_JOIN' ? <Heart className="h-5 w-5 text-[var(--brand-saffron)]" /> : <Eye className="h-5 w-5 text-[var(--brand-navy)]" />}
                    </div>
                    {index < (lead.activities || []).length - 1 && <div className="mt-2 min-h-10 w-0.5 flex-1 bg-[var(--border)]" />}
                  </div>
                  <div className="flex-1 pb-5">
                    <div className="rounded-lg bg-[var(--warm-ivory)] p-4">
                      <p className="font-medium text-[var(--deep-charcoal)]">{activity.activity_type.replaceAll('_', ' ')}</p>
                      <p className="mt-2 text-xs text-[var(--neutral-gray)]">{new Date(activity.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
              {(lead.activities || []).length === 0 && <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-center text-sm text-[var(--neutral-gray)]">No activity yet.</p>}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <h3 className="mb-3 font-semibold text-[var(--brand-navy)]">Follow-up note</h3>
              <textarea className="min-h-24 w-full rounded-xl border border-[var(--border)] p-3 text-sm" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Parent callback, pricing concern, visit context..." />
              <button type="button" disabled={!note.trim() || addNote.isPending} onClick={() => addNote.mutate()} className="mt-3 h-10 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold disabled:opacity-50">Add note</button>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <h3 className="mb-3 font-semibold text-[var(--brand-navy)]">Status</h3>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => updateStatus.mutate({ status: 'FOLLOW_UP', parent_follow_up_required: true })} className="h-10 rounded-xl border border-[var(--border)] text-sm font-semibold">Parent follow-up</button>
                <button type="button" onClick={() => updateStatus.mutate({ status: 'INTERESTED' })} className="h-10 rounded-xl border border-[var(--border)] text-sm font-semibold">Interested</button>
              </div>
              <div className="mt-2 flex gap-2">
                <select className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--border)] px-2 text-xs" value={lostReason} onChange={(event) => setLostReason(event.target.value)}>
                  {lostReasons.map((reason) => <option key={reason} value={reason}>{reason.replaceAll('_', ' ')}</option>)}
                </select>
                <button type="button" onClick={() => updateStatus.mutate({ status: 'LOST', lost_reason: lostReason })} className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm font-semibold">Lost</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function InfoLine({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-[var(--neutral-gray)]">{label}</label>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[var(--brand-navy)]" />
        <span className="text-sm">{value}</span>
      </div>
    </div>
  );
}

function LeadPipeline({
  leads,
  isLoading,
  search,
  setSearch,
  activeStatus,
  setActiveStatus,
  onViewLead,
}: {
  leads: any[];
  isLoading: boolean;
  search: string;
  setSearch: (value: string) => void;
  activeStatus: string;
  setActiveStatus: (value: string) => void;
  onViewLead: (id: string) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map(stages.map((stage) => [stage.status, [] as any[]]));
    for (const lead of leads) {
      const bucket = map.get(lead.status) || [];
      bucket.push(lead);
      map.set(lead.status, bucket);
    }
    return map;
  }, [leads]);
  const activeLeads = activeStatus ? grouped.get(activeStatus) || [] : leads;

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-20 lg:pb-6">
      <div className="bg-[var(--brand-navy)] px-5 py-5 text-white md:px-6 md:py-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold leading-tight">Lead Pipeline</h1>
          <p className="mt-1 text-sm text-white/70">Track and manage all admissions leads.</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-4 md:px-6 md:py-5">
        <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-black/5">
          <Search className="h-4 w-4 text-[var(--neutral-gray)]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, phone, email" className="h-9 flex-1 bg-transparent text-sm outline-none" />
        </div>
      </div>

      <div className="hidden px-6 lg:block">
        <div className="mx-auto flex max-w-7xl gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const items = grouped.get(stage.status) || [];
            return (
              <div key={stage.status} className="w-80 shrink-0">
                <div className="mb-3 flex items-center justify-between rounded-t-lg p-3" style={{ backgroundColor: stage.color }}>
                  <h3 className="text-sm font-semibold text-white">{stage.label}</h3>
                  <span className="rounded-full bg-white/20 px-2 py-1 text-xs font-bold text-white">{items.length}</span>
                </div>
                <div className="max-h-[calc(100vh-270px)] space-y-3 overflow-y-auto pr-1">
                  {items.map((lead) => <LeadCard key={lead.id} lead={lead} onOpen={() => onViewLead(lead.id)} />)}
                  {!isLoading && items.length === 0 && <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-center text-sm text-[var(--neutral-gray)]">No leads here yet.</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="lg:hidden">
        <div className="sticky top-0 z-10 overflow-x-auto border-b border-[var(--border)] bg-white scrollbar-hide">
          <div className="flex gap-2 px-5 py-3">
            <button type="button" onClick={() => setActiveStatus('')} className={`grid h-12 w-14 shrink-0 place-items-center rounded-2xl text-[11px] font-bold leading-tight ${!activeStatus ? 'bg-[var(--brand-saffron)] text-white' : 'bg-gray-100 text-[var(--neutral-gray)]'}`}>
              <span>All</span>
              <span>({leads.length})</span>
            </button>
            {stages.map((stage) => {
              const count = grouped.get(stage.status)?.length || 0;
              return (
                <button key={stage.status} type="button" onClick={() => setActiveStatus(stage.status)} className="grid h-12 w-16 shrink-0 place-items-center rounded-2xl text-[11px] font-bold leading-tight" style={{ backgroundColor: activeStatus === stage.status ? stage.color : '#f3f4f6', color: activeStatus === stage.status ? '#fff' : 'var(--neutral-gray)' }}>
                  <span>{stage.shortLabel}</span>
                  <span>({count})</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-3 px-5 py-4">
          {activeLeads.map((lead) => <LeadCard key={lead.id} lead={lead} onOpen={() => onViewLead(lead.id)} />)}
          {!isLoading && activeLeads.length === 0 && <p className="rounded-xl border border-dashed border-[var(--border)] bg-white p-4 text-center text-sm text-[var(--neutral-gray)]">No leads here yet.</p>}
        </div>
      </div>
    </div>
  );
}

export function AdmissionsView() {
  const [screen, setScreen] = useState<AdmissionsScreen>('dashboard');
  const [activeStatus, setActiveStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filters = useMemo(() => ({ status: activeStatus || undefined, search: search || undefined, limit: 50 }), [activeStatus, search]);

  const { data, isLoading, refetch } = useQuery({
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

  if (selectedId) {
    return <LeadProfile leadId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div>
      <div className="sticky top-0 z-20 border-b border-[var(--border)] bg-white/95 px-3 py-3 backdrop-blur md:px-6">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_1fr_1fr_auto] items-center gap-2 md:flex md:overflow-x-auto md:scrollbar-hide">
          {[
            ['dashboard', 'Dashboard', Users],
            ['pipeline', 'Pipeline', ClipboardList],
            ['qr', 'QR Generator', QrCode],
          ].map(([key, label, Icon]: any) => (
            <button
              key={key}
              type="button"
              onClick={() => setScreen(key)}
              className={`flex h-9 min-w-0 items-center justify-center gap-1 rounded-2xl px-2 text-xs font-semibold md:h-10 md:shrink-0 md:gap-2 md:px-4 md:text-sm ${screen === key ? 'bg-[var(--brand-saffron)] text-white' : 'bg-[var(--warm-ivory)] text-[var(--brand-navy)]'}`}
            >
              <Icon className="h-4 w-4 shrink-0" /> <span className="truncate">{key === 'qr' ? 'QR' : label}</span>
            </button>
          ))}
          <button type="button" onClick={() => refetch()} className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-[var(--border)] md:ml-auto md:h-10 md:w-10">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {screen === 'dashboard' && (
        <DashboardOverview analytics={analytics} leads={leads} onViewPipeline={() => setScreen('pipeline')} onGenerateQr={() => setScreen('qr')} />
      )}
      {screen === 'pipeline' && (
        <LeadPipeline
          leads={leads}
          isLoading={isLoading}
          search={search}
          setSearch={setSearch}
          activeStatus={activeStatus}
          setActiveStatus={setActiveStatus}
          onViewLead={setSelectedId}
        />
      )}
      {screen === 'qr' && <AdmissionQrPanel />}
    </div>
  );
}
