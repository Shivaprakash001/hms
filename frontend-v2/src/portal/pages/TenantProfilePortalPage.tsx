import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Copy,
  Loader2,
  LogOut,
  MessageCircle,
  Phone,
  Upload,
} from 'lucide-react';
import { tenantPortalApi } from '@features/tenant-portal/api';
import { tenantService } from '@features/tenants/api';
import { useAuth } from '@context/AuthContext';
import { ProfileRow, ProfileSection } from '@/portal/components/profile/ProfileSection';
import { TenantStatusBadge } from '@features/tenants/components/badges/TenantStatusBadge';

const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const DOC_TYPES = [
  { value: 'AADHAAR', label: 'Aadhaar' },
  { value: 'COLLEGE_ID', label: 'College ID' },
  { value: 'RENTAL_AGREEMENT', label: 'Rental Agreement' },
  { value: 'OTHER', label: 'Other' },
] as const;

function Field({
  label,
  value,
  onChange,
  type = 'text',
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="block text-sm mb-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      <input
        type={type}
        readOnly={readOnly}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className={`mt-1 w-full px-3 py-2.5 rounded-xl border text-sm ${
          readOnly
            ? 'border-transparent bg-muted/50 text-muted-foreground cursor-not-allowed'
            : 'border-border bg-background'
        }`}
      />
    </label>
  );
}

export function TenantProfilePortalPage() {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const photoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [docType, setDocType] = useState<string>('AADHAAR');
  const [form, setForm] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['tenant', 'portal-profile'],
    queryFn: () => tenantPortalApi.getMyProfile(),
  });

  const saveMutation = useMutation({
    mutationFn: () => tenantService.updateMyProfile(form),
    onSuccess: () => {
      toast.success('Profile updated');
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
    },
    onError: () => toast.error('Could not save profile'),
  });

  const photoMutation = useMutation({
    mutationFn: (file: File) => tenantPortalApi.uploadMyPhoto(file),
    onSuccess: () => {
      toast.success('Photo updated');
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
    },
    onError: () => toast.error('Photo upload failed'),
  });

  const docMutation = useMutation({
    mutationFn: ({ file, type }: { file: File; type: string }) =>
      tenantPortalApi.uploadMyDocument(type, file),
    onSuccess: () => {
      toast.success('Document uploaded for review');
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
    },
    onError: () => toast.error('Document upload failed'),
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  const t = data.tenant ?? data;
  const p = data.profile ?? {};
  const contacts = data.contacts ?? {};
  const hostel = data.hostel;
  const owner = data.owner_contact;
  const room = data.room;
  const docs = (data.documents ?? []) as Record<string, unknown>[];
  const verification = data.verification ?? {};
  const moveOut = data.move_out;
  const isStudent = String(t?.profile_type ?? 'STUDENT').toUpperCase() === 'STUDENT';

  const startEdit = () => {
    setForm({
      name: String(p.name ?? ''),
      gender: String(t.gender ?? ''),
      date_of_birth: t.date_of_birth ? String(t.date_of_birth).slice(0, 10) : '',
      phone_1: String(contacts.tenant_phone?.value ?? t.phone_1 ?? ''),
      phone_2: String(contacts.guardian_phone?.value ?? t.phone_2 ?? ''),
      phone_3: String(contacts.emergency_phone?.value ?? t.phone_3 ?? ''),
      personal_email: String(t.personal_email ?? ''),
      college_name: String(t.college_name ?? ''),
      course: String(t.course ?? ''),
      branch: String(t.branch ?? ''),
      year_of_study: t.year_of_study != null ? String(t.year_of_study) : '',
      section: String(t.section ?? ''),
      roll_number: String(t.roll_number ?? ''),
      office_name: String(t.office_name ?? ''),
      office_location: String(t.office_location ?? ''),
      job_role: String(t.job_role ?? ''),
      permanent_address: String(t.permanent_address ?? ''),
      temporary_address: String(t.temporary_address ?? ''),
      city: String(p.city ?? ''),
      state: String(p.state ?? ''),
      pincode: String(p.pincode ?? ''),
    });
    setEditing(true);
  };

  const ownerPhone = String(owner?.owner_phone ?? hostel?.phone ?? '').replace(/\D/g, '');
  const waPhone = ownerPhone.length === 10 ? `91${ownerPhone}` : ownerPhone;

  const copyPhone = async (phone?: string) => {
    if (!phone) return;
    await navigator.clipboard.writeText(phone);
    toast.success('Copied');
  };

  return (
    <div className="space-y-5 pb-24">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Profile</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your identity & hostel records</p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={startEdit}
            className="text-sm font-semibold text-accent px-3 py-2 rounded-lg border border-accent/30"
          >
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-sm px-3 py-2 rounded-lg border border-border"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              className="text-sm font-semibold px-3 py-2 rounded-lg bg-accent text-accent-foreground"
            >
              Save
            </button>
          </div>
        )}
      </header>

      {/* 1 — Personal */}
      <ProfileSection title="Personal info">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-muted overflow-hidden border border-border">
            {t.photo_url ? (
              <img src={String(t.photo_url)} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                No photo
              </div>
            )}
          </div>
          {editing && (
            <>
              <input
                ref={photoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) photoMutation.mutate(f);
                }}
              />
              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                className="text-sm font-medium text-accent flex items-center gap-1"
              >
                <Upload className="w-4 h-4" />
                Change photo
              </button>
            </>
          )}
        </div>
        {editing ? (
          <>
            <Field label="Full name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="Gender" value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} />
            <Field
              label="Date of birth"
              type="date"
              value={form.date_of_birth}
              onChange={(v) => setForm({ ...form, date_of_birth: v })}
            />
          </>
        ) : (
          <>
            <ProfileRow label="Full name" value={p.name} />
            <ProfileRow label="Gender" value={t.gender ?? '—'} />
            <ProfileRow label="Date of birth" value={fmtDate(t.date_of_birth)} />
            <ProfileRow
              label="Verification"
              value={
                verification.overall === 'VERIFIED'
                  ? 'Verified'
                  : verification.overall === 'ACTION_REQUIRED'
                    ? 'Action required'
                    : 'Pending'
              }
            />
            <div className="pt-2">
              <TenantStatusBadge status={String(t.status)} size="sm" />
            </div>
            <ProfileRow label="Joined" value={fmtDate(t.joined_on)} />
            <ProfileRow label="Profile type" value={t.profile_type} />
          </>
        )}
      </ProfileSection>

      {/* 2 — Contacts */}
      <ProfileSection title="Contact information" description="Tenant, guardian, and emergency numbers">
        {editing ? (
          <>
            <Field
              label="Tenant phone"
              value={form.phone_1}
              onChange={(v) => setForm({ ...form, phone_1: v })}
            />
            <Field
              label="Guardian phone"
              value={form.phone_2}
              onChange={(v) => setForm({ ...form, phone_2: v })}
            />
            <Field
              label="Emergency contact"
              value={form.phone_3}
              onChange={(v) => setForm({ ...form, phone_3: v })}
            />
          </>
        ) : (
          <>
            <ProfileRow label="Tenant phone" value={contacts.tenant_phone?.value} />
            <ProfileRow label="Guardian phone" value={contacts.guardian_phone?.value ?? '—'} />
            <ProfileRow label="Emergency contact" value={contacts.emergency_phone?.value ?? '—'} />
          </>
        )}
      </ProfileSection>

      {/* 3 — Emails */}
      <ProfileSection title="Emails">
        <ProfileRow label="Account email" value={p.account_email} />
        {editing ? (
          <Field
            label="Personal email"
            type="email"
            value={form.personal_email}
            onChange={(v) => setForm({ ...form, personal_email: v })}
          />
        ) : (
          <ProfileRow label="Personal email" value={t.personal_email ?? '—'} />
        )}
        <p className="text-[10px] text-muted-foreground mt-2">
          Account email changes require OTP verification from hostel support.
        </p>
      </ProfileSection>

      {/* 4 — Academic / Work */}
      <ProfileSection title={isStudent ? 'Academic info' : 'Work info'}>
        {isStudent ? (
          editing ? (
            <>
              <Field label="College" value={form.college_name} onChange={(v) => setForm({ ...form, college_name: v })} />
              <Field label="Course" value={form.course} onChange={(v) => setForm({ ...form, course: v })} />
              <Field label="Branch" value={form.branch} onChange={(v) => setForm({ ...form, branch: v })} />
              <Field label="Year" value={form.year_of_study} onChange={(v) => setForm({ ...form, year_of_study: v })} />
              <Field label="Section" value={form.section} onChange={(v) => setForm({ ...form, section: v })} />
              <Field label="Roll number" value={form.roll_number} onChange={(v) => setForm({ ...form, roll_number: v })} />
            </>
          ) : (
            <>
              <ProfileRow label="College" value={t.college_name} />
              <ProfileRow label="Course" value={t.course} />
              <ProfileRow label="Branch" value={t.branch} />
              <ProfileRow label="Year" value={t.year_of_study} />
              <ProfileRow label="Section" value={t.section} />
              <ProfileRow label="Roll no." value={t.roll_number} />
            </>
          )
        ) : editing ? (
          <>
            <Field label="Office" value={form.office_name} onChange={(v) => setForm({ ...form, office_name: v })} />
            <Field label="Location" value={form.office_location} onChange={(v) => setForm({ ...form, office_location: v })} />
            <Field label="Role" value={form.job_role} onChange={(v) => setForm({ ...form, job_role: v })} />
          </>
        ) : (
          <>
            <ProfileRow label="Office" value={t.office_name} />
            <ProfileRow label="Location" value={t.office_location} />
            <ProfileRow label="Role" value={t.job_role} />
          </>
        )}
      </ProfileSection>

      {/* 5 — Address */}
      <ProfileSection title="Address">
        {editing ? (
          <>
            <Field label="Permanent address" value={form.permanent_address} onChange={(v) => setForm({ ...form, permanent_address: v })} />
            <Field label="Temporary address" value={form.temporary_address} onChange={(v) => setForm({ ...form, temporary_address: v })} />
            <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
            <Field label="State" value={form.state} onChange={(v) => setForm({ ...form, state: v })} />
            <Field label="Pincode" value={form.pincode} onChange={(v) => setForm({ ...form, pincode: v })} />
          </>
        ) : (
          <>
            <ProfileRow label="Permanent" value={t.permanent_address} />
            <ProfileRow label="Temporary" value={t.temporary_address} />
            <ProfileRow label="City" value={p.city} />
            <ProfileRow label="State" value={p.state} />
            <ProfileRow label="Pincode" value={p.pincode} />
          </>
        )}
      </ProfileSection>

      {/* 6 — Hostel */}
      <ProfileSection title="Hostel information" readOnly>
        {hostel ? (
          <>
            <ProfileRow label="Hostel" value={hostel.name} />
            <ProfileRow label="Room" value={room?.room_no ?? 'Assignment pending'} />
            <ProfileRow label="Floor" value={room?.floor} />
            <ProfileRow label="Room type" value={room?.room_type} />
            <ProfileRow label="Joined" value={fmtDate(t.joined_on)} />
            <ProfileRow label="Billing start" value={fmtDate(t.billing_start_date)} />
            <ProfileRow label="Monthly rent" value={fmt(Number(t.monthly_rent ?? 0))} />
            <ProfileRow label="Maintenance" value={fmt(Number(t.maintenance_charge ?? 0))} />
            <ProfileRow label="Security deposit" value={fmt(Number(data.advance?.security_deposit ?? t.advance_deposit ?? 0))} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Hostel details will appear once you are assigned.</p>
        )}
      </ProfileSection>

      {/* 7 — Room */}
      <ProfileSection id="room" title="Room details" readOnly>
        {room ? (
          <>
            <ProfileRow label="WiFi network" value={room.wifi_name} />
            <ProfileRow label="WiFi password" value={room.wifi_password ? '••••••••' : '—'} />
            <ProfileRow label="Capacity" value={`${room.current_occupancy ?? '—'} / ${room.capacity}`} />
            <ProfileRow label="Room notes" value={room.notes} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Room assignment pending from hostel management.</p>
        )}
      </ProfileSection>

      {/* 8 — Documents */}
      <ProfileSection id="documents" title="Documents & verification">
        <ul className="space-y-2 mb-4">
          {docs.length === 0 && (
            <li className="text-sm text-muted-foreground">No documents uploaded yet.</li>
          )}
          {docs.map((d) => (
            <li key={String(d.id)} className="p-3 rounded-lg border border-border text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{String(d.doc_type_label ?? d.doc_type)}</span>
                <span
                  className={`text-xs font-semibold ${
                    d.document_status === 'VERIFIED' || d.is_verified
                      ? 'text-emerald-600'
                      : d.document_status === 'REJECTED'
                        ? 'text-destructive'
                        : 'text-amber-600'
                  }`}
                >
                  {String(d.document_status ?? 'PENDING')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Uploaded {fmtDate(String(d.uploaded_at))}</p>
              {d.rejection_reason && (
                <p className="text-xs text-destructive mt-1">Reason: {String(d.rejection_reason)}</p>
              )}
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm"
          >
            {DOC_TYPES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <input
            ref={docRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) docMutation.mutate({ file: f, type: docType });
            }}
          />
          <button
            type="button"
            onClick={() => docRef.current?.click()}
            disabled={docMutation.isPending}
            className="w-full py-3 rounded-xl border border-dashed border-accent text-accent font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload document
          </button>
        </div>
      </ProfileSection>

      {/* 9 — Owner contact */}
      <ProfileSection title="Support & hostel contact" readOnly>
        {owner || hostel ? (
          <>
            <ProfileRow label="Owner" value={owner?.owner_name} />
            {owner?.manager_name && <ProfileRow label="Manager" value={owner.manager_name} />}
            <ProfileRow label="Phone" value={owner?.owner_phone ?? hostel?.phone} />
            <ProfileRow label="Emergency" value={owner?.emergency_contact} />
            <ProfileRow
              label="Address"
              value={[hostel?.address, hostel?.city, hostel?.state, hostel?.pincode].filter(Boolean).join(', ')}
            />
            {hostel?.office_hours && <ProfileRow label="Office hours" value={hostel.office_hours} />}
            <div className="grid grid-cols-3 gap-2 mt-4">
              {ownerPhone && (
                <a
                  href={`tel:${owner?.owner_phone ?? hostel?.phone}`}
                  className="flex flex-col items-center gap-1 py-3 rounded-xl border border-border text-sm font-medium"
                >
                  <Phone className="w-4 h-4 text-accent" />
                  Call
                </a>
              )}
              {waPhone && (
                <a
                  href={`https://wa.me/${waPhone}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center gap-1 py-3 rounded-xl border border-border text-sm font-medium"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  WhatsApp
                </a>
              )}
              <button
                type="button"
                onClick={() => copyPhone(String(owner?.owner_phone ?? hostel?.phone))}
                className="flex flex-col items-center gap-1 py-3 rounded-xl border border-border text-sm font-medium"
              >
                <Copy className="w-4 h-4" />
                Copy
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Contact details unavailable.</p>
        )}
      </ProfileSection>

      {/* 10 — Move-out */}
      <ProfileSection title="Move-out status" readOnly>
        {moveOut ? (
          <>
            <ProfileRow label="Status" value={String(moveOut.status).replace(/_/g, ' ')} />
            <ProfileRow label="Planned exit" value={fmtDate(moveOut.planned_exit_date)} />
            <Link to="/tenant/move-out" className="text-sm font-semibold text-accent mt-2 inline-block">
              View full move-out timeline →
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">No active move-out request.</p>
            <Link
              to="/tenant/move-out"
              className="mt-3 inline-block text-sm font-semibold text-accent"
            >
              Request move-out →
            </Link>
          </>
        )}
      </ProfileSection>

      {/* 11 — Logout */}
      <button
        type="button"
        onClick={() => logout()}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-destructive/50 text-destructive font-bold text-sm bg-destructive/5 touch-manipulation"
      >
        <LogOut className="w-5 h-5" />
        Log out
      </button>
    </div>
  );
}
