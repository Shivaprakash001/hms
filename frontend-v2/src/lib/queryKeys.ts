const ownerKey = (...parts: unknown[]) => ['owner', ...parts];
const hostelKey = (hostelId: string, ...parts: unknown[]) => {
  if (!hostelId) throw new Error('hostelId is required for operational query keys');
  return ['hostel', hostelId, ...parts];
};

export const queryKeys = {
  me: () => ownerKey('me'),

  owner: {
    hostels: () => ownerKey('hostels'),
    profile: () => ownerKey('profile'),
  },

  notifications: () => ownerKey('notifications'),

  portfolio: {
    all: () => ownerKey('portfolio'),
    summary: () => ownerKey('portfolio', 'summary'),
  },

  analytics: {
    all: (hostelId: string) => hostelKey(hostelId, 'analytics'),
  },

  dashboard: {
    all: (hostelId: string) => hostelKey(hostelId, 'dashboard'),
    stats: (hostelId: string) => hostelKey(hostelId, 'dashboard', 'stats'),
    summary: (hostelId: string) => hostelKey(hostelId, 'dashboard', 'summary'),
    monthly: (hostelId: string, months?: number) =>
      hostelKey(hostelId, 'dashboard', 'monthly', months ?? 6),
  },

  tenants: {
    all: (hostelId: string) => hostelKey(hostelId, 'tenants'),
    list: (hostelId: string, filters?: object) =>
      hostelKey(hostelId, 'tenants', 'list', filters ?? {}),
    detail: (hostelId: string, id: string) =>
      hostelKey(hostelId, 'tenants', 'detail', id),
    paymentHistory: (hostelId: string, id: string) =>
      hostelKey(hostelId, 'tenants', id, 'payments'),
  },

  rooms: {
    all: (hostelId: string) => hostelKey(hostelId, 'rooms'),
    list: (hostelId: string, params?: object) =>
      hostelKey(hostelId, 'rooms', 'list', params ?? {}),
    detail: (hostelId: string, id: string) =>
      hostelKey(hostelId, 'rooms', 'detail', id),
  },

  payments: {
    all: (hostelId: string) => hostelKey(hostelId, 'payments'),
    ledger: (hostelId: string, params?: object) =>
      hostelKey(hostelId, 'payments', 'ledger', params ?? {}),
    dues: (hostelId: string, params?: object) =>
      hostelKey(hostelId, 'payments', 'dues', params ?? {}),
  },

  expenses: {
    all: (hostelId: string) => hostelKey(hostelId, 'expenses'),
    list: (hostelId: string) => hostelKey(hostelId, 'expenses', 'list'),
  },

  activity: {
    all: (hostelId: string) => hostelKey(hostelId, 'activity'),
    list: (hostelId: string, params?: object) =>
      hostelKey(hostelId, 'activity', 'list', params ?? {}),
  },
};
