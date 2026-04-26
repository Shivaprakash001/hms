export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { roomAllocationService } from "@/lib/services/room-allocation-service";
import { AllocationSchema } from "@/lib/validators";


export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role === "STUDENT") return apiError("Forbidden", "FORBIDDEN", 403);

  try {
    const allocations = await roomAllocationService.getActiveAllocations(session.sub);
    return apiResponse(allocations);
  } catch (error) {
    return apiError("Failed to fetch allocations");
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role === "STUDENT") return apiError("Forbidden", "FORBIDDEN", 403);

  try {
    const body = await req.json();
    const validated = AllocationSchema.safeParse(body);
    
    if (!validated.success) {
      return apiError("Validation error", "VALIDATION_ERROR", 400);
    }

    const { student_id, room_id, start_date } = validated.data;

    const allocation = await roomAllocationService.allocateRoom({
      studentId: student_id,
      roomId: room_id,
      startDate: start_date.toISOString(),
      ownerId: session.sub
    });

    return apiResponse(allocation, 201);
  } catch (error: any) {
    if (error.message.startsWith("VALIDATION_ERROR")) return apiError(error.message.split(": ")[1], "VALIDATION_ERROR", 400);
    if (error.message.startsWith("RPC_ERROR")) return apiError(error.message.split(": ")[1], "RPC_ERROR", 500);
    return apiError(error.message || "Allocation failed");
  }
}
