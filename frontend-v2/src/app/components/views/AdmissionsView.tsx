import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Bed,
  Bell,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
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
  { status: 'NEW', label: 'New Leads', shortLabel: 'New Leads', color: 'var(--neutral-gray)' },
  { status: 'INTERESTED', label: 'Interested', shortLabel: 'Interested', color: 'var(--brand-saffron)' },
  { status: 'FOLLOW_UP', label: 'Follow Up Queue', shortLabel: 'Follow Up', color: 'var(--alert-amber)' },
  { status: 'READY_TO_JOIN', label: 'Ready to Join', shortLabel: 'Ready to Join', color: 'var(--success-green)' },
  { status: 'INVITED', label: 'Invited', shortLabel: 'Invited', color: 'var(--brand-navy)' },
  { status: 'JOINED', label: 'Joined Tenants', shortLabel: 'Joined', color: 'var(--success-green)' },
  { status: 'LOST', label: 'Lost Opportunities', shortLabel: 'Lost', color: 'var(--danger-red)' },
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
  
  // Delay revocation to ensure the browser has enough time to download the file with the suggested filename.
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 250);
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
    
    // Check if the returned blob is actually an error in JSON format
    if (blob.type && blob.type.includes('application/json')) {
      const text = await blob.text();
      let detail = 'Could not download QR';
      try {
        const parsed = JSON.parse(text);
        detail = parsed?.error?.message || parsed?.detail || parsed?.error || text;
      } catch {}
      toast.error(detail);
      return;
    }

    downloadBlob(blob, `${safeName}-admission-qr.png`);
    toast.success('Admission QR downloaded');
  } catch (error) {
    console.error('QR download error:', error);
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

function AddWalkInLeadModal({
  isOpen,
  onClose,
  hostels,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  hostels: any[];
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    student_name: '',
    student_phone: '',
    student_email: '',
    parent_name: '',
    parent_phone: '',
    hostel_id: '',
    source: '',
    status: 'NEW',
  });

  // Set default hostel id when hostels load
  useState(() => {
    if (hostels.length > 0) {
      setFormData((prev) => ({ ...prev, hostel_id: String(hostels[0].id) }));
    }
  });

  const createLead = useMutation({
    mutationFn: (payload: any) => admissionsService.createDirect(payload),
    onSuccess: () => {
      toast.success('Lead created successfully');
      onSuccess();
      onClose();
      // Reset form
      setFormData({
        student_name: '',
        student_phone: '',
        student_email: '',
        parent_name: '',
        parent_phone: '',
        hostel_id: hostels.length > 0 ? String(hostels[0].id) : '',
        source: '',
        status: 'NEW',
      });
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to create lead');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <h2 className="text-xl font-bold text-[var(--brand-navy)]">Add Walk-In Lead</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-6 w-6" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!formData.source) {
              toast.error('Please select a Lead Source');
              return;
            }
            createLead.mutate(formData);
          }}
          className="p-6 space-y-4 max-h-[80vh] overflow-y-auto"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-550 mb-1 text-gray-500">Student Name *</label>
              <input
                required
                type="text"
                value={formData.student_name}
                onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                className="w-full h-11 rounded-xl border border-gray-200 px-3 text-sm focus:border-[var(--brand-saffron)] focus:outline-none"
                placeholder="Student Name"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-550 mb-1 text-gray-500">Student Phone *</label>
              <input
                required
                type="tel"
                value={formData.student_phone}
                onChange={(e) => setFormData({ ...formData, student_phone: e.target.value })}
                className="w-full h-11 rounded-xl border border-gray-200 px-3 text-sm focus:border-[var(--brand-saffron)] focus:outline-none"
                placeholder="Phone (e.g. 9876543210)"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-550 mb-1 text-gray-500">Student Email (Optional)</label>
            <input
              type="email"
              value={formData.student_email}
              onChange={(e) => setFormData({ ...formData, student_email: e.target.value })}
              className="w-full h-11 rounded-xl border border-gray-200 px-3 text-sm focus:border-[var(--brand-saffron)] focus:outline-none"
              placeholder="email@example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-550 mb-1 text-gray-500">Parent Name (Optional)</label>
              <input
                type="text"
                value={formData.parent_name}
                onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                className="w-full h-11 rounded-xl border border-gray-200 px-3 text-sm focus:border-[var(--brand-saffron)] focus:outline-none"
                placeholder="Parent Name"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-550 mb-1 text-gray-500">Parent Phone (Optional)</label>
              <input
                type="tel"
                value={formData.parent_phone}
                onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                className="w-full h-11 rounded-xl border border-gray-200 px-3 text-sm focus:border-[var(--brand-saffron)] focus:outline-none"
                placeholder="Parent Phone"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-550 mb-1 text-gray-500">Select Hostel *</label>
            <select
              required
              value={formData.hostel_id}
              onChange={(e) => setFormData({ ...formData, hostel_id: e.target.value })}
              className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:border-[var(--brand-saffron)] focus:outline-none"
            >
              <option value="">-- Choose Hostel --</option>
              {hostels.map((hostel) => (
                <option key={hostel.id} value={hostel.id}>
                  {hostel.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-550 mb-1 text-gray-500">Lead Source *</label>
              <select
                required
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:border-[var(--brand-saffron)] focus:outline-none"
              >
                <option value="">-- Select Channel --</option>
                <option value="Walk-In">Walk-In</option>
                <option value="Google">Google</option>
                <option value="Referral">Referral</option>
                <option value="Instagram">Instagram</option>
                <option value="Offline Banner">Offline Banner</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-550 mb-1 text-gray-500">Initial Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:border-[var(--brand-saffron)] focus:outline-none"
              >
                <option value="NEW">New</option>
                <option value="INTERESTED">Interested</option>
                <option value="FOLLOW_UP">Follow Up</option>
                <option value="READY_TO_JOIN">Ready to Join</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl border border-gray-200 font-semibold text-gray-600 hover:bg-gray-55"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLead.isPending}
              className="flex-1 h-11 rounded-xl bg-[var(--brand-saffron)] font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {createLead.isPending ? 'Adding...' : 'Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FollowUpQueue({
  queue,
  onViewLead,
  vacantBeds = 0,
  onAddWalkIn,
  onGenerateQr,
}: {
  queue: any[];
  onViewLead: (id: string) => void;
  vacantBeds?: number;
  onAddWalkIn?: () => void;
  onGenerateQr?: () => void;
}) {
  const qc = useQueryClient();
  const [lostLeadId, setLostLeadId] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState('NO_RESPONSE');

  const snoozeLead = useMutation({
    mutationFn: async (leadId: string) => {
      await admissionsService.addNote(leadId, 'Snoozed follow-up for 3 days');
      await admissionsService.updateStatus(leadId, { parent_follow_up_required: false });
    },
    onSuccess: () => {
      toast.success('Lead follow-up snoozed');
      qc.invalidateQueries({ queryKey: queryKeys.admissions.all() });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to snooze lead');
    }
  });

  const markLeadLost = useMutation({
    mutationFn: async ({ leadId, reason }: { leadId: string; reason: string }) => {
      await admissionsService.updateStatus(leadId, { status: 'LOST', lost_reason: reason });
    },
    onSuccess: () => {
      toast.success('Lead marked as lost');
      setLostLeadId(null);
      qc.invalidateQueries({ queryKey: queryKeys.admissions.all() });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to mark lead lost');
    }
  });

  if (!queue || queue.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 mb-4">
          <ClipboardList className="h-6 w-6" />
        </div>
        <h4 className="text-base font-bold text-gray-800">No active leads in the queue</h4>
        <p className="mt-2 text-xs text-gray-500 max-w-sm mx-auto">
          All tasks are caught up! You have <span className="font-bold text-red-600">{vacantBeds} vacant beds</span> left to fill.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {onAddWalkIn && (
            <button
              onClick={onAddWalkIn}
              className="flex h-9 items-center justify-center rounded-xl bg-[var(--brand-saffron)] px-4 text-xs font-bold text-white hover:opacity-90 transition active:scale-[0.98]"
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Add Walk-In
            </button>
          )}
          {onGenerateQr && (
            <button
              onClick={onGenerateQr}
              className="flex h-9 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-xs font-bold text-gray-700 hover:bg-gray-50 transition active:scale-[0.98]"
            >
              <QrCode className="mr-1.5 h-3.5 w-3.5" /> Generate QR
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {queue.map((lead) => {
        const isActionPending = snoozeLead.isPending || markLeadLost.isPending;
        const priorityBadge = (p: number) => {
          if (p >= 100) return <span className="rounded-xl bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-black text-red-700 shrink-0">🔥 100</span>;
          if (p >= 70) return <span className="rounded-xl bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-black text-amber-700 shrink-0">⚠️ {p}</span>;
          return <span className="rounded-xl bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-black text-blue-700 shrink-0">🕒 {p}</span>;
        };

        return (
          <div key={lead.id} className="relative rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 hover:shadow-md transition duration-200">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {priorityBadge(lead.priority)}
                  <h4 className="font-semibold text-gray-800">{lead.student_name}</h4>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600 uppercase">
                    {lead.status.replaceAll('_', ' ')}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {lead.hostel_name} {lead.room_no ? `· Room ${lead.room_no}` : ''}
                </p>
                <p className="mt-1.5 text-xs font-medium text-amber-750 text-amber-700">
                  {lead.last_activity_desc}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {lead.action === 'Convert' ? (
                  <button
                    type="button"
                    onClick={() => onViewLead(lead.id)}
                    className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 transition"
                  >
                    Convert
                  </button>
                ) : lead.action === 'Call Parent' ? (
                  <a
                    href={phoneHref(lead.parent_phone)}
                    className="flex h-8 items-center rounded-lg bg-red-600 px-3 text-xs font-bold text-white hover:bg-red-700 transition"
                  >
                    <Phone className="mr-1 h-3.5 w-3.5" /> Call Parent
                  </a>
                ) : lead.action === 'Call' ? (
                  <a
                    href={phoneHref(lead.student_phone)}
                    className="flex h-8 items-center rounded-lg bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-700 transition"
                  >
                    <Phone className="mr-1 h-3.5 w-3.5" /> Call
                  </a>
                ) : (
                  <a
                    href={whatsAppHref(lead.student_phone)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-8 items-center rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 transition"
                  >
                    <MessageCircle className="mr-1 h-3.5 w-3.5" /> WhatsApp
                  </a>
                )}

                <button
                  type="button"
                  disabled={isActionPending}
                  onClick={() => snoozeLead.mutate(lead.id)}
                  className="h-8 rounded-lg border border-gray-200 px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  Snooze
                </button>

                {lostLeadId === lead.id ? (
                  <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-lg border border-gray-200">
                    <select
                      value={selectedReason}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="h-7 rounded border border-gray-200 bg-white px-1.5 text-[11px]"
                    >
                      {lostReasons.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={isActionPending}
                      onClick={() => markLeadLost.mutate({ leadId: lead.id, reason: selectedReason })}
                      className="h-7 rounded bg-red-600 px-2 text-[11px] font-bold text-white hover:bg-red-700"
                    >
                      OK
                    </button>
                    <button
                      type="button"
                      onClick={() => setLostLeadId(null)}
                      className="h-7 rounded border border-gray-200 bg-white px-2 text-[11px] font-bold text-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setLostLeadId(lead.id);
                      setSelectedReason('NO_RESPONSE');
                    }}
                    className="h-8 rounded-lg border border-red-200 px-2.5 text-xs font-medium text-red-600 hover:bg-red-50 transition"
                  >
                    Mark Lost
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DashboardOverview({
  analytics,
  leads,
  onViewPipeline,
  onGenerateQr,
  onViewLead,
  onAddWalkIn,
}: {
  analytics: any;
  leads: any[];
  onViewPipeline: () => void;
  onGenerateQr: () => void;
  onViewLead: (id: string) => void;
  onAddWalkIn: () => void;
}) {
  const [lostFilter, setLostFilter] = useState<'30D' | '90D' | '1Y'>('30D');
  const [funnelExpanded, setFunnelExpanded] = useState(false);

  const snapshot = analytics?.snapshot || {};
  const bedsLikelyToFill = snapshot.bedsLikelyToFill || { high: 0, medium: 0, low: 0 };
  const vacancy = analytics?.vacancy || {};
  const forecast = analytics?.forecast || {};
  const funnel = analytics?.funnel || {};
  const sourcePerf = analytics?.sourcePerf || [];
  const qrPerf = analytics?.qrPerf || {};
  const sla = analytics?.sla || { ignoredCount: 0 };
  const todayPulse = analytics?.todayPulse || { scans: 0, enquiries: 0, roomVisits: 0, joins: 0 };
  const vacancyDemandMap = analytics?.vacancyDemandMap || [];
  const lostReasonsData = analytics?.lost_reasons?.[lostFilter] || [];

  const maxCount = Math.max(funnel.visitors || 1, funnel.viewed_rooms || 1, funnel.interested || 1, funnel.reserved || 1, funnel.invited || 1, funnel.joined || 1);

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-12">
      {/* Header */}
      <div className="bg-[var(--brand-navy)] px-5 py-6 text-white md:px-6 md:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Admissions Command Center</h1>
              <p className="mt-1.5 text-sm text-white/70">Fill beds. Recover revenue. Run your hostel business.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onAddWalkIn}
                className="flex h-10 items-center justify-center rounded-xl bg-[var(--brand-saffron)] px-4 text-sm font-semibold text-white hover:opacity-90 transition active:scale-[0.98]"
              >
                <UserPlus className="mr-2 h-4 w-4" /> Add Walk-In
              </button>
              <button
                type="button"
                onClick={onGenerateQr}
                className="flex h-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/20 transition active:scale-[0.98]"
              >
                <QrCode className="mr-2 h-4 w-4" /> QR Generator
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-6 md:px-6 space-y-6">
        {/* Real-time Today Pulse strip */}
        <div className="bg-white rounded-2xl p-4 shadow-sm ring-1 ring-black/5 flex flex-wrap gap-4 items-center justify-between border-l-4 border-[var(--brand-saffron)]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Admissions Today</div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-gray-700">
            <span className="flex items-center gap-1.5"><QrCode className="h-4 w-4 text-indigo-500" /> {todayPulse.scans} scans</span>
            <span className="flex items-center gap-1.5"><UserPlus className="h-4 w-4 text-blue-500" /> {todayPulse.enquiries} enquiries</span>
            <span className="flex items-center gap-1.5"><Eye className="h-4 w-4 text-amber-500" /> {todayPulse.roomVisits} room visits</span>
            <span className="flex items-center gap-1.5"><UserCheck className="h-4 w-4 text-emerald-500" /> {todayPulse.joins} joins</span>
          </div>
        </div>

        {/* SLA Breach Alert */}
        {sla.ignoredCount > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-red-50 border border-red-200 p-4 text-red-800 shadow-sm animate-in fade-in slide-in-from-top-4 duration-200">
            <div className="flex items-center gap-2.5">
              <Flame className="h-5 w-5 text-red-600 shrink-0 animate-bounce" />
              <span className="text-sm font-medium">
                <b>Action Required:</b> {sla.ignoredCount} active leads have been ignored for over 24 hours without follow-up contact.
              </span>
            </div>
            <button
              onClick={onViewPipeline}
              className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold text-red-900 hover:bg-red-200 transition"
            >
              Review Pipeline
            </button>
          </div>
        )}

        {/* Follow-Up Queue (Today's Tasks) elevated to the top */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--brand-navy)] flex items-center gap-2">
              Today's Admissions Tasks
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">{leads.length}</span>
            </h2>
            <button
              onClick={onViewPipeline}
              className="text-xs font-bold text-[var(--brand-saffron)] hover:underline"
            >
              View Pipeline →
            </button>
          </div>
          <FollowUpQueue
            queue={analytics?.queue}
            onViewLead={onViewLead}
            vacantBeds={vacancy.vacantBeds || 0}
            onAddWalkIn={onAddWalkIn}
            onGenerateQr={onGenerateQr}
          />
        </div>

        {/* 3-Column Business Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Admissions Snapshot */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Admissions Snapshot</h3>
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                  {snapshot.activeLeadsCount ?? 0} Active Leads
                </span>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="text-3xl font-black text-gray-800" style={{ fontFamily: 'var(--font-mono)' }}>
                    ₹{(snapshot.potentialRevenue ?? 0).toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">Potential Revenue</div>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                  <div>
                    <div className="text-lg font-bold text-gray-700" style={{ fontFamily: 'var(--font-mono)' }}>
                      ₹{(snapshot.vacancyCapacity ?? 0).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] text-gray-400">Vacancy Capacity</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-500">
                      {bedsLikelyToFill.high + bedsLikelyToFill.medium + bedsLikelyToFill.low}
                    </div>
                    <div className="text-[11px] text-gray-400">Beds in Pipeline</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 border-t border-gray-100 pt-4 space-y-2">
              <div className="text-xs font-semibold text-gray-500">Pipeline Confidence levels:</div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-emerald-50 rounded-lg p-2 text-emerald-800 border border-emerald-100">
                  <div className="font-bold text-base">{bedsLikelyToFill.high}</div>
                  <div className="text-[10px] text-emerald-600">High</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-2 text-amber-800 border border-amber-100">
                  <div className="font-bold text-base">{bedsLikelyToFill.medium}</div>
                  <div className="text-[10px] text-amber-600">Medium</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-gray-700 border border-gray-100">
                  <div className="font-bold text-base">{bedsLikelyToFill.low}</div>
                  <div className="text-[10px] text-gray-500">Low</div>
                </div>
              </div>
            </div>
          </div>

          {/* Bed Fill Forecast */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Bed Fill Forecast</h3>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  Vacancy Projections
                </span>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="text-4xl font-black text-[var(--brand-navy)]" style={{ fontFamily: 'var(--font-mono)' }}>
                    ₹{(forecast.forecastRevenue ?? 0).toLocaleString('en-IN')}
                    {forecast.hasEstimatedRent && <span className="text-xs text-gray-400 font-normal ml-1">*est</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">Projected Revenue</div>
                </div>
                <div className="border-t border-gray-100 pt-4 space-y-2">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Vacant Beds:</span>
                    <span className="font-bold text-gray-800">{vacancy.vacantBeds ?? 0} beds</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>High Confidence Fill:</span>
                    <span className="font-bold text-emerald-700">{bedsLikelyToFill.high} beds</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Beds Still At Risk:</span>
                    <span className="font-bold text-red-600">{forecast.risk ?? 0} beds</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 border-t border-gray-100 pt-4">
              <div className="text-xs font-bold text-[var(--brand-navy)] bg-red-50 rounded-xl py-2 px-3 text-center">
                {vacancy.estimatedFillDate}
              </div>
            </div>
          </div>

          {/* Room-Level Vacancy Demand Map */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Room Demand Map</h3>
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                  Top Vacant Rooms
                </span>
              </div>
              <div className="space-y-3">
                {vacancyDemandMap.length === 0 ? (
                  <div className="text-xs text-gray-500 py-6 text-center italic">
                    No active vacant beds or demands found.
                  </div>
                ) : (
                  vacancyDemandMap.map((room: any) => (
                    <div key={room.room_id} className="flex items-center justify-between border-b border-gray-50 pb-2 text-xs">
                      <span className="font-bold text-gray-700">Room {room.room_no}</span>
                      <div className="flex gap-4">
                        <span className="text-red-600 font-semibold">{room.vacant_beds} vacant</span>
                        <span className="text-indigo-600 font-semibold">{room.interested_leads} interested</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="mt-4 text-[10px] text-gray-400 leading-tight">
              Prioritize rooms with high vacancy and active interested leads for targeted filling.
            </div>
          </div>
        </div>

        {/* Admissions Health Score & Lost Leads Leakage */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Admissions Health Card */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[var(--brand-navy)]">Admissions Health</h3>
                <p className="text-xs text-gray-500 mt-0.5">Top-to-bottom conversion performance</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-emerald-600">{analytics?.conversion_rate || 0}%</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Conversion Rate</div>
              </div>
            </div>

            <button
              onClick={() => setFunnelExpanded(!funnelExpanded)}
              className="w-full flex items-center justify-between rounded-xl bg-gray-50 hover:bg-gray-100 p-3 text-xs font-bold text-gray-700 transition"
            >
              <span>{funnelExpanded ? "Hide Detailed Funnel" : "View Detailed Funnel"}</span>
              {funnelExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {funnelExpanded && (
              <div className="space-y-4 pt-2 border-t border-gray-100 animate-in fade-in duration-200">
                {[
                  { label: 'Visitors', count: funnel.visitors ?? 0, color: 'bg-slate-400', revenue: null },
                  { label: 'Viewed Rooms', count: funnel.viewed_rooms ?? 0, color: 'bg-blue-400', revenue: null },
                  { label: 'Interested', count: funnel.interested ?? 0, color: 'bg-indigo-400', revenue: null },
                  { label: 'Reserved', count: funnel.reserved ?? 0, color: 'bg-purple-400', revenue: null },
                  { label: 'Invited', count: funnel.invited ?? 0, color: 'bg-amber-400', revenue: null },
                  { label: 'Joined / Converted', count: funnel.joined ?? 0, color: 'bg-emerald-500', revenue: null },
                ].map((stage, idx) => {
                  const width = Math.max((stage.count / maxCount) * 100, stage.count > 0 ? 8 : 0);

                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium text-gray-700">
                        <span>{stage.label}</span>
                        <span className="font-bold font-mono">
                          {stage.count} leads
                        </span>
                      </div>
                      <div className="h-5 w-full bg-gray-100 rounded-lg overflow-hidden flex items-center">
                        <div
                          className={`h-full ${stage.color} transition-all duration-500`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Lost Leads (Leakage) Card */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[var(--brand-navy)]">Lost Leads (Leakage)</h3>
                <p className="text-xs text-gray-500 mt-0.5">Why are potential tenants dropping out?</p>
              </div>
              <select
                value={lostFilter}
                onChange={(e) => setLostFilter(e.target.value as any)}
                className="h-9 rounded-xl border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="30D">Last 30 Days</option>
                <option value="90D">Last 90 Days</option>
                <option value="1Y">Last Year</option>
              </select>
            </div>

            <div className="space-y-3">
              {lostReasonsData.length === 0 ? (
                <div className="text-xs text-gray-500 py-8 text-center italic">
                  No lost opportunities logged for this period.
                </div>
              ) : (
                lostReasonsData.map((item: any, idx: number) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium text-gray-700">
                      <span>{item.reason.replaceAll('_', ' ')}</span>
                      <span className="font-bold font-mono">{item.count} leads</span>
                    </div>
                    <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-400 rounded-full"
                        style={{
                          width: `${Math.max(5, (item.count / Math.max(1, lostReasonsData.reduce((sum: number, r: any) => sum + r.count, 0))) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Marketing Center section */}
        <div className="border-t border-gray-200 pt-6 space-y-4">
          <h2 className="text-lg font-bold text-[var(--brand-navy)]">Marketing Center</h2>

          <div className="grid gap-6 md:grid-cols-2">
            {/* QR Performance */}
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[var(--brand-navy)]">QR Scan Performance</h3>
                <span className="text-xs bg-orange-50 text-orange-600 font-bold px-2 py-1 rounded-lg">QR Source</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="text-xl font-bold text-gray-800" style={{ fontFamily: 'var(--font-mono)' }}>
                    {qrPerf.uniqueVisitorsToday ?? 0}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Unique Today</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="text-xl font-bold text-gray-800" style={{ fontFamily: 'var(--font-mono)' }}>
                    {qrPerf.uniqueVisitorsMonth ?? 0}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Unique Month</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="text-xl font-bold text-gray-800" style={{ fontFamily: 'var(--font-mono)' }}>
                    {qrPerf.totalVisitsMonth ?? 0}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Total Scans</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-gray-100 pt-4 text-center">
                <div>
                  <div className="text-base font-bold text-gray-700">{qrPerf.leadsGenerated ?? 0}</div>
                  <div className="text-[10px] text-gray-400">Leads Generated</div>
                </div>
                <div>
                  <div className="text-base font-bold text-emerald-700">{qrPerf.joinsGenerated ?? 0}</div>
                  <div className="text-[10px] text-gray-400">Joins Generated</div>
                </div>
                <div>
                  <div className="text-base font-bold text-indigo-700">
                    ₹{(qrPerf.revenueGenerated ?? 0).toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-gray-400">Realized Revenue</div>
                </div>
              </div>
            </div>

            {/* Scan-to-Lead latency / timeline */}
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 space-y-4">
              <h3 className="text-base font-bold text-[var(--brand-navy)]">Scan-to-Lead Latency</h3>
              <div className="space-y-3">
                {[
                  { label: 'Last Scan Logged', data: qrPerf.lastScan, color: 'border-blue-400' },
                  { label: 'Last Converted Tenant', data: qrPerf.joinsGenerated > 0 ? qrPerf.lastScan : null, color: 'border-emerald-400' },
                ].map((item, idx) => (
                  <div key={idx} className={`flex justify-between items-center p-2.5 rounded-xl border-l-4 bg-gray-50 ${item.color}`}>
                    <span className="text-xs font-semibold text-gray-600">{item.label}</span>
                    {item.data ? (
                      <div className="text-right">
                        <div className="text-xs font-bold text-gray-800">{item.data.name}</div>
                        <div className="text-[10px] text-gray-400">{timeAgo(item.data.timestamp)}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">No record found</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Source Performance Table */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 space-y-4">
            <h3 className="text-base font-bold text-[var(--brand-navy)]">Source Channel Performance</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider">
                    <th className="pb-3">Source Channel</th>
                    <th className="pb-3 text-center">Leads Generated</th>
                    <th className="pb-3 text-center">Conversions</th>
                    <th className="pb-3 text-center">Conversion Rate</th>
                    <th className="pb-3 text-right">Revenue Generated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sourcePerf.map((row: any, idx: number) => {
                    const rate = row.leads > 0 ? Math.round((row.joins / row.leads) * 100) : 0;
                    return (
                      <tr key={idx} className="hover:bg-gray-50/50 transition">
                        <td className="py-3 font-semibold text-gray-800">{row.source}</td>
                        <td className="py-3 text-center font-mono">{row.leads}</td>
                        <td className="py-3 text-center font-mono">{row.joins}</td>
                        <td className="py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${rate > 50 ? 'bg-emerald-50 text-emerald-700' : rate > 20 ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                            {rate}%
                          </span>
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-gray-800">
                          ₹{row.revenue.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                  {sourcePerf.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-gray-400 italic">
                        No channels registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Quick QR Links Panel */}
        <div className="pt-2">
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

  const stageRevenues = useMemo(() => {
    const map = new Map<string, number>();
    for (const stage of stages) {
      const items = grouped.get(stage.status) || [];
      let total = 0;
      for (const item of items) {
        let rent = 8500;
        const activeRes = item.reservations?.[0];
        if (activeRes?.room?.base_rent) {
          rent = Number(activeRes.room.base_rent);
        } else if (item.hostel?.min_rent) {
          rent = Number(item.hostel.min_rent);
        }
        total += rent;
      }
      map.set(stage.status, total);
    }
    return map;
  }, [grouped]);

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
                <div className="mb-3 flex flex-col justify-between rounded-t-lg p-3 text-white" style={{ backgroundColor: stage.color }}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold">{stage.label}</h3>
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">{items.length}</span>
                  </div>
                  <div className="mt-1 text-[11px] font-semibold opacity-90 font-mono">
                    Stage Revenue: ₹{(stageRevenues.get(stage.status) || 0).toLocaleString('en-IN')}
                  </div>
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
            <button type="button" onClick={() => setActiveStatus('')} className={`grid h-14 w-16 shrink-0 place-items-center rounded-2xl text-[10px] font-bold leading-tight ${!activeStatus ? 'bg-[var(--brand-saffron)] text-white' : 'bg-gray-100 text-[var(--neutral-gray)]'}`}>
              <span>All</span>
              <span>({leads.length})</span>
            </button>
            {stages.map((stage) => {
              const count = grouped.get(stage.status)?.length || 0;
              const rev = stageRevenues.get(stage.status) || 0;
              return (
                <button
                  key={stage.status}
                  type="button"
                  onClick={() => setActiveStatus(stage.status)}
                  className="grid h-14 px-4 min-w-[7.5rem] w-auto shrink-0 place-items-center rounded-2xl text-[10px] font-bold leading-tight"
                  style={{
                    backgroundColor: activeStatus === stage.status ? stage.color : '#f3f4f6',
                    color: activeStatus === stage.status ? '#fff' : 'var(--neutral-gray)',
                  }}
                >
                  <span className="whitespace-nowrap w-full text-center px-1">{stage.shortLabel}</span>
                  <span>({count})</span>
                  <span className="text-[9px] opacity-80 font-mono font-normal">
                    ₹{rev >= 100000 ? `${(rev / 100000).toFixed(1)}L` : rev >= 1000 ? `${(rev / 1000).toFixed(0)}k` : rev}
                  </span>
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
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const qc = useQueryClient();
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

  const { data: hostelsData } = useQuery({
    queryKey: queryKeys.owner.hostels(),
    queryFn: ownerService.getHostels,
    staleTime: 5 * 60 * 1000,
  });
  const hostels = readHostels(hostelsData);

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
        <DashboardOverview
          analytics={analytics}
          leads={leads}
          onViewPipeline={() => setScreen('pipeline')}
          onGenerateQr={() => setScreen('qr')}
          onViewLead={setSelectedId}
          onAddWalkIn={() => setIsAddLeadOpen(true)}
        />
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

      <AddWalkInLeadModal
        isOpen={isAddLeadOpen}
        onClose={() => setIsAddLeadOpen(false)}
        hostels={hostels}
        onSuccess={() => {
          refetch();
          qc.invalidateQueries({ queryKey: queryKeys.admissions.all() });
        }}
      />
    </div>
  );
}
