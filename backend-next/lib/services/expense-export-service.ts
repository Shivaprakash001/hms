import { Readable, PassThrough } from "node:stream";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { prisma } from "../db";
import { buildExpenseLedgerWhere, resolveExpenseSort, type ExpenseFilters } from "./expense-service";

// Decoupled from HTTP: takes plain data, returns plain data/streams. The route handler
// (app/api/expenses/export/route.ts) is the only place that knows about Request/Response.
// This separation is what lets a future scheduled-export cron or a saved-report-template
// runner call the same generators without any redesign.

export type ExpenseExportFormat = "csv" | "xlsx" | "pdf";
export type ExpenseExportScope = "current_view" | "all_matching" | "selected";

export type ExpenseExportRequest = {
  ownerId: string;
  filters: ExpenseFilters;
  scope: ExpenseExportScope;
  ids?: string[];
  limit?: number;
  offset?: number;
};

const BATCH_SIZE = 500;
const PDF_MAX_ROWS = 500;

const EXPORT_FIELDS = [
  "id",
  "title",
  "amount",
  "date",
  "category",
  "status",
  "vendor_name",
  "payment_method",
  "is_recurring",
  "recurring_frequency",
  "operational_type",
  "notes",
  "receipt_url",
] as const;

const COLUMNS: { header: string; key: (typeof EXPORT_FIELDS)[number] | "hostel"; width: number }[] = [
  { header: "Date", key: "date", width: 12 },
  { header: "Title", key: "title", width: 32 },
  { header: "Category", key: "category", width: 20 },
  { header: "Amount (INR)", key: "amount", width: 14 },
  { header: "Status", key: "status", width: 12 },
  { header: "Hostel", key: "hostel", width: 20 },
  { header: "Vendor", key: "vendor_name", width: 24 },
  { header: "Payment Method", key: "payment_method", width: 16 },
  { header: "Recurring", key: "is_recurring", width: 12 },
  { header: "Recurring Frequency", key: "recurring_frequency", width: 16 },
  { header: "Expense Type", key: "operational_type", width: 16 },
  { header: "Has Receipt", key: "receipt_url", width: 12 },
  { header: "Notes", key: "notes", width: 36 },
];

function whereForRequest(req: ExpenseExportRequest) {
  if (req.scope === "selected") {
    if (!req.ids?.length) throw new Error("VALIDATION: No expenses selected for export");
    return { where: { id: { in: req.ids }, owner_id: req.ownerId } as any, range: null as null };
  }
  return buildExpenseLedgerWhere(req.ownerId, req.filters);
}

// Batches through matching rows without ever holding more than one batch (BATCH_SIZE rows)
// in memory — the same mechanism regardless of whether the export is 50 rows or 500,000.
async function* iterateExpenseBatches(req: ExpenseExportRequest) {
  const { where } = whereForRequest(req);
  const orderBy = resolveExpenseSort(req.filters?.sort);
  const include = { hostels: { select: { name: true } } };

  if (req.scope === "current_view") {
    const take = Math.min(Math.max(1, req.limit ?? 100), 1000);
    const skip = Math.max(0, req.offset ?? 0);
    const rows = await prisma.expenses.findMany({ where, orderBy, take, skip, include });
    if (rows.length) yield rows;
    return;
  }

  let skip = 0;
  for (;;) {
    const rows: any[] = await prisma.expenses.findMany({ where, orderBy, take: BATCH_SIZE, skip, include });
    if (rows.length === 0) break;
    yield rows;
    if (rows.length < BATCH_SIZE) break;
    skip += BATCH_SIZE;
  }
}

function rowToRecord(row: any): Record<string, unknown> {
  return {
    date: row.date ? new Date(row.date).toISOString().slice(0, 10) : "",
    title: row.title || "",
    category: row.category || "",
    amount: Number(row.amount || 0),
    status: (row.status || "paid").toUpperCase(),
    hostel: row.hostels?.name || "Business (portfolio-level)",
    vendor_name: row.vendor_name || "",
    payment_method: row.payment_method || "",
    is_recurring: row.is_recurring ? "Yes" : "No",
    recurring_frequency: row.is_recurring ? row.recurring_frequency || "" : "",
    operational_type: row.operational_type || "",
    receipt_url: row.receipt_url ? "Yes" : "No",
    notes: row.notes || "",
  };
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function exportFilename(format: ExpenseExportFormat) {
  const stamp = new Date().toISOString().slice(0, 10);
  const ext = format === "xlsx" ? "xlsx" : format;
  return `expenses-export-${stamp}.${ext}`;
}

export function exportContentType(format: ExpenseExportFormat) {
  if (format === "csv") return "text/csv; charset=utf-8";
  if (format === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "application/pdf";
}

/** Streams CSV rows as they're fetched — memory stays bounded to one batch at a time. */
export function streamExpensesCsv(req: ExpenseExportRequest): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        const header = COLUMNS.map((c) => csvCell(c.header)).join(",") + "\r\n";
        controller.enqueue(encoder.encode(header));
        for await (const batch of iterateExpenseBatches(req)) {
          const lines = batch
            .map((row: any) => {
              const record = rowToRecord(row);
              return COLUMNS.map((c) => csvCell(record[c.key])).join(",");
            })
            .join("\r\n");
          controller.enqueue(encoder.encode(lines + "\r\n"));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

/**
 * Streams a true streaming XLSX write (ExcelJS WorkbookWriter flushes rows to the
 * underlying Node stream incrementally) — does not buffer the whole workbook in memory
 * regardless of row count, unlike building an in-memory `xlsx` (SheetJS) workbook.
 */
export function streamExpensesXlsx(req: ExpenseExportRequest): ReadableStream<Uint8Array> {
  const nodePassthrough = new PassThrough();

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: nodePassthrough,
    useStyles: true,
    useSharedStrings: false,
  });
  const sheet = workbook.addWorksheet("Expenses");
  sheet.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  sheet.getRow(1).font = { bold: true };

  (async () => {
    try {
      for await (const batch of iterateExpenseBatches(req)) {
        for (const row of batch) {
          sheet.addRow(rowToRecord(row)).commit();
        }
      }
      await sheet.commit();
      await workbook.commit();
    } catch (error) {
      nodePassthrough.destroy(error as Error);
    }
  })();

  return Readable.toWeb(nodePassthrough) as ReadableStream<Uint8Array>;
}

export type ExpenseExportSummary = {
  totalCount: number;
  totalAmount: number;
  categoryBreakdown: { category: string; amount: number; count: number }[];
  vendorBreakdown: { vendor: string; amount: number; count: number }[];
  statusBreakdown: { status: string; amount: number; count: number }[];
};

/** Aggregates over the exact same filtered set being exported — for the PDF report's summary section. */
export async function getExportSummary(req: ExpenseExportRequest): Promise<ExpenseExportSummary> {
  const { where } = whereForRequest(req);

  const [totals, byCategory, byVendor, byStatus] = await Promise.all([
    prisma.expenses.aggregate({ where, _sum: { amount: true }, _count: { _all: true } }),
    prisma.expenses.groupBy({ by: ["category"], where, _sum: { amount: true }, _count: { _all: true } }),
    prisma.expenses.groupBy({
      by: ["vendor_name"],
      where: { ...where, vendor_name: { not: null } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.expenses.groupBy({ by: ["status"], where, _sum: { amount: true }, _count: { _all: true } }),
  ]);

  return {
    totalCount: totals._count._all,
    totalAmount: Number(totals._sum.amount || 0),
    categoryBreakdown: (byCategory as any[])
      .map((r) => ({ category: r.category, amount: Number(r._sum.amount || 0), count: r._count._all }))
      .sort((a, b) => b.amount - a.amount),
    vendorBreakdown: (byVendor as any[])
      .filter((r) => r.vendor_name)
      .map((r) => ({ vendor: r.vendor_name, amount: Number(r._sum.amount || 0), count: r._count._all }))
      .sort((a, b) => b.amount - a.amount),
    statusBreakdown: (byStatus as any[])
      .map((r) => ({ status: (r.status || "paid").toUpperCase(), amount: Number(r._sum.amount || 0), count: r._count._all }))
      .sort((a, b) => b.amount - a.amount),
  };
}

export function describeFilters(filters: ExpenseFilters): string[] {
  const lines: string[] = [];
  if (filters.range === "custom" && (filters.startDate || filters.endDate)) {
    lines.push(`Date range: ${filters.startDate || "…"} to ${filters.endDate || "…"}`);
  } else if (filters.range) {
    lines.push(`Date range: ${({ today: "Today", week: "This Week", month: "This Month" } as any)[filters.range] || filters.range}`);
  }
  if (filters.status && filters.status !== "all") lines.push(`Status: ${filters.status}`);
  if (filters.categories?.length) lines.push(`Categories: ${filters.categories.join(", ")}`);
  if (filters.search) lines.push(`Search: "${filters.search}"`);
  if (typeof filters.recurring === "boolean") lines.push(`Recurring: ${filters.recurring ? "Yes only" : "One-time only"}`);
  if (filters.amountMin !== undefined || filters.amountMax !== undefined) {
    lines.push(`Amount: ${filters.amountMin ?? "0"} – ${filters.amountMax ?? "∞"}`);
  }
  return lines.length ? lines : ["No filters applied — all expenses"];
}

const INR = (n: number) => `Rs. ${n.toLocaleString("en-IN")}`;

/**
 * Builds a business-report PDF (summary metrics, category/vendor breakdown, applied
 * filters, capped expense list) — a report artifact, not an unbounded data dump, so it
 * is buffer-based (pdf-lib) rather than streamed like CSV/XLSX. Row count is capped at
 * PDF_MAX_ROWS with an explicit truncation note if the matching set is larger.
 */
export async function generateExpensesPdf(req: ExpenseExportRequest): Promise<Uint8Array> {
  const summary = await getExportSummary(req);
  const filterLines = req.scope === "selected" ? [`${req.ids?.length || 0} selected expense(s)`] : describeFilters(req.filters);

  // For current_view scope this naturally respects req.limit/req.offset (the on-screen
  // page); for all_matching/selected it batches in pages of BATCH_SIZE and we stop as
  // soon as we have enough rows for the report.
  const rows: any[] = [];
  for await (const batch of iterateExpenseBatches(req)) {
    rows.push(...batch);
    if (rows.length >= PDF_MAX_ROWS) break;
  }
  const truncated = rows.length > PDF_MAX_ROWS ? rows.slice(0, PDF_MAX_ROWS) : rows;
  const isTruncated = summary.totalCount > truncated.length;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [595.28, 841.89]; // A4
  const margin = 40;
  let page = doc.addPage(pageSize);
  let y = pageSize[1] - margin;

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = doc.addPage(pageSize);
      y = pageSize[1] - margin;
    }
  };

  const text = (str: string, opts: { size?: number; f?: PDFFont; color?: [number, number, number]; x?: number } = {}) => {
    const size = opts.size ?? 10;
    ensureSpace(size + 4);
    page.drawText(str, {
      x: opts.x ?? margin,
      y,
      size,
      font: opts.f ?? font,
      color: rgb(...(opts.color ?? [0.1, 0.1, 0.1])),
    });
    y -= size + 6;
  };

  text("Business Expense Report", { size: 20, f: bold });
  text(`Generated ${new Date().toLocaleString("en-IN")}`, { size: 9, color: [0.45, 0.45, 0.45] });
  y -= 8;

  text("Applied Filters", { size: 13, f: bold });
  for (const line of filterLines) text(`• ${line}`, { size: 9.5 });
  y -= 8;

  text("Summary", { size: 13, f: bold });
  text(`Total expenses: ${summary.totalCount}`, { size: 10 });
  text(`Total amount: ${INR(summary.totalAmount)}`, { size: 10 });
  y -= 8;

  text("Category Breakdown", { size: 13, f: bold });
  for (const c of summary.categoryBreakdown.slice(0, 20)) {
    text(`${c.category}: ${INR(c.amount)} (${c.count} entries)`, { size: 9.5 });
  }
  y -= 8;

  text("Vendor Summary", { size: 13, f: bold });
  if (summary.vendorBreakdown.length === 0) {
    text("No vendor data recorded.", { size: 9.5, color: [0.5, 0.5, 0.5] });
  }
  for (const v of summary.vendorBreakdown.slice(0, 20)) {
    text(`${v.vendor}: ${INR(v.amount)} (${v.count} payments)`, { size: 9.5 });
  }
  y -= 12;

  text("Expense List", { size: 13, f: bold });
  if (isTruncated) {
    text(`Showing first ${truncated.length} of ${summary.totalCount} matching expenses — use CSV or Excel export for the full list.`, {
      size: 8.5,
      color: [0.6, 0.4, 0.1],
    });
  }

  const colX = [margin, margin + 65, margin + 260, margin + 350, margin + 420];
  const drawTableHeader = () => {
    ensureSpace(16);
    const headers = ["Date", "Title", "Category", "Status", "Amount"];
    headers.forEach((h, i) => page.drawText(h, { x: colX[i], y, size: 9, font: bold }));
    y -= 14;
    page.drawLine({ start: { x: margin, y: y + 4 }, end: { x: pageSize[0] - margin, y: y + 4 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  };
  drawTableHeader();

  for (const row of truncated) {
    ensureSpace(14);
    if (y === pageSize[1] - margin - 14) drawTableHeader();
    const record = rowToRecord(row);
    const cells = [
      String(record.date),
      String(record.title).slice(0, 34),
      String(record.category).slice(0, 18),
      String(record.status),
      INR(Number(record.amount)),
    ];
    cells.forEach((cellText, i) => page.drawText(cellText, { x: colX[i], y, size: 8.5, font }));
    y -= 13;
  }

  return doc.save();
}
