import { useState, useEffect } from 'react';
import { useForm, DefaultValues, FieldValues } from 'react-hook-form';

export function errorMessage(error: any, fallback: string): string {
    const detail = error?.response?.data?.detail || error?.response?.data?.message || error?.response?.data?.error?.message || error?.message;
    return `${fallback}${detail ? `. ${typeof detail === 'string' ? detail : detail.message || ''}` : ''}`;
}

export function useSectionForm<T extends FieldValues>(defaultValues: DefaultValues<T>, onSave: (values: T) => Promise<any>) {
    const form = useForm<T>({ defaultValues, mode: 'onBlur' });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        form.reset(defaultValues);
    }, [defaultValues, form]);

    async function submit(values: T) {
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
