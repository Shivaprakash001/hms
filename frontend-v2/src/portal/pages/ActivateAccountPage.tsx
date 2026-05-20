import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BadgeIndianRupee,
  Building2,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  DoorOpen,
  FileText,
  Loader2,
  Lock,
  Receipt,
  ShieldCheck,
  UserRound,
  Users,
  Wifi,
} from 'lucide-react';
import { tenantService } from '@features/tenants/api';
import { useAuth } from '@context/AuthContext';

type ActivationStep = 'ACCOUNT' | 'RULES' | 'PROFILE' | 'ACTIVATE';

type ActivationContext = {
  activation_state: {
    current_step: ActivationStep;
    completed_steps: ActivationStep[];
    blocked_steps: ActivationStep[];
    account_setup_completed: boolean;
    rules_accepted: boolean;
    profile_completed: boolean;
    documents_uploaded: boolean;
    activation_completed: boolean;
  };
  current_step: ActivationStep;
  profile: { name?: string; email?: string; phone?: string };
  tenant: Record<string, string | number | null | undefined>;
  hostel: { name?: string; logo_url?: string; address?: string; phone?: string };
  room_summary: Record<string, string | number | boolean | string[] | null | undefined>;
  rules: {
    title?: string;
    version?: string;
    content?: { categories?: RuleCategory[] };
    required_acknowledgements?: string[];
  };
  documents: { uploaded_count?: number; verification_status?: string };
  missing_fields?: { tier_1_required?: string[] };
};

type RuleCategory = {
  id: string;
  title: string;
  severity?: 'standard' | 'important' | 'critical';
  icon?: string;
  highlights?: string[];
  rules?: string[];
};

const currency = (value: unknown) =>
  Number(value || 0).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });

const fmtDate = (value: unknown) =>
  value ? new Date(String(value)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const phoneDigits = (value: unknown) => String(value || '').replace(/\D/g, '').slice(-10);

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20';

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-muted-foreground">
        {label}
        {required ? ' *' : ''}
      </span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass} />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block sm:col-span-2">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={`${fieldClass} resize-none`} />
    </label>
  );
}

function RuleIcon({ icon }: { icon?: string }) {
  const cls = 'w-4 h-4';
  if (icon === 'receipt') return <Receipt className={cls} />;
  if (icon === 'lock') return <Lock className={cls} />;
  if (icon === 'wifi') return <Wifi className={cls} />;
  if (icon === 'alert-triangle') return <AlertTriangle className={cls} />;
  if (icon === 'door-open') return <DoorOpen className={cls} />;
  return <ShieldCheck className={cls} />;
}

function Progress({ ctx }: { ctx: ActivationContext }) {
  const steps: { id: ActivationStep; label: string }[] = [
    { id: 'ACCOUNT', label: 'Account' },
    { id: 'RULES', label: 'Rules' },
    { id: 'PROFILE', label: 'Profile' },
    { id: 'ACTIVATE', label: 'Activate' },
  ];
  const completed = new Set(ctx.completed_steps ?? ctx.activation_state.completed_steps ?? []);
  const current = ctx.current_step ?? ctx.activation_state.current_step;
  return (
    <div className="grid grid-cols-4 gap-2">
      {steps.map((step) => {
        const done = completed.has(step.id);
        const active = current === step.id;
        return (
          <div key={step.id} className="min-w-0">
            <div className={`h-1.5 rounded-full ${done || active ? 'bg-accent' : 'bg-muted'}`} />
            <p className={`mt-1 text-[11px] font-medium truncate ${active ? 'text-accent' : 'text-muted-foreground'}`}>
              {step.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function ActivateAccountPage() {
  const { token: pathToken } = useParams();
  const [searchParams] = useSearchParams();
  const token = pathToken || searchParams.get('token') || '';
  const navigate = useNavigate();
  const { login } = useAuth();

  const [ctx, setCtx] = useState<ActivationContext | null>(null);
  const [checking, setChecking] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [invalidCode, setInvalidCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [lastPassword, setLastPassword] = useState('');

  const [account, setAccount] = useState({ password: '', confirm_password: '', phone: '' });
  const [acks, setAcks] = useState<Record<string, boolean>>({});
  const [profile, setProfile] = useState<Record<string, string>>({
    phone: '',
    gender: '',
    date_of_birth: '',
    permanent_address: '',
    temporary_address: '',
    profile_type: 'STUDENT',
    college_name: '',
    course: '',
    year_of_study: '',
    branch: '',
    roll_number: '',
    office_name: '',
    office_location: '',
    job_role: '',
    guardian_name: '',
    guardian_phone: '',
    guardian_relation: '',
    emergency_phone: '',
  });

  const [selectedCollege, setSelectedCollege] = useState<string>('');
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string>('');

  const loadContext = async () => {
    if (!token) {
      setInvalid(true);
      setChecking(false);
      return;
    }
    setChecking(true);
    try {
      const data = await tenantService.getActivationContext(token);
      setCtx(data);
      if (data.tenant?.photo_url) {
        setProfilePhotoPreview(data.tenant.photo_url);
      }
      setInvalid(false);
      setInvalidCode('');
      setError('');
      setAccount((prev) => ({
        ...prev,
        phone: prev.phone || phoneDigits(data.tenant?.phone_1 || data.profile?.phone),
      }));

      const college = String(data.tenant?.college_name || '');
      if (college === 'Sreenidhi Institute of Science and Technology' || college === 'Sreenidhi University') {
        setSelectedCollege(college);
      } else if (college) {
        setSelectedCollege('Other');
      }

      const course = String(data.tenant?.course || '');
      if (course === 'B.Tech') {
        setSelectedCourse(course);
      } else if (course) {
        setSelectedCourse('Other');
      }

      setProfile((prev) => ({
        ...prev,
        phone: prev.phone || phoneDigits(data.tenant?.phone_1 || data.profile?.phone),
        gender: prev.gender || String(data.tenant?.gender || ''),
        date_of_birth: prev.date_of_birth || String(data.tenant?.date_of_birth || ''),
        permanent_address: prev.permanent_address || String(data.tenant?.permanent_address || ''),
        temporary_address: prev.temporary_address || String(data.tenant?.temporary_address || ''),
        profile_type: prev.profile_type || String(data.tenant?.profile_type || 'STUDENT'),
        college_name: prev.college_name || college,
        course: prev.course || course,
        year_of_study: prev.year_of_study || String(data.tenant?.year_of_study || ''),
        branch: prev.branch || String(data.tenant?.branch || ''),
        roll_number: prev.roll_number || String(data.tenant?.roll_number || ''),
        office_name: prev.office_name || String(data.tenant?.office_name || ''),
        office_location: prev.office_location || String(data.tenant?.office_location || ''),
        job_role: prev.job_role || String(data.tenant?.job_role || ''),
        guardian_name: prev.guardian_name || String(data.tenant?.guardian_name || ''),
        guardian_phone: prev.guardian_phone || phoneDigits(data.tenant?.guardian_phone || data.tenant?.phone_2),
        guardian_relation: prev.guardian_relation || String(data.tenant?.guardian_relation || ''),
        emergency_phone: prev.emergency_phone || phoneDigits(data.tenant?.phone_3),
      }));
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        'This invitation link has expired or was already used.';
      const code =
        (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code || '';
      setInvalid(true);
      setInvalidCode(code);
      setError(message);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    loadContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const currentStep = ctx?.current_step ?? ctx?.activation_state.current_step;
  const ruleCategories = ctx?.rules?.content?.categories ?? [];
  const requiredAcks = ctx?.rules?.required_acknowledgements ?? [];
  const allAcksChecked = requiredAcks.length > 0 && requiredAcks.every((key) => acks[key] === true);

  const submitStep = async (step: ActivationStep, data: Record<string, unknown>) => {
    setSubmitting(true);
    setError('');
    try {
      const result = await tenantService.updateActivationWorkflow({ token, step, data });
      if (step === 'ACCOUNT' && typeof data.password === 'string') setLastPassword(data.password);
      if (step === 'ACTIVATE') {
        if (lastPassword && ctx?.profile?.email) {
          try {
            await login(ctx.profile.email, lastPassword);
            navigate('/tenant/dashboard', { replace: true });
            return;
          } catch {
            navigate('/login', { replace: true });
            return;
          }
        }
        navigate(result?.redirect_to || '/login', { replace: true });
        return;
      }
      setCtx(result as ActivationContext);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        'Could not save this step';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const accountSubmit = (e: FormEvent) => {
    e.preventDefault();
    submitStep('ACCOUNT', account);
  };

  const handlePhotoChange = (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2MB');
      return;
    }
    setProfilePhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const profileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profilePhotoFile && !profilePhotoPreview) {
      setError('Profile photo is required');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      let photoUrl = profilePhotoPreview;
      if (profilePhotoFile) {
        const uploadRes = await tenantService.uploadActivationPhoto(token, profilePhotoFile);
        if (uploadRes?.photo_url) {
          photoUrl = uploadRes.photo_url;
        }
      }
      await submitStep('PROFILE', { ...profile, photo_url: photoUrl });
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to save profile or upload photo';
      setError(message);
      setSubmitting(false);
    }
  };

  const documentPending = ctx && !ctx.activation_state.documents_uploaded;

  if (checking) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-[340px_1fr]">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="h-14 w-14 rounded-2xl bg-muted animate-pulse" />
            <div className="mt-5 h-3 rounded bg-muted animate-pulse" />
            <div className="mt-3 h-24 rounded-xl bg-muted animate-pulse" />
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
            <p className="mt-4 text-sm font-medium text-foreground">Loading your setup</p>
            <p className="mt-1 text-sm text-muted-foreground">Checking the latest activation state...</p>
          </div>
        </div>
      </div>
    );
  }

  if (invalid || !ctx) {
    const title =
      invalidCode === 'ALREADY_ACTIVE'
        ? 'Account already active'
        : invalidCode === 'EXPIRED'
          ? 'Invitation expired'
          : invalidCode === 'CANCELLED'
            ? 'Invitation cancelled'
            : 'Invitation unavailable';
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h1 className="mt-5 text-xl font-bold text-foreground">{title}</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{error || 'This activation link has expired or was already used.'}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={loadContext} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">
            Retry
          </button>
          <Link to="/login" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-5 sm:py-8">
      <main className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[360px_1fr]">
        <aside className="h-fit rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center overflow-hidden">
              {ctx.hostel.logo_url ? (
                <img src={ctx.hostel.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <Building2 className="w-7 h-7 text-accent" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-accent">Tenant admission</p>
              <h1 className="text-xl font-bold text-foreground truncate">{ctx.hostel.name}</h1>
            </div>
          </div>

          <div className="mt-5">
            <Progress ctx={ctx} />
          </div>

          <div className="mt-5 rounded-xl border border-border bg-background p-4 text-sm">
            <p className="font-semibold text-foreground">Stay summary</p>
            <dl className="mt-3 space-y-2 text-muted-foreground">
              <div className="flex justify-between gap-3">
                <dt>Room</dt>
                <dd className="font-medium text-foreground">{String(ctx.room_summary.room_number || 'Assigned')}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Occupancy</dt>
                <dd className="font-medium text-foreground">
                  {ctx.room_summary.current_occupancy || '—'} / {ctx.room_summary.capacity || '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Rent</dt>
                <dd className="font-medium text-foreground">{currency(ctx.room_summary.monthly_rent)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Billing starts</dt>
                <dd className="font-medium text-foreground">{fmtDate(ctx.room_summary.billing_start_date)}</dd>
              </div>
            </dl>
          </div>
        </aside>

        <section className="rounded-2xl border border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-6">
          {error && (
            <div className="mb-5 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {showWelcome && currentStep === 'ACCOUNT' && !ctx.activation_state.account_setup_completed ? (
            <div className="space-y-6">
              <div>
                <p className="text-sm font-semibold text-accent">Welcome</p>
                <h2 className="mt-1 text-2xl font-bold text-foreground">
                  {ctx.activation_state.completed_steps.length > 0 ? 'Resume setup' : `Welcome to ${ctx.hostel.name}`}
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Your room and billing details are ready. Complete a short setup to enter your tenant portal.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric icon={<DoorOpen className="w-4 h-4" />} label="Room" value={String(ctx.room_summary.room_number || 'Assigned')} />
                <Metric icon={<BadgeIndianRupee className="w-4 h-4" />} label="Monthly rent" value={currency(ctx.room_summary.monthly_rent)} />
                <Metric icon={<Users className="w-4 h-4" />} label="Roommates" value={String(ctx.room_summary.roommates_count ?? 0)} />
              </div>
              <button
                type="button"
                onClick={() => setShowWelcome(false)}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground"
              >
                Start setup
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : null}

          {currentStep === 'ACCOUNT' && (!showWelcome || ctx.activation_state.account_setup_completed) && (
            <form onSubmit={accountSubmit} className="space-y-5">
              <SectionHeading icon={<UserRound className="w-5 h-5" />} title="Set up your account" text="Choose your password and confirm your primary mobile number. No OTP is required." />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Password" type="password" required value={account.password} onChange={(v) => setAccount({ ...account, password: v })} />
                <Field label="Confirm password" type="password" required value={account.confirm_password} onChange={(v) => setAccount({ ...account, confirm_password: v })} />
                <Field label="Primary mobile" required value={account.phone} onChange={(v) => setAccount({ ...account, phone: phoneDigits(v) })} />
              </div>
              <PrimaryButton loading={submitting}>Save account setup</PrimaryButton>
            </form>
          )}

          {currentStep === 'RULES' && (
            <div className="space-y-5">
              <SectionHeading icon={<ClipboardCheck className="w-5 h-5" />} title={ctx.rules.title || 'Hostel rules'} text="Review the important rules in short sections. Your acknowledgement is stored with the current rule snapshot." />
              <div className="grid gap-3">
                {ruleCategories.map((category) => (
                  <details
                    key={category.id}
                    open
                    className={`rounded-xl border p-4 bg-background transition-all duration-300 ${
                      category.id === 'facilities'
                        ? 'border-emerald-500/60 bg-emerald-50/5 dark:bg-emerald-950/5 shadow-md shadow-emerald-500/5 ring-1 ring-emerald-500/10'
                        : 'border-border bg-background'
                    }`}
                  >
                    <summary className="cursor-pointer list-none">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 font-semibold text-foreground">
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                              category.id === 'facilities'
                                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                : 'bg-accent/10 text-accent'
                            }`}
                          >
                            <RuleIcon icon={category.icon} />
                          </span>
                          {category.title}
                        </div>
                        {category.id === 'facilities' ? (
                          <span className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white shadow-sm shadow-emerald-500/20">
                            Included Facilities
                          </span>
                        ) : (
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                              category.severity === 'critical'
                                ? 'bg-destructive/10 text-destructive'
                                : category.severity === 'important'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {category.severity || 'standard'}
                          </span>
                        )}
                      </div>
                    </summary>
                    <div className="mt-3 space-y-2">
                      {(category.highlights || []).map((item) => (
                        <p
                          key={item}
                          className={`rounded-lg px-3 py-2 text-sm font-semibold leading-relaxed ${
                            category.id === 'facilities'
                              ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-300'
                              : 'bg-muted/50 text-foreground'
                          }`}
                        >
                          {item}
                        </p>
                      ))}
                      {(category.rules || []).map((item) => (
                        <p key={item} className="text-sm text-muted-foreground">
                          {item}
                        </p>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
              <div className="space-y-2 rounded-xl border border-border bg-background p-4">
                {[
                  ['fee_refund_rules', 'I understand hostel fee and refund rules'],
                  ['discipline_policies', 'I understand discipline policies'],
                  ['late_fee_obligations', 'I understand late fee and payment obligations'],
                  ['damage_liabilities', 'I understand hostel property damage liabilities'],
                  ['hostel_rules', 'I agree to comply with hostel rules'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={acks[key] === true} onChange={(e) => setAcks({ ...acks, [key]: e.target.checked })} className="mt-1 h-4 w-4 accent-accent" />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                disabled={!allAcksChecked || submitting}
                onClick={() => submitStep('RULES', { acknowledgements: acks, typed_signature_name: ctx.profile.name })}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Accept rules
              </button>
            </div>
          )}

          {currentStep === 'PROFILE' && (
            <form onSubmit={profileSubmit} className="space-y-5">
              <SectionHeading icon={<ShieldCheck className="w-5 h-5" />} title="Complete required profile details" text="Tier 1 fields are required for activation. Other details improve hostel records and can be completed now or later." />
              
              {/* Profile Photo Upload */}
              <label className="flex items-center gap-4 rounded-xl border border-border bg-background p-4 cursor-pointer">
                <div className="w-16 h-16 rounded-full border border-border bg-muted overflow-hidden flex items-center justify-center relative group">
                  {profilePhotoPreview ? (
                    <img
                      src={profilePhotoPreview}
                      alt="Profile preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Camera className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">
                    Profile photo *
                  </p>
                  <p className="text-sm text-muted-foreground">JPG, PNG, or WEBP under 2MB</p>
                  {profilePhotoFile && (
                    <p className="text-xs text-accent mt-1">{profilePhotoFile.name}</p>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handlePhotoChange(e.target.files?.[0])}
                />
                <span className="text-sm font-semibold text-accent">Choose photo</span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Primary mobile" required value={profile.phone} onChange={(v) => setProfile({ ...profile, phone: phoneDigits(v) })} />
                <Field label="Emergency contact (Mobile) *" required value={profile.emergency_phone} onChange={(v) => setProfile({ ...profile, emergency_phone: phoneDigits(v) })} />
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground">Gender *</span>
                  <select value={profile.gender} onChange={(e) => setProfile({ ...profile, gender: e.target.value })} className={fieldClass}>
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </label>
                <Field label="Date of birth" required type="date" value={profile.date_of_birth} onChange={(v) => setProfile({ ...profile, date_of_birth: v })} />
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground">Profile type</span>
                  <select value={profile.profile_type} onChange={(e) => setProfile({ ...profile, profile_type: e.target.value })} className={fieldClass}>
                    <option value="STUDENT">Student</option>
                    <option value="WORKING_PROFESSIONAL">Working professional</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-4">
                <TextArea label="Permanent address (Address, City, State, Pincode) *" required value={profile.permanent_address} onChange={(v) => setProfile({ ...profile, permanent_address: v })} />
              </div>

              {profile.profile_type === 'STUDENT' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold text-muted-foreground">College</span>
                    <select
                      value={selectedCollege}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedCollege(val);
                        if (val !== 'Other') {
                          setProfile((prev) => ({ ...prev, college_name: val }));
                        } else {
                          setProfile((prev) => ({ ...prev, college_name: '' }));
                        }
                      }}
                      className={fieldClass}
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
                      value={profile.college_name}
                      onChange={(v) => setProfile({ ...profile, college_name: v })}
                    />
                  )}

                  <label className="block">
                    <span className="text-xs font-semibold text-muted-foreground">Course</span>
                    <select
                      value={selectedCourse}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedCourse(val);
                        if (val !== 'Other') {
                          setProfile((prev) => ({ ...prev, course: val }));
                        } else {
                          setProfile((prev) => ({ ...prev, course: '' }));
                        }
                      }}
                      className={fieldClass}
                    >
                      <option value="">Select Course</option>
                      <option value="B.Tech">B.Tech</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>

                  {selectedCourse === 'Other' && (
                    <Field
                      label="Custom Course Name"
                      value={profile.course}
                      onChange={(v) => setProfile({ ...profile, course: v })}
                    />
                  )}

                  <label className="block">
                    <span className="text-xs font-semibold text-muted-foreground">Year of study</span>
                    <select
                      value={profile.year_of_study}
                      onChange={(e) => setProfile({ ...profile, year_of_study: e.target.value })}
                      className={fieldClass}
                    >
                      <option value="">Select Year of study</option>
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                    </select>
                  </label>

                  <Field label="Roll number" value={profile.roll_number} onChange={(v) => setProfile({ ...profile, roll_number: v })} />
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Office" value={profile.office_name} onChange={(v) => setProfile({ ...profile, office_name: v })} />
                  <Field label="Office location" value={profile.office_location} onChange={(v) => setProfile({ ...profile, office_location: v })} />
                  <Field label="Job role" value={profile.job_role} onChange={(v) => setProfile({ ...profile, job_role: v })} />
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Guardian name" value={profile.guardian_name} onChange={(v) => setProfile({ ...profile, guardian_name: v })} />
                <Field label="Guardian phone" value={profile.guardian_phone} onChange={(v) => setProfile({ ...profile, guardian_phone: phoneDigits(v) })} />
                <Field label="Guardian relation" value={profile.guardian_relation} onChange={(v) => setProfile({ ...profile, guardian_relation: v })} />
              </div>
              <PrimaryButton loading={submitting}>Save profile</PrimaryButton>
            </form>
          )}

          {currentStep === 'ACTIVATE' && (
            <div className="space-y-5">
              <SectionHeading icon={<CheckCircle2 className="w-5 h-5" />} title="Ready to activate" text="Your required setup is complete. Documents can be uploaded after you enter the tenant portal." />
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric icon={<ShieldCheck className="w-4 h-4" />} label="Rules" value="Accepted" />
                <Metric icon={<UserRound className="w-4 h-4" />} label="Profile" value="Required details complete" />
                <Metric icon={<FileText className="w-4 h-4" />} label="Documents" value={documentPending ? 'Pending after activation' : 'Uploaded'} />
                <Metric icon={<Receipt className="w-4 h-4" />} label="Next rent cycle" value={fmtDate(ctx.room_summary.next_rent_generation_date)} />
              </div>
              <button
                type="button"
                onClick={() => submitStep('ACTIVATE', {})}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Activate account
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function SectionHeading({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">{icon}</div>
      <div>
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <p className="text-xs font-semibold">{label}</p>
      </div>
      <p className="mt-2 text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

function PrimaryButton({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
      {children}
    </button>
  );
}
