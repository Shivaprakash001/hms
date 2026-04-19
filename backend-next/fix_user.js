const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const email = "spchidiri2006@gmail.com";
  
  const user = await prisma.profile.findUnique({
    where: { email }
  });

  if (!user) {
    console.log(`User ${email} not found`);
    return;
  }

  console.log(`Found user:`, user);

  if (!user.is_active) {
    const updated = await prisma.profile.update({
      where: { email },
      data: { is_active: true }
    });
    console.log("Updated user to active:", updated);
  } else {
    console.log("User is already active.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
