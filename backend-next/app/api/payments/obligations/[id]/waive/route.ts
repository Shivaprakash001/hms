import { NextResponse } from "next/server";
import { paymentService } from "@/lib/services/payment-service";
import { authService } from "@/lib/services/auth-service";
import { apiError } from "@/lib/utils/api-utils";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authService.getCurrentUser(req);
    if (!user || user.role !== "OWNER") {
      return apiError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const result = await paymentService.waiveObligation(params.id, user.id);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error waiving obligation:", error);
    const message = String(error?.message ?? error);
    if (message.includes("BAD_REQUEST")) return apiError(message, "BAD_REQUEST", 400);
    return apiError(message, "INTERNAL_ERROR", 500);
  }
}
