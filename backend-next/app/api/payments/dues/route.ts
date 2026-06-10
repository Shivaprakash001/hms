import { ApiResponse } from "@/src/lib/api-response";
import { ApiError } from "@/src/lib/api-error";
import { paymentService } from "@/src/services/payments/payment-service";
import { authService } from "@/lib/services/auth-service";
import { requireHostelBelongsToOwner } from "@/lib/security/scoped-query";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";


export async function GET(req: Request) {
  try {
    const user = await authService.getCurrentUser(req);
    if (!user) {
      return ApiResponse.error(ApiError.unauthorized("Unauthorized"));
    }
    if (!["OWNER", "ADMIN"].includes(user.role)) {
      console.warn(`[payments.dues.GET] Forbidden access attempt by ${user?.role} ${user?.id}`);
      return ApiResponse.error(ApiError.forbidden("Unauthorized"));
    }

    const { searchParams } = new URL(req.url);
    const rentMonth = searchParams.get("rent_month");
    const status = searchParams.get("status");
    const hostelId = searchParams.get("hostelId") || undefined;
    
    if (!hostelId) {
      return ApiResponse.error(new ApiError("hostelId is required", 400, "HOSTEL_CONTEXT_REQUIRED"));
    }

    let ownerId: string;
    if (user.role === "ADMIN") {
      const hostel = await prisma.hostels.findUnique({
        where: { id: hostelId },
        select: { owner_id: true }
      });
      if (!hostel) {
        return ApiResponse.error(ApiError.notFound("Hostel not found"));
      }
      ownerId = hostel.owner_id;
    } else {
      ownerId = user.id;
      await requireHostelBelongsToOwner(ownerId, hostelId);
    }

    const result = await paymentService.getDuesReport(
      ownerId,
      hostelId,
      rentMonth ? new Date(rentMonth) : undefined,
      status || undefined
    );

    return ApiResponse.success(result);
  } catch (error: any) {
    console.error("Detailed API Error [payments.dues.GET]:", error);
    return ApiResponse.error(new ApiError("Internal Server Error", 500));
  }
}
