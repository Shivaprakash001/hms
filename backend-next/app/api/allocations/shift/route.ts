export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { roomAllocationService } from "@/lib/services/room-allocation-service";
import { z } from "zod";

const ShiftSchema = z.object({
  tenant_id: z.string().uuid(),
  new_room_id: z.string().uuid(),
  shift_date: z.string().or(z.date()).transform(val => new Date(val))
});

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const body = await req.json();
    const validated = ShiftSchema.safeParse(body);

    if (!validated.success) {
      return apiError("Validation error", "VALIDATION_ERROR", 400);
    }

    const { tenant_id, new_room_id, shift_date } = validated.data;

    // Delegate the complex transactional logic to our established roomAllocationService
    const newAllocation = await roomAllocationService.shiftRoom(
      tenant_id,
      new_room_id,
      shift_date.toISOString(),
      session.sub
    );

    return apiResponse(newAllocation, 201);
  } catch (error: any) {
    const rawMessage = String(error?.message || "Failed to shift tenant room");
    const [maybeCode, ...rest] = rawMessage.split(":");
    const normalizedCode = maybeCode?.trim();
    const normalizedMessage = rest.length > 0 ? rest.join(":").trim() : rawMessage;

    if (normalizedCode === "VALIDATION_ERROR") return apiError(normalizedMessage, "VALIDATION_ERROR", 400);
    if (normalizedCode === "NOT_FOUND") return apiError(normalizedMessage, "NOT_FOUND", 404);
    if (normalizedCode === "CONFLICT") return apiError(normalizedMessage, "CONFLICT", 409);
    
    return apiError(normalizedMessage, "INTERNAL_ERROR", 500);
  }
}
