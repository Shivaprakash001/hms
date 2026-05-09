import React, { useRef, useState, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import {
    AlertCircle, Bell, Bot, Building2, CalendarClock,
    ChevronLeft, CreditCard, Lock, Mail, MessageCircle, Monitor, Receipt,
    Settings2, ShieldCheck, UploadCloud, User, Users, X
} from 'lucide-react';
import { useSectionForm } from './hooks/useSectionForm';
import { Button, SettingsCard, Field, ToggleRow, SaveButton, ScopePill, inputClass, cx } from './components/ui';

export const DEFAULT_BILLING_DEFAULTS = {
    advance_deposit: 0,
    maintenance_charge: 0,
    maintenance_type: 'MONTHLY',
    auto_fill_room_rent: true,
    allow_override: true,
};

export const DEFAULT_PREFS = {
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

export const sectionsMeta = [
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

export const sectionById = Object.fromEntries(sectionsMeta.map(s => [s.id, s]));

export function normalizeDays(value: any, fallback: number[] = []) {
    const source = Array.isArray(value) ? value : fallback;
    return Array.from(new Set(source.map(Number).filter(day => Number.isInteger(day) && day > 0 && day <= 90))).sort((a, b) => a - b);
}

function SectionHeader({ section, activeHostel, dirty, saving, saved, error, onClearError }: any) {
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

function MobileTopBar({ section, dirty, saving, saved, onBack }: any) {
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

export function FormShell({ section, activeHostel, children, formState, onSubmit, onBack }: any) {
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

export function ProfileSection({ owner, onSave, onBack }: any) {
    const defaults = useMemo(() => ({ name: owner?.name || '', phone: owner?.phone || '', email: owner?.email || '', new_password: '', confirm_password: '' }), [owner]);
    const state = useSectionForm(defaults, async (values: any) => {
        if (values.new_password) throw new Error('Password changes require current-password verification. Leave blank to update profile.');
        return onSave({ name: values.name, phone: values.phone });
    });
    const { register, handleSubmit, watch, formState: { errors } } = state.form;
    return (
        <section aria-labelledby="profile-heading">
            <FormShell section={sectionById.profile} formState={state} onSubmit={handleSubmit(state.submit)} onBack={onBack}>
                <SettingsCard title="Personal information">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="Full name" error={errors.name?.message as string}><input className={inputClass} {...register('name', { required: 'Full name is required' })} /></Field>
                        <Field label="Phone"><input className={inputClass} {...register('phone')} /></Field>
                    </div>
                    <div className="mt-3"><Field label="Email" readOnly hint="Email cannot be changed"><input className={inputClass} readOnly {...register('email')} /></Field></div>
                </SettingsCard>
                <SettingsCard title="Security">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="New password" hint="Leave blank to keep current"><input type="password" placeholder="Leave blank to keep current" className={inputClass} {...register('new_password')} /></Field>
                        <Field label="Confirm password" error={errors.confirm_password?.message as string}><input type="password" placeholder="Leave blank to keep current" className={inputClass} {...register('confirm_password', { validate: (value: string) => !watch('new_password') || value === watch('new_password') || 'Passwords do not match' })} /></Field>
                    </div>
                </SettingsCard>
            </FormShell>
        </section>
    );
}

export function HostelSection({ hostel, onSave, onUploadLogo, onBack }: any) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const defaults = useMemo(() => ({
        name: hostel?.name || '', phone: hostel?.phone || '', gst_number: hostel?.gst_number || '', address: hostel?.address || '', city: hostel?.city || '', state: hostel?.state || '', pincode: hostel?.pincode || '', logo_url: hostel?.logo_url || '',
    }), [hostel]);
    const state = useSectionForm(defaults, onSave);
    const { register, handleSubmit, setValue, watch, formState: { errors } } = state.form;
    
    async function handleFile(event: any) {
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
        } catch (err: any) {
            state.setError(err?.message || 'Failed to upload logo');
        } finally {
            setUploading(false);
        }
    }
    
    return (
        <section aria-labelledby="hostel-heading">
            <FormShell section={sectionById.hostel} activeHostel={hostel} formState={state} onSubmit={handleSubmit(state.submit)} onBack={onBack}>
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
                    <Field label="Hostel name" error={errors.name?.message as string}><input className={inputClass} {...register('name', { required: 'Hostel name is required' })} /></Field>
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

export function BillingSection({ prefs, activeHostel, onSave, onBack }: any) {
    const defaults = useMemo(() => ({
        rent_cycle: prefs.rent_cycle, auto_rent_day: Number(prefs.auto_rent_day), due_day: Number(prefs.due_day), grace_days: Number(prefs.grace_days || 0), late_fee_rules: prefs.late_fee_rules?.length ? prefs.late_fee_rules : DEFAULT_PREFS.late_fee_rules, max_late_fee: Number(prefs.max_late_fee || 0),
    }), [prefs]);
    const state = useSectionForm(defaults, (values: any) => onSave('billing-config', values));
    const { control, register, handleSubmit, watch, setValue } = state.form;
    const { fields, append, remove } = useFieldArray({ control, name: 'late_fee_rules' });
    const grace = Number(watch('grace_days') || 0);
    const dayOptions = Array.from({ length: 28 }, (_, i) => i + 1);
    
    return (
        <section aria-labelledby="billing-heading">
            <FormShell section={sectionById.billing} activeHostel={activeHostel} formState={state} onSubmit={handleSubmit(state.submit)} onBack={onBack}>
                <SettingsCard title="Rent cycle">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <Field label="Cycle"><select className={inputClass} {...register('rent_cycle')}><option value="MONTHLY">Monthly</option></select></Field>
                        <Field label="Generate on"><select className={inputClass} {...register('auto_rent_day', { valueAsNumber: true })}>{dayOptions.map((day) => <option key={day} value={day}>{day}</option>)}</select></Field>
                        <Field label="Due on"><select className={inputClass} {...register('due_day', { valueAsNumber: true })}>{dayOptions.map((day) => <option key={day} value={day}>{day}</option>)}</select></Field>
                    </div>
                    <div className="mt-4">
                        <p className="mb-2 text-xs font-medium text-ink-600">Grace period — days after due date before late fees apply</p>
                        <div className="flex items-center gap-3 sm:hidden">
                            <Button variant="outline" onClick={() => setValue('grace_days', Math.max(0, grace - 1), { shouldDirty: true })}>-</Button>
                            <span className="min-h-11 flex-1 rounded-md border border-ink-200 px-3 py-3 text-center text-base font-medium">{grace} days</span>
                            <Button variant="outline" onClick={() => setValue('grace_days', Math.min(15, grace + 1), { shouldDirty: true })}>+</Button>
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
                                        <Field label="Type"><select className={inputClass} {...register(`late_fee_rules.${index}.type` as const)}><option value="PER_DAY">Per day ₹</option><option value="FLAT">Flat fee ₹</option><option value="PERCENTAGE">Percentage %</option></select></Field>
                                        <Field label="Amount"><input type="number" min="0" className={inputClass} {...register(`late_fee_rules.${index}.amount` as const, { valueAsNumber: true })} /></Field>
                                        <Field label="After N days"><input type="number" min="0" className={inputClass} {...register(`late_fee_rules.${index}.after_days` as const, { valueAsNumber: true })} /></Field>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between gap-2">
                                        <p className="text-xs text-ink-500">{typeLabel} from day {row.after_days || 0}</p>
                                        {fields.length > 1 && <Button variant="ghost" onClick={() => remove(index)} aria-label="Remove late fee rule"><X size={16} /></Button>}
                                    </div>
                                </div>
                            );
                        })}
                        <Button variant="ghost" disabled={fields.length >= 3} onClick={() => append({ type: 'FLAT', amount: 100, after_days: 7 } as any)}>+ Add rule</Button>
                        <Field label="Maximum late fee cap (₹)"><input type="number" min="0" className={cx(inputClass, 'max-w-xs')} {...register('max_late_fee', { valueAsNumber: true })} /></Field>
                    </div>
                </SettingsCard>
            </FormShell>
        </section>
    );
}

export function TenantDefaultsSection({ prefs, activeHostel, onSave, onBack }: any) {
    const defaults = useMemo(() => ({ ...prefs.billing_defaults }), [prefs]);
    const state = useSectionForm(defaults, (values: any) => onSave('invite-defaults', values));
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
                    <ToggleRow title="Auto-fill room rent" description="Pre-fill rent from the room's base rent" checked={watch('auto_fill_room_rent')} onChange={(value: boolean) => setValue('auto_fill_room_rent', value, { shouldDirty: true })} />
                    <ToggleRow title="Allow manual override" description="Customize values per invite before sending" checked={watch('allow_override')} onChange={(value: boolean) => setValue('allow_override', value, { shouldDirty: true })} />
                    <div className="mt-3 inline-flex rounded-full bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">New invites default to ₹{watch('advance_deposit') || 0} deposit + ₹{watch('maintenance_charge') || 0} {String(type || '').toLowerCase()} maintenance</div>
                </SettingsCard>
            </FormShell>
        </section>
    );
}

export function PaymentsSection({ prefs, activeHostel, onSave, onBack }: any) {
    const defaults = useMemo(() => ({ upi_id: prefs.upi_id || '', phonepe_merchant_id: prefs.phonepe_merchant_id || '', allow_partial_payments: !!prefs.allow_partial_payments }), [prefs]);
    const state = useSectionForm(defaults, (values: any) => onSave('payment-config', values));
    const { register, handleSubmit, watch, setValue } = state.form;
    return (
        <section aria-labelledby="payments-heading">
            <FormShell section={sectionById.payments} activeHostel={activeHostel} formState={state} onSubmit={handleSubmit(state.submit)} onBack={onBack}>
                <SettingsCard title="UPI configuration">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="UPI ID"><input placeholder="yourname@upi" className={inputClass} {...register('upi_id')} /></Field>
                        <Field label="PhonePe merchant ID" hint="Optional"><input className={inputClass} {...register('phonepe_merchant_id')} /></Field>
                    </div>
                </SettingsCard>
                <SettingsCard title="Payment rules">
                    <ToggleRow title="Allow partial payments" description="Tenants can pay less than the full amount due" checked={watch('allow_partial_payments')} onChange={(value: boolean) => setValue('allow_partial_payments', value, { shouldDirty: true })} />
                </SettingsCard>
            </FormShell>
        </section>
    );
}

function ChannelRow({ icon: Icon, title, description, checked, onChange, disabled, badge, tone = 'slate' }: any) {
    const toneClass = tone === 'blue' ? 'bg-blue-50 text-blue-600' : tone === 'green' ? 'bg-green-50 text-green-600' : 'bg-ink-100 text-ink-500';
    return (
        <div className="flex items-center justify-between gap-3 border-t border-ink-200/40 py-3 first:border-t-0">
            <div className="flex items-center gap-3">
                <span className={cx('flex h-8 w-8 items-center justify-center rounded-md', toneClass)}><Icon size={16} aria-hidden="true" /></span>
                <div>
                    <p className="text-base font-medium text-ink-900 dark:text-ink-50">{title} {badge && <span className="ml-2 rounded-full bg-ink-100 px-2 py-1 text-2xs text-ink-500">{badge}</span>}</p>
                    <p className="text-sm text-ink-600">{description}</p>
                </div>
            </div>
            <ToggleRow title="" checked={checked} onChange={onChange} disabled={disabled} />
        </div>
    );
}

export function NotificationsSection({ prefs, activeHostel, addonUsage, onSave, onTopup, onAutoTopup, onTestReminder, onBack }: any) {
    const defaults = useMemo(() => ({
        reminder_email: prefs.reminder_email, reminder_in_app: prefs.reminder_in_app, reminder_whatsapp: prefs.reminder_whatsapp, reminder_after_due_days: normalizeDays(prefs.reminder_after_due_days, [1, 5, 10]), reminder_before_due_days: normalizeDays(prefs.reminder_before_due_days, []), reminder_auto_stop_after_payment: prefs.reminder_auto_stop_after_payment, late_fee_notification: prefs.late_fee_notification, owner_daily_summary: prefs.owner_daily_summary, auto_send_reminders: prefs.auto_send_reminders,
    }), [prefs]);
    const state = useSectionForm(defaults, (values: any) => onSave('notification-config', values));
    const { handleSubmit, watch, setValue } = state.form;
    const credits = Number(addonUsage?.reminders_remaining || 0);
    const fill = Math.min(100, Math.round((credits / 200) * 100));
    const days = watch('reminder_after_due_days') || [];
    
    function toggleDay(day: number) {
        const next = days.includes(day) ? days.filter((item: number) => item !== day) : [...days, day];
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
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xl font-semibold text-ink-900 dark:text-ink-50">{credits}</p>
                            <p className="text-sm text-ink-600">credits remaining</p>
                        </div>
                        <Button onClick={onTopup}>Top up</Button>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-ink-200"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${fill}%` }} /></div>
                    {credits < 20 && <div className="mt-3 rounded-md border border-warning-500 bg-warning-50 p-3 text-sm text-amber-700">Low reminder credits. Top up to avoid paused automation.</div>}
                    <ToggleRow title="Auto top-up" description="Buy 200 credits when balance reaches 0" checked={!!addonUsage?.auto_topup} onChange={onAutoTopup} />
                </SettingsCard>
                <SettingsCard title="Channels">
                    <ChannelRow icon={Mail} tone="blue" title="Email" description="Send reminders via email" checked={watch('reminder_email')} onChange={(v: boolean) => setValue('reminder_email', v, { shouldDirty: true })} />
                    <ChannelRow icon={Monitor} tone="green" title="In-app" description="Show inside tenant dashboard" checked={watch('reminder_in_app')} onChange={(v: boolean) => setValue('reminder_in_app', v, { shouldDirty: true })} />
                    <ChannelRow icon={MessageCircle} title="WhatsApp" description="Coming soon" checked={false} disabled badge="Coming soon" onChange={() => {}} />
                </SettingsCard>
                <SettingsCard title="Reminder schedule" description="Days after due date to trigger a reminder">
                    <div className="flex flex-wrap gap-2">
                        {[1, 5, 10, 15, ...days.filter((day: number) => ![1, 5, 10, 15].includes(day))].slice(0, 8).map((day: number) => (
                            <button key={day} type="button" onClick={() => toggleDay(day)} className={cx('min-h-11 rounded-full border px-3 text-sm font-medium', days.includes(day) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:bg-surface-100')}>Day {day}{day === 1 ? ' — Gentle' : day === 5 ? ' — Warning' : day === 10 ? ' — Final notice' : ''}</button>
                        ))}
                        <Button variant="ghost" disabled={days.length >= 6} onClick={addCustomDay}>+ Custom day</Button>
                    </div>
                </SettingsCard>
                <SettingsCard title="Owner alerts">
                    <ToggleRow title="Late fee applied" description="Notify when late fees are added" checked={watch('late_fee_notification')} onChange={(v: boolean) => setValue('late_fee_notification', v, { shouldDirty: true })} />
                    <ToggleRow title="Daily summary" description="Morning email with payment stats" checked={watch('owner_daily_summary')} onChange={(v: boolean) => setValue('owner_daily_summary', v, { shouldDirty: true })} />
                    <div className="pt-3"><Button variant="ghost" onClick={onTestReminder}><Bell size={16} /> Send test reminder to myself</Button></div>
                </SettingsCard>
            </FormShell>
        </section>
    );
}

export function ReceiptsSection({ prefs, activeHostel, onSave, onBack }: any) {
    const defaults = useMemo(() => ({ receipt_prefix: prefs.receipt_prefix || 'HMS', receipt_format: prefs.receipt_format || 'PREFIX-YEAR-SEQ', auto_email_receipt: !!prefs.auto_email_receipt, receipt_footer: prefs.receipt_footer || '' }), [prefs]);
    const state = useSectionForm(defaults, (values: any) => onSave('receipt-config', values));
    const { register, handleSubmit, watch, setValue } = state.form;
    const prefix = String(watch('receipt_prefix') || 'HMS').slice(0, 6).toUpperCase();
    return (
        <section aria-labelledby="receipts-heading">
            <FormShell section={sectionById.receipts} activeHostel={activeHostel} formState={state} onSubmit={handleSubmit(state.submit)} onBack={onBack}>
                <SettingsCard title="Receipt numbering">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="Prefix"><input maxLength={6} className={inputClass} {...register('receipt_prefix')} /></Field>
                        <Field label="Format"><select className={inputClass} {...register('receipt_format')}><option value="PREFIX-YEAR-SEQ">PREFIX-YEAR-SEQ</option><option value="PREFIX-SEQ">PREFIX-SEQ</option></select></Field>
                    </div>
                    <p className="mt-3 font-mono text-sm text-ink-400">Preview: {prefix}-2026-0001</p>
                </SettingsCard>
                <SettingsCard title="Delivery & footer">
                    <ToggleRow title="Auto-email receipt on payment" description="Send PDF to tenant on confirmation" checked={watch('auto_email_receipt')} onChange={(v: boolean) => setValue('auto_email_receipt', v, { shouldDirty: true })} />
                    <Field label="Footer message" hint={`${String(watch('receipt_footer') || '').length}/120 characters`}><input maxLength={120} className={inputClass} {...register('receipt_footer')} /></Field>
                </SettingsCard>
            </FormShell>
        </section>
    );
}

export function AutomationSection({ prefs, activeHostel, onSave, automationEnabled, onBack }: any) {
    const defaults = useMemo(() => ({ auto_generate_rent: prefs.auto_generate_rent, auto_apply_late_fees: prefs.auto_apply_late_fees, auto_send_reminders: prefs.auto_send_reminders }), [prefs]);
    const state = useSectionForm(defaults, (values: any) => onSave('automation-config', values));
    const { handleSubmit, watch, setValue } = state.form;
    return (
        <section aria-labelledby="automation-heading">
            <FormShell section={sectionById.automation} activeHostel={activeHostel} formState={state} onSubmit={handleSubmit(state.submit)} onBack={onBack}>
                {!automationEnabled && <div className="rounded-lg border border-warning-500 bg-warning-50 p-4 text-amber-800"><div className="flex gap-3"><Lock size={18} aria-hidden="true" /><div><p className="font-semibold">Automation requires Starter plan</p><p className="text-sm">Upgrade to activate rent generation, late fees, and reminders.</p></div></div></div>}
                <div className={cx(!automationEnabled && 'pointer-events-none opacity-40')} aria-label={!automationEnabled ? 'Automation settings — requires Starter plan' : undefined}>
                    <SettingsCard title="Automated tasks">
                        <ToggleRow title="Auto-generate rent" description="Create obligations on generation day each month" checked={watch('auto_generate_rent')} onChange={(v: boolean) => setValue('auto_generate_rent', v, { shouldDirty: true })} />
                        <ToggleRow title="Auto-apply late fees" description="Add late fees after grace period automatically" checked={watch('auto_apply_late_fees')} onChange={(v: boolean) => setValue('auto_apply_late_fees', v, { shouldDirty: true })} />
                        <ToggleRow title="Auto-send reminders" description="Trigger reminders per your notification schedule" checked={watch('auto_send_reminders')} onChange={(v: boolean) => setValue('auto_send_reminders', v, { shouldDirty: true })} />
                    </SettingsCard>
                </div>
            </FormShell>
        </section>
    );
}

export function SecuritySection({ prefs, activeHostel, onSave, onBack }: any) {
    const defaults = useMemo(() => ({ allow_tenant_edits: prefs.allow_tenant_edits, require_doc_approval: prefs.require_doc_approval, data_retention_months: Number(prefs.data_retention_months || 0) }), [prefs]);
    const state = useSectionForm(defaults, (values: any) => onSave('security-config', values));
    const { register, handleSubmit, watch, setValue } = state.form;
    return (
        <section aria-labelledby="security-heading">
            <FormShell section={sectionById.security} activeHostel={activeHostel} formState={state} onSubmit={handleSubmit(state.submit)} onBack={onBack}>
                <SettingsCard title="Tenant permissions">
                    <ToggleRow title="Tenants can edit their profile" description="Name, phone, personal details" checked={watch('allow_tenant_edits')} onChange={(v: boolean) => setValue('allow_tenant_edits', v, { shouldDirty: true })} />
                    <ToggleRow title="Require document approval" description="You approve uploaded ID before tenant is verified" checked={watch('require_doc_approval')} onChange={(v: boolean) => setValue('require_doc_approval', v, { shouldDirty: true })} />
                </SettingsCard>
                <SettingsCard title="Data retention">
                    <div className="max-w-xs">
                        <Field label="Keep records for" hint="Applies to exited tenant records and payment history">
                            <select className={inputClass} {...register('data_retention_months', { valueAsNumber: true })}>
                                <option value={0}>Forever</option>
                                <option value={36}>3 years</option>
                                <option value={60}>5 years</option>
                                <option value={84}>7 years</option>
                            </select>
                        </Field>
                    </div>
                </SettingsCard>
            </FormShell>
        </section>
    );
}

export function SystemSection({ prefs, activeHostel, onSave, onBack }: any) {
    const defaults = useMemo(() => ({ currency: prefs.currency, timezone: prefs.timezone, date_format: prefs.date_format, time_format: prefs.time_format, language: prefs.language }), [prefs]);
    const state = useSectionForm(defaults, (values: any) => onSave('system-config', values));
    const { register, handleSubmit } = state.form;
    return (
        <section aria-labelledby="system-heading">
            <FormShell section={sectionById.system} activeHostel={activeHostel} formState={state} onSubmit={handleSubmit(state.submit)} onBack={onBack}>
                <SettingsCard title="Locale & display">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="Currency"><select className={inputClass} {...register('currency')}><option value="INR">₹ INR</option><option value="USD">$ USD</option></select></Field>
                        <Field label="Timezone"><select className={inputClass} {...register('timezone')}><option value="Asia/Kolkata">Asia/Kolkata</option><option value="UTC">UTC</option></select></Field>
                        <Field label="Date format"><select className={inputClass} {...register('date_format')}><option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="MM/DD/YYYY">MM/DD/YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option></select></Field>
                        <Field label="Time format"><select className={inputClass} {...register('time_format')}><option value="12h">12 hour</option><option value="24h">24 hour</option></select></Field>
                    </div>
                    <div className="mt-3 max-w-xs"><Field label="Language"><select className={inputClass} {...register('language')}><option value="en">English</option><option value="hi">Hindi</option><option value="te">Telugu</option></select></Field></div>
                    <p className="mt-4 text-xs text-ink-400">Changing timezone affects how generation and due dates are calculated.</p>
                </SettingsCard>
            </FormShell>
        </section>
    );
}
