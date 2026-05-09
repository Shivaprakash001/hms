import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { resolveOwnerScope } from "@/lib/auth/resolve-operational-scope";
import { requireHostelBelongsToOwner } from "@/lib/security/scoped-query";
import { expenseService } from "@/lib/services/expense-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


/**
 * 💸 Expenses Collection
 * Access: Owner/Admin only
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const scope = resolveOwnerScope(session);
    const hostelId = req.nextUrl.searchParams.get("hostelId") || undefined;
    await requireHostelBelongsToOwner(scope.owner_id, hostelId);
    if (!hostelId) return apiError("hostelId is required", "HOSTEL_CONTEXT_REQUIRED", 400);
    const expenses = await expenseService.getAllExpenses(scope.owner_id, hostelId);
    return apiResponse(expenses);
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch expenses");
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const scope = resolveOwnerScope(session);
    const body = await req.json();

    if (!body.title || !body.amount || !body.date || !body.category) {
      return apiError("Missing required fields: title, amount, date, category", "VALIDATION_ERROR", 400);
    }

    await requireHostelBelongsToOwner(scope.owner_id, body.hostelId || undefined);

    const expense = await expenseService.createExpense({
      owner_id: scope.owner_id,
      title: body.title,
      amount: Number(body.amount),
      date: body.date,
      category: body.category,
      status: body.status || "paid",
      hostel_id: body.hostelId || undefined, // Phase 4: hostel-scoped expenses
    });
    return apiResponse(expense, 201);
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (msg.startsWith("VALIDATION"))
      return apiError(msg.split(": ")[1] ?? msg, "VALIDATION_ERROR", 400);
    return apiError(msg || "Failed to create expense");
  }
}
