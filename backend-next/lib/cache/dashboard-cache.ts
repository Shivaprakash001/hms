const dashboardCache = new Map<string, { data: any, timestamp: number }>();

export function invalidateDashboardCache(ownerId: string) {
  for (const key of Array.from(dashboardCache.keys())) {
    if (key.startsWith(`${ownerId}_`)) {
      dashboardCache.delete(key);
    }
  }
}

export function getCachedDashboard(ownerId: string) {
  const entry = dashboardCache.get(ownerId);

  if (!entry) return null;

  // Cache strictly for 60 seconds (60000ms)
  if (Date.now() - entry.timestamp > 60000) {
    dashboardCache.delete(ownerId);
    return null;
  }

  return entry.data;
}

export function setDashboardCache(ownerId: string, data: any) {
  dashboardCache.set(ownerId, {
    data,
    timestamp: Date.now()
  });
}
