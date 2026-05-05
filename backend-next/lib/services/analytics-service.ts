import { prisma } from "../db";

export function getDateRange(from?: string | null, to?: string | null) {
  const now = new Date();
  const start = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = to   ? new Date(to)   : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export class AnalyticsService {

  // ── Dashboard 1: Cashflow ──────────────────────────────────────────────────

  async getCashflowDashboard(ownerId: string, start: Date, end: Date) {
    const now = new Date();

    const [expectedAgg, collectedAgg, overdueAgg, overdueGroups, topGroups, daily] =
      await Promise.all([
        prisma.rentObligation.aggregate({
          where: { owner_id: ownerId, rent_month: { gte: start, lte: end } },
          _sum: { total_amount: true },
        }),
        prisma.payment.aggregate({
          where: { owner_id: ownerId, payment_date: { gte: start, lte: end } },
          _sum: { amount_paid: true },
        }),
        prisma.rentObligation.aggregate({
          where: { owner_id: ownerId, status: { notIn: ["PAID", "WAIVED"] }, due_date: { lt: now } },
          _sum: { total_amount: true },
        }),
        prisma.rentObligation.groupBy({
          by: ["tenant_id"],
          where: { owner_id: ownerId, status: { notIn: ["PAID", "WAIVED"] }, due_date: { lt: now } },
        }),
        prisma.rentObligation.groupBy({
          by: ["tenant_id"],
          where: { owner_id: ownerId, status: { notIn: ["PAID", "WAIVED"] }, due_date: { lt: now } },
          _sum: { total_amount: true },
          orderBy: { _sum: { total_amount: "desc" } },
          take: 5,
        }),
        prisma.$queryRaw<{ date: string; amount: number }[]>`
          SELECT payment_date::text AS date, SUM(amount_paid)::float AS amount
          FROM payments
          WHERE owner_id = ${ownerId}::uuid
            AND payment_date >= ${start}::date
            AND payment_date <= ${end}::date
          GROUP BY payment_date ORDER BY payment_date
        `,
      ]);

    const expected  = Number(expectedAgg._sum.total_amount  ?? 0);
    const collected = Number(collectedAgg._sum.amount_paid  ?? 0);
    const overdue   = Number(overdueAgg._sum.total_amount   ?? 0);
    const ids       = topGroups.map((d) => d.tenant_id);

    const [tenants, dueDates] = ids.length
      ? await Promise.all([
          prisma.tenant.findMany({
            where: { id: { in: ids } },
            select: { id: true, profile: { select: { name: true } } },
          }),
          prisma.$queryRaw<{ tenant_id: string; earliest_due: Date }[]>`
            SELECT tenant_id, MIN(due_date) AS earliest_due
            FROM rent_obligations
            WHERE owner_id = ${ownerId}::uuid
              AND status NOT IN ('PAID','WAIVED')
              AND due_date < NOW()
              AND tenant_id = ANY(${ids})
            GROUP BY tenant_id
          `,
        ])
      : [[], []];

    const nameMap = new Map((tenants as any[]).map((t) => [t.id, t.profile.name]));
    const dueMap  = new Map((dueDates as any[]).map((r) => [r.tenant_id, r.earliest_due]));

    return {
      expected_rent:          expected,
      collected_amount:       collected,
      pending_amount:         Math.max(0, expected - collected),
      collection_rate:        expected > 0 ? Math.round((collected / expected) * 10000) / 100 : 0,
      overdue_amount:         overdue,
      overdue_tenants_count:  overdueGroups.length,
      top_defaulters: topGroups.map((d) => {
        const earliest = dueMap.get(d.tenant_id);
        return {
          tenant_id:      d.tenant_id,
          name:           nameMap.get(d.tenant_id) ?? "Unknown",
          pending_amount: Number(d._sum.total_amount ?? 0),
          days_overdue:   earliest ? Math.floor((now.getTime() - new Date(earliest).getTime()) / 86400000) : 0,
        };
      }),
      daily_collection: daily.map((r) => ({ date: r.date, amount: r.amount })),
    };
  }

  // ── Dashboard 2: Tenant Intelligence ──────────────────────────────────────

  async getTenantIntelligenceDashboard(ownerId: string, start: Date, end: Date) {
    const [distRows, riskyRows, behaviorRows, depRows, exitRows, totalExited] =
      await Promise.all([
        prisma.$queryRaw<{ good: bigint; medium: bigint; risky: bigint }[]>`
          SELECT
            COUNT(CASE WHEN tbs.score >= 80 THEN 1 END) AS good,
            COUNT(CASE WHEN tbs.score >= 50 AND tbs.score < 80 THEN 1 END) AS medium,
            COUNT(CASE WHEN tbs.score < 50 THEN 1 END) AS risky
          FROM tenant_behavior_scores tbs
          JOIN tenants t ON t.id = tbs.tenant_id
          WHERE t.owner_id = ${ownerId}::uuid AND t.status = 'ACTIVE'
        `,
        prisma.$queryRaw<{ tenant_id: string; name: string; score: number; pending_amount: number; avg_delay_days: number }[]>`
          SELECT t.id AS tenant_id, p.name, COALESCE(tbs.score, 100) AS score,
            COALESCE(SUM(CASE WHEN o.status NOT IN ('PAID','WAIVED') THEN o.total_amount ELSE 0 END)::float, 0) AS pending_amount,
            COALESCE(AVG(CASE WHEN pay.payment_date > o.due_date THEN pay.payment_date - o.due_date END), 0)::float AS avg_delay_days
          FROM tenants t
          JOIN profiles p ON p.id = t.profile_id
          LEFT JOIN tenant_behavior_scores tbs ON tbs.tenant_id = t.id
          LEFT JOIN rent_obligations o ON o.tenant_id = t.id
          LEFT JOIN payments pay ON pay.tenant_id = t.id AND pay.obligation_id = o.id
          WHERE t.owner_id = ${ownerId}::uuid AND t.status = 'ACTIVE'
            AND COALESCE(tbs.score, 100) < 50
          GROUP BY t.id, p.name, tbs.score
          ORDER BY COALESCE(tbs.score, 100) ASC LIMIT 10
        `,
        prisma.$queryRaw<{ on_time: bigint; total: bigint; avg_delay: number }[]>`
          SELECT
            COUNT(CASE WHEN pay.payment_date <= o.due_date THEN 1 END) AS on_time,
            COUNT(*) AS total,
            COALESCE(AVG(CASE WHEN pay.payment_date > o.due_date THEN pay.payment_date - o.due_date END), 0)::float AS avg_delay
          FROM payments pay
          JOIN rent_obligations o ON o.id = pay.obligation_id
          JOIN tenants t ON t.id = pay.tenant_id
          WHERE t.owner_id = ${ownerId}::uuid
            AND pay.payment_date >= ${start}::date AND pay.payment_date <= ${end}::date
        `,
        prisma.$queryRaw<{ total_paid: bigint; with_reminder: bigint }[]>`
          WITH paid AS (
            SELECT DISTINCT pay.obligation_id
            FROM payments pay JOIN tenants t ON t.id = pay.tenant_id
            WHERE t.owner_id = ${ownerId}::uuid
              AND pay.payment_date >= ${start}::date AND pay.payment_date <= ${end}::date
          )
          SELECT COUNT(*) AS total_paid,
            COUNT(CASE WHEN rl.obligation_id IS NOT NULL THEN 1 END) AS with_reminder
          FROM paid
          LEFT JOIN LATERAL (
            SELECT 1 FROM reminder_logs rl WHERE rl.obligation_id = paid.obligation_id LIMIT 1
          ) rl ON true
        `,
        prisma.$queryRaw<{ reason: string; count: bigint }[]>`
          SELECT COALESCE(exit_reason,'Not specified') AS reason, COUNT(*) AS count
          FROM tenants
          WHERE owner_id = ${ownerId}::uuid AND status = 'LEFT'
            AND exit_date >= ${start}::date AND exit_date <= ${end}::date
          GROUP BY exit_reason ORDER BY count DESC LIMIT 5
        `,
        prisma.tenant.count({
          where: { owner_id: ownerId, status: "LEFT", exit_date: { gte: start, lte: end } },
        }),
      ]);

    const activeCount = await prisma.tenant.count({ where: { owner_id: ownerId, status: "ACTIVE" } });
    const dist = distRows[0];
    const beh  = behaviorRows[0];
    const dep  = depRows[0];
    const tot  = Number(beh?.total ?? 0); const onT = Number(beh?.on_time ?? 0);
    const totP = Number(dep?.total_paid ?? 0); const rem = Number(dep?.with_reminder ?? 0);
    const base = activeCount + totalExited;

    return {
      distribution: { good: Number(dist?.good ?? 0), medium: Number(dist?.medium ?? 0), risky: Number(dist?.risky ?? 0) },
      risky_tenants: riskyRows.map((r) => ({
        tenant_id: r.tenant_id, name: r.name, score: r.score,
        pending_amount: r.pending_amount,
        avg_delay_days: Math.round(r.avg_delay_days * 10) / 10,
      })),
      payment_behavior: {
        on_time_percentage:        tot > 0 ? Math.round((onT / tot) * 10000) / 100 : 0,
        avg_delay_days:            Math.round(Number(beh?.avg_delay ?? 0) * 10) / 10,
        reminder_dependency_rate:  totP > 0 ? Math.round((rem / totP) * 10000) / 100 : 0,
      },
      exit_insights: {
        total_exits: totalExited,
        top_reasons: exitRows.map((r) => ({ reason: r.reason, count: Number(r.count) })),
        churn_rate:  base > 0 ? Math.round((totalExited / base) * 10000) / 100 : 0,
      },
    };
  }

  // ── Dashboard 3: Reminder Funnel ──────────────────────────────────────────

  async getReminderFunnelDashboard(ownerId: string, start: Date, end: Date) {
    const [funnelRows, channelRows] = await Promise.all([
      prisma.$queryRaw<{ sent: bigint; converted: bigint; revenue: number; avg_hours: number }[]>`
        SELECT
          COUNT(*) AS sent,
          COUNT(CASE WHEN rl.converted_to_payment = true THEN 1 END) AS converted,
          COALESCE((
            SELECT SUM(pay.amount_paid)::float FROM payments pay
            JOIN tenants t2 ON t2.id = pay.tenant_id
            WHERE t2.owner_id = ${ownerId}::uuid
              AND pay.payment_date >= ${start}::date AND pay.payment_date <= ${end}::date
              AND pay.obligation_id IN (
                SELECT DISTINCT rl2.obligation_id FROM reminder_logs rl2
                JOIN tenants t3 ON t3.id = rl2.tenant_id
                WHERE t3.owner_id = ${ownerId}::uuid
                  AND rl2.sent_at >= ${start} AND rl2.sent_at <= ${end}
              )
          ), 0) AS revenue,
          COALESCE(AVG(
            CASE WHEN rl.converted_to_payment = true AND rl.converted_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (rl.converted_at - rl.sent_at)) / 3600.0 END
          ), 0)::float AS avg_hours
        FROM reminder_logs rl
        JOIN tenants t ON t.id = rl.tenant_id
        WHERE t.owner_id = ${ownerId}::uuid
          AND rl.sent_at >= ${start} AND rl.sent_at <= ${end}
      `,
      prisma.$queryRaw<{ channel: string; sent: bigint; converted: bigint }[]>`
        SELECT rl.channel,
          COUNT(*) AS sent,
          COUNT(CASE WHEN rl.converted_to_payment = true THEN 1 END) AS converted
        FROM reminder_logs rl
        JOIN tenants t ON t.id = rl.tenant_id
        WHERE t.owner_id = ${ownerId}::uuid
          AND rl.sent_at >= ${start} AND rl.sent_at <= ${end}
        GROUP BY rl.channel ORDER BY sent DESC
      `,
    ]);

    const f = funnelRows[0];
    const s = Number(f?.sent ?? 0); const c = Number(f?.converted ?? 0);

    return {
      reminders_sent:         s,
      conversions:            c,
      conversion_rate:        s > 0 ? Math.round((c / s) * 10000) / 100 : 0,
      revenue_generated:      Number(f?.revenue ?? 0),
      avg_time_to_pay_hours:  Math.round(Number(f?.avg_hours ?? 0) * 100) / 100,
      channel_performance: channelRows.map((r) => {
        const rs = Number(r.sent); const rc = Number(r.converted);
        return { channel: r.channel, sent: rs, converted: rc,
          conversion_rate: rs > 0 ? Math.round((rc / rs) * 10000) / 100 : 0 };
      }),
    };
  }

  // ── Dashboard 4: Operations ───────────────────────────────────────────────

  async getOperationsDashboard(ownerId: string, start: Date, end: Date) {
    const [roomRows, moveRows, revenueAgg, expenseAgg, complaintRows] = await Promise.all([
      prisma.$queryRaw<{ total_rooms: bigint; total_capacity: bigint; occupied_beds: bigint; avg_vacancy_days: number }[]>`
        SELECT
          COUNT(DISTINCT r.id) AS total_rooms,
          COALESCE(SUM(r.capacity), 0) AS total_capacity,
          COUNT(DISTINCT CASE WHEN ra.is_active = true THEN ra.id END) AS occupied_beds,
          COALESCE(AVG(
            CASE WHEN ra.is_active = false
              AND ra.end_date >= ${start}::date AND ra.end_date <= ${end}::date
              AND NOT EXISTS (SELECT 1 FROM room_allocations ra2 WHERE ra2.room_id = r.id AND ra2.is_active = true)
            THEN CURRENT_DATE - ra.end_date END
          ), 0)::float AS avg_vacancy_days
        FROM rooms r
        JOIN hostels h ON h.id = r.hostel_id
        LEFT JOIN room_allocations ra ON ra.room_id = r.id
        WHERE h.owner_id = ${ownerId}::uuid AND r.is_active = true
      `,
      prisma.$queryRaw<{ move_ins: bigint; move_outs: bigint }[]>`
        SELECT
          COUNT(CASE WHEN ra.start_date >= ${start}::date AND ra.start_date <= ${end}::date THEN 1 END) AS move_ins,
          COUNT(CASE WHEN ra.end_date   >= ${start}::date AND ra.end_date   <= ${end}::date THEN 1 END) AS move_outs
        FROM room_allocations ra
        JOIN tenants t ON t.id = ra.tenant_id
        WHERE t.owner_id = ${ownerId}::uuid
      `,
      prisma.payment.aggregate({
        where: { owner_id: ownerId, payment_date: { gte: start, lte: end } },
        _sum: { amount_paid: true },
      }),
      prisma.expense.aggregate({
        where: { owner_id: ownerId, date: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
      prisma.$queryRaw<{ pending: bigint; resolved: bigint; avg_hours: number }[]>`
        SELECT
          COUNT(CASE WHEN status = 'PENDING'  THEN 1 END) AS pending,
          COUNT(CASE WHEN status = 'RESOLVED' THEN 1 END) AS resolved,
          COALESCE(AVG(
            CASE WHEN resolved_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600.0 END
          ), 0)::float AS avg_hours
        FROM complaints
        WHERE owner_id = ${ownerId}::uuid
          AND created_at >= ${start} AND created_at <= ${end}
      `,
    ]);

    const r   = roomRows[0];
    const m   = moveRows[0];
    const cp  = complaintRows[0];
    const cap = Number(r?.total_capacity ?? 0);
    const occ = Number(r?.occupied_beds  ?? 0);
    const rev = Number(revenueAgg._sum.amount_paid ?? 0);
    const exp = Number(expenseAgg._sum.amount      ?? 0);

    return {
      occupancy_rate:    cap > 0 ? Math.round((occ / cap) * 10000) / 100 : 0,
      total_rooms:       Number(r?.total_rooms ?? 0),
      occupied_rooms:    occ,
      avg_vacancy_days:  Math.round(Number(r?.avg_vacancy_days ?? 0) * 10) / 10,
      move_ins:          Number(m?.move_ins  ?? 0),
      move_outs:         Number(m?.move_outs ?? 0),
      revenue:           rev,
      expenses:          exp,
      profit:            rev - exp,
      complaints: {
        pending:                   Number(cp?.pending  ?? 0),
        resolved:                  Number(cp?.resolved ?? 0),
        avg_resolution_time_hours: Math.round(Number(cp?.avg_hours ?? 0) * 100) / 100,
      },
    };
  }
}

export const analyticsService = new AnalyticsService();
