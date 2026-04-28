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
    
    // Generates or fetches cached PDF URL
    const result = await invoiceService.generateInvoicePDF(paymentId);
    
    // Redirect directly to PDF so window.open() handles it naturally
    return NextResponse.redirect(result.url, 307);

  } catch (error: any) {
    console.error("Invoice generation failed:", error);
    return apiError(error.message || "Failed to generate invoice rendering");
  }
}
