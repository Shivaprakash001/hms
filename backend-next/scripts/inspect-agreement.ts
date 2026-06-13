import { prisma } from "../lib/db";

async function main() {
  const docId = "3a016aea-9ba2-4a67-9f31-7d60b0b450c6";
  const agreement = await prisma.agreement.findUnique({
    where: { id: docId },
    include: { tenant: true }
  });
  console.log("Agreement details:", JSON.stringify(agreement, null, 2));
}

main()
  .catch((err) => console.error(err))
  .finally(() => prisma.$disconnect());
