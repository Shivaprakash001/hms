export const normalizeIndianPhone = (value) => {
    const cleaned = String(value || '').replace(/\D/g, '');
    if (cleaned.length === 10) return `+91${cleaned}`;
    if (cleaned.length === 12 && cleaned.startsWith('91')) return `+${cleaned}`;
    if (cleaned.length === 13 && cleaned.startsWith('091')) return `+${cleaned.slice(1)}`;
    return null;
};

export const indianPhoneDigits = (value) => {
    const normalized = normalizeIndianPhone(value);
    return normalized ? normalized.slice(3) : String(value || '').replace(/\D/g, '').slice(-10);
};
