import { randomUUID } from "crypto";
import { prisma } from "../db";
import { eventSystem } from "../events";

const EXPENSE_CATEGORIES = [
  "Food",
  "Electricity",
  "Water",
  "Internet",
  "Staff Salary",
  "Salary",
  "Maintenance",
  "Repairs",
  "Cleaning",
  "Security",
  "Furniture",
  "Kitchen",
  "Marketing",
  "Transport",
  "Miscellaneous",
];

const FIXED_CATEGORIES = new Set(["Internet", "Security", "Staff Salary", "Salary"]);

type ExpenseFilters = {
  range?: string;
  startDate?: string;
  endDate?: string;
  categories?: string[];
  status?: string;
  sort?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const addMonths = (date: Date, months: number) => new Date(date.getFullYear(), date.getMonth() + months, 1);
const endExclusiveMonth = (date: Date) => addMonths(startOfMonth(date), 1);
const round = (n: number) => Math.round(n * 100) / 100;

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function asDate(value: unknown, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function getRange(filters: ExpenseFilters) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (filters.startDate || filters.endDate) {
    const start = asDate(filters.startDate, startOfMonth(now));
    const endBase = asDate(filters.endDate, now);
    const end = new Date(endBase.getFullYear(), endBase.getMonth(), endBase.getDate() + 1);
    return { start, end };
  }

  if (filters.range === "today") return { start: today, end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1) };
  if (filters.range === "week") {
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end };
  }

  return { start: startOfMonth(now), end: endExclusiveMonth(now) };
}

function pctChange(current: number, previous: number) {
  if (previous <= 0 && current <= 0) return 0;
  if (previous <= 0) return 100;
  return round(((current - previous) / previous) * 100);
}

function healthFromRatio(ratio: number) {
  if (ratio <= 35) return "healthy";
  if (ratio <= 55) return "warning";
  return "dangerous";
}

function normalizeCategory(category: string) {
  if (!category) return "Miscellaneous";
  const lower = category.toLowerCase();
  if (lower === "salary") return "Staff Salary";
  const found = EXPENSE_CATEGORIES.find((c) => c.toLowerCase() === lower);
  return found || category;
}

function suggestedCategory(title: string) {
  const text = title.toLowerCase();
  if (/(electric|power|eb|current|bescom|bill)/.test(text)) return "Electricity";
  if (/(food|rice|milk|grocery|vegetable|kitchen|meal)/.test(text)) return "Food";
  if (/(wifi|internet|broadband|router|airtel|jio)/.test(text)) return "Internet";
  if (/(repair|plumb|paint|fix|carpenter)/.test(text)) return "Repairs";
  if (/(clean|housekeep|sanit)/.test(text)) return "Cleaning";
  if (/(salary|staff|warden|watchman)/.test(text)) return "Staff Salary";
  if (/(water|tanker)/.test(text)) return "Water";
  return "Miscellaneous";
}

export class ExpenseService {
  async getAllExpenses(ownerId: string, hostelId: string, filters: ExpenseFilters = {}) {
    const { start, end } = getRange(filters);
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const nextMonthStart = endExclusiveMonth(now);
    const previousMonthStart = addMonths(currentMonthStart, -1);
    const sixMonthStart = addMonths(currentMonthStart, -5);

    const ledgerWhere: any = {
      owner_id: ownerId,
      hostel_id: hostelId,
      date: { gte: start, lt: end },
      ...(filters.status && filters.status !== "all" ? { status: filters.status } : {}),
      ...(filters.categories?.length ? { category: { in: filters.categories } } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: "insensitive" } },
              { notes: { contains: filters.search, mode: "insensitive" } },
              { vendor_name: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const sort = filters.sort || "recent";
    const orderBy: any =
      sort === "highest"
        ? { amount: "desc" }
        : sort === "oldest"
          ? { date: "asc" }
          : sort === "category"
            ? { category: "asc" }
            : { date: "desc" };

    const [
      ledger,
      totalCount,
      currentAgg,
      previousAgg,
      currentRevenue,
      previousRevenue,
      categoryCurrent,
      categoryPrevious,
      monthlyExpenses,
      monthlyPayments,
      latestSnapshot,
      rooms,
      activeTenants,
      duplicateCandidates,
    ] = await Promise.all([
      prisma.expenses.findMany({
        where: ledgerWhere,
        orderBy,
        take: Math.min(Number(filters.limit || 30), 100),
        skip: Number(filters.offset || 0),
        include: { hostels: { select: { id: true, name: true } }, profiles: { select: { id: true, name: true, email: true } } },
      }),
      prisma.expenses.count({ where: ledgerWhere }),
      prisma.expenses.aggregate({
        where: { owner_id: ownerId, hostel_id: hostelId, date: { gte: currentMonthStart, lt: nextMonthStart } },
        _sum: { amount: true },
      }),
      prisma.expenses.aggregate({
        where: { owner_id: ownerId, hostel_id: hostelId, date: { gte: previousMonthStart, lt: currentMonthStart } },
        _sum: { amount: true },
      }),
      prisma.payments.aggregate({
        where: { hostel_id: hostelId, payment_date: { gte: currentMonthStart, lt: nextMonthStart } },
        _sum: { amount_paid: true },
      }),
      prisma.payments.aggregate({
        where: { hostel_id: hostelId, payment_date: { gte: previousMonthStart, lt: currentMonthStart } },
        _sum: { amount_paid: true },
      }),
      prisma.expenses.groupBy({
        by: ["category"],
        where: { owner_id: ownerId, hostel_id: hostelId, date: { gte: currentMonthStart, lt: nextMonthStart } },
        _sum: { amount: true },
      }),
      prisma.expenses.groupBy({
        by: ["category"],
        where: { owner_id: ownerId, hostel_id: hostelId, date: { gte: previousMonthStart, lt: currentMonthStart } },
        _sum: { amount: true },
      }),
      prisma.expenses.groupBy({
        by: ["date"],
        where: { owner_id: ownerId, hostel_id: hostelId, date: { gte: sixMonthStart, lt: nextMonthStart } },
        _sum: { amount: true },
      }),
      prisma.payments.groupBy({
        by: ["payment_date"],
        where: { hostel_id: hostelId, payment_date: { gte: sixMonthStart, lt: nextMonthStart } },
        _sum: { amount_paid: true },
      }),
      prisma.hostel_daily_snapshots.findFirst({
        where: { hostel_id: hostelId },
        orderBy: { snapshot_date: "desc" },
      }),
      prisma.rooms.findMany({ where: { hostel_id: hostelId, is_active: true }, select: { id: true, capacity: true, base_rent: true } }),
      prisma.tenants.count({ where: { hostel_id: hostelId, status: "ACTIVE" } }),
      prisma.expenses.findMany({
        where: { owner_id: ownerId, hostel_id: hostelId, date: { gte: currentMonthStart, lt: nextMonthStart } },
        select: { id: true, title: true, amount: true, date: true, category: true },
        orderBy: { created_at: "desc" },
        take: 200,
      }),
    ]);

    const currentExpenses = Number(currentAgg._sum.amount || 0);
    const previousExpenses = Number(previousAgg._sum.amount || 0);
    const collectedRevenue = Number(currentRevenue._sum.amount_paid || latestSnapshot?.collected_revenue || 0);
    const previousCollected = Number(previousRevenue._sum.amount_paid || 0);
    const netProfit = round(collectedRevenue - currentExpenses);
    const margin = collectedRevenue > 0 ? round((netProfit / collectedRevenue) * 100) : 0;
    const expenseRevenueRatio = collectedRevenue > 0 ? round((currentExpenses / collectedRevenue) * 100) : 0;
    const expensePerTenant = activeTenants > 0 ? round(currentExpenses / activeTenants) : 0;
    const totalCapacity = rooms.reduce((sum, r) => sum + Number(r.capacity || 0), 0);
    const occupiedBeds = activeTenants;
    const occupancyRate = totalCapacity > 0 ? round((occupiedBeds / totalCapacity) * 100) : Number(latestSnapshot?.occupancy_rate || 0);
    const expensePerOccupiedBed = occupiedBeds > 0 ? round(currentExpenses / occupiedBeds) : 0;
    const avgBedRent = activeTenants > 0 && collectedRevenue > 0
      ? collectedRevenue / activeTenants
      : rooms.reduce((sum, r) => sum + Number(r.base_rent || 0), 0) / Math.max(rooms.length, 1);
    const vacancyLossEstimate = round(Math.max(0, totalCapacity - occupiedBeds) * avgBedRent);

    const previousByCategory = new Map(categoryPrevious.map((row) => [normalizeCategory(row.category), Number(row._sum.amount || 0)]));
    const categoryBreakdown = categoryCurrent
      .map((row) => {
        const category = normalizeCategory(row.category);
        const amount = Number(row._sum.amount || 0);
        const previous = previousByCategory.get(category) || 0;
        const trend = pctChange(amount, previous);
        return {
          category,
          amount,
          percentage: currentExpenses > 0 ? round((amount / currentExpenses) * 100) : 0,
          trend,
          anomaly: previous > 0 && trend >= 35 ? `${category} up ${trend}% compared to last month` : null,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    const months = Array.from({ length: 6 }, (_, i) => addMonths(sixMonthStart, i));
    const expensesByMonth = new Map<string, number>();
    for (const row of monthlyExpenses) {
      const key = monthKey(new Date(row.date));
      expensesByMonth.set(key, (expensesByMonth.get(key) || 0) + Number(row._sum.amount || 0));
    }
    const revenueByMonth = new Map<string, number>();
    for (const row of monthlyPayments) {
      const key = monthKey(new Date(row.payment_date));
      revenueByMonth.set(key, (revenueByMonth.get(key) || 0) + Number(row._sum.amount_paid || 0));
    }
    const monthlyTrend = months.map((date) => {
      const key = monthKey(date);
      const revenue = revenueByMonth.get(key) || 0;
      const expenses = expensesByMonth.get(key) || 0;
      return { month: key, revenue, expenses, profit: round(revenue - expenses) };
    });

    const fixedExpenses = categoryBreakdown
      .filter((c) => FIXED_CATEGORIES.has(c.category))
      .reduce((sum, c) => sum + c.amount, 0);
    const fixedCostRatio = currentExpenses > 0 ? round((fixedExpenses / currentExpenses) * 100) : 0;
    const fastestGrowingCategory = [...categoryBreakdown].sort((a, b) => b.trend - a.trend)[0] || null;

    const duplicateKeys = new Map<string, number>();
    for (const item of duplicateCandidates) {
      const key = `${String(item.title).toLowerCase()}|${Number(item.amount)}|${new Date(item.date).toISOString().slice(0, 10)}`;
      duplicateKeys.set(key, (duplicateKeys.get(key) || 0) + 1);
    }
    const duplicateCount = Array.from(duplicateKeys.values()).filter((count) => count > 1).length;

    const insights = this.buildInsights({
      currentExpenses,
      previousExpenses,
      collectedRevenue,
      previousCollected,
      margin,
      expenseRevenueRatio,
      expensePerTenant,
      expensePerOccupiedBed,
      occupancyRate,
      fixedCostRatio,
      vacancyLossEstimate,
      fastestGrowingCategory,
      categoryBreakdown,
      duplicateCount,
    });

    return {
      expenses: ledger.map((e: any) => ({
        ...e,
        amount: Number(e.amount || 0),
        hostel: e.hostels?.name || null,
        added_by: e.profiles?.name || e.profiles?.email || null,
        suggested_category: suggestedCategory(e.title || ""),
      })),
      total: totalCount,
      kpis: {
        this_month_expenses: currentExpenses,
        last_month_expenses: previousExpenses,
        expense_growth_rate: pctChange(currentExpenses, previousExpenses),
        collected_revenue: collectedRevenue,
        previous_collected_revenue: previousCollected,
        net_profit: netProfit,
        profit_margin: margin,
        health: margin >= 25 ? "healthy" : margin >= 12 ? "warning" : "dangerous",
        expense_per_tenant: expensePerTenant,
        expense_per_occupied_room: expensePerOccupiedBed,
        expense_revenue_ratio: expenseRevenueRatio,
        expense_ratio_health: healthFromRatio(expenseRevenueRatio),
        fixed_variable_ratio: fixedCostRatio,
        fastest_growing_category: fastestGrowingCategory,
        net_operational_margin: margin,
      },
      category_breakdown: categoryBreakdown,
      insights,
      monthly_trend: monthlyTrend,
      occupancy_impact: {
        occupancy_rate: occupancyRate,
        active_tenants: activeTenants,
        total_capacity: totalCapacity,
        expense_per_occupied_bed: expensePerOccupiedBed,
        vacancy_loss_estimate: vacancyLossEstimate,
        fixed_cost_pressure: fixedCostRatio,
        message:
          occupancyRate < 70 && fixedCostRatio > 45
            ? `Hostel is at ${occupancyRate}% occupancy while fixed costs remain high.`
            : `Occupancy is ${occupancyRate}% with ${fixedCostRatio}% fixed cost pressure.`,
      },
      meta: {
        range: { start, end },
        categories: EXPENSE_CATEGORIES,
      },
    };
  }

  private buildInsights(data: any) {
    const insights: Array<{ type: string; severity: string; title: string; detail: string }> = [];
    const food = data.categoryBreakdown.find((c: any) => c.category === "Food");
    const electricity = data.categoryBreakdown.find((c: any) => c.category === "Electricity");

    if (data.expenseRevenueRatio > 0) {
      insights.push({
        type: "efficiency",
        severity: data.expenseRevenueRatio > 55 ? "dangerous" : data.expenseRevenueRatio > 35 ? "warning" : "healthy",
        title: `${data.expenseRevenueRatio}% of revenue consumed by operations`,
        detail: data.expenseRevenueRatio > 55 ? "Review large and recurring costs before adding new beds." : "Operational expense ratio is within a manageable range.",
      });
    }

    if (data.margin < 18) {
      insights.push({
        type: "profit",
        severity: "dangerous",
        title: "Profit margin dropped below 18%",
        detail: "Collections or pricing need attention before costs scale further.",
      });
    }

    if (food && data.collectedRevenue > 0) {
      const foodRevenueRatio = round((food.amount / data.collectedRevenue) * 100);
      insights.push({
        type: "category",
        severity: foodRevenueRatio > 35 ? "warning" : "healthy",
        title: `Food costs are ${foodRevenueRatio}% of collected revenue`,
        detail: foodRevenueRatio > 35 ? "Meal cost is becoming heavy. Check vendor rates and wastage." : "Food cost looks controlled for current collections.",
      });
    }

    if (electricity?.trend > 35) {
      insights.push({
        type: "anomaly",
        severity: "warning",
        title: `Electricity up ${electricity.trend}% compared to last month`,
        detail: "Check AC usage, meter billing period, or duplicate EB entries.",
      });
    }

    if (data.occupancyRate < 70 && data.fixedCostRatio > 45) {
      insights.push({
        type: "occupancy",
        severity: "warning",
        title: "Fixed cost pressure is high for current occupancy",
        detail: `At ${data.occupancyRate}% occupancy, every vacant bed is amplifying operational costs.`,
      });
    }

    if (data.duplicateCount > 0) {
      insights.push({
        type: "leakage",
        severity: "warning",
        title: `${data.duplicateCount} possible duplicate expense entr${data.duplicateCount === 1 ? "y" : "ies"}`,
        detail: "Review same-title and same-amount entries from this month.",
      });
    }

    if (data.fastestGrowingCategory?.trend > 25) {
      insights.push({
        type: "growth",
        severity: "warning",
        title: `${data.fastestGrowingCategory.category} is the fastest growing cost`,
        detail: `It increased ${data.fastestGrowingCategory.trend}% month over month.`,
      });
    }

    if (insights.length === 0) {
      insights.push({
        type: "healthy",
        severity: "healthy",
        title: "Expenses look controlled this month",
        detail: "Keep logging daily costs to improve trend accuracy.",
      });
    }

    return insights.slice(0, 6);
  }

  async createExpense(data: {
    owner_id: string;
    title: string;
    amount: number;
    date: Date | string;
    category: string;
    status?: string;
    hostel_id: string;
    notes?: string;
    vendor_name?: string;
    payment_method?: string;
    receipt_url?: string;
    is_recurring?: boolean;
    recurring_frequency?: string;
    created_by?: string;
    approved_by?: string;
    expense_type?: string;
    tags?: string[];
    metadata?: any;
  }) {
    if (!data.hostel_id) throw new Error("HOSTEL_CONTEXT_REQUIRED: Expense requires hostel_id");
    if (!Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0) {
      throw new Error("VALIDATION: Amount must be greater than zero");
    }

    const parsedDate = data.date instanceof Date ? data.date : new Date(data.date);
    if (Number.isNaN(parsedDate.getTime())) throw new Error("VALIDATION: Invalid date provided");

    const category = normalizeCategory(data.category || suggestedCategory(data.title));
    const expense = await prisma.expenses.create({
      data: {
        id: randomUUID(),
        owner_id: data.owner_id,
        title: data.title,
        amount: Number(data.amount),
        date: parsedDate,
        category,
        status: data.status || "paid",
        hostel_id: data.hostel_id,
        notes: data.notes || null,
        vendor_name: data.vendor_name || null,
        payment_method: data.payment_method || null,
        receipt_url: data.receipt_url || null,
        receipt_uploaded_at: data.receipt_url ? new Date() : null,
        is_recurring: Boolean(data.is_recurring),
        recurring_frequency: data.recurring_frequency || null,
        created_by: data.created_by || data.owner_id,
        approved_by: data.approved_by || null,
        expense_type: data.expense_type || (FIXED_CATEGORIES.has(category) ? "FIXED" : "VARIABLE"),
        tags: data.tags || [],
        metadata: {
          ...(data.metadata || {}),
          suggested_category: suggestedCategory(data.title),
        },
      } as any,
    });

    await eventSystem.trigger("expense_created", {
      expense_id: expense.id,
      owner_id: data.owner_id,
      hostel_id: data.hostel_id,
      title: data.title,
      amount: data.amount,
    });

    return expense;
  }

  async updateExpense(expenseId: string, ownerId: string, data: any) {
    const existing = await prisma.expenses.findFirst({ where: { id: expenseId, owner_id: ownerId } });
    if (!existing) throw new Error("NOT_FOUND: Expense not found");

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.amount !== undefined) updateData.amount = Number(data.amount);
    if (data.category !== undefined) updateData.category = normalizeCategory(data.category);
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.vendor_name !== undefined) updateData.vendor_name = data.vendor_name || null;
    if (data.payment_method !== undefined) updateData.payment_method = data.payment_method || null;
    if (data.receipt_url !== undefined) {
      updateData.receipt_url = data.receipt_url || null;
      updateData.receipt_uploaded_at = data.receipt_url ? new Date() : null;
    }
    if (data.is_recurring !== undefined) updateData.is_recurring = Boolean(data.is_recurring);
    if (data.recurring_frequency !== undefined) updateData.recurring_frequency = data.recurring_frequency || null;
    if (data.expense_type !== undefined) updateData.expense_type = data.expense_type;
    if (data.tags !== undefined) updateData.tags = Array.isArray(data.tags) ? data.tags : [];
    if (data.metadata !== undefined) updateData.metadata = data.metadata;
    if (data.date !== undefined) {
      const d = new Date(data.date);
      if (!Number.isNaN(d.getTime())) updateData.date = d;
    }

    return prisma.expenses.update({ where: { id: expenseId }, data: updateData });
  }

  async deleteExpense(expenseId: string, ownerId: string) {
    const existing = await prisma.expenses.findFirst({ where: { id: expenseId, owner_id: ownerId } });
    if (!existing) throw new Error("NOT_FOUND: Expense not found");
    return prisma.expenses.delete({ where: { id: expenseId } });
  }
}

export const expenseService = new ExpenseService();
