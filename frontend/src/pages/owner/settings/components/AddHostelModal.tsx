import React, { useState } from 'react';
import { X, Building2, AlertCircle, Loader2, Lock } from 'lucide-react';
import { Button, Field, inputClass, cx } from './ui';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';

export function AddHostelModal({ isOpen, onClose, onSubmit, plan, hostelsCount }: any) {
    const { register, handleSubmit, formState: { errors }, reset } = useForm();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    // A limit > 0 means there is a hard cap. If limit is 0 or null, it's unlimited.
    const isLimited = plan && plan.hostel_limit > 0 && hostelsCount >= plan.hostel_limit;

    async function handleAdd(values: any) {
        setSubmitting(true);
        setError('');
        try {
            await onSubmit(values);
            reset();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to add hostel');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-900/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-xl bg-surface-0 shadow-2xl dark:bg-ink-950">
                <div className="flex items-center justify-between border-b border-ink-200/40 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                            <Building2 size={20} />
                        </div>
                        <h2 className="text-lg font-semibold text-ink-900 dark:text-ink-50">Add new hostel</h2>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-md p-2 text-ink-500 hover:bg-surface-100 dark:hover:bg-ink-900">
                        <X size={20} />
                    </button>
                </div>
                
                {isLimited ? (
                    <div className="p-6 text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-500">
                            <Lock size={28} />
                        </div>
                        <h3 className="mb-2 text-lg font-semibold text-ink-900 dark:text-ink-50">Hostel limit reached</h3>
                        <p className="mb-6 text-sm text-ink-600 dark:text-ink-300">
                            Your current <strong>{plan.name}</strong> plan only supports up to {plan.hostel_limit} {plan.hostel_limit === 1 ? 'hostel' : 'hostels'}. Upgrade your plan to unlock multiple hostels and manage your entire portfolio from one account.
                        </p>
                        <div className="flex flex-col gap-3">
                            <Link to="/dashboard/billing" className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand-500 px-4 text-base font-medium text-white transition hover:bg-brand-600" onClick={onClose}>
                                View upgrade options
                            </Link>
                            <Button variant="ghost" onClick={onClose}>Cancel</Button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit(handleAdd)} className="p-5">
                        {error && (
                            <div className="mb-4 flex items-start gap-2 rounded-md border border-danger-500 bg-danger-50 p-3 text-sm text-danger-600">
                                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                <p className="flex-1">{error}</p>
                            </div>
                        )}
                        
                        <div className="space-y-4">
                            <Field label="Hostel name" error={errors.name?.message as string}>
                                <input autoFocus placeholder="e.g. Skyline Hostel" className={inputClass} {...register('name', { required: 'Hostel name is required' })} />
                            </Field>
                            
                            <Field label="Phone number (optional)">
                                <input type="tel" placeholder="e.g. +91 9876543210" className={inputClass} {...register('phone')} />
                            </Field>
                        </div>
                        
                        <div className="mt-6 flex gap-3">
                            <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
                            <Button type="submit" disabled={submitting} className="flex-1">
                                {submitting && <Loader2 size={16} className="animate-spin" />}
                                Create hostel
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
