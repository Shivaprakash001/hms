import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Copy,
  Loader2,
  LogOut,
  MessageCircle,
  Phone,
  Upload,
  Send,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { tenantPortalApi } from '@features/tenant-portal/api';
import { tenantService } from '@features/tenants/api';
import { useAuth } from '@context/AuthContext';
import { ProfileRow, ProfileSection } from '@/portal/components/profile/ProfileSection';
import { TenantStatusBadge } from '@features/tenants/components/badges/TenantStatusBadge';

const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const documentTypesForProfile = (profileType?: string) => {
  const type = String(profileType || 'STUDENT').toUpperCase();
  return type === 'WORKING_PROFESSIONAL'
    ? [
        { value: 'AADHAAR', label: 'Aadhaar' },
        { value: 'WORK_ID', label: 'Work ID' },
      ]
    : [
        { value: 'AADHAAR', label: 'Aadhaar' },
        { value: 'COLLEGE_ID', label: 'College ID' },
      ];
};

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
  const [docNumber, setDocNumber] = useState<string>('');
  const [form, setForm] = useState<Record<string, string>>({});
  const [selectedCollege, setSelectedCollege] = useState<string>('');
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [newMessages, setNewMessages] = useState<Record<string, string>>({});
  const [expandedChats, setExpandedChats] = useState<Record<string, boolean>>({});

  const { data, isLoading, isError, refetch } = useQuery({
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
    mutationFn: ({ file, type, number }: { file: File; type: string; number: string }) =>
      tenantPortalApi.uploadMyDocument(type, file, number),
    onSuccess: () => {
      toast.success('Document uploaded for review');
      setDocNumber('');
      if (docRef.current) docRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
    },
    onError: () => toast.error('Document upload failed'),
  });

  const messageMutation = useMutation({
    mutationFn: ({ docId, message }: { docId: string; message: string }) => {
      const tenantId = data?.tenant?.id ?? data?.id ?? '';
      return tenantService.postDocumentMessage(tenantId, docId, message);
    },
    onSuccess: (_, variables) => {
      setNewMessages((prev) => ({ ...prev, [variables.docId]: '' }));
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      toast.success('Message sent');
    },
    onError: () => toast.error('Failed to send message'),
  });

  // Compute before early return — Rules of Hooks requires unconditional hook calls
  const docTypes = data ? documentTypesForProfile((data.tenant ?? data)?.profile_type) : [];

  useEffect(() => {
    if (docTypes.length && !docTypes.some((type) => type.value === docType)) {
      setDocType(docTypes[0]?.value ?? 'AADHAAR');
    }
  }, [docType, docTypes]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6 text-destructive" />
        </div>
        <p className="text-base font-bold text-foreground">Could not load your profile</p>
        <p className="text-sm text-muted-foreground mt-1">Check your connection and try again.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 px-5 py-2.5 rounded-2xl bg-accent text-accent-foreground text-sm font-semibold"
        >
          Retry
        </button>
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

  const profileFields = [
    { label: 'Full name', value: p.name },
    { label: 'Gender', value: t.gender },
    { label: 'Date of birth', value: t.date_of_birth },
    { label: 'Profile photo', value: t.photo_url },
    { label: 'Tenant phone', value: t.phone_1 || p.phone },
    { label: 'Guardian phone', value: t.phone_2 },
    { label: 'Emergency phone', value: t.phone_3 || p.emergency_contact },
    { label: 'Profile type', value: t.profile_type },
    { label: 'Permanent address', value: t.permanent_address },
    { label: 'City', value: p.city },
    { label: 'State', value: p.state },
    { label: 'Pincode', value: p.pincode },
    { label: 'Documents', value: docs.length > 0 ? 'uploaded' : '' },
  ];

  if (isStudent) {
    profileFields.push(
      { label: 'College name', value: t.college_name },
      { label: 'Course', value: t.course },
      { label: 'Year of study', value: t.year_of_study },
    );
  } else if (String(t.profile_type).toUpperCase() === 'WORKING_PROFESSIONAL') {
    profileFields.push(
      { label: 'Office name', value: t.office_name },
      { label: 'Job role', value: t.job_role },
      { label: 'Office location', value: t.office_location },
    );
  }

  const completedFields = profileFields.filter(f => f.value != null && String(f.value).trim() !== '');
  const completionPercent = Math.round((completedFields.length / profileFields.length) * 100);

  const startEdit = () => {
    const college = String(t.college_name ?? '');
    if (college === 'Sreenidhi Institute of Science and Technology' || college === 'Sreenidhi University') {
      setSelectedCollege(college);
    } else if (college) {
      setSelectedCollege('Other');
    } else {
      setSelectedCollege('');
    }

    const course = String(t.course ?? '');
    if (course === 'B.Tech') {
      setSelectedCourse(course);
    } else if (course) {
      setSelectedCourse('Other');
    } else {
      setSelectedCourse('');
    }

    setForm({
      name: String(p.name ?? ''),
      gender: String(t.gender ?? ''),
      date_of_birth: t.date_of_birth ? String(t.date_of_birth).slice(0, 10) : '',
      phone_1: String(contacts.tenant_phone?.value ?? t.phone_1 ?? ''),
      phone_2: String(contacts.guardian_phone?.value ?? t.phone_2 ?? ''),
      phone_3: String(contacts.emergency_phone?.value ?? t.phone_3 ?? ''),
      college_name: college,
      course: course,
      branch: String(t.branch ?? ''),
      year_of_study: t.year_of_study != null ? String(t.year_of_study) : '',
      section: String(t.section ?? ''),
      roll_number: String(t.roll_number ?? ''),
      office_name: String(t.office_name ?? ''),
      office_location: String(t.office_location ?? ''),
      job_role: String(t.job_role ?? ''),
      permanent_address: String(t.permanent_address ?? ''),
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
      <header className="overflow-hidden rounded-2xl shadow-sm">
        <div
          className="px-5 py-4 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1B2D5B 0%, #243A72 100%)' }}
        >
          <div
            className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #F07B1D 0%, transparent 60%)' }}
          />
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-white/15 ring-2 ring-white/20 shrink-0">
              {t.photo_url ? (
                <img src={String(t.photo_url)} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-xl font-bold text-white">
                    {String(p.name ?? 'T').charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60">Tenant Profile</p>
              <h1
                className="text-xl font-bold text-white truncate leading-tight"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {String(p.name ?? t.name ?? 'Your Profile')}
              </h1>
              <div className="mt-1.5">
                <TenantStatusBadge status={String(t.status)} size="sm" />
              </div>
            </div>
          </div>
        </div>
        <div className="bg-card border border-t-0 border-border rounded-b-2xl px-5 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Identity &amp; hostel records</p>
          {!editing ? (
            <button
              type="button"
              onClick={startEdit}
              className="text-sm font-semibold text-accent px-3 py-2 rounded-xl border border-accent/30 hover:bg-accent/5 transition-colors"
            >
              Edit profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-sm px-3 py-2 rounded-xl border border-border"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                className="text-sm font-semibold px-4 py-2 rounded-xl bg-accent text-accent-foreground active:scale-[0.98] transition-transform"
              >
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground">Profile completeness</span>
          <span className="text-sm font-bold text-accent">{completionPercent}%</span>
        </div>
        <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${completionPercent}%`, background: completionPercent === 100 ? 'var(--success)' : 'var(--accent)' }}
          />
        </div>
        {completionPercent === 100 ? (
          <div className="flex items-center gap-2 text-xs font-medium text-success">
            <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
            Profile is 100% complete
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-amber-700">Missing: </span>
            {profileFields.filter(f => !f.value || String(f.value).trim() === '').map(f => f.label).join(', ')}
          </p>
        )}
      </div>

      {/* 1 — Personal */}
      <ProfileSection title="Personal info">
        <div className="flex items-center gap-4 mb-5">
          <div className={`w-16 h-16 rounded-full overflow-hidden bg-accent/10 shrink-0 ${editing ? 'ring-2 ring-accent ring-offset-2' : 'ring-1 ring-border'}`}>
            {t.photo_url ? (
              <img src={String(t.photo_url)} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-xl font-bold text-accent">{String(p.name ?? 'T').charAt(0).toUpperCase()}</span>
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
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-accent/30 text-sm font-semibold text-accent hover:bg-accent/5 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
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
        <ProfileRow label="Account email" value={p.account_email || p.email} />
        <p className="text-[10px] text-muted-foreground mt-2">
          Account email changes require OTP verification from hostel support.
        </p>
      </ProfileSection>

      {/* 4 — Academic / Work */}
      <ProfileSection title={isStudent ? 'Academic info' : 'Work info'}>
        {isStudent ? (
          editing ? (
            <>
              <label className="block text-sm mb-3">
                <span className="text-muted-foreground text-xs">College</span>
                <select
                  value={selectedCollege}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedCollege(val);
                    if (val !== 'Other') {
                      setForm({ ...form, college_name: val });
                    } else {
                      setForm({ ...form, college_name: '' });
                    }
                  }}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm"
                >
                  <option value="">Select College</option>
                  <option value="Sreenidhi Institute of Science and Technology">Sreenidhi Institute of Science and Technology</option>
                  <option value="Sreenidhi University">Sreenidhi University</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              {selectedCollege === 'Other' && (
                <Field
                  label="Custom College Name"
                  value={form.college_name}
                  onChange={(v) => setForm({ ...form, college_name: v })}
                />
              )}

              <label className="block text-sm mb-3">
                <span className="text-muted-foreground text-xs">Course</span>
                <select
                  value={selectedCourse}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedCourse(val);
                    if (val !== 'Other') {
                      setForm({ ...form, course: val });
                    } else {
                      setForm({ ...form, course: '' });
                    }
                  }}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm"
                >
                  <option value="">Select Course</option>
                  <option value="B.Tech">B.Tech</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              {selectedCourse === 'Other' && (
                <Field
                  label="Custom Course Name"
                  value={form.course}
                  onChange={(v) => setForm({ ...form, course: v })}
                />
              )}

              <label className="block text-sm mb-3">
                <span className="text-muted-foreground text-xs">Year</span>
                <select
                  value={form.year_of_study}
                  onChange={(e) => setForm({ ...form, year_of_study: e.target.value })}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm"
                >
                  <option value="">Select Year</option>
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                </select>
              </label>

              <Field label="Branch" value={form.branch} onChange={(v) => setForm({ ...form, branch: v })} />
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
            <Field label="Permanent address (Address, City, State, Pincode)" value={form.permanent_address} onChange={(v) => setForm({ ...form, permanent_address: v })} />
            <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
            <Field label="State" value={form.state} onChange={(v) => setForm({ ...form, state: v })} />
            <Field label="Pincode" value={form.pincode} onChange={(v) => setForm({ ...form, pincode: v })} />
          </>
        ) : (
          <>
            <ProfileRow label="Permanent address" value={t.permanent_address} />
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
            <ProfileRow label="Joined" value={fmtDate(t.joined_on)} />
            <ProfileRow label="Billing start" value={fmtDate(t.billing_start_date)} />
            <ProfileRow label="Monthly rent" value={fmt(Number(t.monthly_rent ?? 0))} />
            <ProfileRow label="Maintenance" value={fmt(Number(t.maintenance_charge ?? 0))} />
            <ProfileRow label="Security deposit" value={fmt(Number(data.advance?.security_deposit ?? t.advance_deposit ?? 0))} />
            {Number(data.advance?.available_rent_advance ?? 0) > 0 && (
              <ProfileRow label="Future rent credit" value={fmt(Number(data.advance?.available_rent_advance))} />
            )}
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
        <div className="mb-4 rounded-xl border border-accent/20 bg-accent/5 p-3 text-xs text-muted-foreground">
          Upload Aadhaar and {isStudent ? 'College ID' : 'Work ID'} only. Replacing a document archives the older copy and sends the new one to your owner for review.
        </div>
        <ul className="space-y-2 mb-4">
          {docs.length === 0 && (
            <li className="text-sm text-muted-foreground">No documents uploaded yet.</li>
          )}
          {docs.map((d) => {
            const docId = String(d.id);
            const status = String(d.document_status ?? 'PENDING').toUpperCase();
            
            let chatMessages: { sender: string; sender_name: string; message: string; timestamp: string }[] = [];
            try {
              const reasonStr = String(d.rejection_reason || '');
              if (reasonStr.startsWith('[') && reasonStr.endsWith(']')) {
                chatMessages = JSON.parse(reasonStr);
              } else if (reasonStr) {
                chatMessages = [{ sender: 'owner', sender_name: 'Owner Query', message: reasonStr, timestamp: '' }];
              }
            } catch {
              chatMessages = [];
            }

            const isChatExpanded = expandedChats[docId];

            return (
              <li key={docId} className="p-4 rounded-xl border border-border bg-card text-sm space-y-3">
                <div className="flex justify-between items-center gap-2">
                  <span className="font-semibold text-foreground">{String(d.doc_type_label ?? d.doc_type)}</span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase ${
                      status === 'APPROVED' || d.is_verified
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : status === 'REJECTED'
                          ? 'bg-rose-500/10 text-rose-600'
                          : 'bg-amber-500/10 text-amber-600'
                    }`}
                  >
                    {status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Uploaded {fmtDate(String(d.uploaded_at || d.created_at))}</p>
                {d.doc_number && (
                  <p className="text-xs text-muted-foreground">Document no. {String(d.doc_number)}</p>
                )}
                
                {/* Chat section for Document queries */}
                <div className="mt-2 pt-2 border-t border-border/60 space-y-2">
                  <button
                    type="button"
                    onClick={() => setExpandedChats(prev => ({ ...prev, [docId]: !prev[docId] }))}
                    className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-accent" />
                      {chatMessages.length > 0
                        ? `Conversational Thread (${chatMessages.length})`
                        : 'View / Start Verification Conversation'}
                    </span>
                    {isChatExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {isChatExpanded && (
                    <div className="space-y-3 pt-2">
                      {chatMessages.length > 0 && (
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                          {chatMessages.map((msg, idx) => {
                            const isOwner = msg.sender === 'owner';
                            return (
                              <div
                                key={idx}
                                className={`flex flex-col max-w-[85%] ${!isOwner ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                              >
                                <span className="text-[9px] text-muted-foreground mb-0.5 px-1">
                                  {msg.sender_name}
                                </span>
                                <div className={`p-2.5 rounded-2xl text-xs font-medium leading-relaxed ${
                                  !isOwner
                                    ? 'bg-accent text-accent-foreground rounded-tr-none'
                                    : 'bg-secondary text-secondary-foreground rounded-tl-none'
                                }`}>
                                  {msg.message}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="Reply to owner or upload comment..."
                          value={newMessages[docId] || ''}
                          onChange={(e) => setNewMessages(prev => ({ ...prev, [docId]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const text = (newMessages[docId] || '').trim();
                              if (text) messageMutation.mutate({ docId, message: text });
                            }
                          }}
                          className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const text = (newMessages[docId] || '').trim();
                            if (text) messageMutation.mutate({ docId, message: text });
                          }}
                          className="p-2 rounded-xl bg-accent text-accent-foreground"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col gap-2">
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm"
          >
            {docTypes.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={docNumber}
            onChange={(e) => setDocNumber(e.target.value)}
            placeholder="Document number (optional)"
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm"
          />
          <input
            ref={docRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) docMutation.mutate({ file: f, type: docType, number: docNumber });
            }}
          />
          <button
            type="button"
            onClick={() => docRef.current?.click()}
            disabled={docMutation.isPending}
            className="w-full py-3.5 rounded-2xl border-2 border-dashed border-accent/40 bg-accent/5 text-accent font-semibold text-sm flex items-center justify-center gap-2 hover:border-accent hover:bg-accent/8 transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {docMutation.isPending ? 'Uploading…' : 'Upload document'}
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
                  className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-primary text-primary-foreground text-xs font-semibold"
                >
                  <Phone className="w-4 h-4" />
                  Call
                </a>
              )}
              {waPhone && (
                <a
                  href={`https://wa.me/${waPhone}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center gap-1.5 py-3 rounded-2xl border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-700"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </a>
              )}
              <button
                type="button"
                onClick={() => copyPhone(String(owner?.owner_phone ?? hostel?.phone))}
                className="flex flex-col items-center gap-1.5 py-3 rounded-2xl border border-border bg-secondary text-xs font-semibold text-foreground"
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
        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border border-destructive/30 text-destructive font-semibold text-sm bg-destructive/5 hover:bg-destructive/10 transition-colors active:scale-[0.98] touch-manipulation"
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </button>
    </div>
  );
}
