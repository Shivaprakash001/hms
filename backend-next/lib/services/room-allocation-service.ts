import { prisma, supabase } from "../db";
import { eventSystem } from "../events";

export class RoomAllocationService {

  // ✅ FIXED: Added missing method
  async getActiveAllocations(userId: string) {
    return await prisma.roomAllocation.findMany({
      where: {
        student: {
          owner_id: userId
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

  // ✅ Allocate Room (Prisma Transaction based)
  async allocateRoom(data: { studentId: string; roomId: string; startDate: string; ownerId: string }) {
    const { studentId, roomId, startDate, ownerId } = data;

    const allocationData = await prisma.$transaction(async (tx) => {
      // 1. Check if student already has an active allocation
      const existing = await tx.roomAllocation.findFirst({
        where: { student_id: studentId, end_date: null }
      });
      
      if (existing) {
        throw new Error("VALIDATION_ERROR: Student is already allocated to a room and checking out is required first");
      }

      // 2. Check room capacity
      const room = await tx.room.findUnique({
        where: { id: roomId },
        include: {
          allocations: {
            where: { end_date: null }
          }
        }
      });
      
      if (!room) {
        throw new Error("VALIDATION_ERROR: Room not found");
      }
      if (room.allocations.length >= room.capacity) {
        throw new Error("VALIDATION_ERROR: Room is at maximum capacity");
      }

      // 3. Create allocation
      return await tx.roomAllocation.create({
        data: {
          student_id: studentId,
          room_id: roomId,
          start_date: new Date(startDate)
        }
      });
    });

    // ✅ Trigger Events
    await eventSystem.trigger("student_allocated_room", {
      student_id: studentId,
      room_id: roomId,
      allocation_id: allocationData.id,
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