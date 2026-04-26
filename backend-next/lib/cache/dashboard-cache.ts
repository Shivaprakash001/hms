const dashboardCache = new Map<string, { data: any, timestamp: number }>();

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
