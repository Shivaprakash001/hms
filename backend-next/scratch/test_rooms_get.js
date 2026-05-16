const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const ownerId = '16c27806-03c0-424a-874f-d007ec149954';
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
    
    console.log("Rooms returned by API-like query:");
    console.log(JSON.stringify(rooms, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
test();
