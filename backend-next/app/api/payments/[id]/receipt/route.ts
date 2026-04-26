export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // Needed for buffer & pdfkit

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

    // Generate the PDF buffer
    const pdfBuffer = await receiptService.generatePdfBuffer(paymentId);

    // Return it as a downloadable file
    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="receipt_${paymentId.substring(0, 8)}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("Error downloading receipt:", error);
    const message = error?.message || "Unknown error";
    const status = message.includes("NOT_FOUND") ? 404 : 500;
    return new NextResponse(JSON.stringify({ error: message }), { status, headers: { 'Content-Type': 'application/json' } });
  }
}
