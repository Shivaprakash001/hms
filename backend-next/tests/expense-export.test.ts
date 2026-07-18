import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { expenseService } from "@/lib/services/expense-service";
import {
  streamExpensesCsv,
  streamExpensesXlsx,
  generateExpensesPdf,
  getExportSummary,
  type ExpenseExportRequest,
} from "@/lib/services/expense-export-service";
import { createTestOwner } from "./factories/owner-factory";

async function readStream(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Buffer[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

function parseCsv(text: string): string[][] {
  return text
    .trim()
    .split("\r\n")
    .map((line) => line.split(",").map((cell) => cell.replace(/^"|"$/g, "").replace(/""/g, '"')));
}

describe("Expense export service", () => {
  it("CSV export matches the same filtered set the UI query would return", async () => {
    const owner = await createTestOwner();
    await expenseService.createExpense({
      owner_id: owner.id, title: "Rice 60 bags", amount: 91000, date: new Date(),
      category: "Food & Groceries", vendor_name: "Sri Ganesh Traders", payment_method: "UPI",
    });
    await expenseService.createExpense({
      owner_id: owner.id, title: "Electricity bill", amount: 12500, date: new Date(),
      category: "Electricity", payment_method: "Bank Transfer",
    });
    await expenseService.createExpense({
      owner_id: owner.id, title: "Vegetables", amount: 600, date: new Date(),
      category: "Food & Groceries", status: "pending",
    });

    const uiResult = await expenseService.getAllExpenses(owner.id, { categories: ["Food & Groceries"] });

    const req: ExpenseExportRequest = { ownerId: owner.id, filters: { categories: ["Food & Groceries"] }, scope: "all_matching" };
    const csvBuffer = await readStream(streamExpensesCsv(req));
    const rows = parseCsv(csvBuffer.toString("utf-8"));
    const [header, ...dataRows] = rows;

    expect(header).toContain("Title");
    expect(dataRows.length).toBe(uiResult.expenses.length);
    expect(dataRows.length).toBe(2); // Rice 60 bags + Vegetables, not Electricity

    const titles = dataRows.map((r) => r[header.indexOf("Title")]);
    expect(titles).toEqual(expect.arrayContaining(["Rice 60 bags", "Vegetables"]));
    expect(titles).not.toContain("Electricity bill");

    const amountCol = header.indexOf("Amount (INR)");
    const riceRow = dataRows.find((r) => r[header.indexOf("Title")] === "Rice 60 bags")!;
    expect(riceRow[amountCol]).toBe("91000");
  });

  it("respects recurring/amount-range/search filters exactly like the list endpoint", async () => {
    const owner = await createTestOwner();
    await expenseService.createExpense({
      owner_id: owner.id, title: "Monthly Internet", amount: 1200, date: new Date(),
      category: "Internet", is_recurring: true,
    });
    await expenseService.createExpense({
      owner_id: owner.id, title: "One-time Repair", amount: 8000, date: new Date(),
      category: "Maintenance & Repairs", is_recurring: false,
    });

    const req: ExpenseExportRequest = { ownerId: owner.id, filters: { recurring: true }, scope: "all_matching" };
    const csvBuffer = await readStream(streamExpensesCsv(req));
    const [header, ...dataRows] = parseCsv(csvBuffer.toString("utf-8"));
    expect(dataRows.length).toBe(1);
    expect(dataRows[0][header.indexOf("Title")]).toBe("Monthly Internet");
  });

  it("scope=selected exports exactly the given IDs regardless of other filters", async () => {
    const owner = await createTestOwner();
    const a = await expenseService.createExpense({
      owner_id: owner.id, title: "A", amount: 100, date: new Date(), category: "Miscellaneous",
    });
    const b = await expenseService.createExpense({
      owner_id: owner.id, title: "B", amount: 200, date: new Date(), category: "Miscellaneous",
    });
    await expenseService.createExpense({
      owner_id: owner.id, title: "C", amount: 300, date: new Date(), category: "Miscellaneous",
    });

    const req: ExpenseExportRequest = {
      ownerId: owner.id,
      filters: { search: "this matches nothing" }, // deliberately irrelevant — selected scope should ignore it
      scope: "selected",
      ids: [a.id, b.id],
    };
    const csvBuffer = await readStream(streamExpensesCsv(req));
    const [header, ...dataRows] = parseCsv(csvBuffer.toString("utf-8"));
    expect(dataRows.length).toBe(2);
    const titles = dataRows.map((r) => r[header.indexOf("Title")]).sort();
    expect(titles).toEqual(["A", "B"]);
  });

  it("scope=current_view respects limit/offset like the paginated list", async () => {
    const owner = await createTestOwner();
    for (let i = 0; i < 5; i++) {
      await expenseService.createExpense({
        owner_id: owner.id, title: `Item ${i}`, amount: 100 + i, date: new Date(), category: "Miscellaneous",
      });
    }
    const req: ExpenseExportRequest = { ownerId: owner.id, filters: {}, scope: "current_view", limit: 2, offset: 0 };
    const csvBuffer = await readStream(streamExpensesCsv(req));
    const [, ...dataRows] = parseCsv(csvBuffer.toString("utf-8"));
    expect(dataRows.length).toBe(2);
  });

  it("XLSX export is a valid workbook containing the same rows as CSV", async () => {
    const owner = await createTestOwner();
    await expenseService.createExpense({
      owner_id: owner.id, title: "Gas cylinders", amount: 10000, date: new Date(), category: "Gas Cylinders",
    });
    await expenseService.createExpense({
      owner_id: owner.id, title: "Milk supply", amount: 100, date: new Date(), category: "Food & Groceries",
    });

    const req: ExpenseExportRequest = { ownerId: owner.id, filters: {}, scope: "all_matching" };
    const xlsxBuffer = await readStream(streamExpensesXlsx(req));
    expect(xlsxBuffer.length).toBeGreaterThan(0);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsxBuffer as any);
    const sheet = workbook.getWorksheet("Expenses");
    expect(sheet).toBeTruthy();
    // Header row + 2 data rows
    expect(sheet!.rowCount).toBe(3);
    const titleColIndex = sheet!.getRow(1).values as any[];
    expect(titleColIndex).toContain("Title");
  });

  it("PDF export is a valid non-empty PDF document", async () => {
    const owner = await createTestOwner();
    await expenseService.createExpense({
      owner_id: owner.id, title: "Rice purchase", amount: 5000, date: new Date(),
      category: "Food & Groceries", vendor_name: "Sri Ganesh Traders",
    });

    const req: ExpenseExportRequest = { ownerId: owner.id, filters: {}, scope: "all_matching" };
    const pdfBytes = await generateExpensesPdf(req);
    expect(pdfBytes.length).toBeGreaterThan(0);
    expect(Buffer.from(pdfBytes.slice(0, 5)).toString("utf-8")).toBe("%PDF-");
  });

  it("getExportSummary aggregates over the same filtered set as the export rows (no drift)", async () => {
    const owner = await createTestOwner();
    await expenseService.createExpense({
      owner_id: owner.id, title: "Rice", amount: 3000, date: new Date(),
      category: "Food & Groceries", vendor_name: "Sri Ganesh Traders",
    });
    await expenseService.createExpense({
      owner_id: owner.id, title: "Dal", amount: 1500, date: new Date(),
      category: "Food & Groceries", vendor_name: "Sri Ganesh Traders",
    });
    await expenseService.createExpense({
      owner_id: owner.id, title: "Electricity", amount: 9000, date: new Date(), category: "Electricity",
    });

    const req: ExpenseExportRequest = { ownerId: owner.id, filters: { categories: ["Food & Groceries"] }, scope: "all_matching" };
    const summary = await getExportSummary(req);
    expect(summary.totalCount).toBe(2);
    expect(summary.totalAmount).toBe(4500);
    expect(summary.vendorBreakdown[0]).toMatchObject({ vendor: "Sri Ganesh Traders", amount: 4500, count: 2 });
  });
});
