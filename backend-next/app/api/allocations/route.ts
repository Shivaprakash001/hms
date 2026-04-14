import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { roomAllocationService } from "@/lib/services/room-allocation-service";

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
    const { student_id, room_id, start_date } = body;

    const allocation = await roomAllocationService.allocateRoom(
      student_id,
      room_id,
      new Date(start_date),
      session.sub
    );

    return apiResponse(allocation, 201);
  } catch (error: any) {
    if (error.message.startsWith("BAD_REQUEST")) return apiError(error.message.split(": ")[1], "BAD_REQUEST", 400);
    return apiError(error.message || "Allocation failed");
  }
}
