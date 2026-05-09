import { dashboardSnapshotService } from "../services/dashboard-snapshot-service";
const dashboardCache = new Map<string, { data: any, timestamp: number }>();

export function invalidateDashboardCache(ownerId: string) {
  for (const key of Array.from(dashboardCache.keys())) {
    if (key.startsWith(`${ownerId}_`)) {
      dashboardCache.delete(key);
    }
  }
  dashboardSnapshotService.markOwnerStale(ownerId).catch(() => {});
}

export function invalidateHostelDashboardCache(hostelId: string) {
  for (const key of Array.from(dashboardCache.keys())) {
    if (key.includes(`_${hostelId}`) || key === hostelId) dashboardCache.delete(key);
  }
}

export function invalidatePortfolioCache(ownerId: string) {
  for (const key of Array.from(dashboardCache.keys())) {
    if (key.startsWith(`portfolio_${ownerId}`)) dashboardCache.delete(key);
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
