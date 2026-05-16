const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const rooms = await prisma.rooms.findMany({
      where: { hostel_id: '6fa62eca-cbb1-4b12-8567-81756608ed38' },
      select: { room_no: true, is_active: true }
    });
    console.log("Rooms in hostel 6fa62eca-cbb1-4b12-8567-81756608ed38:");
    console.log(rooms);
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
run();
