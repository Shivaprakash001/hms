const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const ownerId = 'c39676a0-c867-4435-9660-a060b8bceab6';
    const hostelId = '6fa62eca-cbb1-4b12-8567-81756608ed38';
    
    const rooms = await prisma.rooms.findMany({
      where: {
        hostels: { owner_id: ownerId },
        is_active: true,
        hostel_id: hostelId,
      },
      include: {
        room_allocations: {
          where: { is_active: true, end_date: null },
        }
      },
      orderBy: { room_no: "asc" }
    });
    
    console.log("Rooms returned for REAL owner:", rooms.length);
    if (rooms.length > 0) {
      console.log("First room:", rooms[0].room_no);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
test();
