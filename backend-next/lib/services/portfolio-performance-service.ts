import { prisma } from "../db";
import { Prisma } from "@prisma/client";
import { formatShortMonth } from "../format";

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
  total_capacity: number;
  vacant_beds: number;
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
    total_capacity: number;
    vacant_beds: number;
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
    const ranges = monthRanges(boundedMonths);

    const rangeValues = Prisma.join(
      ranges.map((range) => Prisma.sql`
        (${range.monthKey}, ${range.label}, ${range.start}::date, ${range.end}::date)
      `),
      ","
    );

    const [capacityByHostel, cashflowGrid] = await Promise.all([
      prisma.$queryRaw<Array<{ hostel_id: string; total_capacity: number; active_tenants: number; occupancy: number }>>`
        WITH room_capacity AS (
          SELECT hostel_id, COALESCE(SUM(capacity), 0)::float AS total_capacity
          FROM rooms
          WHERE is_active = true
          GROUP BY hostel_id
        ), active_tenants AS (
          SELECT hostel_id, COUNT(id)::float AS active_tenants
          FROM tenants
          WHERE owner_id = ${ownerId}::uuid AND status = 'ACTIVE'
          GROUP BY hostel_id
        )
        SELECT
          h.id::text AS hostel_id,
          COALESCE(rc.total_capacity, 0)::float AS total_capacity,
          COALESCE(at.active_tenants, 0)::float AS active_tenants,
          CASE
            WHEN COALESCE(rc.total_capacity, 0) > 0
              THEN ROUND((COALESCE(at.active_tenants, 0) / rc.total_capacity * 1000)::numeric) / 10
            ELSE 0
          END::float AS occupancy
        FROM hostels h
        LEFT JOIN room_capacity rc ON rc.hostel_id = h.id
        LEFT JOIN active_tenants at ON at.hostel_id = h.id
        WHERE h.owner_id = ${ownerId}::uuid AND h.is_active = true
      `,
      prisma.$queryRaw<Array<{
        month_key: string;
        month_label: string;
        hostel_id: string;
        hostel_name: string;
        city: string | null;
        revenue: number;
        collections: number;
        pending_dues: number;
        collection_rate: number;
      }>>`
        WITH ranges(month_key, month_label, start_date, end_date) AS (
          VALUES ${rangeValues}
        ), active_hostels AS (
          SELECT id, name, city
          FROM hostels
          WHERE owner_id = ${ownerId}::uuid AND is_active = true
        ), pay_agg AS (
          SELECT obligation_id, SUM(amount_paid)::float AS total_paid
          FROM payments
          GROUP BY obligation_id
        )
        SELECT
          r.month_key,
          r.month_label,
          h.id::text AS hostel_id,
          h.name AS hostel_name,
          h.city,
          COALESCE(SUM(o.amount - GREATEST(o.amount - COALESCE(pay_agg.total_paid, 0), 0)), 0)::float AS revenue,
          COALESCE(SUM(o.amount - GREATEST(o.amount - COALESCE(pay_agg.total_paid, 0), 0)), 0)::float AS collections,
          COALESCE(SUM(GREATEST(o.amount - COALESCE(pay_agg.total_paid, 0), 0)), 0)::float AS pending_dues,
          CASE
            WHEN COALESCE(SUM(o.amount), 0) > 0
              THEN ROUND((COALESCE(SUM(o.amount - GREATEST(o.amount - COALESCE(pay_agg.total_paid, 0), 0)), 0) / SUM(o.amount) * 10000)::numeric) / 100
            ELSE 0
          END::float AS collection_rate
        FROM ranges r
        CROSS JOIN active_hostels h
        LEFT JOIN rent_obligations o
          ON o.owner_id = ${ownerId}::uuid
          AND o.hostel_id = h.id
          AND o.status <> 'WAIVED'
          AND o.rent_month >= r.start_date
          AND o.rent_month <= r.end_date
          AND EXISTS (
            SELECT 1
            FROM tenants t
            WHERE t.id = o.tenant_id AND t.status = 'ACTIVE'
          )
        LEFT JOIN pay_agg ON pay_agg.obligation_id = o.id
        GROUP BY r.month_key, r.month_label, h.id, h.name, h.city
        ORDER BY r.month_key ASC, h.name ASC
      `,
    ]);

    const capacityMap = new Map(
      capacityByHostel.map((c) => [
        c.hostel_id,
        {
          activeTenants: Number(c.active_tenants || 0),
          totalCapacity: Number(c.total_capacity || 0),
          occupancy: Number(c.occupancy || 0),
        },
      ])
    );
    const cashflowRows = cashflowGrid.map((row) => ({
      monthKey: row.month_key,
      monthLabel: row.month_label,
      hostel_id: row.hostel_id,
      hostel_name: row.hostel_name,
      city: row.city,
      revenue: Number(row.revenue || 0),
      collections: Number(row.collections || 0),
      occupancy_rate: capacityMap.get(row.hostel_id)?.occupancy ?? 0,
      pending_dues: Number(row.pending_dues || 0),
      collection_rate: Number(row.collection_rate || 0),
    }));
    const hostelMeta = Array.from(
      new Map(
        cashflowRows.map((row) => [
          row.hostel_id,
          {
            id: row.hostel_id,
            name: row.hostel_name,
            city: row.city,
          },
        ])
      ).values()
    );

    const monthly_trends: PortfolioPerformanceMonth[] = ranges.map((range) => ({
      month: range.label,
      month_key: range.monthKey,
      hostels: cashflowRows
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
      cashflowRows.filter((r) => r.monthKey === currentKey).map((r) => [r.hostel_id, r])
    );
    const previousByHostel = new Map(
      cashflowRows.filter((r) => r.monthKey === previousKey).map((r) => [r.hostel_id, r])
    );
    const currentRows = cashflowRows.filter((r) => r.monthKey === currentKey);

    let rankings: PortfolioPerformanceRanking[] = hostelMeta.map((h) => {
      const cur = currentByHostel.get(h.id);
      const prev = previousByHostel.get(h.id);
      const capacity = capacityMap.get(h.id);
      const revenue = cur?.revenue ?? 0;
      const prevRevenue = prev?.revenue ?? 0;
      const activeTenants = capacity?.activeTenants ?? 0;
      const totalCapacity = capacity?.totalCapacity ?? 0;
      return {
        hostel_id: h.id,
        hostel_name: h.name,
        city: h.city,
        revenue,
        occupancy_rate: cur?.occupancy_rate ?? 0,
        collection_rate: cur?.collection_rate ?? 0,
        pending_dues: cur?.pending_dues ?? 0,
        active_tenants: activeTenants,
        total_capacity: totalCapacity,
        vacant_beds: Math.max(totalCapacity - activeTenants, 0),
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

    const aggregateRevenue = currentRows.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
    const aggregateDue = currentRows.reduce((sum, row) => sum + Number(row.pending_dues || 0), 0);
    const aggregateActiveTenants = Array.from(capacityMap.values()).reduce(
      (sum, row) => sum + Number(row.activeTenants || 0),
      0
    );
    const aggregateCapacity = Array.from(capacityMap.values()).reduce(
      (sum, row) => sum + Number(row.totalCapacity || 0),
      0
    );
    const aggregateExpected = aggregateRevenue + aggregateDue;

    return {
      portfolio: {
        total_revenue: aggregateRevenue,
        total_due: aggregateDue,
        occupancy_rate: aggregateCapacity > 0
          ? Math.round((aggregateActiveTenants / aggregateCapacity) * 10000) / 100
          : 0,
        active_tenants: aggregateActiveTenants,
        collection_rate: aggregateExpected > 0
          ? Math.round((aggregateRevenue / aggregateExpected) * 10000) / 100
          : 0,
        total_capacity: aggregateCapacity,
        vacant_beds: Math.max(aggregateCapacity - aggregateActiveTenants, 0),
      },
      monthly_trends,
      hostel_rankings: rankings,
      top_performer_hostel_id: topId,
      computed_at: new Date().toISOString(),
    };
  }
}

export const portfolioPerformanceService = new PortfolioPerformanceService();
