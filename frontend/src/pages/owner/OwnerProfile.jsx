import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import {
    AlertCircle,
    Bell,
    Bot,
    Building2,
    CalendarClock,
    CheckCircle,
    ChevronLeft,
    CreditCard,
    Loader2,
    Lock,
    Mail,
    Menu,
    MessageCircle,
    Monitor,
    Receipt,
    Settings2,
    ShieldCheck,
    UploadCloud,
    User,
    Users,
    X,
} from 'lucide-react';
import { ownerService, billingService, addonService } from '../../api/services';
import BuyRemindersModal from '../../components/owner/BuyRemindersModal';
import { useAppPreferences } from '../../context/AppPreferencesContext';

const DEFAULT_BILLING_DEFAULTS = {
    advance_deposit: 0,
    maintenance_charge: 0,
    maintenance_type: 'MONTHLY',
    auto_fill_room_rent: true,
    allow_override: true,
};

const DEFAULT_PREFS = {
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    date_format: 'DD/MM/YYYY',
    time_format: '12h',
    language: 'en',
    rent_cycle: 'MONTHLY',
    auto_rent_day: 1,
    due_day: 5,
    grace_days: 0,
    late_fee_rules: [{ type: 'PER_DAY', amount: 48, after_days: 5 }],
    max_late_fee: 500,
    allow_partial_payments: false,
    upi_id: '',
    phonepe_merchant_id: '',
    reminder_email: true,
    reminder_in_app: true,
    reminder_whatsapp: false,
    reminder_after_due_days: [1, 5, 10],
    reminder_before_due_days: [],
    reminder_auto_stop_after_payment: true,
    late_fee_notification: true,
    owner_daily_summary: false,
    receipt_prefix: 'HMS',
    receipt_format: 'PREFIX-YEAR-SEQ',
    receipt_footer: '',
    auto_email_receipt: false,
    auto_generate_rent: true,
    auto_apply_late_fees: true,
    auto_send_reminders: true,
    allow_tenant_edits: true,
    require_doc_approval: false,
    data_retention_months: 0,
    billing_defaults: DEFAULT_BILLING_DEFAULTS,
};

const sections = [
    { id: 'profile', label: 'My Profile', group: 'ACCOUNT', icon: User, ownerScoped: true, description: 'Personal details and account access' },
    { id: 'hostel', label: 'Hostel Identity', group: 'ACCOUNT', icon: Building2, description: 'Branding, address, and property identity' },
    { id: 'billing', label: 'Rent & Billing', group: 'BILLING', icon: CalendarClock, description: 'Rent cycles, due dates, and late fee rules' },
    { id: 'tenant-defaults', label: 'Tenant Defaults', group: 'BILLING', icon: Users, description: 'Defaults for new tenant invitations' },
    { id: 'payments', label: 'Payments', group: 'BILLING', icon: CreditCard, description: 'UPI, gateway, and collection rules' },
    { id: 'notifications', label: 'Notifications', group: 'COMMUNICATION', icon: Bell, description: 'Credits, channels, schedules, and alerts' },
    { id: 'receipts', label: 'Receipts', group: 'COMMUNICATION', icon: Receipt, description: 'Receipt numbering, delivery, and footer copy' },
    { id: 'automation', label: 'Automation', group: 'CONTROL', icon: Bot, description: 'Automated rent, late fees, and reminders', pro: true },
    { id: 'security', label: 'Access & Docs', group: 'CONTROL', icon: ShieldCheck, description: 'Tenant permissions and document controls' },
    { id: 'system', label: 'System', group: 'CONTROL', icon: Settings2, description: 'Locale, timezone, and display preferences' },
];

const groups = ['ACCOUNT', 'BILLING', 'COMMUNICATION', 'CONTROL'];
const sectionById = Object.fromEntries(sections.map((section) => [section.id, section]));

function cx(...classes) {
    return classes.filter(Boolean).join(' ');
}

function normalizeDays(value, fallback = []) {
    const source = Array.isArray(value) ? value : fallback;
    return Array.from(new Set(source.map(Number).filter((day) => Number.isInteger(day) && day > 0 && day <= 90))).sort((a, b) => a - b);
}

function dayOptions() {
    return Array.from({ length: 28 }, (_, index) => index + 1);
}

function errorMessage(error, fallback) {
    const detail = error?.response?.data?.detail || error?.response?.data?.message || error?.response?.data?.error?.message || error?.message;
    return `${fallback}${detail ? `. ${typeof detail === 'string' ? detail : detail.message || ''}` : ''}`;
}

function resolveBillingDefaults(prefs = {}) {
    const nested = prefs.billing_defaults || {};
    return {
        ...DEFAULT_BILLING_DEFAULTS,
        advance_deposit: Number(nested.advance_deposit ?? prefs.advance_amount_default ?? 0),
        maintenance_charge: Number(nested.maintenance_charge ?? prefs.maintenance_amount_default ?? 0),
        maintenance_type: nested.maintenance_type || prefs.maintenance_type || 'MONTHLY',
        auto_fill_room_rent: nested.auto_fill_room_rent ?? true,
        allow_override: nested.allow_override ?? true,
    };
}

function mergePreferences(raw = {}) {
    return {
        ...DEFAULT_PREFS,
        ...raw,
        late_fee_rules: raw.late_fee_rules?.length ? raw.late_fee_rules : DEFAULT_PREFS.late_fee_rules,
        reminder_after_due_days: normalizeDays(raw.reminder_after_due_days, [1, 5, 10]),
        reminder_before_due_days: normalizeDays(raw.reminder_before_due_days, []),
        billing_defaults: resolveBillingDefaults(raw),
    };
}

function hasAutomation(planId) {
    return !['free', 'trial'].includes(String(planId || 'free').toLowerCase());
}

function Button({ children, variant = 'primary', className = '', ...props }) {
    return (
        <button
            type="button"
            className={cx(
                'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-base font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
                variant === 'primary' && 'bg-brand-500 text-white hover:bg-brand-600',
                variant === 'ghost' && 'bg-transparent text-ink-700 hover:bg-surface-100 dark:text-ink-100',
                variant === 'outline' && 'border border-ink-200 bg-surface-0 text-ink-800 hover:bg-surface-100 dark:bg-ink-900 dark:text-ink-50',
                variant === 'danger' && 'bg-danger-500 text-white',
                className,
            )}
            {...props}
        >
            {children}
        </button>
    );
}

function SaveButton({ dirty, saving, saved, mobile = false }) {
    return (
        <button
            type="submit"
            disabled={!dirty || saving}
            className={cx(
                'relative inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-base font-medium transition disabled:cursor-not-allowed',
                dirty ? 'bg-brand-500 text-white hover:bg-brand-600' : 'bg-ink-100 text-ink-400',
                mobile && 'px-3',
            )}
        >
            {dirty && mobile && <span className="absolute -left-1 top-2 h-1 w-1 rounded-full bg-brand-500" />}
            {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {saved && !saving && <CheckCircle size={16} aria-hidden="true" />}
            {saved ? 'Saved' : 'Save'}
        </button>
    );
}

function SettingsCard({ title, description, children }) {
    return (
        <div className="rounded-lg border border-ink-200/40 bg-surface-0 p-4 shadow-sm dark:bg-ink-900 md:p-5">
            <div className="mb-4">
                <h2 className="text-base font-medium text-ink-900 dark:text-ink-50">{title}</h2>
                {description && <p className="mt-0.5 text-sm text-ink-600 dark:text-ink-300">{description}</p>}
            </div>
            {children}
        </div>
    );
}

function Field({ label, hint, error, readOnly, children }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-300">{label}</span>
            {children}
            {error && <p className="mt-1 text-xs text-danger-500">{error}</p>}
            {!error && hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
            {readOnly && !hint && <p className="mt-1 text-xs text-ink-400">Read only</p>}
        </label>
    );
}

const inputClass = 'w-full rounded-md border border-ink-200 bg-surface-0 px-3 py-2 text-base text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:bg-surface-100 disabled:text-ink-400 dark:bg-ink-950 dark:text-ink-50';

function ToggleRow({ title, description, checked, onChange, disabled }) {
    return (
        <div className="flex items-center justify-between gap-3 border-t border-ink-200/40 py-3 first:border-t-0">
            <div className="pr-3">
                <p className="text-base font-medium text-ink-900 dark:text-ink-50">{title}</p>
                {description && <p className="text-sm text-ink-600 dark:text-ink-300">{description}</p>}
            </div>
            <button
                type="button"
                aria-disabled={disabled ? 'true' : undefined}
                disabled={disabled}
                onClick={() => onChange(!checked)}
                className="flex min-h-11 min-w-11 items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
            >
                <span className={cx('relative h-5 w-9 rounded-full transition duration-150', checked ? 'bg-brand-500' : 'bg-ink-200')}>
                    <span className={cx('absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition duration-150', checked && 'translate-x-4')} />
                </span>
            </button>
        </div>
    );
}

function ScopePill({ hostel }) {
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            <Building2 size={13} aria-hidden="true" />
            {hostel || 'Selected hostel'} only
        </span>
    );
}

function SectionHeader({ section, activeHostel, dirty, saving, saved, error, onClearError }) {
    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 id={`${section.id}-heading`} className="text-xl font-semibold text-ink-900 dark:text-ink-50">{section.label}</h1>
                        {!section.ownerScoped && <ScopePill hostel={activeHostel?.name} />}
                    </div>
                    <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{section.description}</p>
                </div>
                <div className="hidden md:block"><SaveButton dirty={dirty} saving={saving} saved={saved} /></div>
            </div>
            {error && (
                <div className="flex items-start gap-2 rounded-md border border-danger-500 bg-danger-50 p-3 text-sm text-danger-500">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <p className="flex-1">{error}</p>
                    <button type="button" aria-label="Dismiss error" onClick={onClearError} className="min-h-11 min-w-11 -m-3 flex items-center justify-center"><X size={15} /></button>
                </div>
            )}
        </div>
    );
}

function MobileTopBar({ section, dirty, saving, saved, onBack }) {
    return (
        <div className="sticky top-0 z-40 -mx-4 mb-4 flex h-14 items-center gap-2 border-b border-ink-200/40 bg-surface-0 px-4 dark:bg-ink-950 md:hidden">
            <button type="button" aria-label="Back to settings sections" onClick={onBack} className="flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-surface-100">
                <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <p className="flex-1 truncate text-base font-semibold text-ink-900 dark:text-ink-50">{section.label}</p>
            <SaveButton dirty={dirty} saving={saving} saved={saved} mobile />
        </div>
    );
}

function useSectionForm(defaultValues, onSave) {
    const form = useForm({ defaultValues, mode: 'onBlur' });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        form.reset(defaultValues);
    }, [defaultValues]);

    async function submit(values) {
        setSaving(true);
        setSaved(false);
        setError('');
        try {
            await onSave(values);
            form.reset(values);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            setError(errorMessage(err, 'Failed to save section'));
        } finally {
            setSaving(false);
        }
    }

    return { form, saving, saved, error, setError, submit };
}

function FormShell({ section, activeHostel, children, formState, onSubmit, onBack }) {
    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <MobileTopBar section={section} dirty={formState.form.formState.isDirty} saving={formState.saving} saved={formState.saved} onBack={onBack} />
            <SectionHeader
                section={section}
                activeHostel={activeHostel}
                dirty={formState.form.formState.isDirty}
                saving={formState.saving}
                saved={formState.saved}
                error={formState.error}
                onClearError={() => formState.setError('')}
            />
            {children}
            <div className="md:hidden"><SaveButton dirty={formState.form.formState.isDirty} saving={formState.saving} saved={formState.saved} /></div>
        </form>
    );
}

function ProfileSection({ owner, onSave, onBack }) {
    const defaults = useMemo(() => ({ name: owner?.name || '', phone: owner?.phone || '', email: owner?.email || '', new_password: '', confirm_password: '' }), [owner]);
    const state = useSectionForm(defaults, async ({ name, phone, new_password }) => {
        if (new_password) throw new Error('Password changes require current-password verification. Leave password fields blank to update profile details.');
        return onSave({ name, phone });
    });
    const { register, handleSubmit, watch, formState: { errors } } = state.form;
    const section = sectionById.profile;
    return (
        <section aria-labelledby="profile-heading">
            <FormShell section={section} formState={state} onSubmit={handleSubmit(state.submit)} onBack={onBack}>
                <SettingsCard title="Personal information">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="Full name" error={errors.name?.message}><input className={inputClass} {...register('name', { required: 'Full name is required' })} /></Field>
                        <Field label="Phone"><input className={inputClass} {...register('phone')} /></Field>
                    </div>
                    <div className="mt-3"><Field label="Email" readOnly hint="Email cannot be changed"><input className={inputClass} readOnly {...register('email')} /></Field></div>
                </SettingsCard>
                <SettingsCard title="Security">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="New password" hint="Leave blank to keep current"><input type="password" placeholder="Leave blank to keep current" className={inputClass} {...register('new_password')} /></Field>
                        <Field label="Confirm password" error={errors.confirm_password?.message}><input type="password" placeholder="Leave blank to keep current" className={inputClass} {...register('confirm_password', { validate: (value) => !watch('new_password') || value === watch('new_password') || 'Passwords do not match' })} /></Field>
                    </div>
                </SettingsCard>
            </FormShell>
        </section>
    );
}

function HostelSection({ hostel, onSave, onUploadLogo, onBack }) {
    const fileRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const defaults = useMemo(() => ({
        name: hostel?.name || '', phone: hostel?.phone || '', gst_number: hostel?.gst_number || '', address: hostel?.address || '', city: hostel?.city || '', state: hostel?.state || '', pincode: hostel?.pincode || '', logo_url: hostel?.logo_url || '',
    }), [hostel]);
    const state = useSectionForm(defaults, onSave);
    const { register, handleSubmit, setValue, watch, formState: { errors } } = state.form;
    const section = sectionById.hostel;
    async function handleFile(event) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
            state.setError('Failed to upload logo. Use PNG, JPG, or WEBP under 2MB.');
            return;
        }
        setUploading(true);
        try {
            const response = await onUploadLogo(file);
            setValue('logo_url', response?.hostel?.logo_url || response?.logo_url || watch('logo_url'), { shouldDirty: true });
        } catch (err) {
            state.setError(errorMessage(err, 'Failed to upload logo'));
        } finally {
            setUploading(false);
        }
    }
    return (
        <section aria-labelledby="hostel-heading">
            <FormShell section={section} activeHostel={hostel} formState={state} onSubmit={handleSubmit(state.submit)} onBack={onBack}>
                <SettingsCard title="Logo & branding">
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-ink-200 bg-surface-100">
                            {watch('logo_url') ? <img src={watch('logo_url')} alt="Hostel logo" className="h-full w-full object-cover" /> : <Building2 size={22} className="text-ink-400" aria-hidden="true" />}
                        </div>
                        <div className="flex-1">
                            <p className="text-base font-medium text-ink-900 dark:text-ink-50">Hostel logo</p>
                            <p className="text-sm text-ink-600 dark:text-ink-300">Used on receipts and tenant-facing branding.</p>
                            {uploading && <div className="mt-2 h-2 rounded-full bg-ink-200"><div className="h-2 w-2/3 rounded-full bg-brand-500" /></div>}
                        </div>
                        <Button variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}><UploadCloud size={16} /> Upload</Button>
                        <input ref={fileRef} className="hidden" type="file" accept="image/png,image/jpg,image/jpeg,image/webp" onChange={handleFile} />
                    </div>
                </SettingsCard>
                <SettingsCard title="Property details">
                    <Field label="Hostel name" error={errors.name?.message}><input className={inputClass} {...register('name', { required: 'Hostel name is required' })} /></Field>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="Phone"><input className={inputClass} {...register('phone')} /></Field>
                        <Field label="GST number" hint="Optional"><input className={inputClass} {...register('gst_number')} /></Field>
                    </div>
                    <div className="mt-3"><Field label="Address"><textarea rows={2} className={inputClass} {...register('address')} /></Field></div>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <Field label="City"><input className={inputClass} {...register('city')} /></Field>
                        <Field label="State"><input className={inputClass} {...register('state')} /></Field>
                        <Field label="Pincode"><input className={inputClass} {...register('pincode')} /></Field>
                    </div>
                </SettingsCard>
            </FormShell>
        </section>
    );
}

function BillingSection({ prefs, activeHostel, onSave, onBack }) {
    const defaults = useMemo(() => ({
        rent_cycle: prefs.rent_cycle, auto_rent_day: Number(prefs.auto_rent_day), due_day: Number(prefs.due_day), grace_days: Number(prefs.grace_days || 0), late_fee_rules: prefs.late_fee_rules?.length ? prefs.late_fee_rules : DEFAULT_PREFS.late_fee_rules, max_late_fee: Number(prefs.max_late_fee || 0),
    }), [prefs]);
    const state = useSectionForm(defaults, (values) => onSave('billing-config', values));
    const { control, register, handleSubmit, watch } = state.form;
    const { fields, append, remove } = useFieldArray({ control, name: 'late_fee_rules' });
    const grace = Number(watch('grace_days') || 0);
    return (
        <section aria-labelledby="billing-heading">
            <FormShell section={sectionById.billing} activeHostel={activeHostel} formState={state} onSubmit={handleSubmit(state.submit)} onBack={onBack}>
                <SettingsCard title="Rent cycle">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <Field label="Cycle"><select className={inputClass} {...register('rent_cycle')}><option value="MONTHLY">Monthly</option></select></Field>
                        <Field label="Generate on"><select className={inputClass} {...register('auto_rent_day', { valueAsNumber: true })}>{dayOptions().map((day) => <option key={day} value={day}>{day}</option>)}</select></Field>
                        <Field label="Due on"><select className={inputClass} {...register('due_day', { valueAsNumber: true })}>{dayOptions().map((day) => <option key={day} value={day}>{day}</option>)}</select></Field>
                    </div>
                    <div className="mt-4">
                        <p className="mb-2 text-xs font-medium text-ink-600">Grace period — days after due date before late fees apply</p>
                        <div className="flex items-center gap-3 sm:hidden">
                            <Button variant="outline" onClick={() => state.form.setValue('grace_days', Math.max(0, grace - 1), { shouldDirty: true })}>-</Button>
                            <span className="min-h-11 flex-1 rounded-md border border-ink-200 px-3 py-3 text-center text-base font-medium">{grace} days</span>
                            <Button variant="outline" onClick={() => state.form.setValue('grace_days', Math.min(15, grace + 1), { shouldDirty: true })}>+</Button>
                        </div>
                        <div className="hidden items-center gap-3 sm:flex">
                            <input type="range" min="0" max="15" step="1" className="w-full accent-amber-500" {...register('grace_days', { valueAsNumber: true })} />
                            <span className="w-16 text-sm font-medium text-ink-600">{grace} days</span>
                        </div>
                    </div>
                </SettingsCard>
                <SettingsCard title="Late fee rules" description="Rules are cumulative and applied in order">
                    <div className="space-y-4">
                        {fields.map((field, index) => {
                            const row = watch(`late_fee_rules.${index}`) || {};
                            const typeLabel = row.type === 'PERCENTAGE' ? `${row.amount || 0}%` : `₹${row.amount || 0}${row.type === 'PER_DAY' ? '/day' : ''}`;
                            return (
                                <div key={field.id} className="rounded-md border border-ink-200/60 p-3">
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        <Field label="Type"><select className={inputClass} {...register(`late_fee_rules.${index}.type`)}><option value="PER_DAY">Per day ₹</option><option value="FLAT">Flat fee ₹</option><option value="PERCENTAGE">Percentage %</option></select></Field>
                                        <Field label="Amount"><input type="number" min="0" className={inputClass} {...register(`late_fee_rules.${index}.amount`, { valueAsNumber: true })} /></Field>
                                        <Field label="After N days"><input type="number" min="0" className={inputClass} {...register(`late_fee_rules.${index}.after_days`, { valueAsNumber: true })} /></Field>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between gap-2">
                                        <p className="text-xs text-ink-500">{typeLabel} from day {row.after_days || 0}</p>
                                        {fields.length > 1 && <Button variant="ghost" onClick={() => remove(index)} aria-label="Remove late fee rule"><X size={16} /></Button>}
                                    </div>
                                </div>
                            );
                        })}
                        <Button variant="ghost" disabled={fields.length >= 3} onClick={() => append({ type: 'FLAT', amount: 100, after_days: 7 })}>+ Add rule</Button>
                        <Field label="Maximum late fee cap (₹)"><input type="number" min="0" className={cx(inputClass, 'max-w-xs')} {...register('max_late_fee', { valueAsNumber: true })} /></Field>
                    </div>
                </SettingsCard>
            </FormShell>
        </section>
    );
}

function TenantDefaultsSection({ prefs, activeHostel, onSave, onBack }) {
    const defaults = useMemo(() => ({ ...prefs.billing_defaults }), [prefs]);
    const state = useSectionForm(defaults, (values) => onSave('invite-defaults', values));
    const { register, handleSubmit, watch, setValue } = state.form;
    const type = watch('maintenance_type');
    return (
        <section aria-labelledby="tenant-defaults-heading">
            <FormShell section={sectionById['tenant-defaults']} activeHostel={activeHostel} formState={state} onSubmit={handleSubmit(state.submit)} onBack={onBack}>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">These defaults apply to new tenant invites only. Existing tenants keep their original billing snapshots.</div>
                <SettingsCard title="Invite defaults">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="Default advance deposit (₹)"><input type="number" min="0" className={inputClass} {...register('advance_deposit', { valueAsNumber: true })} /></Field>
                        <Field label="Default maintenance charge (₹)"><input type="number" min="0" className={inputClass} {...register('maintenance_charge', { valueAsNumber: true })} /></Field>
                    </div>
                    <div className="mt-3 max-w-xs"><Field label="Maintenance type"><select className={inputClass} {...register('maintenance_type')}><option value="ONE_TIME">One-time</option><option value="MONTHLY">Monthly</option><option value="NONE">None</option></select></Field></div>
                    <div className="my-4 border-t border-ink-200/40" />
                    <ToggleRow title="Auto-fill room rent" description="Pre-fill rent from the room's base rent" checked={watch('auto_fill_room_rent')} onChange={(value) => setValue('auto_fill_room_rent', value, { shouldDirty: true })} />
                    <ToggleRow title="Allow manual override" description="Customize values per invite before sending" checked={watch('allow_override')} onChange={(value) => setValue('allow_override', value, { shouldDirty: true })} />
                    <div className="mt-3 inline-flex rounded-full bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">New invites default to ₹{watch('advance_deposit') || 0} deposit + ₹{watch('maintenance_charge') || 0} {String(type || '').toLowerCase()} maintenance</div>
                </SettingsCard>
            </FormShell>
        </section>
    );
}

function PaymentsSection({ prefs, activeHostel, onSave, onBack }) {
    const defaults = useMemo(() => ({ upi_id: prefs.upi_id || '', phonepe_merchant_id: prefs.phonepe_merchant_id || '', allow_partial_payments: !!prefs.allow_partial_payments }), [prefs]);
    const state = useSectionForm(defaults, (values) => onSave('payment-config', values));
    const { register, handleSubmit, watch, setValue } = state.form;
    return (
        <section aria-labelledby="payments-heading">
            <FormShell section={sectionById.payments} activeHostel={activeHostel} formState={state} onSubmit={handleSubmit(state.submit)} onBack={onBack}>
                <SettingsCard title="UPI configuration"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="UPI ID"><input placeholder="yourname@upi" className={inputClass} {...register('upi_id')} /></Field><Field label="PhonePe merchant ID" hint="Optional"><input className={inputClass} {...register('phonepe_merchant_id')} /></Field></div></SettingsCard>
                <SettingsCard title="Payment rules"><ToggleRow title="Allow partial payments" description="Tenants can pay less than the full amount due" checked={watch('allow_partial_payments')} onChange={(value) => setValue('allow_partial_payments', value, { shouldDirty: true })} /></SettingsCard>
            </FormShell>
        </section>
    );
}

function NotificationsSection({ prefs, activeHostel, addonUsage, onSave, onTopup, onAutoTopup, onTestReminder, onBack }) {
    const defaults = useMemo(() => ({
        reminder_email: prefs.reminder_email, reminder_in_app: prefs.reminder_in_app, reminder_whatsapp: prefs.reminder_whatsapp, reminder_after_due_days: normalizeDays(prefs.reminder_after_due_days, [1, 5, 10]), reminder_before_due_days: normalizeDays(prefs.reminder_before_due_days, []), reminder_auto_stop_after_payment: prefs.reminder_auto_stop_after_payment, late_fee_notification: prefs.late_fee_notification, owner_daily_summary: prefs.owner_daily_summary, auto_send_reminders: prefs.auto_send_reminders,
    }), [prefs]);
    const state = useSectionForm(defaults, (values) => onSave('notification-config', values));
    const { handleSubmit, watch, setValue } = state.form;
    const credits = Number(addonUsage?.reminders_remaining || 0);
    const fill = Math.min(100, Math.round((credits / 200) * 100));
    const days = watch('reminder_after_due_days') || [];
    function toggleDay(day) {
        const next = days.includes(day) ? days.filter((item) => item !== day) : [...days, day];
        setValue('reminder_after_due_days', normalizeDays(next, []), { shouldDirty: true });
    }
    function addCustomDay() {
        if (days.length >= 6) return;
        const value = Number(window.prompt('Add reminder day after due date'));
        if (Number.isInteger(value) && value > 0 && value <= 90) toggleDay(value);
    }
    return (
        <section aria-labelledby="notifications-heading">
            <FormShell section={sectionById.notifications} activeHostel={activeHostel} formState={state} onSubmit={handleSubmit(state.submit)} onBack={onBack}>
                <SettingsCard title="Reminder credits">
                    <div className="flex items-center justify-between gap-3"><div><p className="text-xl font-semibold text-ink-900 dark:text-ink-50">{credits}</p><p className="text-sm text-ink-600">credits remaining</p></div><Button onClick={onTopup}>Top up</Button></div>
                    <div className="mt-3 h-2 rounded-full bg-ink-200"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${fill}%` }} /></div>
                    {credits < 20 && <div className="mt-3 rounded-md border border-warning-500 bg-warning-50 p-3 text-sm text-amber-700">Low reminder credits. Top up to avoid paused automation.</div>}
                    <ToggleRow title="Auto top-up" description="Buy 200 credits when balance reaches 0" checked={!!addonUsage?.auto_topup} onChange={onAutoTopup} />
                </SettingsCard>
                <SettingsCard title="Channels">
                    <ChannelRow icon={Mail} tone="blue" title="Email" description="Send reminders via email" checked={watch('reminder_email')} onChange={(v) => setValue('reminder_email', v, { shouldDirty: true })} />
                    <ChannelRow icon={Monitor} tone="green" title="In-app" description="Show inside tenant dashboard" checked={watch('reminder_in_app')} onChange={(v) => setValue('reminder_in_app', v, { shouldDirty: true })} />
                    <ChannelRow icon={MessageCircle} title="WhatsApp" description="Coming soon" checked={false} disabled badge="Coming soon" onChange={() => {}} />
                </SettingsCard>
                <SettingsCard title="Reminder schedule" description="Days after due date to trigger a reminder">
                    <div className="flex flex-wrap gap-2">
                        {[1, 5, 10, 15, ...days.filter((day) => ![1, 5, 10, 15].includes(day))].slice(0, 8).map((day) => (
                            <button key={day} type="button" onClick={() => toggleDay(day)} className={cx('min-h-11 rounded-full border px-3 text-sm font-medium', days.includes(day) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:bg-surface-100')}>Day {day}{day === 1 ? ' — Gentle' : day === 5 ? ' — Warning' : day === 10 ? ' — Final notice' : ''}</button>
                        ))}
                        <Button variant="ghost" disabled={days.length >= 6} onClick={addCustomDay}>+ Custom day</Button>
                    </div>
                </SettingsCard>
                <SettingsCard title="Owner alerts">
                    <ToggleRow title="Late fee applied" description="Notify when late fees are added" checked={watch('late_fee_notification')} onChange={(v) => setValue('late_fee_notification', v, { shouldDirty: true })} />
                    <ToggleRow title="Daily summary" description="Morning email with payment stats" checked={watch('owner_daily_summary')} onChange={(v) => setValue('owner_daily_summary', v, { shouldDirty: true })} />
                    <div className="pt-3"><Button variant="ghost" onClick={onTestReminder}><Bell size={16} /> Send test reminder to myself</Button></div>
                </SettingsCard>
            </FormShell>
        </section>
    );
}

function ChannelRow({ icon: Icon, title, description, checked, onChange, disabled, badge, tone = 'slate' }) {
    const toneClass = tone === 'blue' ? 'bg-blue-50 text-blue-600' : tone === 'green' ? 'bg-green-50 text-green-600' : 'bg-ink-100 text-ink-500';
    return (
        <div className="flex items-center justify-between gap-3 border-t border-ink-200/40 py-3 first:border-t-0">
            <div className="flex items-center gap-3"><span className={cx('flex h-8 w-8 items-center justify-center rounded-md', toneClass)}><Icon size={16} aria-hidden="true" /></span><div><p className="text-base font-medium text-ink-900 dark:text-ink-50">{title} {badge && <span className="ml-2 rounded-full bg-ink-100 px-2 py-1 text-2xs text-ink-500">{badge}</span>}</p><p className="text-sm text-ink-600">{description}</p></div></div>
            <ToggleRow title="" checked={checked} onChange={onChange} disabled={disabled} />
        </div>
    );
}

function ReceiptsSection({ prefs, activeHostel, onSave, onBack }) {
    const defaults = useMemo(() => ({ receipt_prefix: prefs.receipt_prefix || 'HMS', receipt_format: prefs.receipt_format || 'PREFIX-YEAR-SEQ', auto_email_receipt: !!prefs.auto_email_receipt, receipt_footer: prefs.receipt_footer || '' }), [prefs]);
    const state = useSectionForm(defaults, (values) => onSave('receipt-config', values));
    const { register, handleSubmit, watch, setValue } = state.form;
    const prefix = String(watch('receipt_prefix') || 'HMS').slice(0, 6).toUpperCase();
    return (
        <section aria-labelledby="receipts-heading">
            <FormShell section={sectionById.receipts} activeHostel={activeHostel} formState={state} onSubmit={handleSubmit(state.submit)} onBack={onBack}>
                <SettingsCard title="Receipt numbering"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="Prefix"><input maxLength={6} className={inputClass} {...register('receipt_prefix')} /></Field><Field label="Format"><select className={inputClass} {...register('receipt_format')}><option value="PREFIX-YEAR-SEQ">PREFIX-YEAR-SEQ</option><option value="PREFIX-SEQ">PREFIX-SEQ</option></select></Field></div><p className="mt-3 font-mono text-sm text-ink-400">Preview: {prefix}-2026-0001</p></SettingsCard>
                <SettingsCard title="Delivery & footer"><ToggleRow title="Auto-email receipt on payment" description="Send PDF to tenant on confirmation" checked={watch('auto_email_receipt')} onChange={(v) => setValue('auto_email_receipt', v, { shouldDirty: true })} /><Field label="Footer message" hint={`${String(watch('receipt_footer') || '').length}/120 characters`}><input maxLength={120} className={inputClass} {...register('receipt_footer')} /></Field></SettingsCard>
            </FormShell>
        </section>
    );
}

function AutomationSection({ prefs, activeHostel, onSave, automationEnabled, onBack }) {
    const defaults = useMemo(() => ({ auto_generate_rent: prefs.auto_generate_rent, auto_apply_late_fees: prefs.auto_apply_late_fees, auto_send_reminders: prefs.auto_send_reminders }), [prefs]);
    const state = useSectionForm(defaults, (values) => onSave('automation-config', values));
    const { handleSubmit, watch, setValue } = state.form;
    return (
        <section aria-labelledby="automation-heading">
            <FormShell section={sectionById.automation} activeHostel={activeHostel} formState={state} onSubmit={handleSubmit(state.submit)} onBack={onBack}>
                {!automationEnabled && <div className="rounded-lg border border-warning-500 bg-warning-50 p-4 text-amber-800"><div className="flex gap-3"><Lock size={18} aria-hidden="true" /><div><p className="font-semibold">Automation requires Starter plan</p><p className="text-sm">Upgrade to activate rent generation, late fees, and reminders.</p></div></div></div>}
                <div className={cx(!automationEnabled && 'pointer-events-none opacity-40')} aria-label={!automationEnabled ? 'Automation settings — requires Starter plan' : undefined}>
                    <SettingsCard title="Automated tasks"><ToggleRow title="Auto-generate rent" description="Create obligations on generation day each month" checked={watch('auto_generate_rent')} onChange={(v) => setValue('auto_generate_rent', v, { shouldDirty: true })} /><ToggleRow title="Auto-apply late fees" description="Add late fees after grace period automatically" checked={watch('auto_apply_late_fees')} onChange={(v) => setValue('auto_apply_late_fees', v, { shouldDirty: true })} /><ToggleRow title="Auto-send reminders" description="Trigger reminders per your notification schedule" checked={watch('auto_send_reminders')} onChange={(v) => setValue('auto_send_reminders', v, { shouldDirty: true })} /></SettingsCard>
                </div>
            </FormShell>
        </section>
    );
}

function SecuritySection({ prefs, activeHostel, onSave, onBack }) {
    const defaults = useMemo(() => ({ allow_tenant_edits: prefs.allow_tenant_edits, require_doc_approval: prefs.require_doc_approval, data_retention_months: Number(prefs.data_retention_months || 0) }), [prefs]);
    const state = useSectionForm(defaults, (values) => onSave('security-config', values));
    const { register, handleSubmit, watch, setValue } = state.form;
    return <section aria-labelledby="security-heading"><FormShell section={sectionById.security} activeHostel={activeHostel} formState={state} onSubmit={handleSubmit(state.submit)} onBack={onBack}><SettingsCard title="Tenant permissions"><ToggleRow title="Tenants can edit their profile" description="Name, phone, personal details" checked={watch('allow_tenant_edits')} onChange={(v) => setValue('allow_tenant_edits', v, { shouldDirty: true })} /><ToggleRow title="Require document approval" description="You approve uploaded ID before tenant is verified" checked={watch('require_doc_approval')} onChange={(v) => setValue('require_doc_approval', v, { shouldDirty: true })} /></SettingsCard><SettingsCard title="Data retention"><div className="max-w-xs"><Field label="Keep records for" hint="Applies to exited tenant records and payment history"><select className={inputClass} {...register('data_retention_months', { valueAsNumber: true })}><option value={0}>Forever</option><option value={36}>3 years</option><option value={60}>5 years</option><option value={84}>7 years</option></select></Field></div></SettingsCard></FormShell></section>;
}

function SystemSection({ prefs, activeHostel, onSave, onBack }) {
    const defaults = useMemo(() => ({ currency: prefs.currency, timezone: prefs.timezone, date_format: prefs.date_format, time_format: prefs.time_format, language: prefs.language }), [prefs]);
    const state = useSectionForm(defaults, (values) => onSave('system-config', values));
    const { register, handleSubmit } = state.form;
    return <section aria-labelledby="system-heading"><FormShell section={sectionById.system} activeHostel={activeHostel} formState={state} onSubmit={handleSubmit(state.submit)} onBack={onBack}><SettingsCard title="Locale & display"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="Currency"><select className={inputClass} {...register('currency')}><option value="INR">₹ INR</option><option value="USD">$ USD</option></select></Field><Field label="Timezone"><select className={inputClass} {...register('timezone')}><option value="Asia/Kolkata">Asia/Kolkata</option><option value="UTC">UTC</option></select></Field><Field label="Date format"><select className={inputClass} {...register('date_format')}><option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="MM/DD/YYYY">MM/DD/YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option></select></Field><Field label="Time format"><select className={inputClass} {...register('time_format')}><option value="12h">12 hour</option><option value="24h">24 hour</option></select></Field></div><div className="mt-3 max-w-xs"><Field label="Language"><select className={inputClass} {...register('language')}><option value="en">English</option><option value="hi">Hindi</option><option value="te">Telugu</option></select></Field></div><p className="mt-4 text-xs text-ink-400">Changing timezone affects how generation and due dates are calculated.</p></SettingsCard></FormShell></section>;
}

function SettingsNav({ activeSection, setActiveSection, hostels, activeHostelId, onHostelChange, planId, compact = false }) {
    return (
        <nav aria-label="Settings navigation" className="space-y-5">
            <div className={cx('flex items-center gap-3', compact && 'justify-center')}>
                <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-brand-500 text-2xs font-bold text-white">AG</div>
                {!compact && <p className="text-base font-semibold text-ink-900 dark:text-ink-50">Apna Ghar</p>}
            </div>
            {!compact && <select value={activeHostelId || ''} onChange={(event) => onHostelChange(event.target.value)} className={inputClass}>{hostels.map((hostel) => <option key={hostel.id} value={hostel.id}>{hostel.name}</option>)}</select>}
            {groups.map((group) => (
                <div key={group}>
                    {!compact && <p className="mb-2 px-3 text-2xs font-semibold uppercase tracking-widest text-ink-400">{group}</p>}
                    <div className="space-y-1">
                        {sections.filter((section) => section.group === group).map((section) => {
                            const Icon = section.icon;
                            const active = activeSection === section.id;
                            const proLocked = section.pro && !hasAutomation(planId);
                            return (
                                <button key={section.id} type="button" aria-current={active ? 'page' : undefined} title={compact ? section.label : undefined} onClick={() => setActiveSection(section.id)} className={cx('group relative flex min-h-11 w-full items-center gap-3 rounded-md border-l-4 px-3 text-left text-base font-medium transition', active ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-transparent text-ink-600 hover:bg-surface-100 dark:text-ink-300', compact && 'justify-center px-2')}>
                                    <Icon size={18} aria-hidden="true" />
                                    {!compact && <span className="flex-1">{section.label}</span>}
                                    {!compact && proLocked && <span className="rounded-full bg-ink-100 px-2 py-1 text-2xs text-ink-500">Pro</span>}
                                    {compact && <span className="pointer-events-none absolute left-12 z-50 hidden rounded-md bg-ink-900 px-2 py-1 text-xs text-white group-hover:block">{section.label}</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </nav>
    );
}

function MobileOverview({ setActiveSection }) {
    return (
        <div className="md:hidden">
            <div className="sticky top-0 z-40 -mx-4 mb-4 flex h-14 items-center border-b border-ink-200/40 bg-surface-0 px-4 dark:bg-ink-950"><h1 className="text-lg font-semibold text-ink-900 dark:text-ink-50">Settings</h1></div>
            <div className="grid grid-cols-3 gap-3">
                {sections.map((section) => { const Icon = section.icon; return <button key={section.id} type="button" onClick={() => setActiveSection(section.id)} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-ink-200 bg-surface-0 p-3 text-center text-xs font-medium text-ink-700 shadow-sm"><Icon size={20} aria-hidden="true" />{section.label}</button>; })}
            </div>
        </div>
    );
}

function MobileDrawer({ open, onClose, children }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 md:hidden">
            <button aria-label="Close settings menu" type="button" onClick={onClose} className="absolute inset-0 bg-ink-900/50" />
            <div className="absolute inset-x-0 bottom-0 max-h-dvh overflow-y-auto rounded-t-xl bg-surface-0 p-4 shadow-lg dark:bg-ink-950">
                <div className="mb-4 flex items-center justify-between"><p className="text-base font-semibold text-ink-900 dark:text-ink-50">Settings menu</p><button type="button" aria-label="Close menu" onClick={onClose} className="flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-surface-100"><X size={18} /></button></div>
                {children}
            </div>
        </div>
    );
}

export default function OwnerProfile() {
    const { updatePreferencesLocal } = useAppPreferences();
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState('');
    const [owner, setOwner] = useState(null);
    const [hostels, setHostels] = useState([]);
    const [activeHostelId, setSelectedHostelIdState] = useState('');
    const [hostel, setHostel] = useState(null);
    const [prefs, setPrefs] = useState(DEFAULT_PREFS);
    const [planId, setPlanId] = useState('free');
    const [addonUsage, setAddonUsage] = useState(null);
    const [activeSection, setActiveSection] = useState(() => (
        typeof window !== 'undefined' && window.innerWidth < 768 ? 'overview' : 'profile'
    ));
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [buyCreditsModal, setBuyCreditsModal] = useState(null);

    async function load(selectedId) {
        setLoading(true);
        setPageError('');
        try {
            const [profileData, hostelsData, subscriptionData, usageData] = await Promise.all([
                ownerService.getProfile(),
                ownerService.getHostels(),
                billingService.getSubscription().catch(() => null),
                addonService.getUsage().catch(() => null),
            ]);
            const nextOwner = profileData?.owner || {};
            const nextHostels = hostelsData?.hostels || profileData?.hostels || [];
            const chosenId = selectedId || nextHostels[0]?.id || '';
            const policyResponse = chosenId ? await ownerService.getHostelPreferences(chosenId) : null;
            const nextHostel = policyResponse?.hostel || nextHostels.find((item) => item.id === chosenId) || null;
            const nextPrefs = mergePreferences(policyResponse?.compatibility_preferences || {});
            setOwner(nextOwner);
            setHostels(nextHostels);
            setSelectedHostelIdState(chosenId);
            setHostel(nextHostel);
            setPrefs(nextPrefs);
            setPlanId(subscriptionData?.current_plan?.id || subscriptionData?.plan_id || 'free');
            setAddonUsage(usageData || null);
            updatePreferencesLocal(nextPrefs);
        } catch (error) {
            setPageError(errorMessage(error, 'Failed to load settings'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    async function switchHostel(hostelId) {
        if (!hostelId || hostelId === activeHostelId) return;
        await load(hostelId);
    }

    async function saveProfile(values) {
        const response = await ownerService.updateProfileSection(values);
        setOwner((current) => ({ ...current, ...(response?.profile || values) }));
    }

    async function saveHostel(values) {
        const response = await ownerService.updateHostel(values, activeHostelId);
        setHostel((current) => ({ ...current, ...(response?.hostel || values) }));
    }

    async function saveConfig(section, values) {
        const response = await ownerService.updateSectionConfig(activeHostelId, section, values);
        const nextPrefs = mergePreferences(response?.compatibility_preferences || prefs);
        setPrefs(nextPrefs);
        updatePreferencesLocal(nextPrefs);
    }

    async function uploadLogo(file) {
        const response = await ownerService.uploadLogo(file, activeHostelId);
        setHostel((current) => ({ ...current, ...(response?.hostel || {}) }));
        return response;
    }

    async function setAutoTopup(enabled) {
        const response = await addonService.setAutoTopup(enabled, 'settings');
        setAddonUsage((current) => ({ ...(current || {}), auto_topup: response?.auto_topup ?? enabled }));
    }

    async function sendTestReminder() {
        await ownerService.sendTestReminder('DUE_SOON', activeHostelId);
    }

    const active = sectionById[activeSection] || null;

    function renderSection() {
        if (!active || activeSection === 'overview') return <MobileOverview setActiveSection={setActiveSection} />;
        const onBack = () => setActiveSection('overview');
        const common = { activeHostel: hostel, onBack };
        switch (activeSection) {
            case 'profile': return <ProfileSection owner={owner} onSave={saveProfile} onBack={onBack} />;
            case 'hostel': return <HostelSection hostel={hostel} onSave={saveHostel} onUploadLogo={uploadLogo} {...common} />;
            case 'billing': return <BillingSection prefs={prefs} onSave={saveConfig} {...common} />;
            case 'tenant-defaults': return <TenantDefaultsSection prefs={prefs} onSave={saveConfig} {...common} />;
            case 'payments': return <PaymentsSection prefs={prefs} onSave={saveConfig} {...common} />;
            case 'notifications': return <NotificationsSection prefs={prefs} addonUsage={addonUsage} onSave={saveConfig} onTopup={() => setBuyCreditsModal('manual')} onAutoTopup={setAutoTopup} onTestReminder={sendTestReminder} {...common} />;
            case 'receipts': return <ReceiptsSection prefs={prefs} onSave={saveConfig} {...common} />;
            case 'automation': return <AutomationSection prefs={prefs} onSave={saveConfig} automationEnabled={hasAutomation(planId)} {...common} />;
            case 'security': return <SecuritySection prefs={prefs} onSave={saveConfig} {...common} />;
            case 'system': return <SystemSection prefs={prefs} onSave={saveConfig} {...common} />;
            default: return null;
        }
    }

    if (loading) {
        return <div className="flex min-h-screen items-center justify-center bg-surface-50 text-ink-600"><Loader2 className="animate-spin" size={22} aria-hidden="true" /><span className="ml-2 text-base">Loading settings...</span></div>;
    }

    return (
        <div className="min-h-screen bg-surface-50 text-ink-900 dark:bg-ink-950 dark:text-ink-50">
            <aside className="fixed inset-y-0 left-0 z-30 hidden w-16 border-r border-ink-200/60 bg-surface-0 p-3 dark:bg-ink-950 md:block lg:w-56">
                <div className="hidden lg:block"><SettingsNav activeSection={activeSection === 'overview' ? 'profile' : activeSection} setActiveSection={setActiveSection} hostels={hostels} activeHostelId={activeHostelId} onHostelChange={switchHostel} planId={planId} /></div>
                <div className="lg:hidden"><SettingsNav compact activeSection={activeSection === 'overview' ? 'profile' : activeSection} setActiveSection={setActiveSection} hostels={hostels} activeHostelId={activeHostelId} onHostelChange={switchHostel} planId={planId} /></div>
            </aside>

            <main className="px-4 py-0 md:ml-16 md:px-6 md:py-6 lg:ml-56">
                <div className="mx-auto max-w-2xl">
                    {pageError && <div className="mb-4 rounded-md border border-danger-500 bg-danger-50 p-3 text-sm text-danger-500">{pageError}</div>}
                    {renderSection()}
                </div>
            </main>

            <button type="button" onClick={() => setDrawerOpen(true)} className="fixed bottom-4 left-1/2 z-50 flex min-h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-brand-500 px-5 text-base font-medium text-white shadow-lg md:hidden">
                <Menu size={16} aria-hidden="true" /> Settings
            </button>
            <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
                <SettingsNav activeSection={activeSection === 'overview' ? 'profile' : activeSection} setActiveSection={(id) => { setActiveSection(id); setDrawerOpen(false); }} hostels={hostels} activeHostelId={activeHostelId} onHostelChange={(id) => { switchHostel(id); setDrawerOpen(false); }} planId={planId} />
            </MobileDrawer>
            {buyCreditsModal && <BuyRemindersModal isOpen={!!buyCreditsModal} onClose={() => setBuyCreditsModal(null)} trigger={buyCreditsModal} onSuccess={() => load(activeHostelId)} />}
        </div>
    );
}
