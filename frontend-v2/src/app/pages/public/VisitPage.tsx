import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import {
  ArrowRight,
  BedDouble,
  Building2,
  CheckCircle2,
  Heart,
  Home,
  IndianRupee,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
  Utensils,
} from 'lucide-react';
import { admissionsPublicService } from '@features/admissions/api';
import { queryKeys } from '@lib/queryKeys';

const fallbackPhoto = '/android-chrome-512x512.png';

function rupee(value: number | null | undefined) {
  if (!value) return 'Ask owner';
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

function RoomCard({ room, onAction }: { room: any; onAction: (type: string, metadata?: any) => void }) {
  const photo = room.photos?.[0] || fallbackPhoto;
  return (
    <article className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="aspect-[16/10] bg-muted">
        <img src={photo} alt={`Room ${room.room_no}`} loading="lazy" className="h-full w-full object-cover" />
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-foreground">Room {room.room_no}</h3>
            <p className="text-xs text-muted-foreground">{room.room_type} · Floor {room.floor ?? room.floor_name ?? 'Ground'}</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            {room.available_beds} beds left
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-xl bg-muted p-2">
            <span className="block text-muted-foreground">Rent</span>
            <b>{rupee(room.pricing?.monthly_rent)}</b>
          </div>
          <div className="rounded-xl bg-muted p-2">
            <span className="block text-muted-foreground">Capacity</span>
            <b>{room.capacity}</b>
          </div>
          <div className="rounded-xl bg-muted p-2">
            <span className="block text-muted-foreground">Occupied</span>
            <b>{room.occupied_count}</b>
          </div>
        </div>
        {room.roommate_preview?.length > 0 && (
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs font-semibold text-foreground">Roommate preview</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {room.roommate_preview.slice(0, 3).map((mate: any, index: number) => (
                <span key={index} className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-secondary-foreground">
                  {[mate.college, mate.course, mate.year ? `Year ${mate.year}` : null].filter(Boolean).join(' · ')}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onAction('MARK_INTEREST', { room_id: room.id })}
            className="h-11 rounded-xl border border-border font-semibold text-sm active:scale-[0.99]"
          >
            Interested
          </button>
          <button
            type="button"
            onClick={() => onAction('REQUEST_JOIN', { room_id: room.id })}
            className="h-11 rounded-xl bg-accent text-accent-foreground font-semibold text-sm active:scale-[0.99]"
          >
            Request admission
          </button>
        </div>
      </div>
    </article>
  );
}

export function VisitPage() {
  const { hostelSlug = '' } = useParams();
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
  const availableCount = useMemo(
    () => rooms.reduce((sum: number, room: any) => sum + Number(room.available_beds || 0), 0),
    [rooms],
  );
  const ownerHostels = useMemo(() => {
    if (Array.isArray(data?.owner_hostels) && data.owner_hostels.length > 0) return data.owner_hostels;
    return [
      {
        id: data?.hostel?.id,
        public_slug: data?.hostel?.public_slug,
        name: data?.hostel?.name,
        vacancy_count: availableCount,
        starting_price: data?.hostel?.starting_price,
        is_current: true,
      },
      ...(data?.other_hostels || []).map((hostel: any) => ({ ...hostel, is_current: false })),
    ].filter((hostel: any) => hostel.id);
  }, [availableCount, data]);
  const heroPhoto = data?.hostel?.photos?.[0] || data?.hostel?.logo_url || fallbackPhoto;

  const onAction = (type: string, metadata?: any) => {
    if (!lead?.id) {
      document.getElementById('visitor-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    activity.mutate({ type, metadata });
  };

  if (isLoading) return <div className="min-h-screen bg-slate-50" />;
  if (isError || !data) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-10">
        <div className="mx-auto max-w-md rounded-2xl border bg-white p-5">
          <h1 className="text-xl font-bold">Admissions link unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">Please ask the hostel owner for the latest QR link.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-foreground">
      <section className="relative overflow-hidden bg-sidebar text-white">
        <div className="absolute inset-0 opacity-20">
          <img src={heroPhoto} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="relative mx-auto max-w-5xl px-5 py-7 md:py-12">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-white/70">Admissions open</p>
              <h1 className="text-2xl font-bold tracking-normal">{data.hostel.name}</h1>
            </div>
          </div>
          <div className="mt-8 max-w-xl space-y-4">
            <h2 className="text-4xl font-black tracking-normal md:text-5xl">Explore available rooms</h2>
            <p className="text-sm leading-6 text-white/80">
              Check rooms, pricing, food, safety, and parent-friendly details before speaking with the owner.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-white/10 p-3">
                <BedDouble className="h-4 w-4 text-accent" />
                <b className="mt-2 block">{availableCount}</b>
                <span className="text-[11px] text-white/70">Beds open</span>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <IndianRupee className="h-4 w-4 text-accent" />
                <b className="mt-2 block">{rupee(data.hostel.starting_price)}</b>
                <span className="text-[11px] text-white/70">Starts from</span>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <ShieldCheck className="h-4 w-4 text-accent" />
                <b className="mt-2 block">Private</b>
                <span className="text-[11px] text-white/70">Safe preview</span>
              </div>
            </div>
            <a href="#visitor-details" className="inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-5 font-bold text-accent-foreground">
              Continue <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {ownerHostels.length > 1 && (
        <section className="mx-auto max-w-5xl px-5 py-5">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-accent" />
              <div>
                <h2 className="font-bold">Choose a hostel to view</h2>
                <p className="text-xs text-muted-foreground">Compare all active hostels from this owner before sharing your details.</p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {ownerHostels.map((hostel: any) => {
                const isCurrent = hostel.public_slug === data.hostel.public_slug || hostel.is_current;
                return (
                  <a
                    key={hostel.id}
                    href={isCurrent ? '#visitor-details' : `/visit/${hostel.public_slug}`}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={`rounded-xl border p-3 active:scale-[0.99] ${
                      isCurrent ? 'border-accent bg-accent/5' : 'border-border bg-background'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <b className="truncate">{hostel.name}</b>
                      {isCurrent ? (
                        <span className="rounded-full bg-accent px-2 py-1 text-[10px] font-bold text-accent-foreground">Viewing</span>
                      ) : (
                        <ArrowRight className="h-4 w-4 shrink-0" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {Number(hostel.vacancy_count || 0)} beds open · From {rupee(hostel.starting_price)}
                    </p>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section id="visitor-details" className="mx-auto max-w-5xl px-5 py-6">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          {lead ? (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-600" />
              <div>
                <h2 className="font-bold">You are in the admissions list</h2>
                <p className="text-sm text-muted-foreground">Explore rooms below. Every interest action helps the owner follow up faster.</p>
              </div>
            </div>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                createLead.mutate();
              }}
            >
              <div>
                <h2 className="text-lg font-bold">Quick visitor details</h2>
                <p className="text-sm text-muted-foreground">No account, OTP, or password. This takes under a minute.</p>
              </div>
              <input className="hidden" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              <div className="grid gap-3 md:grid-cols-2">
                <input required placeholder="Student name" className="h-12 rounded-xl border px-3" value={form.student_name} onChange={(e) => setForm({ ...form, student_name: e.target.value })} />
                <input required placeholder="Student mobile number" className="h-12 rounded-xl border px-3" value={form.student_phone} onChange={(e) => setForm({ ...form, student_phone: e.target.value })} />
                <input type="email" placeholder="Student email (optional now)" className="h-12 rounded-xl border px-3" value={form.student_email} onChange={(e) => setForm({ ...form, student_email: e.target.value })} />
                <input placeholder="Parent name" className="h-12 rounded-xl border px-3" value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} />
                <input placeholder="Parent mobile number" className="h-12 rounded-xl border px-3" value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} />
                <select className="h-12 rounded-xl border px-3" value={form.decision_maker_type} onChange={(e) => setForm({ ...form, decision_maker_type: e.target.value })}>
                  <option value="BOTH">Student and parent decide</option>
                  <option value="PARENT">Parent decides</option>
                  <option value="STUDENT">Student decides</option>
                </select>
              </div>
              {createLead.isError && <p className="text-sm font-medium text-destructive">Could not save details. Please check the phone number and try again.</p>}
              <button disabled={createLead.isPending} className="h-12 w-full rounded-xl bg-accent font-bold text-accent-foreground active:scale-[0.99]">
                {createLead.isPending ? 'Saving...' : 'Explore rooms'}
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-5xl space-y-4 px-5 pb-8">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ['Safety', data.trust_sections.safety?.join(' · ') || 'Safe admission process', ShieldCheck],
            ['Food', data.trust_sections.food?.join(' · ') || 'Ask owner for current menu', Utensils],
            ['Rules', data.trust_sections.rules?.join(' · ') || 'Rules shared before joining', Home],
          ].map(([title, text, Icon]: any) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-4">
              <Icon className="h-5 w-5 text-accent" />
              <h3 className="mt-2 font-bold">{title}</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black">Available rooms</h2>
            <p className="text-sm text-muted-foreground">Cards show beds, pricing, and privacy-safe roommate context.</p>
          </div>
          <Phone className="h-5 w-5 text-accent" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {rooms.map((room: any) => (
            <RoomCard key={room.id} room={room} onAction={onAction} />
          ))}
        </div>

        {data.other_hostels?.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-accent" />
              <h2 className="font-bold">Other hostels by this owner</h2>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {data.other_hostels.map((hostel: any) => (
                <a key={hostel.id} href={`/visit/${hostel.public_slug}`} className="rounded-xl border border-border p-3 active:scale-[0.99]">
                  <div className="flex items-center justify-between">
                    <b>{hostel.name}</b>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {hostel.vacancy_count} beds open · From {rupee(hostel.starting_price)}
                  </p>
                </a>
              ))}
            </div>
          </section>
        )}

        <div className="rounded-2xl bg-sidebar p-4 text-white">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-1 h-5 w-5 text-accent" />
            <div>
              <h2 className="font-bold">Ready to discuss admission?</h2>
              <p className="mt-1 text-sm text-white/70">Tap request admission on a room card. The owner will see your interest and parent details.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
