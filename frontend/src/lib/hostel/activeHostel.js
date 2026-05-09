export function getOwnerIdFromUser(user) {
  const role = String(user?.role || '').toLowerCase();
  return user?.owner_id || (role === 'owner' ? user?.id : null) || 'anonymous';
}

export function getActiveHostelStorageKey(user) {
  return `activeHostel:${getOwnerIdFromUser(user)}`;
}

export function getActiveHostelId(user) {
  if (typeof window === 'undefined') return user?.hostel_id || null;
  return window.localStorage.getItem(getActiveHostelStorageKey(user)) || user?.hostel_id || null;
}

export function setActiveHostelId(user, hostelId) {
  if (typeof window === 'undefined' || !hostelId) return;
  window.localStorage.setItem(getActiveHostelStorageKey(user), hostelId);
}

export function clearActiveHostelIds() {
  if (typeof window === 'undefined') return;
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith('activeHostel:'))
    .forEach((key) => window.localStorage.removeItem(key));
}
