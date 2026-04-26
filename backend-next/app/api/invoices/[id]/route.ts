export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSession, apiError } from "@/lib/auth";
import { invoiceService } from "@/lib/services/invoice-service";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req);
  if (!session) {
    return apiError("Unauthorized", "UNAUTHORIZED", 401);
  }

  try {
    const { id: paymentId } = params;
    
    // Resolve receipt from payment ID since ledger only carries payment
    const receipt = await prisma.receipt.findFirst({
        where: { payment_id: paymentId }
    });

    if (!receipt) {
        return apiError("Receipt has not been generated for this transaction yet.", "NOT_FOUND", 404);
    }
    
    // Generates or fetches cached PDF URL
    const result = await invoiceService.generateInvoicePDF(receipt.id);
    
    // Return standard JSON so frontend handles secure redirect
    return NextResponse.json({ url: result.url });

  } catch (error: any) {
    console.error("Invoice generation failed:", error);
    return apiError(error.message || "Failed to generate invoice rendering");
  }
}
