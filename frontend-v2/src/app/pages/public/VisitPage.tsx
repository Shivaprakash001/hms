import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Bed,
  Building2,
  CheckCircle,
  Heart,
  Home,
  IndianRupee,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  Shield,
  Utensils,
  Wifi,
  Wind,
  X,
} from 'lucide-react';
import { admissionsPublicService } from '@features/admissions/api';
import { queryKeys } from '@lib/queryKeys';

const fallbackPhoto = '/android-chrome-512x512.png';

function rupee(value: number | null | undefined) {
  if (!value) return 'Ask owner';
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

function roomPrice(room: any) {
  return Number(room?.pricing?.monthly_rent || 0);
}

function phoneLink(phone?: string | null) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `tel:${digits}` : '#';
}

function waLink(phone?: string | null, text?: string) {
  const digits = String(phone || '').replace(/\D/g, '');
  const encoded = text ? `?text=${encodeURIComponent(text)}` : '';
  return digits ? `https://wa.me/${digits}${encoded}` : `https://wa.me/${encoded}`;
}

function QuickRegistrationSheet({
  open,
  onClose,
  form,
  setForm,
  onSubmit,
  saving,
  error,
}: {
  open: boolean;
  onClose: () => void;
  form: any;
  setForm: (next: any) => void;
  onSubmit: () => void;
  saving: boolean;
  error: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <button className="absolute inset-0 bg-black/50" aria-label="Close registration" onClick={onClose} />
      <div className="relative w-full bg-white p-6 shadow-2xl md:max-w-lg md:rounded-3xl rounded-t-3xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-[var(--neutral-gray)] hover:bg-[var(--warm-ivory)]"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-5">
          <h2 className="text-2xl font-bold text-[var(--brand-navy)]">Quick visitor details</h2>
          <p className="mt-1 text-sm text-[var(--neutral-gray)]">Just your name and number. No account, OTP, or password.</p>
        </div>

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <input className="hidden" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          <input required placeholder="Student name" className="h-14 w-full rounded-2xl border-0 bg-[var(--warm-ivory)] px-4 text-base outline-none ring-1 ring-transparent focus:ring-[var(--brand-saffron)]" value={form.student_name} onChange={(e) => setForm({ ...form, student_name: e.target.value })} />
          <input required placeholder="Student mobile" inputMode="tel" className="h-14 w-full rounded-2xl border-0 bg-[var(--warm-ivory)] px-4 text-base outline-none ring-1 ring-transparent focus:ring-[var(--brand-saffron)]" value={form.student_phone} onChange={(e) => setForm({ ...form, student_phone: e.target.value })} />
          <input type="email" placeholder="Student email (optional now)" className="h-14 w-full rounded-2xl border-0 bg-[var(--warm-ivory)] px-4 text-base outline-none ring-1 ring-transparent focus:ring-[var(--brand-saffron)]" value={form.student_email} onChange={(e) => setForm({ ...form, student_email: e.target.value })} />
          <input placeholder="Parent name (optional)" className="h-14 w-full rounded-2xl border-0 bg-[var(--warm-ivory)] px-4 text-base outline-none ring-1 ring-transparent focus:ring-[var(--brand-saffron)]" value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} />
          <input placeholder="Parent mobile (optional)" inputMode="tel" className="h-14 w-full rounded-2xl border-0 bg-[var(--warm-ivory)] px-4 text-base outline-none ring-1 ring-transparent focus:ring-[var(--brand-saffron)]" value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} />
          <select className="h-14 w-full rounded-2xl border-0 bg-[var(--warm-ivory)] px-4 text-base outline-none ring-1 ring-transparent focus:ring-[var(--brand-saffron)]" value={form.decision_maker_type} onChange={(e) => setForm({ ...form, decision_maker_type: e.target.value })}>
            <option value="BOTH">Student and parent decide</option>
            <option value="PARENT">Parent decides</option>
            <option value="STUDENT">Student decides</option>
          </select>
          {error && <p className="text-sm font-medium text-[var(--danger-red)]">Could not save details. Please check the phone number and try again.</p>}
          <button disabled={saving} className="h-14 w-full rounded-2xl bg-[var(--brand-saffron)] text-lg font-semibold text-white disabled:opacity-60">
            {saving ? 'Saving...' : 'Continue'}
          </button>
          <p className="text-center text-sm text-[var(--neutral-gray)]">No spam. The owner uses this only for admissions follow-up.</p>
        </form>
      </div>
    </div>
  );
}

function RoomCard({
  room,
  onView,
  onInterest,
  interested,
}: {
  room: any;
  onView: () => void;
  onInterest: () => void;
  interested: boolean;
}) {
  const photo = room.photos?.[0] || fallbackPhoto;
  const available = Number(room.available_beds || 0);
  const isFull = available <= 0;

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <button type="button" onClick={onView} className="block w-full text-left">
        <div className="relative h-48 bg-gradient-to-br from-[var(--brand-navy)]/10 to-[var(--brand-saffron)]/10">
          <img src={photo} alt={`Room ${room.room_no}`} loading="lazy" className="h-full w-full object-cover" />
          <span className="absolute left-3 top-3 rounded-lg bg-[var(--brand-navy)] px-3 py-1 text-sm font-semibold text-white">Room {room.room_no}</span>
          <span className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-semibold text-white ${isFull ? 'bg-[var(--danger-red)]' : 'bg-[var(--success-green)]'}`}>
            {isFull ? 'Full' : `${available} bed${available === 1 ? '' : 's'} available`}
          </span>
        </div>
      </button>

      <div className="space-y-3 p-4">
        <div className="flex items-center gap-4 text-sm text-[var(--neutral-gray)]">
          <span className="flex items-center gap-1"><Bed className="h-4 w-4" /> {room.capacity} beds</span>
          <span className="flex items-center gap-1"><CheckCircle className="h-4 w-4 text-[var(--success-green)]" /> {available} open</span>
        </div>
        <div>
          <span className="text-2xl font-bold text-[var(--brand-saffron)]">{rupee(roomPrice(room))}</span>
          <span className="text-[var(--neutral-gray)]">/month</span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-[var(--neutral-gray)]">
          {['Meals', 'WiFi', 'Maintenance'].map((item) => (
            <span key={item} className="inline-flex items-center gap-1 rounded-full bg-[var(--warm-ivory)] px-2.5 py-1">
              <CheckCircle className="h-3 w-3 text-[var(--success-green)]" /> {item}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onView} className="h-11 rounded-xl border border-[var(--border)] font-semibold text-[var(--brand-navy)]">View details</button>
          <button
            type="button"
            disabled={isFull || interested}
            onClick={onInterest}
            className={`h-11 rounded-xl font-semibold text-white disabled:opacity-60 ${interested ? 'bg-[var(--success-green)]' : 'bg-[var(--brand-saffron)]'}`}
          >
            {interested ? 'Interested' : "I'm interested"}
          </button>
        </div>
      </div>
    </article>
  );
}

function RoomDetail({
  room,
  onBack,
  onInterest,
  interested,
}: {
  room: any;
  onBack: () => void;
  onInterest: () => void;
  interested: boolean;
}) {
  const photo = room.photos?.[0] || fallbackPhoto;
  const available = Number(room.available_beds || 0);

  return (
    <div className="min-h-screen bg-[var(--warm-ivory)] pb-24">
      <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
          <button type="button" onClick={onBack} className="-ml-2 grid h-10 w-10 place-items-center rounded-lg hover:bg-[var(--warm-ivory)]">
            <ArrowLeft className="h-5 w-5 text-[var(--brand-navy)]" />
          </button>
          <h1 className="text-xl font-bold text-[var(--brand-navy)]">Room {room.room_no}</h1>
        </div>
      </div>

      <div className="mx-auto max-w-3xl">
        <div className="relative h-72 bg-gradient-to-br from-[var(--brand-navy)]/10 to-[var(--brand-saffron)]/10">
          <img src={photo} alt={`Room ${room.room_no}`} className="h-full w-full object-cover" />
          <span className="absolute right-4 top-4 rounded-full bg-[var(--success-green)] px-3 py-1 text-sm font-semibold text-white">{available} bed{available === 1 ? '' : 's'} available</span>
        </div>

        <div className="space-y-6 px-5 py-6">
          <section>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[var(--brand-saffron)]">{rupee(roomPrice(room))}</span>
              <span className="text-[var(--neutral-gray)]">/month</span>
            </div>
            <div className="mt-2 flex items-center gap-4 text-sm text-[var(--neutral-gray)]">
              <span>{room.capacity} beds</span>
              <span>{room.occupied_count} occupied</span>
              <span className="text-[var(--success-green)]">{available} available</span>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-[var(--brand-navy)]">Who you would be living with</h2>
            <div className="space-y-3">
              {(room.roommate_preview || []).slice(0, 4).map((mate: any, index: number) => (
                <div key={index} className="flex items-center gap-4 rounded-xl bg-white p-4">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[var(--brand-saffron)]/20 to-[var(--brand-navy)]/20 font-semibold text-[var(--brand-navy)]">R{index + 1}</div>
                  <div>
                    <p className="font-medium text-[var(--deep-charcoal)]">{mate.college || 'College not shared'}</p>
                    <p className="text-sm text-[var(--neutral-gray)]">{[mate.course, mate.year ? `Year ${mate.year}` : null].filter(Boolean).join(' · ') || 'Student details private'}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-4 rounded-xl border-2 border-dashed border-[var(--success-green)]/30 bg-[var(--success-green)]/5 p-4">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-[var(--success-green)]/10">
                  <Bed className="h-6 w-6 text-[var(--success-green)]" />
                </div>
                <div>
                  <p className="font-medium text-[var(--success-green)]">Available for you</p>
                  <p className="text-sm text-[var(--neutral-gray)]">This preview never exposes names or phone numbers.</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-[var(--brand-navy)]">What is included</h2>
            <div className="space-y-3 rounded-xl bg-white p-4">
              {['Meals', 'High-speed WiFi', 'Room maintenance', 'Security', 'Water and electricity'].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-[var(--deep-charcoal)]">
                  <CheckCircle className="h-4 w-4 text-[var(--success-green)]" /> {item}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-[var(--border)] bg-white p-4">
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            onClick={onInterest}
            disabled={interested || available <= 0}
            className={`h-14 w-full rounded-xl text-lg font-semibold text-white disabled:opacity-60 ${interested ? 'bg-[var(--success-green)]' : 'bg-[var(--brand-saffron)]'}`}
          >
            {interested ? 'Interested' : 'Mark as interested'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InterestConfirmation({ room, studentName, onExploreMore, onShare }: { room: any; studentName: string; onExploreMore: () => void; onShare: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--warm-ivory)] p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <div className="grid h-24 w-24 place-items-center rounded-full bg-[var(--brand-saffron)]">
            <CheckCircle className="h-14 w-14 text-white" />
          </div>
        </div>
        <div className="mb-8 text-center">
          <h1 className="mb-3 text-3xl font-bold text-[var(--brand-navy)]" style={{ fontFamily: 'var(--font-hero)' }}>Great choice, {studentName || 'there'}!</h1>
          <p className="text-lg text-[var(--neutral-gray)]">We noted your interest in <b className="text-[var(--deep-charcoal)]">Room {room?.room_no}</b>. The owner can follow up faster now.</p>
        </div>
        <div className="mb-6 rounded-2xl border border-[var(--brand-saffron)]/20 bg-white p-6">
          <h3 className="mb-2 font-semibold text-[var(--brand-navy)]">What happens next?</h3>
          <ul className="space-y-1 text-sm text-[var(--neutral-gray)]">
            <li>• Owner sees your selected room and parent contact.</li>
            <li>• You can ask questions before joining.</li>
            <li>• No commitment is created yet.</li>
          </ul>
        </div>
        <div className="space-y-3">
          <button type="button" onClick={onShare} className="h-14 w-full rounded-xl border-2 border-[var(--brand-navy)] font-semibold text-[var(--brand-navy)]">
            Share with parents
          </button>
          <button type="button" onClick={onExploreMore} className="h-14 w-full rounded-xl border border-[var(--border)] font-semibold text-[var(--brand-navy)]">
            Explore more rooms
          </button>
        </div>
      </div>
    </div>
  );
}

function ShareWithParents({ room, hostel, studentName, onBack }: { room: any; hostel: any; studentName: string; onBack: () => void }) {
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const message = `Hi! I am interested in Room ${room?.room_no} at ${hostel?.name}.

${room?.capacity || ''}-sharing · ${rupee(roomPrice(room))}/month
Meals, WiFi, and hostel rules are listed here:
${shareUrl}

- ${studentName}`;

  const copy = async () => {
    await navigator.clipboard.writeText(message);
  };

  return (
    <div className="min-h-screen bg-[var(--warm-ivory)]">
      <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-5 py-4">
          <button type="button" onClick={onBack} className="-ml-2 grid h-10 w-10 place-items-center rounded-lg hover:bg-[var(--warm-ivory)]">
            <ArrowLeft className="h-5 w-5 text-[var(--brand-navy)]" />
          </button>
          <h1 className="text-xl font-bold text-[var(--brand-navy)]">Share with parents</h1>
        </div>
      </div>
      <div className="mx-auto max-w-lg space-y-6 px-5 py-8">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-5 text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[var(--brand-saffron)]/20 to-[var(--brand-navy)]/20">
              <Share2 className="h-8 w-8 text-[var(--brand-saffron)]" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--brand-navy)]">Share room details</h2>
            <p className="text-sm text-[var(--neutral-gray)]">Parents can review room, pricing, safety, and rules.</p>
          </div>
          <pre className="whitespace-pre-wrap rounded-xl bg-[var(--warm-ivory)] p-4 text-sm text-[var(--deep-charcoal)]">{message}</pre>
        </div>
        <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="flex h-14 items-center justify-center rounded-xl bg-[var(--success-green)] font-semibold text-white">
          <MessageCircle className="mr-2 h-5 w-5" /> Share via WhatsApp
        </a>
        <button type="button" onClick={copy} className="h-14 w-full rounded-xl border border-[var(--border)] bg-white font-semibold text-[var(--brand-navy)]">Copy message</button>
      </div>
    </div>
  );
}

export function VisitPage() {
  const { hostelSlug = '' } = useParams();
  const [showRegistration, setShowRegistration] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [successRoomId, setSuccessRoomId] = useState<string | null>(null);
  const [shareRoomId, setShareRoomId] = useState<string | null>(null);
  const [interestedRooms, setInterestedRooms] = useState<Set<string>>(new Set());
  const [lead, setLead] = useState<any>(() => {
    try {
      const saved = localStorage.getItem(`visit-lead:${hostelSlug}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [form, setForm] = useState({
    student_name: '',
    student_phone: '',
    student_email: '',
    parent_name: '',
    parent_phone: '',
    decision_maker_type: 'BOTH',
    website: '',
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.admissions.visit(hostelSlug),
    queryFn: () => admissionsPublicService.getVisitHostel(hostelSlug),
    staleTime: 3 * 60 * 1000,
  });

  const createLead = useMutation({
    mutationFn: () => admissionsPublicService.createLead(hostelSlug, { ...form, source: 'QR' }),
    onSuccess: (created) => {
      setLead(created);
      setShowRegistration(false);
      localStorage.setItem(`visit-lead:${hostelSlug}`, JSON.stringify(created));
    },
  });

  const activity = useMutation({
    mutationFn: ({ type, metadata }: { type: string; metadata?: any }) =>
      admissionsPublicService.recordActivity(hostelSlug, {
        lead_id: lead?.id,
        activity_type: type,
        metadata: metadata || {},
      }),
  });

  const rooms = data?.rooms || [];
  const selectedRoom = rooms.find((room: any) => String(room.id) === String(selectedRoomId));
  const successRoom = rooms.find((room: any) => String(room.id) === String(successRoomId));
  const shareRoom = rooms.find((room: any) => String(room.id) === String(shareRoomId));
  const availableCount = rooms.reduce((sum: number, room: any) => sum + Number(room.available_beds || 0), 0);
  const startingPrice = data?.hostel?.starting_price || rooms.map(roomPrice).filter(Boolean).sort((a: number, b: number) => a - b)[0] || null;
  const ownerHostels = useMemo(() => {
    if (Array.isArray(data?.owner_hostels) && data.owner_hostels.length > 0) return data.owner_hostels;
    return [
      {
        id: data?.hostel?.id,
        public_slug: data?.hostel?.public_slug,
        name: data?.hostel?.name,
        vacancy_count: availableCount,
        starting_price: startingPrice,
        is_current: true,
      },
      ...(data?.other_hostels || []).map((hostel: any) => ({ ...hostel, is_current: false })),
    ].filter((hostel: any) => hostel.id);
  }, [availableCount, data, startingPrice]);

  const heroPhoto = data?.hostel?.photos?.[0] || data?.hostel?.logo_url || fallbackPhoto;

  const requireLeadThen = (roomId: string, action: () => void) => {
    if (!lead?.id) {
      setSelectedRoomId(roomId);
      setShowRegistration(true);
      return;
    }
    action();
  };

  const markInterest = (room: any) => {
    requireLeadThen(room.id, () => {
      setInterestedRooms((prev) => new Set([...prev, String(room.id)]));
      activity.mutate({ type: 'MARK_INTEREST', metadata: { room_id: room.id } });
      setSuccessRoomId(room.id);
      setSelectedRoomId(null);
    });
  };

  if (selectedRoom) {
    return (
      <RoomDetail
        room={selectedRoom}
        onBack={() => setSelectedRoomId(null)}
        onInterest={() => markInterest(selectedRoom)}
        interested={interestedRooms.has(String(selectedRoom.id))}
      />
    );
  }

  if (successRoom) {
    return (
      <InterestConfirmation
        room={successRoom}
        studentName={lead?.student_name || form.student_name}
        onExploreMore={() => setSuccessRoomId(null)}
        onShare={() => {
          setShareRoomId(successRoom.id);
          setSuccessRoomId(null);
        }}
      />
    );
  }

  if (shareRoom) {
    return (
      <ShareWithParents
        room={shareRoom}
        hostel={data?.hostel}
        studentName={lead?.student_name || form.student_name}
        onBack={() => {
          setSuccessRoomId(shareRoom.id);
          setShareRoomId(null);
        }}
      />
    );
  }

  if (isLoading) return <div className="min-h-screen bg-[var(--warm-ivory)]" />;
  if (isError || !data) {
    return (
      <main className="min-h-screen bg-[var(--warm-ivory)] px-5 py-10">
        <div className="mx-auto max-w-md rounded-2xl border bg-white p-5">
          <h1 className="text-xl font-bold text-[var(--brand-navy)]">Admissions link unavailable</h1>
          <p className="mt-2 text-sm text-[var(--neutral-gray)]">Please ask the hostel owner for the latest QR link.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--warm-ivory)] pb-24">
      <section className="px-6 pb-8 pt-10 text-center">
        <div className="inline-flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-[var(--brand-saffron)]">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--brand-navy)]" style={{ fontFamily: 'var(--font-hero)' }}>
            {data.hostel.name}
          </h1>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6">
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="aspect-[4/3] bg-gradient-to-br from-[var(--brand-saffron)]/20 to-[var(--brand-navy)]/10 md:aspect-[21/9]">
            <img src={heroPhoto} alt={data.hostel.name} className="h-full w-full object-cover" />
          </div>
          <div className="p-6 text-center">
            <h2 className="text-4xl font-bold text-[var(--brand-navy)] md:text-5xl" style={{ fontFamily: 'var(--font-hero)' }}>
              Explore rooms before you join
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-lg text-[var(--neutral-gray)]">
              Compare rooms, food, safety, rules, and parent-friendly details before speaking with the owner.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-[var(--deep-charcoal)]">
              <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-[var(--brand-saffron)]" /> {data.hostel.city || 'Location shared by owner'}</span>
              <span className="inline-flex items-center gap-2"><Utensils className="h-4 w-4 text-[var(--brand-saffron)]" /> Meals</span>
              <span className="inline-flex items-center gap-2"><Shield className="h-4 w-4 text-[var(--brand-saffron)]" /> Safe preview</span>
            </div>
            <button type="button" onClick={() => setShowRegistration(true)} className="mt-7 h-14 w-full max-w-md rounded-2xl bg-[var(--brand-saffron)] text-lg font-semibold text-white shadow-lg md:w-auto md:px-10">
              Share visitor details
            </button>
          </div>
        </div>
      </section>

      {ownerHostels.length > 1 && (
        <section className="mx-auto mt-6 max-w-5xl px-6">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-3">
              <h2 className="text-xl font-semibold text-[var(--brand-navy)]">Choose a hostel to view</h2>
              <p className="text-sm text-[var(--neutral-gray)]">See every active hostel from this owner before submitting interest.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {ownerHostels.map((hostel: any) => {
                const isCurrent = hostel.public_slug === data.hostel.public_slug || hostel.is_current;
                return (
                  <a key={hostel.id} href={isCurrent ? '#rooms' : `/visit/${hostel.public_slug}`} className={`rounded-xl border p-3 ${isCurrent ? 'border-[var(--brand-saffron)] bg-[var(--brand-saffron)]/5' : 'border-[var(--border)]'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <b className="truncate text-[var(--deep-charcoal)]">{hostel.name}</b>
                      {isCurrent ? <span className="rounded-full bg-[var(--brand-saffron)] px-2 py-1 text-[10px] font-bold text-white">Viewing</span> : <ArrowRight className="h-4 w-4" />}
                    </div>
                    <p className="mt-1 text-xs text-[var(--neutral-gray)]">{Number(hostel.vacancy_count || 0)} beds open · From {rupee(hostel.starting_price)}</p>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto mt-8 max-w-5xl px-6">
        <h2 className="mb-4 text-2xl font-semibold text-[var(--brand-navy)]">About</h2>
        <p className="leading-relaxed text-[var(--neutral-gray)]">
          {data.hostel.name} has {availableCount} open beds with pricing from {rupee(startingPrice)}. Parents can review safety, food, rules, and privacy-safe roommate context before deciding.
        </p>
      </section>

      <section className="mx-auto mt-8 max-w-5xl px-6">
        <h2 className="mb-4 text-2xl font-semibold text-[var(--brand-navy)]">Facilities</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            [Wifi, 'WiFi'],
            [Utensils, 'Meals'],
            [Shield, 'Security'],
            [Home, 'Rules'],
            [Wind, 'Ventilation'],
            [Phone, 'Owner contact'],
          ].map(([Icon, label]: any) => (
            <div key={label} className="flex flex-col items-center gap-2 rounded-xl bg-white p-4 text-center">
              <Icon className="h-8 w-8 text-[var(--brand-saffron)]" />
              <span className="text-xs text-[var(--deep-charcoal)]">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="rooms" className="mx-auto mt-8 max-w-5xl px-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--brand-navy)]">Available rooms</h2>
            <p className="text-sm text-[var(--neutral-gray)]">Tap a room for details and roommate preview.</p>
          </div>
          <IndianRupee className="h-5 w-5 text-[var(--brand-saffron)]" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {rooms.map((room: any) => (
            <RoomCard
              key={room.id}
              room={room}
              interested={interestedRooms.has(String(room.id))}
              onView={() => {
                if (lead?.id) activity.mutate({ type: 'VIEW_ROOM', metadata: { room_id: room.id } });
                setSelectedRoomId(room.id);
              }}
              onInterest={() => markInterest(room)}
            />
          ))}
        </div>
      </section>

      <div className="fixed bottom-0 left-0 right-0 border-t border-[var(--border)] bg-white p-4 shadow-lg">
        <div className="mx-auto flex max-w-lg gap-3">
          <a href={phoneLink(data.hostel.phone)} className="flex items-center gap-2 rounded-xl bg-[var(--warm-ivory)] px-4 py-3 font-medium text-[var(--brand-navy)]">
            <Phone className="h-5 w-5" /> Call
          </a>
          <a href={waLink(data.hostel.phone)} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-[var(--warm-ivory)] px-4 py-3 font-medium text-[var(--success-green)]">
            <MessageCircle className="h-5 w-5" /> WhatsApp
          </a>
          <a href="#rooms" className="flex flex-1 items-center justify-center rounded-xl bg-[var(--brand-saffron)] px-4 py-3 font-semibold text-white">
            View rooms
          </a>
        </div>
      </div>

      <QuickRegistrationSheet
        open={showRegistration}
        onClose={() => setShowRegistration(false)}
        form={form}
        setForm={setForm}
        onSubmit={() => createLead.mutate()}
        saving={createLead.isPending}
        error={createLead.isError}
      />
    </main>
  );
}
