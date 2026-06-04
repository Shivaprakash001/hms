import { randomUUID } from "crypto";
import { prisma } from "../db";
import { eventSystem } from "../events";

const EXPENSE_CATEGORIES = [
  "Food & Groceries",
  "Staff Salary",
  "Electricity",
  "Water",
  "Gas Cylinders",
  "Internet",
  "Cleaning Supplies",
  "Maintenance & Repairs",
  "Security",
  "Laundry",
  "Transportation",
  "Furniture & Equipment",
  "Licenses & Government",
  "Marketing",
  "Medical & Emergency",
  "Miscellaneous",
];

type ExpenseFilters = {
  range?: string;
  startDate?: string;
  endDate?: string;
  hostelId?: string;
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

function normalizeCategory(category: string) {
  if (!category) return "Miscellaneous";
  const lower = category.toLowerCase().trim();
  const aliases: Record<string, string> = {
    food: "Food & Groceries",
    grocery: "Food & Groceries",
    groceries: "Food & Groceries",
    kitchen: "Food & Groceries",
    salary: "Staff Salary",
    staff: "Staff Salary",
    gas: "Gas Cylinders",
    "gas cylinder": "Gas Cylinders",
    cylinder: "Gas Cylinders",
    cleaning: "Cleaning Supplies",
    repairs: "Maintenance & Repairs",
    repair: "Maintenance & Repairs",
    maintenance: "Maintenance & Repairs",
    asset: "Furniture & Equipment",
    assets: "Furniture & Equipment",
    "asset purchase": "Furniture & Equipment",
    furniture: "Furniture & Equipment",
  };
  if (aliases[lower]) return aliases[lower];
  const found = EXPENSE_CATEGORIES.find((c) => c.toLowerCase() === lower);
  return found || category;
}

function suggestedCategory(title: string) {
  const text = title.toLowerCase();
  if (/(electric|power|eb|current|bescom|bill)/.test(text)) return "Electricity";
  if (/(food|rice|milk|grocery|vegetable|kitchen|meal|dal|oil)/.test(text)) return "Food & Groceries";
  if (/(gas|cylinder|lpg)/.test(text)) return "Gas Cylinders";
  if (/(wifi|internet|broadband|router|airtel|jio)/.test(text)) return "Internet";
  if (/(repair|plumb|paint|fix|carpenter|maintenance)/.test(text)) return "Maintenance & Repairs";
  if (/(clean|housekeep|sanit|soap|phenyl)/.test(text)) return "Cleaning Supplies";
  if (/(salary|staff|warden|watchman)/.test(text)) return "Staff Salary";
  if (/(security|guard|cctv)/.test(text)) return "Security";
  if (/(laundry|washing|washer)/.test(text)) return "Laundry";
  if (/(transport|auto|fuel|petrol|diesel)/.test(text)) return "Transportation";
  if (/(bed|mattress|furniture|fridge|geyser|fan|machine|equipment)/.test(text)) return "Furniture & Equipment";
  if (/(license|licence|government|tax|permit)/.test(text)) return "Licenses & Government";
  if (/(marketing|banner|ad|advertis|poster)/.test(text)) return "Marketing";
  if (/(medical|emergency|first aid|doctor)/.test(text)) return "Medical & Emergency";
  if (/(water|tanker)/.test(text)) return "Water";
  return "Miscellaneous";
}

function businessPaymentWhere(ownerId: string, start: Date, end: Date) {
  return {
    payment_date: { gte: start, lt: end },
    OR: [{ owner_id: ownerId }, { hostels: { owner_id: ownerId } }],
  } as any;
}

export class ExpenseService {
  async getAllExpenses(ownerId: string, filters: ExpenseFilters = {}) {
    const { start, end } = getRange(filters);
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const nextMonthStart = endExclusiveMonth(now);
    const previousMonthStart = addMonths(currentMonthStart, -1);
    const sixMonthStart = addMonths(currentMonthStart, -5);

    const ledgerWhere: any = {
      owner_id: ownerId,
      date: { gte: start, lt: end },
      ...(filters.hostelId ? { hostel_id: filters.hostelId } : {}),
      ...(filters.status && filters.status !== "all" ? { status: filters.status } : {}),
      ...(filters.categories?.length ? { category: { in: filters.categories.map(normalizeCategory) } } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: "insensitive" } },
              { notes: { contains: filters.search, mode: "insensitive" } },
              { vendor_name: { contains: filters.search, mode: "insensitive" } },
              { payment_method: { contains: filters.search, mode: "insensitive" } },
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

    const businessCurrentWhere = { owner_id: ownerId, date: { gte: currentMonthStart, lt: nextMonthStart } };
    const businessPreviousWhere = { owner_id: ownerId, date: { gte: previousMonthStart, lt: currentMonthStart } };

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
        where: businessCurrentWhere,
        _sum: { amount: true },
      }),
      prisma.expenses.aggregate({
        where: businessPreviousWhere,
        _sum: { amount: true },
      }),
      prisma.payments.aggregate({
        where: businessPaymentWhere(ownerId, currentMonthStart, nextMonthStart),
        _sum: { amount_paid: true },
      }),
      prisma.payments.aggregate({
        where: businessPaymentWhere(ownerId, previousMonthStart, currentMonthStart),
        _sum: { amount_paid: true },
      }),
      prisma.expenses.groupBy({
        by: ["category"],
        where: businessCurrentWhere,
        _sum: { amount: true },
      }),
      prisma.expenses.groupBy({
        by: ["category"],
        where: businessPreviousWhere,
        _sum: { amount: true },
      }),
      prisma.expenses.groupBy({
        by: ["date"],
        where: { owner_id: ownerId, date: { gte: sixMonthStart, lt: nextMonthStart } },
        _sum: { amount: true },
      }),
      prisma.payments.groupBy({
        by: ["payment_date"],
        where: businessPaymentWhere(ownerId, sixMonthStart, nextMonthStart),
        _sum: { amount_paid: true },
      }),
      prisma.expenses.findMany({
        where: businessCurrentWhere,
        select: { id: true, title: true, amount: true, date: true, category: true },
        orderBy: { created_at: "desc" },
        take: 200,
      }),
    ]);

    const currentExpenses = Number(currentAgg._sum.amount || 0);
    const previousExpenses = Number(previousAgg._sum.amount || 0);
    const collectedRevenue = Number(currentRevenue._sum.amount_paid || 0);
    const previousCollected = Number(previousRevenue._sum.amount_paid || 0);
    const netProfit = round(collectedRevenue - currentExpenses);
    const margin = collectedRevenue > 0 ? round((netProfit / collectedRevenue) * 100) : 0;
    const expenseRevenueRatio = collectedRevenue > 0 ? round((currentExpenses / collectedRevenue) * 100) : 0;

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

    const duplicateKeys = new Map<string, number>();
    for (const item of duplicateCandidates) {
      const key = `${String(item.title).toLowerCase()}|${Number(item.amount)}|${new Date(item.date).toISOString().slice(0, 10)}`;
      duplicateKeys.set(key, (duplicateKeys.get(key) || 0) + 1);
    }
    const duplicateCount = Array.from(duplicateKeys.values()).filter((count) => count > 1).length;
    const fastestGrowingCategory = [...categoryBreakdown].sort((a, b) => b.trend - a.trend)[0] || null;

    const insights = this.buildInsights({
      currentExpenses,
      previousExpenses,
      collectedRevenue,
      margin,
      expenseRevenueRatio,
      fastestGrowingCategory,
      categoryBreakdown,
      duplicateCount,
    });

    return {
      expenses: ledger.map((e: any) => ({
        ...e,
        amount: Number(e.amount || 0),
        hostel: e.hostels?.name || null,
        hostel_id: e.hostel_id || null,
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
        expense_revenue_ratio: expenseRevenueRatio,
        fastest_growing_category: fastestGrowingCategory,
      },
      category_breakdown: categoryBreakdown,
      insights,
      monthly_trend: monthlyTrend,
      meta: {
        range: { start, end },
        categories: EXPENSE_CATEGORIES,
        hostel_filter: filters.hostelId || null,
        accounting_scope: "business",
      },
    };
  }

  private buildInsights(data: any) {
    const insights: Array<{ type: string; severity: string; title: string; detail: string }> = [];
    const food = data.categoryBreakdown.find((c: any) => c.category === "Food & Groceries");
    const electricity = data.categoryBreakdown.find((c: any) => c.category === "Electricity");
    const salary = data.categoryBreakdown.find((c: any) => c.category === "Staff Salary");

    if (food && data.currentExpenses > 0) {
      insights.push({
        type: "category",
        severity: food.percentage > 45 ? "warning" : "healthy",
        title: `Food & Groceries consumed ${food.percentage}% of expenses this month`,
        detail: food.percentage > 45 ? "Review kitchen purchase quantity, vendor rates, and wastage." : "Kitchen spending is within the tracked business range.",
      });
    }

    if (salary?.trend > 0) {
      insights.push({
        type: "salary",
        severity: salary.trend > 20 ? "warning" : "healthy",
        title: `Staff salary increased ${salary.trend}% compared to last month`,
        detail: "Check one-time payments before treating this as a recurring increase.",
      });
    }

    if (electricity?.trend > 25) {
      insights.push({
        type: "anomaly",
        severity: "warning",
        title: "Electricity spending is trending upward",
        detail: `Electricity increased ${electricity.trend}% month over month.`,
      });
    }

    if (data.expenseRevenueRatio > 0) {
      insights.push({
        type: "profit",
        severity: data.expenseRevenueRatio > 60 ? "dangerous" : data.expenseRevenueRatio > 40 ? "warning" : "healthy",
        title: `${data.expenseRevenueRatio}% of revenue went to business expenses`,
        detail: data.expenseRevenueRatio > 60 ? "Profit is tight this month. Review top categories first." : "Expense ratio is inside a manageable business range.",
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
        title: "Business expenses look controlled this month",
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
    hostel_id?: string | null;
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
    if (!data.title?.trim()) throw new Error("VALIDATION: Title is required");
    if (!Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0) {
      throw new Error("VALIDATION: Amount must be greater than zero");
    }
    if (!data.payment_method) throw new Error("VALIDATION: Payment method is required");

    const parsedDate = data.date instanceof Date ? data.date : new Date(data.date);
    if (Number.isNaN(parsedDate.getTime())) throw new Error("VALIDATION: Invalid date provided");

    const category = normalizeCategory(data.category || suggestedCategory(data.title));
    const expense = await prisma.expenses.create({
      data: {
        id: randomUUID(),
        owner_id: data.owner_id,
        title: data.title.trim(),
        amount: Number(data.amount),
        date: parsedDate,
        category,
        status: data.status || "paid",
        hostel_id: data.hostel_id || null,
        notes: data.notes || null,
        vendor_name: data.vendor_name || null,
        payment_method: data.payment_method || null,
        receipt_url: data.receipt_url || null,
        receipt_uploaded_at: data.receipt_url ? new Date() : null,
        is_recurring: Boolean(data.is_recurring),
        recurring_frequency: data.is_recurring ? data.recurring_frequency || "monthly" : null,
        created_by: data.created_by || data.owner_id,
        approved_by: data.approved_by || null,
        expense_type: data.expense_type || "BUSINESS",
        tags: data.tags || [],
        metadata: {
          ...(data.metadata || {}),
          accounting_scope: "business",
          hostel_reference_only: Boolean(data.hostel_id),
          suggested_category: suggestedCategory(data.title),
        },
      },
    });

    await eventSystem.trigger("expense_created", {
      expense_id: expense.id,
      owner_id: data.owner_id,
      hostel_id: data.hostel_id || undefined,
      title: data.title,
      amount: data.amount,
    });

    return expense;
  }

  async updateExpense(expenseId: string, ownerId: string, data: any) {
    const existing = await prisma.expenses.findFirst({ where: { id: expenseId, owner_id: ownerId } });
    if (!existing) throw new Error("NOT_FOUND: Expense not found");

    const updateData: any = {};
    if (data.title !== undefined) {
      if (!String(data.title).trim()) throw new Error("VALIDATION: Title is required");
      updateData.title = String(data.title).trim();
    }
    if (data.amount !== undefined) {
      if (!Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0) {
        throw new Error("VALIDATION: Amount must be greater than zero");
      }
      updateData.amount = Number(data.amount);
    }
    if (data.category !== undefined) updateData.category = normalizeCategory(data.category);
    if (data.status !== undefined) updateData.status = data.status;
    if (data.hostel_id !== undefined || data.hostelId !== undefined) updateData.hostel_id = data.hostel_id ?? data.hostelId ?? null;
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

    const expense = await prisma.expenses.update({ where: { id: expenseId }, data: updateData });
    await eventSystem.trigger("expense_updated", {
      expense_id: expense.id,
      owner_id: ownerId,
      hostel_id: expense.hostel_id || existing.hostel_id || undefined,
      title: expense.title,
      amount: Number(expense.amount || 0),
    });
    return expense;
  }

  async deleteExpense(expenseId: string, ownerId: string) {
    const existing = await prisma.expenses.findFirst({ where: { id: expenseId, owner_id: ownerId } });
    if (!existing) throw new Error("NOT_FOUND: Expense not found");
    const expense = await prisma.expenses.delete({ where: { id: expenseId } });
    await eventSystem.trigger("expense_deleted", {
      expense_id: expense.id,
      owner_id: ownerId,
      hostel_id: expense.hostel_id || undefined,
      title: expense.title,
      amount: Number(expense.amount || 0),
    });
    return expense;
  }
}

export const expenseService = new ExpenseService();
