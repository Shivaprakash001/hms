import { FormEvent, InputHTMLAttributes, ReactNode, useEffect, useState } from 'react';
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
  Download,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Lock,
  Receipt,
  ShieldCheck,
  Unlock,
  UserRound,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import { tenantService } from '@features/tenants/api';
import { useAuth } from '@context/AuthContext';
import { SignaturePad } from '@shared/ui/inputs';

type ActivationStep = 'ACCOUNT' | 'RULES' | 'AGREEMENT' | 'PROFILE' | 'ACTIVATE';

type ActivationContext = {
  activation_state: {
    current_step: ActivationStep;
    completed_steps: ActivationStep[];
    blocked_steps: ActivationStep[];
    account_setup_completed: boolean;
    rules_accepted: boolean;
    agreement_signed: boolean;
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
  agreement: {
    id: string;
    status: string;
    signed_at?: string | null;
    pdf_url?: string | null;
    content_snapshot: Record<string, any>;
    tenant_signature_url?: string | null;
    tenant_signature_name?: string | null;
    tenant_signed_at?: string | null;
    guardian_signature_url?: string | null;
    guardian_signature_name?: string | null;
    guardian_relation?: string | null;
    guardian_signed_at?: string | null;
    owner_signature_url?: string | null;
    owner_signature_name?: string | null;
    owner_signed_at?: string | null;
  } | null;
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

type ProfileDraft = {
  profile: Record<string, string>;
  selectedCollege: string;
  selectedCourse: string;
  photoUrl: string;
  savedAt: number;
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

const activationSteps: { id: ActivationStep; label: string; helper: string }[] = [
  { id: 'ACCOUNT', label: 'Account', helper: 'Password and mobile' },
  { id: 'RULES', label: 'Rules', helper: 'Read and accept' },
  { id: 'AGREEMENT', label: 'Agreement', helper: 'Sign contract' },
  { id: 'PROFILE', label: 'Profile', helper: 'Personal details' },
  { id: 'ACTIVATE', label: 'Activate', helper: 'Enter portal' },
];

const visualSteps: { id: 'ACCOUNT' | 'AGREEMENT' | 'PROFILE' | 'ACTIVATE'; label: string; helper: string }[] = [
  { id: 'ACCOUNT', label: 'Account', helper: 'Password and mobile' },
  { id: 'AGREEMENT', label: 'Agreement', helper: 'Read & sign' },
  { id: 'PROFILE', label: 'Profile', helper: 'Personal details' },
  { id: 'ACTIVATE', label: 'Activate', helper: 'Enter portal' },
];

const guardianRelations = ['Father', 'Mother', 'Brother', 'Sister', 'Uncle', 'Aunt', 'Grandparent', 'Spouse', 'Other'];

const activationMessages = [
  'Activating your account...',
  'Setting up your room access...',
  'Preparing tenant portal...',
];

function passwordStrength(password: string) {
  let score = 0;
  const suggestions: string[] = [];

  if (password.length >= 8) {
    score += 1;
  } else {
    suggestions.push('Use at least 8 characters');
  }

  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    suggestions.push('Add one uppercase letter');
  }

  if (/[0-9]/.test(password)) {
    score += 1;
  } else {
    suggestions.push('Add one number');
  }

  if (/[^A-Za-z0-9]/.test(password)) {
    score += 1;
  } else {
    suggestions.push('Add one symbol');
  }

  if (score <= 1) {
    return {
      label: 'Weak',
      width: '25%',
      color: 'bg-red-500',
      textColor: 'text-red-700',
      suggestions,
    };
  }
  if (score === 2) {
    return {
      label: 'Fair',
      width: '50%',
      color: 'bg-amber-500',
      textColor: 'text-amber-700',
      suggestions,
    };
  }
  if (score === 3) {
    return {
      label: 'Good',
      width: '75%',
      color: 'bg-lime-500',
      textColor: 'text-lime-700',
      suggestions,
    };
  }
  return {
    label: 'Strong',
    width: '100%',
    color: 'bg-emerald-500',
    textColor: 'text-emerald-700',
    suggestions: [],
  };
}

function duplicatePhoneMessage(values: { primary?: string; emergency?: string; guardian?: string }) {
  const entries = [
    ['Primary mobile', phoneDigits(values.primary)],
    ['Emergency mobile', phoneDigits(values.emergency)],
    ['Guardian mobile', phoneDigits(values.guardian)],
  ].filter(([, value]) => String(value || '').length > 0);

  for (const [, value] of entries) {
    if (String(value).length !== 10) continue;
    const matches = entries.filter(([, candidate]) => candidate === value);
    if (matches.length > 1) {
      return `${matches.map(([label]) => label).join(' and ')} must be different numbers.`;
    }
  }
  return '';
}

function invalidPhoneMessage(values: { primary?: string; emergency?: string; guardian?: string }) {
  const entries = [
    ['Primary mobile', values.primary, true],
    ['Emergency mobile', values.emergency, true],
    ['Guardian mobile', values.guardian, false],
  ] as const;

  for (const [label, value, required] of entries) {
    const rawValue = String(value || '').trim();
    const digits = rawValue.replace(/\D/g, '');
    if (!rawValue && !required) continue;
    if (!/^[6-9]\d{9}$/.test(digits)) {
      return `${label} must be a valid 10-digit Indian mobile number.`;
    }
  }
  return '';
}

function profileDraftKey(token: string) {
  return `hms:tenant-activation:${token}:profile-draft`;
}

function readProfileDraft(token: string): ProfileDraft | null {
  if (!token || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(profileDraftKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ProfileDraft>;
    if (!parsed.profile || typeof parsed.profile !== 'object') return null;
    return {
      profile: parsed.profile as Record<string, string>,
      selectedCollege: String(parsed.selectedCollege || ''),
      selectedCourse: String(parsed.selectedCourse || ''),
      photoUrl: String(parsed.photoUrl || ''),
      savedAt: Number(parsed.savedAt || Date.now()),
    };
  } catch {
    return null;
  }
}

function writeProfileDraft(token: string, draft: Omit<ProfileDraft, 'savedAt'>) {
  if (!token || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(profileDraftKey(token), JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // Local draft save is best-effort. Backend save still remains authoritative.
  }
}

function clearProfileDraft(token: string) {
  if (!token || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(profileDraftKey(token));
  } catch {
    // Ignore storage failures.
  }
}

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20';

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  helperText,
  inputMode,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  helperText?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-muted-foreground">
        {label}
        {required ? ' *' : ''}
      </span>
      <input type={type} inputMode={inputMode} value={value} onChange={(e) => onChange(e.target.value)} className={`${fieldClass} disabled:bg-muted/40 disabled:text-muted-foreground`} disabled={disabled} />
      {helperText ? <span className="mt-1 block text-xs text-muted-foreground">{helperText}</span> : null}
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

function Progress({
  ctx,
  activeStep,
  onStepClick,
}: {
  ctx: ActivationContext;
  activeStep: ActivationStep;
  onStepClick: (step: ActivationStep) => void;
}) {
  const completed = new Set(ctx.completed_steps ?? ctx.activation_state.completed_steps ?? []);
  const current = ctx.current_step ?? ctx.activation_state.current_step;
  
  const getVisualCurrentIndex = (stepId: ActivationStep) => {
    if (stepId === 'ACCOUNT') return 0;
    if (stepId === 'RULES' || stepId === 'AGREEMENT') return 1;
    if (stepId === 'PROFILE') return 2;
    if (stepId === 'ACTIVATE') return 3;
    return 0;
  };

  const currentIndex = getVisualCurrentIndex(current);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-bold text-accent">Step {Math.max(1, currentIndex + 1)} of {visualSteps.length}</span>
        <span className="text-muted-foreground">Complete setup in under 3 minutes</span>
      </div>
      <div className="flex items-center gap-0">
        {visualSteps.map((step, i) => {
          const done = step.id === 'AGREEMENT' 
            ? completed.has('AGREEMENT') 
            : completed.has(step.id);
            
          const active = step.id === 'AGREEMENT'
            ? (activeStep === 'RULES' || activeStep === 'AGREEMENT')
            : activeStep === step.id;

          return (
            <div key={step.id} className="flex-1 flex items-center">
              <div className={`h-1.5 rounded-full flex-1 transition-colors duration-300 ${
                done || active ? 'bg-accent' : 'bg-muted'
              }`} />
              {i < visualSteps.length - 1 && <div className="w-1" />}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-4">
        {visualSteps.map((step, i) => {
          const done = step.id === 'AGREEMENT' 
            ? completed.has('AGREEMENT') 
            : completed.has(step.id);

          const active = step.id === 'AGREEMENT'
            ? (activeStep === 'RULES' || activeStep === 'AGREEMENT')
            : activeStep === step.id;

          const clickable = step.id === 'AGREEMENT'
            ? (completed.has('AGREEMENT') || current === 'RULES' || current === 'AGREEMENT' || completed.has('RULES'))
            : (completed.has(step.id) || current === step.id);

          return (
            <button
              key={step.id}
              type="button"
              disabled={!clickable}
              onClick={() => {
                if (step.id === 'AGREEMENT') {
                  if (current === 'RULES' || current === 'AGREEMENT') {
                    onStepClick(current);
                  } else {
                    onStepClick('AGREEMENT');
                  }
                } else {
                  onStepClick(step.id);
                }
              }}
              className="min-w-0 flex flex-col items-center gap-1 rounded-xl px-1 py-1 text-center disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                done ? 'bg-success text-white' : active ? 'bg-accent text-white' : 'bg-muted text-muted-foreground'
              }`}>
                {done ? '✓' : i + 1}
              </div>
              <p className={`text-[10px] font-medium truncate ${
                active ? 'text-accent' : done ? 'text-success' : 'text-muted-foreground'
              }`}>
                {step.label}
              </p>
            </button>
          );
        })}
      </div>
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
  const [visibleStep, setVisibleStep] = useState<ActivationStep | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activationProgress, setActivationProgress] = useState(0);
  const [profileDraftReady, setProfileDraftReady] = useState(false);
  const [profileDraftStatus, setProfileDraftStatus] = useState<'idle' | 'restored' | 'saving' | 'saved'>('idle');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [paymentFrequency, setPaymentFrequency] = useState('MONTHLY');

  const [account, setAccount] = useState({ password: '', confirm_password: '', phone: '' });

  // Agreement Signature State
  const [tenantSigBlob, setTenantSigBlob] = useState<Blob | null>(null);
  const [tenantSigName, setTenantSigName] = useState('');
  const [guardianSigBlob, setGuardianSigBlob] = useState<Blob | null>(null);
  const [isGuardianLocked, setIsGuardianLocked] = useState(true);

  const [acks, setAcks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (ctx) {
      const completed = new Set(ctx.completed_steps ?? ctx.activation_state.completed_steps ?? []);
      if (completed.has('RULES') || ctx.activation_state.rules_accepted) {
        setAcks({
          fee_refund_rules: true,
          discipline_policies: true,
          late_fee_obligations: true,
          damage_liabilities: true,
          hostel_rules: true,
        });
      }
    }
  }, [ctx]);

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
    setProfileDraftReady(false);
    try {
      const data = await tenantService.getActivationContext(token);
      const draft = readProfileDraft(token);
      setCtx(data);
      setPaymentFrequency(String(data?.tenant?.payment_frequency || 'MONTHLY'));
      setProfilePhotoPreview(String(data.tenant?.photo_url || draft?.photoUrl || ''));
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

      if (draft?.selectedCollege) {
        setSelectedCollege(draft.selectedCollege);
      }
      if (draft?.selectedCourse) {
        setSelectedCourse(draft.selectedCourse);
      }

      const backendProfile = {
        phone: phoneDigits(data.tenant?.phone_1 || data.profile?.phone),
        gender: String(data.tenant?.gender || ''),
        date_of_birth: String(data.tenant?.date_of_birth || ''),
        permanent_address: String(data.tenant?.permanent_address || ''),
        temporary_address: String(data.tenant?.temporary_address || ''),
        profile_type: String(data.tenant?.profile_type || 'STUDENT'),
        college_name: college,
        course,
        year_of_study: String(data.tenant?.year_of_study || ''),
        branch: String(data.tenant?.branch || ''),
        roll_number: String(data.tenant?.roll_number || ''),
        office_name: String(data.tenant?.office_name || ''),
        office_location: String(data.tenant?.office_location || ''),
        job_role: String(data.tenant?.job_role || ''),
        guardian_name: String(data.tenant?.guardian_name || data.agreement?.guardian_signature_name || ''),
        guardian_phone: phoneDigits(data.tenant?.guardian_phone || data.tenant?.phone_2),
        guardian_relation: String(data.tenant?.guardian_relation || data.agreement?.guardian_relation || ''),
        emergency_phone: phoneDigits(data.tenant?.phone_3),
      };

      const mergedProfile = {
        ...backendProfile,
        ...(data.activation_state?.profile_completed ? {} : draft?.profile || {}),
      };

      setProfile(mergedProfile);
      
      if (data.agreement) {
        setTenantSigName(String(data.agreement.tenant_signature_name || ''));
      }
      
      const hasGuardianDetails = Boolean(
        mergedProfile.guardian_name ||
        mergedProfile.guardian_relation
      );
      setIsGuardianLocked(hasGuardianDetails);

      if (data.activation_state?.profile_completed) {
        clearProfileDraft(token);
      }
      setProfileDraftStatus(draft && !data.activation_state?.profile_completed ? 'restored' : 'idle');
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
      setProfileDraftReady(true);
      setChecking(false);
    }
  };

  useEffect(() => {
    loadContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const currentStep = ctx?.current_step ?? ctx?.activation_state.current_step;
  const completed = new Set(ctx?.completed_steps ?? ctx?.activation_state.completed_steps ?? []);
  const activeStep = visibleStep || currentStep;
  const ruleCategories = ctx?.agreement?.content_snapshot?.hostel_rules?.categories ?? ctx?.rules?.content?.categories ?? [];
  const requiredAcks = ctx?.rules?.required_acknowledgements ?? [];
  const allAcksChecked = requiredAcks.length > 0 && requiredAcks.every((key) => acks[key] === true);
  const strength = passwordStrength(account.password);
  const activationStageIndex = activationProgress < 40 ? 0 : activationProgress < 78 ? 1 : 2;
  const activationProgressWidth = `${Math.max(8, Math.round(activationProgress))}%`;

  useEffect(() => {
    setVisibleStep(null);
  }, [ctx?.current_step, ctx?.activation_state.current_step]);

  useEffect(() => {
    if (!(submitting && activeStep === 'ACTIVATE')) {
      setActivationProgress(0);
      return;
    }

    const startedAt = Date.now();
    setActivationProgress(8);
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const next =
        elapsed < 1800
          ? 8 + (elapsed / 1800) * 32
          : elapsed < 4600
            ? 40 + ((elapsed - 1800) / 2800) * 38
            : 78 + Math.min(((elapsed - 4600) / 6500) * 16, 16);
      setActivationProgress(next);
    }, 250);

    return () => window.clearInterval(timer);
  }, [activeStep, submitting]);

  useEffect(() => {
    if (!token || !ctx || !profileDraftReady || ctx.activation_state.profile_completed) return;
    if (activeStep !== 'PROFILE') return;

    setProfileDraftStatus('saving');
    const timer = window.setTimeout(() => {
      writeProfileDraft(token, {
        profile,
        selectedCollege,
        selectedCourse,
        photoUrl: /^https?:\/\//.test(profilePhotoPreview) ? profilePhotoPreview : '',
      });
      setProfileDraftStatus('saved');
    }, 700);

    return () => window.clearTimeout(timer);
  }, [
    activeStep,
    ctx,
    profile,
    profileDraftReady,
    profilePhotoPreview,
    selectedCollege,
    selectedCourse,
    token,
  ]);

  const goToStep = (step: ActivationStep) => {
    const completed = new Set(ctx?.completed_steps ?? ctx?.activation_state.completed_steps ?? []);
    if (step === currentStep || completed.has(step)) {
      setError('');
      setVisibleStep(step);
      setShowWelcome(false);
    }
  };

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
            return true;
          } catch {
            navigate('/login?signin=1', { replace: true });
            return true;
          }
        }
        navigate(result?.redirect_to || '/login?signin=1', { replace: true });
        return true;
      }
      setCtx(result as ActivationContext);
      setVisibleStep(null);
      return true;
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        'Could not save this step';
      setError(message);
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const accountSubmit = (e: FormEvent) => {
    e.preventDefault();
    submitStep('ACCOUNT', account);
  };

  const handlePhotoChange = async (file?: File) => {
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

    setPhotoUploading(true);
    setError('');
    try {
      const uploadRes = await tenantService.uploadActivationPhoto(token, file);
      if (uploadRes?.photo_url) {
        setProfilePhotoPreview(uploadRes.photo_url);
        setProfilePhotoFile(null);
        writeProfileDraft(token, {
          profile,
          selectedCollege,
          selectedCourse,
          photoUrl: uploadRes.photo_url,
        });
        setProfileDraftStatus('saved');
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Photo upload failed. You can try again or save after choosing the photo.';
      setError(message);
    } finally {
      setPhotoUploading(false);
    }
  };

  const agreementSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ctx) return;
    setError('');

    const profileType = String(ctx.tenant.profile_type || 'STUDENT').toUpperCase();
    const isStudent = profileType === 'STUDENT';
    const existingTenantSigUrl = ctx.agreement?.tenant_signature_url || '';
    const existingGuardianSigUrl = ctx.agreement?.guardian_signature_url || '';

    if (!tenantSigName.trim()) {
      setError('Your typed full name signature is required');
      return;
    }
    if (!tenantSigBlob && !existingTenantSigUrl) {
      setError('Please draw your signature');
      return;
    }
    if (isStudent) {
      const gName = (profile.guardian_name || '').trim();
      const gRelation = profile.guardian_relation || '';
      if (!gName) {
        setError("Parent/Guardian typed full name signature is required");
        return;
      }
      if (!guardianSigBlob && !existingGuardianSigUrl) {
        setError("Please draw parent/guardian signature");
        return;
      }
      if (!gRelation) {
        setError("Please select parent/guardian relationship");
        return;
      }
    }

    setSubmitting(true);
    try {
      // 1. Upload Tenant Signature
      let tenantSigUrl = existingTenantSigUrl;
      if (tenantSigBlob) {
        const tenantFile = new File([tenantSigBlob], 'tenant_signature.png', { type: 'image/png' });
        const tenantUpload = await tenantService.uploadActivationSignature(token, tenantFile, 'tenant');
        tenantSigUrl = tenantUpload.url;
      }

      // 2. Upload Guardian Signature if student
      let guardianSigUrl = existingGuardianSigUrl;
      if (isStudent && guardianSigBlob) {
        const guardianFile = new File([guardianSigBlob], 'guardian_signature.png', { type: 'image/png' });
        const guardianUpload = await tenantService.uploadActivationSignature(token, guardianFile, 'guardian');
        guardianSigUrl = guardianUpload.url;
      }

      // 3. Submit step to Activation State Machine
      const saved = await submitStep('AGREEMENT', {
        tenant_signature_url: tenantSigUrl,
        tenant_signature_name: tenantSigName.trim(),
        guardian_signature_url: isStudent ? guardianSigUrl : null,
        guardian_signature_name: isStudent ? (profile.guardian_name || '').trim() : null,
        guardian_relation: isStudent ? profile.guardian_relation : null,
      });

      if (saved) {
        // Clear local drawing state
        setTenantSigBlob(null);
        setGuardianSigBlob(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to submit agreement signature');
    } finally {
      setSubmitting(false);
    }
  };

  const profileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const invalidMessage = invalidPhoneMessage({
      primary: profile.phone,
      emergency: profile.emergency_phone,
      guardian: profile.guardian_phone,
    });
    if (invalidMessage) {
      setError(invalidMessage);
      return;
    }
    const duplicateMessage = duplicatePhoneMessage({
      primary: profile.phone,
      emergency: profile.emergency_phone,
      guardian: profile.guardian_phone,
    });
    if (duplicateMessage) {
      setError(duplicateMessage);
      return;
    }
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
      const saved = await submitStep('PROFILE', { ...profile, photo_url: photoUrl });
      if (saved) {
        clearProfileDraft(token);
        setProfileDraftStatus('idle');
      }
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
          <Link to="/login?signin=1" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-5 sm:py-8">
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed left-1/2 top-4 z-[80] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-2xl shadow-amber-900/10"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <p className="min-w-0 flex-1 text-sm font-semibold leading-5 text-amber-900">{error}</p>
            <button
              type="button"
              onClick={() => setError('')}
              className="rounded-lg p-1 text-amber-700 transition-colors hover:bg-amber-100"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <main className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[360px_1fr]">
        <aside className="h-fit rounded-2xl overflow-hidden border border-border shadow-sm">
          <div
            className="px-5 py-4 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #1B2D5B 0%, #243A72 100%)' }}
          >
            <div
              className="absolute inset-0 opacity-10"
              style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #F07B1D 0%, transparent 60%)' }}
            />
            <div className="relative flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center overflow-hidden shrink-0">
                {ctx.hostel.logo_url ? (
                  <img src={ctx.hostel.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Building2 className="w-6 h-6 text-white/80" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60">Tenant admission</p>
                <h1
                  className="text-lg font-bold text-white truncate leading-tight"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {ctx.hostel.name}
                </h1>
              </div>
            </div>
          </div>

          <div className="bg-card p-5">
            <Progress ctx={ctx} activeStep={activeStep || ctx.activation_state.current_step} onStepClick={goToStep} />

          <div className="mt-5 rounded-2xl border border-border bg-secondary/40 p-4 text-sm">
            <p className="font-bold text-foreground">Stay summary</p>
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
          </div>
        </aside>

        <section className="rounded-2xl border border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-6 shadow-sm">
          {showWelcome && activeStep === 'ACCOUNT' && !ctx.activation_state.account_setup_completed ? (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-accent">Step 1 of {visualSteps.length}</p>
                <h2 className="mt-1 text-2xl font-bold text-foreground">
                  {ctx.activation_state.completed_steps.length > 0 ? 'Resume setup' : `Welcome to ${ctx.hostel.name}`}
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Complete setup in under 3 minutes. Your room is already reserved, and only four simple steps are left before you enter the tenant portal.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric icon={<CheckCircle2 className="w-4 h-4" />} label="Setup time" value="Under 3 min" />
                <Metric icon={<ClipboardCheck className="w-4 h-4" />} label="Simple steps" value="4 steps" />
                <Metric icon={<DoorOpen className="w-4 h-4" />} label="Room status" value="Reserved" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric icon={<DoorOpen className="w-4 h-4" />} label="Room" value={String(ctx.room_summary.room_number || 'Assigned')} />
                <Metric icon={<BadgeIndianRupee className="w-4 h-4" />} label="Monthly rent" value={currency(ctx.room_summary.monthly_rent)} />
                <Metric icon={<Users className="w-4 h-4" />} label="Roommates" value={String(ctx.room_summary.roommates_count ?? 0)} />
              </div>
              <button
                type="button"
                onClick={() => setShowWelcome(false)}
                className="inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-3.5 text-sm font-semibold text-accent-foreground active:scale-[0.98] transition-transform shadow-sm"
              >
                Start setup
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : null}

          {activeStep === 'ACCOUNT' && ctx.activation_state.account_setup_completed && (
            <div className="space-y-5">
              <SectionHeading
                icon={<UserRound className="w-5 h-5" />}
                title="Account setup saved"
                text="Your password is securely saved and hidden. Your phone number is restored from the saved account details."
              />
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="font-bold">Password saved securely</p>
                    <p className="mt-1 text-emerald-800">
                      We do not show saved passwords again. If you reload or return to this step, only your saved phone number is shown.
                    </p>
                  </div>
                </div>
              </div>
              <Field
                label="Primary mobile"
                required
                value={account.phone}
                onChange={(v) => setAccount({ ...account, phone: phoneDigits(v) })}
                inputMode="tel"
                helperText="Saved with your account setup."
              />
              <button
                type="button"
                onClick={() => setVisibleStep(null)}
                className="inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-3.5 text-sm font-semibold text-accent-foreground active:scale-[0.98] transition-transform shadow-sm"
              >
                Continue setup
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {activeStep === 'ACCOUNT' && !ctx.activation_state.account_setup_completed && !showWelcome && (
            <form onSubmit={accountSubmit} className="space-y-5">
              <SectionHeading icon={<UserRound className="w-5 h-5" />} title="Set up your account" text="Choose your password and confirm your primary mobile number. No OTP is required." />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground">Password *</span>
                  <div className="relative mt-1.5">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={account.password}
                      onChange={(e) => setAccount({ ...account, password: e.target.value })}
                      className={`${fieldClass} mt-0 pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full ${strength.color} transition-all`} style={{ width: strength.width }} />
                  </div>
                  <p className={`mt-1 text-xs font-semibold ${strength.textColor}`}>Password strength: {strength.label}</p>
                  {strength.suggestions.length > 0 && (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Try: {strength.suggestions.slice(0, 2).join(', ')}.
                    </p>
                  )}
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground">Confirm password *</span>
                  <div className="relative mt-1.5">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={account.confirm_password}
                      onChange={(e) => setAccount({ ...account, confirm_password: e.target.value })}
                      className={`${fieldClass} mt-0 pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>
                <Field label="Primary mobile" required value={account.phone} onChange={(v) => setAccount({ ...account, phone: phoneDigits(v) })} />
              </div>
              <PrimaryButton loading={submitting}>Save account setup</PrimaryButton>
            </form>
          )}

          {activeStep === 'RULES' && (
            <div className="space-y-5 pb-24">
              <SectionHeading icon={<ClipboardCheck className="w-5 h-5" />} title={ctx.rules.title || 'Hostel rules'} text="6 rule sections · Estimated reading time: 2 minutes. Expand only the sections you want to inspect in detail." />
              <div className="grid gap-3">
                {ruleCategories.map((category) => (
                  <details
                    key={category.id}
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
              <div className="sticky bottom-3 z-20 rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur">
                {completed.has('RULES') ? (
                  <button
                    type="button"
                    onClick={() => goToStep('AGREEMENT')}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3.5 text-sm font-semibold text-accent-foreground active:scale-[0.98] transition-transform shadow-sm cursor-pointer"
                  >
                    Proceed to Agreement
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!allAcksChecked || submitting}
                    onClick={() => submitStep('RULES', { acknowledgements: acks, typed_signature_name: ctx.profile.name })}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3.5 text-sm font-semibold text-accent-foreground disabled:opacity-50 active:scale-[0.98] transition-transform shadow-sm"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Accept rules
                  </button>
                )}
              </div>
            </div>
          )}

          {activeStep === 'AGREEMENT' && ctx?.agreement && (
            <form onSubmit={agreementSubmit} className="space-y-5 pb-24">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <SectionHeading
                  icon={<FileText className="w-5 h-5" />}
                  title="Review & Sign Agreement"
                  text="Please review the terms of your hostel stay and sign electronically below to proceed."
                />
                <button
                  type="button"
                  onClick={() => goToStep('RULES')}
                  className="self-start sm:self-center shrink-0 text-xs font-semibold text-accent hover:underline flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-secondary/40 transition cursor-pointer"
                >
                  ← Read Rules Again
                </button>
              </div>

              {/* Immutable Lease Snapshot Box */}
              <div className="rounded-xl border border-border bg-background p-5 shadow-sm space-y-4 max-h-[350px] overflow-y-auto text-sm leading-relaxed text-foreground select-none">
                <div className="text-center border-b pb-4 mb-4">
                  <h3 className="font-extrabold text-base tracking-tight text-slate-800">
                    HOSTEL RESIDENCY AGREEMENT
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Hostel: {ctx.agreement.content_snapshot.hostel_name}
                  </p>
                </div>

                <p>
                  This agreement is made and entered into by and between the Hostel Management of <strong>{ctx.agreement.content_snapshot.hostel_name}</strong> (represented by <strong>{ctx.agreement.content_snapshot.owner_name}</strong>) and the Tenant <strong>{ctx.agreement.content_snapshot.tenant_name}</strong>.
                </p>

                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 mt-3 mb-1">
                  1. Room & Financial Summary
                </h4>
                <div className="bg-muted/40 rounded-lg p-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs border border-border/50">
                  <div>
                    <span className="text-muted-foreground">Assigned Room:</span>{" "}
                    <strong className="text-foreground">{ctx.agreement.content_snapshot.room_number}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Joining Date:</span>{" "}
                    <strong className="text-foreground">{ctx.agreement.content_snapshot.joining_date}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Monthly Rent:</span>{" "}
                    <strong className="text-foreground">₹{ctx.agreement.content_snapshot.monthly_rent}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Security Deposit:</span>{" "}
                    <strong className="text-foreground">₹{ctx.agreement.content_snapshot.advance_deposit}</strong>
                  </div>
                  {ctx.agreement.content_snapshot.maintenance_charge > 0 && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Maintenance Charge:</span>{" "}
                      <strong className="text-foreground">
                        ₹{ctx.agreement.content_snapshot.maintenance_charge} ({ctx.agreement.content_snapshot.maintenance_type})
                      </strong>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Payment Cycle:</span>{" "}
                    <strong className="text-foreground">{ctx.agreement.content_snapshot.payment_frequency}</strong>
                  </div>
                </div>

                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 mt-4 mb-1">
                  2. Terms of Residency & Rules Compliance
                </h4>
                <ul className="list-disc pl-5 space-y-2 text-xs text-muted-foreground">
                  <li>The Tenant shall use the allocated room solely for residential purposes. Sub-letting or transferring the room to any other person is strictly prohibited.</li>
                  <li>The Tenant agrees to pay the monthly rent of ₹{ctx.agreement.content_snapshot.monthly_rent} on or before the due date as defined by the hostel policy. Late payments may attract fees or lead to suspension of access.</li>
                  <li>A refundable security deposit of ₹{ctx.agreement.content_snapshot.advance_deposit} is deposited with the management, which will be settled/refunded upon successful move-out compliance checks, subject to clearance of all pending dues and room inspection for damages.</li>
                  <li>Either party must provide at least 30 days written notice prior to terminating this residency agreement.</li>
                  <li className="text-foreground font-medium bg-secondary/20 p-2 rounded border border-border/50">
                    <strong>Hostel Rules Binding Clause:</strong> The Tenant explicitly agrees to follow, comply with, and be legally bound by each and every rule, policy, and regulation of the hostel (as reviewed and accepted under the Rules section). This includes all guidelines concerning fee refunds, hostel discipline, guest policies, late fee obligations, and property damage liabilities. Any breach of these rules constitutes a violation of this residency agreement and may result in immediate termination of stay.
                  </li>
                </ul>

                {ruleCategories.length > 0 && (
                  <>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 mt-4 mb-1">
                      3. Hostel Rules & Regulations
                    </h4>
                    <div className="space-y-4 pl-2 text-xs text-muted-foreground border-l-2 border-slate-100 ml-1">
                      {ruleCategories.map((category: any) => (
                        <div key={category.id} className="space-y-1">
                          <h5 className="font-bold text-slate-800">{category.title}</h5>
                          <ul className="list-disc pl-5 space-y-1">
                            {(category.highlights || []).map((hl: string, idx: number) => (
                              <li key={`hl-${idx}`} className="italic text-foreground font-medium">
                                {hl}
                              </li>
                            ))}
                            {(category.rules || []).map((rule: string, idx: number) => (
                              <li key={`rule-${idx}`}>
                                {rule}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {ctx.agreement.content_snapshot.custom_rules && (
                  <>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 mt-4 mb-1">
                      4. Additional Custom Rules
                    </h4>
                    <p className="text-xs whitespace-pre-line text-muted-foreground bg-amber-50/20 border border-amber-500/10 rounded-lg p-3 italic">
                      {ctx.agreement.content_snapshot.custom_rules}
                    </p>
                  </>
                )}

                <p className="text-[10px] text-muted-foreground mt-4 pt-4 border-t border-dashed">
                  This electronic document is valid under the Information Technology Act. Digital signatures and IP details collected during onboarding are legally binding.
                </p>
              </div>

              {/* Signature Section */}
              <div className="grid gap-6">
                {/* Tenant Signature */}
                <div className="rounded-xl border border-border bg-background p-4 space-y-3">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-accent/10 text-accent text-xs font-semibold">1</span>
                    Tenant Signature
                  </h3>
                  <div className="grid gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">
                        Full Name (Type to sign) <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={tenantSigName}
                        onChange={(e) => setTenantSigName(e.target.value)}
                        placeholder="Type your official full name"
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">
                        Draw Signature <span className="text-destructive">*</span>
                      </label>
                      <SignaturePad
                        onSave={setTenantSigBlob}
                        placeholder="Draw tenant signature here"
                        existingSignatureUrl={ctx.agreement?.tenant_signature_url}
                      />
                    </div>
                  </div>
                </div>

                {/* Guardian Signature (conditional for STUDENT profiles) */}
                {String(ctx.tenant.profile_type || 'STUDENT').toUpperCase() === 'STUDENT' && (
                  <div className="rounded-xl border border-border bg-background p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-accent/10 text-accent text-xs font-semibold">2</span>
                        Parent/Guardian Co-Signature
                      </h3>
                    </div>

                    {profile.guardian_name && profile.guardian_relation && (
                      <div className="flex items-center justify-between rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                        <span className="flex items-center gap-1.5 font-medium">
                          {isGuardianLocked ? (
                            <>
                              <Lock className="w-3.5 h-3.5 text-amber-600" />
                              Guardian details are synced and locked.
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                              Editing details updates all stages.
                            </>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsGuardianLocked(!isGuardianLocked)}
                          className="font-bold underline hover:text-amber-900 transition-colors"
                        >
                          {isGuardianLocked ? 'Modify' : 'Lock'}
                        </button>
                      </div>
                    )}

                    <div className="grid gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">
                          Relationship to Tenant <span className="text-destructive">*</span>
                        </label>
                        <select
                          required
                          disabled={isGuardianLocked && !!profile.guardian_relation}
                          value={profile.guardian_relation || ''}
                          onChange={(e) => setProfile(prev => ({ ...prev, guardian_relation: e.target.value }))}
                          className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none bg-white disabled:bg-slate-50 disabled:text-slate-500"
                        >
                          <option value="">Select relationship</option>
                          <option value="Father">Father</option>
                          <option value="Mother">Mother</option>
                          <option value="Guardian">Guardian</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">
                          Parent/Guardian Full Name <span className="text-destructive">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          disabled={isGuardianLocked && !!profile.guardian_name}
                          value={profile.guardian_name || ''}
                          onChange={(e) => setProfile(prev => ({ ...prev, guardian_name: e.target.value }))}
                          placeholder="Type parent/guardian full name"
                          className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">
                          Draw Signature <span className="text-destructive">*</span>
                        </label>
                        <SignaturePad
                          onSave={setGuardianSigBlob}
                          placeholder="Draw parent/guardian signature here"
                          existingSignatureUrl={ctx.agreement?.guardian_signature_url}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button Bar */}
              <div className="sticky bottom-3 z-20 rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3.5 text-sm font-semibold text-accent-foreground disabled:opacity-50 active:scale-[0.98] transition-transform shadow-sm cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading & signing agreement...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Submit & sign contract
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {activeStep === 'PROFILE' && (
            <form onSubmit={profileSubmit} className="space-y-5">
              <SectionHeading icon={<ShieldCheck className="w-5 h-5" />} title="Complete required profile details" text="Start with personal and guardian contacts, then add address, academic or work details, and profile photo." />
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-xs font-semibold text-muted-foreground">
                {profileDraftStatus === 'saving' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-accent" />
                    Saving draft...
                  </>
                ) : profileDraftStatus === 'restored' ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Draft restored from this device
                  </>
                ) : profileDraftStatus === 'saved' ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Draft saved locally
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Saved steps are synced to your account
                  </>
                )}
              </div>

              <FormGroup title="Personal details">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Primary mobile"
                  required
                  value={profile.phone}
                  onChange={(v) => setProfile({ ...profile, phone: phoneDigits(v) })}
                  inputMode="tel"
                  helperText="Enter a valid 10-digit Indian mobile number."
                />
                <Field label="Date of birth" required type="date" value={profile.date_of_birth} onChange={(v) => setProfile({ ...profile, date_of_birth: v })} />
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
              </div>
              </FormGroup>
              
              <FormGroup title="Guardian details">
              <div className="grid gap-4 sm:grid-cols-2">
                {profile.guardian_name && profile.guardian_relation && (
                  <div className="col-span-2 flex items-center justify-between rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                    <span className="flex items-center gap-1.5 font-medium">
                      {isGuardianLocked ? (
                        <>
                          <Lock className="w-3.5 h-3.5 text-amber-600" />
                          Guardian details are synced and locked.
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                          Editing details updates all stages.
                        </>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsGuardianLocked(!isGuardianLocked)}
                      className="font-bold underline hover:text-amber-900 transition-colors"
                    >
                      {isGuardianLocked ? 'Modify' : 'Lock'}
                    </button>
                  </div>
                )}
                <Field
                  label="Guardian name"
                  disabled={isGuardianLocked && !!profile.guardian_name}
                  value={profile.guardian_name || ''}
                  onChange={(v) => setProfile({ ...profile, guardian_name: v })}
                />
                <Field
                  label="Guardian phone"
                  disabled={isGuardianLocked && !!profile.guardian_phone}
                  value={profile.guardian_phone || ''}
                  onChange={(v) => setProfile({ ...profile, guardian_phone: phoneDigits(v) })}
                  inputMode="tel"
                  helperText="Use a valid 10-digit mobile number if provided."
                />
                <Field
                  label="Emergency contact (Mobile)"
                  required
                  value={profile.emergency_phone || ''}
                  onChange={(v) => setProfile({ ...profile, emergency_phone: phoneDigits(v) })}
                  inputMode="tel"
                  helperText="Must be valid and different from primary and guardian numbers."
                />
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground">Guardian relation</span>
                  <select
                    disabled={isGuardianLocked && !!profile.guardian_relation}
                    value={profile.guardian_relation || ''}
                    onChange={(e) => setProfile({ ...profile, guardian_relation: e.target.value })}
                    className={`${fieldClass} disabled:bg-muted/40 disabled:text-muted-foreground`}
                  >
                    <option value="">Select relation</option>
                    {guardianRelations.map((relation) => (
                      <option key={relation} value={relation}>{relation}</option>
                    ))}
                  </select>
                </label>
              </div>
              </FormGroup>
              <FormGroup title="Address">
              <div className="grid gap-4">
                <TextArea label="Permanent address (Address, City, State, Pincode) *" required value={profile.permanent_address} onChange={(v) => setProfile({ ...profile, permanent_address: v })} />
              </div>
              </FormGroup>

              <FormGroup title={profile.profile_type === 'STUDENT' ? 'Academic details' : 'Work details'}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground">Profile type</span>
                  <select value={profile.profile_type} onChange={(e) => setProfile({ ...profile, profile_type: e.target.value })} className={fieldClass}>
                    <option value="STUDENT">Student</option>
                    <option value="WORKING_PROFESSIONAL">Working professional</option>
                  </select>
                </label>
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

                  <Field label="Branch" value={profile.branch} onChange={(v) => setProfile({ ...profile, branch: v })} />
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

                  <Field
                    label="Roll number"
                    value={profile.roll_number}
                    onChange={(v) => setProfile({ ...profile, roll_number: v.trimStart().toUpperCase() })}
                    helperText="Use your unique college roll number. Duplicate roll numbers cannot be used."
                  />
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Office" value={profile.office_name} onChange={(v) => setProfile({ ...profile, office_name: v })} />
                  <Field label="Office location" value={profile.office_location} onChange={(v) => setProfile({ ...profile, office_location: v })} />
                  <Field label="Job role" value={profile.job_role} onChange={(v) => setProfile({ ...profile, job_role: v })} />
                </div>
              )}
              </FormGroup>

              <FormGroup title="Profile photo">
              <label className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-accent/30 bg-accent/5 p-4 cursor-pointer hover:border-accent hover:bg-accent/8 transition-colors">
                <div className={`w-16 h-16 rounded-full overflow-hidden bg-secondary flex items-center justify-center shrink-0 ${
                  profilePhotoPreview ? 'ring-2 ring-accent ring-offset-2' : 'ring-1 ring-border'
                }`}>
                  {profilePhotoPreview ? (
                    <img
                      src={profilePhotoPreview}
                      alt="Profile preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Camera className="w-6 h-6 text-accent" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-sm">Profile photo *</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {photoUploading ? 'Uploading photo now...' : 'JPG, PNG, or WEBP under 2MB'}
                  </p>
                  {profilePhotoFile && (
                    <p className="text-xs text-accent font-medium mt-1 truncate">{profilePhotoFile.name}</p>
                  )}
                  {!profilePhotoFile && /^https?:\/\//.test(profilePhotoPreview) && (
                    <p className="text-xs text-emerald-700 font-medium mt-1">Photo uploaded and saved</p>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handlePhotoChange(e.target.files?.[0])}
                />
                <span className="text-sm font-semibold text-accent shrink-0">Choose</span>
              </label>
              </FormGroup>
              <PrimaryButton loading={submitting || photoUploading}>
                {photoUploading ? 'Uploading photo...' : 'Save profile'}
              </PrimaryButton>
            </form>
          )}

          {activeStep === 'ACTIVATE' && (
            <div className="space-y-5">
              <SectionHeading icon={<CheckCircle2 className="w-5 h-5" />} title="Ready to activate" text="Your required setup is complete. Documents can be uploaded after you enter the tenant portal." />
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-bold">After activation, please login again</p>
                    <p className="mt-1 leading-6">
                      Your setup session will end after activation. Use the email/mobile and password you just created to login to the tenant portal.
                    </p>
                  </div>
                </div>
              </div>
              {submitting && (
                <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-accent" />
                    <p className="text-sm font-bold text-foreground">{activationMessages[activationStageIndex]}</p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
                      style={{ width: activationProgressWidth }}
                    />
                  </div>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric icon={<ShieldCheck className="w-4 h-4" />} label="Rules" value="Accepted" />
                <Metric icon={<UserRound className="w-4 h-4" />} label="Profile" value="Required details complete" />
                <Metric icon={<FileText className="w-4 h-4" />} label="Documents" value={documentPending ? 'Pending after activation' : 'Uploaded'} />
                <Metric icon={<Receipt className="w-4 h-4" />} label="Next rent cycle" value={fmtDate(ctx.room_summary.next_rent_generation_date)} />
              </div>

              {/* Signed Agreement Summary */}
              {ctx.agreement && (
                <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 flex-wrap gap-2">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-accent" />
                      <span>Signed Agreement Details</span>
                    </h3>
                    {ctx.agreement.pdf_url && (
                      <a
                        href={ctx.agreement.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-accent hover:bg-accent/90 rounded-lg shadow-sm transition-all"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download PDF</span>
                      </a>
                    )}
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Tenant Signature Preview */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">Tenant Signature</p>
                      <p className="text-sm font-medium text-slate-800">{ctx.agreement.tenant_signature_name}</p>
                      {ctx.agreement.tenant_signature_url ? (
                        <div className="h-20 bg-white rounded-lg border border-slate-200 p-2 flex items-center justify-center">
                          <img src={ctx.agreement.tenant_signature_url} alt="Tenant Signature" className="h-full object-contain" />
                        </div>
                      ) : (
                        <p className="text-xs text-amber-600 italic">No drawing saved</p>
                      )}
                    </div>

                    {/* Guardian Signature Preview (if student) */}
                    {String(ctx.tenant?.profile_type || 'STUDENT').toUpperCase() === 'STUDENT' && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">Guardian Signature ({ctx.agreement.guardian_relation || 'Parent'})</p>
                        <p className="text-sm font-medium text-slate-800">{ctx.agreement.guardian_signature_name}</p>
                        {ctx.agreement.guardian_signature_url ? (
                          <div className="h-20 bg-white rounded-lg border border-slate-200 p-2 flex items-center justify-center">
                            <img src={ctx.agreement.guardian_signature_url} alt="Guardian Signature" className="h-full object-contain" />
                          </div>
                        ) : (
                          <p className="text-xs text-amber-600 italic">No drawing saved</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <label className="text-xs font-semibold text-muted-foreground">Select Billing Cycle</label>
                </div>
                <select
                  value={paymentFrequency}
                  onChange={(e) => setPaymentFrequency(e.target.value)}
                  className="w-full mt-2 px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="MONTHLY">Monthly (Pay rent every month)</option>
                  <option value="QUARTERLY">Quarterly (Pay rent every 3 months)</option>
                  <option value="HALF_YEARLY">Half Yearly (Pay rent every 6 months)</option>
                  <option value="ACADEMIC_YEARLY">Academic Yearly (Pay rent every 12 months)</option>
                </select>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Confirm your preferred billing frequency. Changing it later will require submitting a change request to the hostel owner.
                </p>
              </div>
              <button
                type="button"
                onClick={() => submitStep('ACTIVATE', { payment_frequency: paymentFrequency })}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 active:scale-[0.98] transition-transform shadow-sm"
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
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent shrink-0">{icon}</div>
      <div>
        <h2
          className="text-lg font-bold text-foreground"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {title}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function FormGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-background p-4">
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
          {icon}
        </div>
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      </div>
      <p className="text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

function PrimaryButton({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-3.5 text-sm font-semibold text-accent-foreground disabled:opacity-50 active:scale-[0.98] transition-transform shadow-sm"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
      {children}
    </button>
  );
}
