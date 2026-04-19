import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { expenseService } from "@/lib/services/expense-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


/**
 * 💸 Expense Member
 * Access: Owner/Admin only
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const body = await req.json();
    const expense = await expenseService.updateExpense(params.id, session.sub, body);
    return apiResponse(expense);
  } catch (error: any) {
    return apiError(error.message || "Failed to update expense");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const expense = await expenseService.deleteExpense(params.id, session.sub);
    return apiResponse(expense);
  } catch (error: any) {
    return apiError(error.message || "Failed to delete expense");
  }
}
