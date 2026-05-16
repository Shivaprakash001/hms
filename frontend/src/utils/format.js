const DEFAULT_PREFERENCES = {
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    date_format: 'DD/MM/YYYY',
    time_format: '12h',
    language: 'en',
};

const LANGUAGE_TO_LOCALE = {
    en: 'en-IN',
    hi: 'hi-IN',
};

const DATE_PART_ORDERS = {
    'DD/MM/YYYY': ['day', 'month', 'year'],
    'MM/DD/YYYY': ['month', 'day', 'year'],
    'YYYY-MM-DD': ['year', 'month', 'day'],
};

const DATE_SEPARATORS = {
    'DD/MM/YYYY': '/',
    'MM/DD/YYYY': '/',
    'YYYY-MM-DD': '-',
};

export const getDefaultPreferences = () => ({ ...DEFAULT_PREFERENCES });

export const resolvePreferences = (preferences) => ({
    ...DEFAULT_PREFERENCES,
    ...(preferences || {}),
});

const getLocale = (language) => LANGUAGE_TO_LOCALE[language] || LANGUAGE_TO_LOCALE.en;

const toDate = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const formatCurrency = (value, preferences) => {
    const prefs = resolvePreferences(preferences);
    const amount = Number(value || 0);
    return new Intl.NumberFormat(getLocale(prefs.language), {
        style: 'currency',
        currency: prefs.currency || 'INR',
        maximumFractionDigits: 0,
    }).format(amount);
};

export const formatDate = (value, preferences, fallback = 'N/A') => {
    const date = toDate(value);
    if (!date) return fallback;

    const prefs = resolvePreferences(preferences);
    const dateFormat = prefs.date_format || DEFAULT_PREFERENCES.date_format;
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: prefs.timezone,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).formatToParts(date);

    const partMap = parts.reduce((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = part.value;
        return acc;
    }, {});

    const order = DATE_PART_ORDERS[dateFormat] || DATE_PART_ORDERS[DEFAULT_PREFERENCES.date_format];
    const separator = DATE_SEPARATORS[dateFormat] || '/';
    return order.map((type) => partMap[type]).join(separator);
};

export const formatTime = (value, preferences, fallback = 'N/A') => {
    const date = toDate(value);
    if (!date) return fallback;

    const prefs = resolvePreferences(preferences);
    return new Intl.DateTimeFormat(getLocale(prefs.language), {
        timeZone: prefs.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: prefs.time_format !== '24h',
    }).format(date);
};

export const formatDateTime = (value, preferences, fallback = 'N/A') => {
    const datePart = formatDate(value, preferences, fallback);
    if (datePart === fallback) return fallback;
    return `${datePart} ${formatTime(value, preferences, fallback)}`;
};

export const formatMonthYear = (value, preferences, fallback = 'N/A') => {
    const date = toDate(value);
    if (!date) return fallback;
    const prefs = resolvePreferences(preferences);
    return new Intl.DateTimeFormat(getLocale(prefs.language), {
        timeZone: prefs.timezone,
        month: 'long',
        year: 'numeric',
    }).format(date);
};

export const jsonToFormData = (data) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
        if (value instanceof File || value instanceof Blob) {
            formData.append(key, value);
        } else if (typeof value === 'object' && value !== null) {
            formData.append(key, JSON.stringify(value));
        } else if (value !== undefined && value !== null) {
            formData.append(key, String(value));
        }
    });
    return formData;
};
