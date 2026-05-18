import { prisma } from "../db";
import { formatShortMonth } from "../format";
import { financialService } from "@/src/services/payments/financial-service";
import { dashboardSnapshotService } from "./dashboard-snapshot-service";

export interface PortfolioPerformanceHostelMonth {
  hostel_id: string;
  hostel_name: string;
  revenue: number;
  collections: number;
  occupancy_rate: number;
}

export interface PortfolioPerformanceMonth {
  month: string;
  month_key: string;
  hostels: PortfolioPerformanceHostelMonth[];
}

export interface PortfolioPerformanceRanking {
  hostel_id: string;
  hostel_name: string;
  city: string | null;
  revenue: number;
  occupancy_rate: number;
  collection_rate: number;
  pending_dues: number;
  active_tenants: number;
  trend_percentage: number;
  is_top_performer: boolean;
}

export interface PortfolioPerformanceResponse {
  portfolio: {
    total_revenue: number;
    total_due: number;
    occupancy_rate: number;
    active_tenants: number;
    collection_rate: number;
  };
  monthly_trends: PortfolioPerformanceMonth[];
  hostel_rankings: PortfolioPerformanceRanking[];
  top_performer_hostel_id: string | null;
  computed_at: string;
}

function monthRanges(months: number) {
  const now = new Date();
  return Array.from({ length: months }, (_, i) => {
    const targetMonth = now.getUTCMonth() - (months - 1 - i);
    const targetYear = now.getUTCFullYear() + Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;
    const start = new Date(Date.UTC(targetYear, normalizedMonth, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0, 23, 59, 59, 999));
    const monthKey = `${targetYear}-${String(normalizedMonth + 1).padStart(2, "0")}`;
    return { start, end, monthKey, label: formatShortMonth(start) };
  });
}

function trendPct(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export class PortfolioPerformanceService {
  async getPortfolioPerformance(ownerId: string, months = 6): Promise<PortfolioPerformanceResponse> {
    const boundedMonths = Math.max(1, Math.min(12, months));

    const hostels = await prisma.hostels.findMany({
      where: { owner_id: ownerId, is_active: true },
      select: { id: true, name: true, city: true },
      orderBy: { name: "asc" },
    });

    const ranges = monthRanges(boundedMonths);

    const capacityByHostel = await Promise.all(
      hostels.map(async (h) => {
        const [capacityRow, activeTenants] = await Promise.all([
          prisma.$queryRaw<{ total_capacity: number }[]>`
            SELECT COALESCE(SUM(r.capacity), 0)::int AS total_capacity
            FROM rooms r
            WHERE r.hostel_id = ${h.id}::uuid AND r.is_active = true
          `,
          prisma.tenants.count({
            where: { owner_id: ownerId, hostel_id: h.id, status: "ACTIVE" },
          }),
        ]);
        const capacity = Number(capacityRow[0]?.total_capacity ?? 0);
        const occupancy =
          capacity > 0 ? Math.round((activeTenants / capacity) * 1000) / 10 : 0;
        return { hostelId: h.id, activeTenants, occupancy };
      })
    );

    const capacityMap = new Map(capacityByHostel.map((c) => [c.hostelId, c]));

    const cashflowGrid = await Promise.all(
      ranges.flatMap((range) =>
        hostels.map(async (h) => {
          const cf = await financialService.getOperationalCashflowMetrics(
            ownerId,
            range.start,
            range.end,
            h.id
          );
          const cap = capacityMap.get(h.id);
          return {
            monthKey: range.monthKey,
            monthLabel: range.label,
            hostel_id: h.id,
            hostel_name: h.name,
            revenue: Number(cf.collected_total || 0),
            collections: Number(cf.collected_total || 0),
            occupancy_rate: cap?.occupancy ?? 0,
            pending_dues: Number(cf.pending_total || 0),
            collection_rate: Number(cf.collection_rate || 0),
          };
        })
      )
    );

    const monthly_trends: PortfolioPerformanceMonth[] = ranges.map((range) => ({
      month: range.label,
      month_key: range.monthKey,
      hostels: cashflowGrid
        .filter((row) => row.monthKey === range.monthKey)
        .map(({ hostel_id, hostel_name, revenue, collections, occupancy_rate }) => ({
          hostel_id,
          hostel_name,
          revenue,
          collections,
          occupancy_rate,
        })),
    }));

    const currentKey = ranges[ranges.length - 1]?.monthKey;
    const previousKey = ranges[ranges.length - 2]?.monthKey;

    const currentByHostel = new Map(
      cashflowGrid.filter((r) => r.monthKey === currentKey).map((r) => [r.hostel_id, r])
    );
    const previousByHostel = new Map(
      cashflowGrid.filter((r) => r.monthKey === previousKey).map((r) => [r.hostel_id, r])
    );

    let rankings: PortfolioPerformanceRanking[] = hostels.map((h) => {
      const cur = currentByHostel.get(h.id);
      const prev = previousByHostel.get(h.id);
      const revenue = cur?.revenue ?? 0;
      const prevRevenue = prev?.revenue ?? 0;
      return {
        hostel_id: h.id,
        hostel_name: h.name,
        city: h.city,
        revenue,
        occupancy_rate: cur?.occupancy_rate ?? 0,
        collection_rate: cur?.collection_rate ?? 0,
        pending_dues: cur?.pending_dues ?? 0,
        active_tenants: capacityMap.get(h.id)?.activeTenants ?? 0,
        trend_percentage: trendPct(revenue, prevRevenue),
        is_top_performer: false,
      };
    });

    rankings.sort((a, b) => {
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      if (b.collection_rate !== a.collection_rate) return b.collection_rate - a.collection_rate;
      return b.occupancy_rate - a.occupancy_rate;
    });

    const topId = rankings[0]?.hostel_id ?? null;
    if (topId) {
      rankings = rankings.map((r) => ({
        ...r,
        is_top_performer: r.hostel_id === topId && r.revenue > 0,
      }));
    }

    const aggregate = await dashboardSnapshotService.getPortfolioStats(ownerId);

    return {
      portfolio: {
        total_revenue: Number(aggregate.rent_collected_this_month || 0),
        total_due: Number(aggregate.pending_dues || 0),
        occupancy_rate: Number(aggregate.occupancy_rate || 0),
        active_tenants: Number(aggregate.active_tenants || 0),
        collection_rate: Number(aggregate.collection_rate || 0),
      },
      monthly_trends,
      hostel_rankings: rankings,
      top_performer_hostel_id: topId,
      computed_at: new Date().toISOString(),
    };
  }
}

export const portfolioPerformanceService = new PortfolioPerformanceService();
