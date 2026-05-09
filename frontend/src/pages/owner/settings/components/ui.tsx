import React from 'react';
import { Building2, Loader2, CheckCircle } from 'lucide-react';

export function cx(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(' ');
}

export const inputClass = 'w-full rounded-md border border-ink-200 bg-surface-0 px-3 py-2 text-base text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:bg-surface-100 disabled:text-ink-400 dark:bg-ink-950 dark:text-ink-50';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'ghost' | 'outline' | 'danger';
}

export function Button({ children, variant = 'primary', className = '', ...props }: ButtonProps) {
    return (
        <button
            type="button"
            className={cx(
                'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-base font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
                variant === 'primary' && 'bg-brand-500 text-white hover:bg-brand-600',
                variant === 'ghost' && 'bg-transparent text-ink-700 hover:bg-surface-100 dark:text-ink-100',
                variant === 'outline' && 'border border-ink-200 bg-surface-0 text-ink-800 hover:bg-surface-100 dark:bg-ink-900 dark:text-ink-50',
                variant === 'danger' && 'bg-danger-500 text-white',
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
}

interface SaveButtonProps {
    dirty: boolean;
    saving: boolean;
    saved: boolean;
    mobile?: boolean;
}

export function SaveButton({ dirty, saving, saved, mobile = false }: SaveButtonProps) {
    return (
        <button
            type="submit"
            disabled={!dirty || saving}
            className={cx(
                'relative inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-base font-medium transition disabled:cursor-not-allowed',
                dirty ? 'bg-brand-500 text-white hover:bg-brand-600' : 'bg-ink-100 text-ink-400',
                mobile && 'px-3'
            )}
        >
            {dirty && mobile && <span className="absolute -left-1 top-2 h-1 w-1 rounded-full bg-brand-500" />}
            {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {saved && !saving && <CheckCircle size={16} aria-hidden="true" />}
            {saved ? 'Saved' : 'Save'}
        </button>
    );
}

interface SettingsCardProps {
    title: string;
    description?: string;
    children: React.ReactNode;
}

export function SettingsCard({ title, description, children }: SettingsCardProps) {
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

interface FieldProps {
    label: string;
    hint?: string;
    error?: string;
    readOnly?: boolean;
    children: React.ReactNode;
}

export function Field({ label, hint, error, readOnly, children }: FieldProps) {
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

interface ToggleRowProps {
    title: string;
    description?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}

export function ToggleRow({ title, description, checked, onChange, disabled }: ToggleRowProps) {
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

export function ScopePill({ hostel }: { hostel?: string }) {
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            <Building2 size={13} aria-hidden="true" />
            {hostel || 'Selected hostel'} only
        </span>
    );
}
