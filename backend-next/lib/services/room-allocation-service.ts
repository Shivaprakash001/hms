import { prisma, supabase } from "../db";
import { eventSystem } from "../events";

export class RoomAllocationService {

  // ✅ FIXED: Added missing method
  async getActiveAllocations(userId: string) {
    return await prisma.roomAllocation.findMany({
      where: {
        student: {
          profile_id: userId
        },
        end_date: null // active allocations
      },
      include: {
        room: true,
        student: true
      },
      orderBy: {
        start_date: "desc"
      }
    });
  }

  // ✅ Allocate Room (RPC based)
  async allocateRoom(data: { studentId: string; roomId: string; startDate: string; ownerId: string }) {
    const { studentId, roomId, startDate, ownerId } = data;

    /**
     * DATABASE-LEVEL ATOMICITY
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

    if (!result?.success) {
      const msg = result?.message || "Room allocation failed";
      throw new Error(`VALIDATION_ERROR: ${msg}`);
    }

    const allocationData = result.data;

    // ✅ Trigger Events
    await eventSystem.trigger("student_allocated_room", {
      student_id: studentId,
      room_id: roomId,
      allocation_id: allocationData.allocation_id,
      owner_id: ownerId
    });

    return allocationData;
  }

  // ✅ End Allocation
  async endAllocation(allocationId: string, endDate: string) {
    return await prisma.roomAllocation.update({
      where: { id: allocationId },
      data: { end_date: new Date(endDate) }
    });
  }

  // ✅ Shift Room
  async shiftRoom(studentId: string, newRoomId: string, shiftDate: string, ownerId: string) {

    // 1. Find active allocation
    const active = await prisma.roomAllocation.findFirst({
      where: { student_id: studentId, end_date: null },
      orderBy: { start_date: "desc" }
    });

    if (!active) {
      throw new Error("NOT_FOUND: No active allocation found for student");
    }

    // 2. Allocate new room (atomic)
    await this.allocateRoom({
      studentId,
      roomId: newRoomId,
      startDate: shiftDate,
      ownerId
    });

    // 3. End old allocation
    await this.endAllocation(active.id, shiftDate);

    return { success: true };
  }
}

// ✅ Singleton export
export const roomAllocationService = new RoomAllocationService();