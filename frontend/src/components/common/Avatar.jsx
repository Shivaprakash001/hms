import React, { useEffect, useMemo, useState } from 'react';

export default function Avatar({ src, name, size = 32, className = '' }) {
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
        setImageError(false);
    }, [src]);

    const fallback = useMemo(() => {
        const trimmed = (name || '').trim();
        return trimmed ? trimmed.charAt(0).toUpperCase() : 'U';
    }, [name]);

    const resolvedSrc = src && !imageError ? src : '';
    const fallbackFontSize = Math.max(11, Math.round(size * 0.42));

    return (
        <div
            className={`rounded-full overflow-hidden shrink-0 bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold select-none ${className}`}
            style={{ width: size, height: size }}
            aria-label="avatar"
        >
            {resolvedSrc ? (
                <img
                    src={resolvedSrc}
                    alt={`${name || 'User'} avatar`}
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                />
            ) : (
                <span style={{ fontSize: `${fallbackFontSize}px`, lineHeight: 1 }}>{fallback}</span>
            )}
        </div>
    );
}
