import React from 'react';

const QrCodeImage = ({ value, size = 220, alt = 'Payment QR code' }) => {
    if (!value) {
        return (
            <div className="w-full aspect-square rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-sm text-slate-400">
                QR unavailable
            </div>
        );
    }

    const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;
    return (
        <img
            src={src}
            alt={alt}
            className="w-full aspect-square rounded-2xl border border-slate-200 bg-white object-contain"
        />
    );
};

export default QrCodeImage;
