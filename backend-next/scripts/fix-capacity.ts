import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupOverallocatedRooms() {
  console.log("Checking for overallocated rooms...");
  const rooms = await prisma.room.findMany({
    include: {
      allocations: {
        where: { is_active: true }
      }
    }
  });

  let fixed = 0;
  for (const room of rooms) {
    if (room.allocations.length > room.capacity) {
      console.log(`Room ${room.room_no} (Capacity: ${room.capacity}) has ${room.allocations.length} active allocations.`);
      
      // Sort allocations to keep the oldest ones up to capacity
      const sortedAllocations = room.allocations.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
      
      const toRemove = sortedAllocations.slice(room.capacity);
      
      for (const allocation of toRemove) {
        console.log(`Removing excess allocation ${allocation.id} for tenant ${allocation.tenant_id}`);
        // "Set No Room" approach - drop room ID and make inactive
        await prisma.roomAllocation.update({
          where: { id: allocation.id },
          data: { is_active: false }
        });
        fixed++;
      }
    }
  }

  console.log(`Cleanup complete. Fixed ${fixed} allocations.`);
}

cleanupOverallocatedRooms()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());