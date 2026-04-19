import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { expenseService } from "@/lib/services/expense-service";

export const runtime = "nodejs";

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
    const expenses = await expenseService.getAllExpenses(session.sub);
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
    const body = await req.json();
    const expense = await expenseService.createExpense({
      ...body,
      owner_id: session.sub,
      date: new Date(body.date)
    });
    return apiResponse(expense, 201);
  } catch (error: any) {
    return apiError(error.message || "Failed to create expense");
  }
}
