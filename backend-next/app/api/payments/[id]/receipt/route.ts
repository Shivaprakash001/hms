export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

import { NextResponse } from "next/server";
import { receiptService } from "@/lib/services/receipt-service";
import { authService } from "@/lib/services/auth-service";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const startTime = Date.now();

  try {
    const user = await authService.getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: paymentId } = params;

    if (!paymentId || paymentId.length < 10) {
      return NextResponse.json({ error: "Invalid payment ID" }, { status: 400 });
    }

    const pdfBuffer = await receiptService.generatePdfBuffer(paymentId);
    const elapsed = Date.now() - startTime;

    console.info(`[receipt.pdf] Generated for payment=${paymentId.slice(0, 8)} in ${elapsed}ms (${(pdfBuffer.length / 1024).toFixed(0)}KB)`);

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdfBuffer.length),
        "Content-Disposition": `inline; filename="receipt-${paymentId.substring(0, 8)}.pdf"`,
        "Cache-Control": "private, max-age=300, stale-while-revalidate=60",
        "X-PDF-Generation-Time": `${elapsed}ms`,
      },
    });
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    const message = error?.message || "Unknown error";

    // Classify error for appropriate status code
    let status = 500;
    if (message.includes("NOT_FOUND")) status = 404;
    else if (message.includes("FORBIDDEN")) status = 403;
    else if (message.includes("timeout") || message.includes("Timeout")) status = 504;

    console.error(`[receipt.pdf] Failed in ${elapsed}ms:`, message);

    return NextResponse.json(
      { error: status === 500 ? "Failed to generate receipt PDF" : message },
      { status }
    );
  }
}
