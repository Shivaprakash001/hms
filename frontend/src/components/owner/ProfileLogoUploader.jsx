import React, { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, UploadCloud } from 'lucide-react';
import Avatar from '../common/Avatar';

const MAX_UPLOAD_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_WIDTH = 512;

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
});

const loadImage = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
});

const resizeLogoFile = async (file) => {
    const src = await readFileAsDataUrl(file);
    const image = await loadImage(src);

    const ratio = image.width > MAX_WIDTH ? (MAX_WIDTH / image.width) : 1;
    const width = Math.max(1, Math.round(image.width * ratio));
    const height = Math.max(1, Math.round(image.height * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, width, height);

    let quality = 0.9;
    let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    while (blob && blob.size > MAX_UPLOAD_SIZE && quality > 0.5) {
        quality -= 0.1;
        blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    }

    if (!blob) {
        throw new Error('Failed to process image');
    }

    return new File([blob], 'logo.webp', { type: 'image/webp' });
};

export default function ProfileLogoUploader({ logoUrl, onUpload, onRemove, disabled = false }) {
    const inputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [error, setError] = useState('');

    const handleChooseFile = () => {
        if (disabled || uploading) return;
        inputRef.current?.click();
    };

    const handleFileChange = async (event) => {
        const selected = event.target.files?.[0];
        event.target.value = '';
        if (!selected) return;

        setError('');

        if (!ALLOWED_TYPES.includes(selected.type)) {
            setError('Only PNG, JPG, and WEBP logos are allowed.');
            return;
        }

        try {
            setUploading(true);
            const optimized = await resizeLogoFile(selected);
            if (optimized.size > MAX_UPLOAD_SIZE) {
                throw new Error('Logo must be 2MB or smaller after optimization.');
            }
            await onUpload(optimized);
        } catch (uploadError) {
            setError(uploadError?.message || 'Failed to upload logo.');
        } finally {
            setUploading(false);
        }
    };

    const handleRemove = async () => {
        if (disabled || uploading || removing || !logoUrl || !onRemove) return;
        const confirmed = window.confirm('Remove the hostel logo?');
        if (!confirmed) return;

        setError('');
        try {
            setRemoving(true);
            await onRemove();
        } catch (uploadError) {
            setError(uploadError?.message || 'Failed to remove logo.');
        } finally {
            setRemoving(false);
        }
    };

    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {logoUrl ? (
                    <Avatar src={logoUrl} name="Hostel Logo" size={72} className="ring-2 ring-white border border-slate-200" />
                ) : (
                    <div className="w-[72px] h-[72px] rounded-full bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        <ImagePlus size={22} className="text-slate-400" />
                    </div>
                )}
                <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">Hostel Logo</p>
                    <p className="text-xs text-slate-500 mt-0.5">Used in owner avatar and receipt branding. PNG/JPG/WEBP, max 2MB.</p>
                    {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}
                </div>
                <button
                    type="button"
                    onClick={handleChooseFile}
                    disabled={disabled || uploading}
                    className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-ops-accent text-white text-sm font-semibold hover:bg-ops-accent/700 transition-colors disabled:opacity-70"
                >
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                    {uploading ? 'Uploading...' : 'Upload Logo'}
                </button>
                {logoUrl && (
                    <button
                        type="button"
                        onClick={handleRemove}
                        disabled={disabled || uploading || removing}
                        className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-rose-200 bg-white text-rose-600 text-sm font-semibold hover:bg-rose-50 transition-colors disabled:opacity-70"
                    >
                        {removing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        {removing ? 'Removing...' : 'Remove Logo'}
                    </button>
                )}
            </div>

            <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFileChange}
                disabled={disabled || uploading}
            />
        </div>
    );
}
