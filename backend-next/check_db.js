const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function run() {
  const user = await prisma.profile.findFirst();
  console.log("Success! Profile:", user);
}
run().catch(e => { console.error("Error:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
