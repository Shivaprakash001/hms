export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30; // Puppeteer needs more time than default

import { NextResponse } from "next/server";
import { receiptService } from "@/lib/services/receipt-service";
import { authService } from "@/lib/services/auth-service";
import { prisma } from "@/lib/db";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authService.getCurrentUser(req);
    if (!user) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const { id: paymentId } = params;
    const payment = await prisma.payments.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        owner_id: true,
        tenant_id: true,
        hostel_id: true,
        tenant: { select: { profile_id: true, owner_id: true } },
      },
    });
    if (!payment) {
      return new NextResponse(JSON.stringify({ error: "Payment not found" }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    if (user.role === "TENANT") {
      if (payment.tenant?.profile_id !== user.id) {
        return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
    } else if (user.role === "OWNER") {
      if (payment.owner_id !== user.id && payment.tenant?.owner_id !== user.id) {
        return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
      const hostel = await prisma.hostels.findUnique({ where: { id: payment.hostel_id }, select: { owner_id: true } });
      if (!hostel || hostel.owner_id !== user.id) {
        return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
    } else if (user.role !== "ADMIN") {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    // Owners/admins may auto-generate new receipts (plan-gated in service).
    // Tenants can only fetch already-created receipts.
    const canAutoCreateReceipt = ["OWNER", "ADMIN"].includes(user.role);
    const pdfBuffer = await receiptService.generatePdfBuffer(paymentId, {
      autoCreate: canAutoCreateReceipt,
    });

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="receipt_${paymentId.substring(0, 8)}.pdf"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error: any) {
    console.error("Error downloading receipt:", error);
    const message = error?.message || "Unknown error";
    const status = message.includes("NOT_FOUND")
      ? 404
      : message.includes("PLAN_UPGRADE_REQUIRED")
        ? 403
        : 500;
    return new NextResponse(JSON.stringify({ error: message }), { status, headers: { 'Content-Type': 'application/json' } });
  }
}
