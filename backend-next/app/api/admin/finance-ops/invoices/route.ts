export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "ADMIN") {
    return apiError("Admin access required", "FORBIDDEN", 403);
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const ownerId = searchParams.get("ownerId") || undefined;
  const q = searchParams.get("q") || undefined;
  const take = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 200);

  try {
    const invoices = await prisma.ownerInvoice.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(ownerId ? { owner_id: ownerId } : {}),
        ...(q ? {
          OR: [
            { id: q },
            { invoice_number: q },
            { attempts: { some: {
              OR: [
                { merchant_txn_id: q },
                { merchant_transaction_id: q },
                { provider_order_id: q },
                { provider_transaction_id: q },
                { provider_reference_id: q },
              ],
            } } },
          ],
        } : {}),
      },
      select: {
        id: true,
        owner_id: true,
        plan_id: true,
        invoice_number: true,
        amount_paise: true,
        status: true,
        billing_month: true,
        due_date: true,
        expires_at: true,
        paid_at: true,
        created_at: true,
        attempts: {
          select: {
            id: true,
            status: true,
            settlement_status: true,
            merchant_txn_id: true,
            merchant_transaction_id: true,
            provider_order_id: true,
            provider_transaction_id: true,
            provider_reference_id: true,
            created_at: true,
            settled_at: true,
          },
          orderBy: { created_at: "desc" },
          take: 3,
        },
      },
      orderBy: { created_at: "desc" },
      take,
    });

    return apiResponse({ invoices });
  } catch (error: any) {
    console.error("[FINANCE_OPS_INVOICES]", error);
    return apiError(error?.message || "Failed to fetch platform invoices");
  }
}
