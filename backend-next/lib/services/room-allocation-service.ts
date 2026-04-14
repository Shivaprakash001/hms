import { prisma, supabase } from "../db";
import { eventSystem } from "../events";

export class RoomAllocationService {
  async allocateRoom(data: { studentId: string; roomId: string; startDate: string; ownerId: string }) {
    const { studentId, roomId, startDate, ownerId } = data;

    /**
     * DATABASE-LEVEL ATOMICITY
     * Preserving original FastAPI behavior by calling the PostgreSQL RPC function.
     * This uses FOR UPDATE locking internally to prevent double-booking.
     */
    const { data: result, error } = await supabase.rpc("allocate_room_safely", {
      p_student_id: studentId,
      p_room_id: roomId,
      p_start_date: startDate,
    });

    if (error) {
      console.error("RPC execution error:", error);
      throw new Error(`RPC_ERROR: ${error.message}`);
    }

    // result follows JSONB format from migrations/008_add_allocation_rpc.sql
    if (!result?.success) {
      const msg = result?.message || "Room allocation failed";
      throw new Error(`VALIDATION_ERROR: ${msg}`);
    }

    const allocationData = result.data;

    // Trigger Side Effects (Hooks)
    await eventSystem.trigger("student_allocated_room", {
      student_id: studentId,
      room_id: roomId,
      allocation_id: allocationData.allocation_id,
      owner_id: ownerId
    });

    return allocationData;
  }

  async endAllocation(allocationId: string, endDate: string) {
    // End allocation logic remains via Prisma or Supabase client
    return await prisma.roomAllocation.update({
      where: { id: allocationId },
      data: { end_date: new Date(endDate) }
    });
  }

  async shiftRoom(studentId: string, newRoomId: string, shiftDate: string, ownerId: string) {
    // 1. Find active allocation
    const active = await prisma.roomAllocation.findFirst({
      where: { student_id: studentId, end_date: null },
      orderBy: { start_date: "desc" }
    });

    if (!active) throw new Error("NOT_FOUND: No active allocation found for student");

    // 2. Perform Atomic Allocation for new room
    // Note: This effectively calls the RPC for the new room's capacity check
    await this.allocateRoom({ 
      studentId, 
      roomId: newRoomId, 
      startDate: shiftDate, 
      ownerId 
    });

    // 3. Mark old as ended
    await this.endAllocation(active.id, shiftDate);

    return { success: true };
  }
}

export const roomAllocationService = new RoomAllocationService();
