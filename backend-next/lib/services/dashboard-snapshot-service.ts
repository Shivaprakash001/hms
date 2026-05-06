import { prisma } from "../db";
import { dashboardService } from "./dashboard-service";
import { getLogger } from "../logger";

const logger = getLogger("dashboard-snapshot-service");

const SNAPSHOT_TTL_MS = 60_000;

type MonthlyPoint = {
  month: string;
  year: number;
  collected: number;
  due: number;
  collection_rate: number;
};

function utcMonthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function toDate(v: any): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isFresh(ts: Date | null, now: Date) {
  return !!ts && now.getTime() - ts.getTime() <= SNAPSHOT_TTL_MS;
}

function lockKey(ownerId: string, kind: "stats" | "monthly", months?: number) {
  return kind === "monthly"
    ? `dashboard_snapshot_${ownerId}_monthly_${months || 6}`
    : `dashboard_snapshot_${ownerId}_stats`;
}

export class DashboardSnapshotService {
  private async fetchSnapshotRow(ownerId: string) {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT *
      FROM owner_dashboard_snapshots
      WHERE owner_id = ${ownerId}::uuid
      LIMIT 1
    `;
    return rows[0] || null;
  }

  async markOwnerStale(ownerId: string) {
    const month = utcMonthStart(new Date());
    await prisma.$executeRaw`
      INSERT INTO owner_dashboard_snapshots (owner_id, snapshot_month, is_stale, updated_at)
      VALUES (${ownerId}::uuid, ${month}::date, true, NOW())
      ON CONFLICT (owner_id) DO UPDATE
      SET is_stale = true, updated_at = NOW()
    `;
  }

  async getOwnerStats(ownerId: string) {
    const now = new Date();
    const row: any = await this.fetchSnapshotRow(ownerId);

    const statsComputedAt = toDate(row?.stats_computed_at);
    const fresh = row && !row.is_stale && isFresh(statsComputedAt, now);
    if (fresh) return this.mapStatsRow(row);

    await this.refreshStats(ownerId, row);
    const updated: any = await this.fetchSnapshotRow(ownerId);
    if (updated) return this.mapStatsRow(updated);

    // Fallback in case lock contention and row not yet present.
    return dashboardService.getOwnerStats(ownerId);
  }

  async getMonthlyStats(ownerId: string, months: number) {
    const now = new Date();
    const row: any = await this.fetchSnapshotRow(ownerId);

    const monthlyComputedAt = toDate(row?.monthly_computed_at);
    const hasCorrectMonths = Number(row?.monthly_trend_months || 0) === months;
    const fresh = row && !row.is_stale && hasCorrectMonths && isFresh(monthlyComputedAt, now);
    if (fresh && Array.isArray(row.monthly_trend)) return row.monthly_trend as MonthlyPoint[];

    await this.refreshMonthly(ownerId, months, row);
    const updatedRows: any[] = await prisma.$queryRaw<any[]>`
      SELECT monthly_trend
      FROM owner_dashboard_snapshots
      WHERE owner_id = ${ownerId}::uuid
      LIMIT 1
    `;
    const updated: any = updatedRows[0] || null;
    if (updated?.monthly_trend && Array.isArray(updated.monthly_trend)) {
      return updated.monthly_trend as MonthlyPoint[];
    }

    return dashboardService.getMonthlyStats(ownerId, months);
  }

  private mapStatsRow(row: any) {
    return {
      total_rooms: Number(row.total_room_count || 0),
      total_tenants: Number(row.tenant_count || 0),
      active_tenants: Number(row.active_tenant_count || 0),
      total_capacity: Number(row.total_capacity || 0),
      vacant_beds: Number(row.vacant_beds || 0),
      occupancy_rate: Number(row.occupancy_rate || 0),
      revenue: Number(row.rent_collected_month || 0),
      expenses_this_month: Number(row.expenses_month || 0),
      rent_collected_this_month: Number(row.rent_collected_month || 0),
      pending_dues: Number(row.pending_dues || 0),
      overdue_amount: Number(row.overdue_total || 0),
      overdue_count: Number(row.overdue_count || 0),
      collection_rate: Number(row.collection_rate || 0),
    };
  }

  private async refreshStats(ownerId: string, existingRow: any) {
    const key = lockKey(ownerId, "stats");
    const acquired = await this.acquireLock(key);
    if (!acquired) {
      logger.info("stats_refresh_lock_busy", { owner_id: ownerId });
      return;
    }

    try {
      const stats = await dashboardService.getOwnerStats(ownerId);
      const monthly = await dashboardService.getMonthlyStats(ownerId, 1);
      const collectionRate = Number(monthly?.[0]?.collection_rate || 0);
      const snapshotMonth = utcMonthStart(new Date());
      const now = new Date();

      await prisma.$executeRaw`
        INSERT INTO owner_dashboard_snapshots (
          owner_id, snapshot_month, tenant_count, active_tenant_count, total_room_count, total_capacity,
          vacant_beds, occupancy_rate, rent_collected_month, expenses_month, pending_dues, overdue_total,
          overdue_count, collection_rate, stats_computed_at, is_stale, updated_at
        )
        VALUES (
          ${ownerId}::uuid, ${snapshotMonth}::date, ${Number(stats.total_tenants || 0)}, ${Number(stats.active_tenants || 0)},
          ${Number(stats.total_rooms || 0)}, ${Number(stats.total_capacity || 0)}, ${Number(stats.vacant_beds || 0)},
          ${Number(stats.occupancy_rate || 0)}, ${Number(stats.rent_collected_this_month || 0)},
          ${Number(stats.expenses_this_month || 0)}, ${Number(stats.pending_dues || 0)},
          ${Number(stats.overdue_amount || 0)}, ${Number(stats.overdue_count || 0)},
          ${collectionRate}, ${now}, false, NOW()
        )
        ON CONFLICT (owner_id) DO UPDATE SET
          snapshot_month = EXCLUDED.snapshot_month,
          tenant_count = EXCLUDED.tenant_count,
          active_tenant_count = EXCLUDED.active_tenant_count,
          total_room_count = EXCLUDED.total_room_count,
          total_capacity = EXCLUDED.total_capacity,
          vacant_beds = EXCLUDED.vacant_beds,
          occupancy_rate = EXCLUDED.occupancy_rate,
          rent_collected_month = EXCLUDED.rent_collected_month,
          expenses_month = EXCLUDED.expenses_month,
          pending_dues = EXCLUDED.pending_dues,
          overdue_total = EXCLUDED.overdue_total,
          overdue_count = EXCLUDED.overdue_count,
          collection_rate = EXCLUDED.collection_rate,
          stats_computed_at = EXCLUDED.stats_computed_at,
          is_stale = false,
          updated_at = NOW()
      `;
    } finally {
      await this.releaseLock(key);
    }
  }

  private async refreshMonthly(ownerId: string, months: number, existingRow: any) {
    const key = lockKey(ownerId, "monthly", months);
    const acquired = await this.acquireLock(key);
    if (!acquired) {
      logger.info("monthly_refresh_lock_busy", { owner_id: ownerId, months });
      return;
    }

    try {
      const trend = await dashboardService.getMonthlyStats(ownerId, months);
      const now = new Date();
      const snapshotMonth = utcMonthStart(now);
      const staleValue = existingRow ? !!existingRow.is_stale : false;

      await prisma.$executeRaw`
        INSERT INTO owner_dashboard_snapshots (
          owner_id, snapshot_month, monthly_trend, monthly_trend_months,
          monthly_computed_at, is_stale, updated_at
        )
        VALUES (
          ${ownerId}::uuid, ${snapshotMonth}::date, ${JSON.stringify(trend)}::jsonb,
          ${months}, ${now}, ${staleValue}, NOW()
        )
        ON CONFLICT (owner_id) DO UPDATE SET
          snapshot_month = EXCLUDED.snapshot_month,
          monthly_trend = EXCLUDED.monthly_trend,
          monthly_trend_months = EXCLUDED.monthly_trend_months,
          monthly_computed_at = EXCLUDED.monthly_computed_at,
          updated_at = NOW()
      `;
    } finally {
      await this.releaseLock(key);
    }
  }

  private async acquireLock(key: string) {
    const result = await prisma.$executeRaw`
      INSERT INTO system_locks (key, locked_at, expires_at)
      VALUES (${key}, NOW(), NOW() + interval '20 seconds')
      ON CONFLICT (key) DO UPDATE
      SET locked_at = NOW(), expires_at = NOW() + interval '20 seconds'
      WHERE system_locks.expires_at < NOW()
    `;
    return result > 0;
  }

  private async releaseLock(key: string) {
    await prisma.$executeRaw`DELETE FROM system_locks WHERE key = ${key}`.catch(() => {});
  }
}

export const dashboardSnapshotService = new DashboardSnapshotService();
