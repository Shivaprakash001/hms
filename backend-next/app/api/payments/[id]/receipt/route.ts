export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30; // Puppeteer needs more time than default

import { NextResponse } from "next/server";
import { receiptService } from "@/lib/services/receipt-service";
import { authService } from "@/lib/services/auth-service";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await authService.getCurrentUser(req);
    if (!user) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const { id: paymentId } = params;

    // Generate the PDF buffer via Puppeteer
    const pdfBuffer = await receiptService.generatePdfBuffer(paymentId);

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
    const status = message.includes("NOT_FOUND") ? 404 : 500;
    return new NextResponse(JSON.stringify({ error: message }), { status, headers: { 'Content-Type': 'application/json' } });
  }
}
