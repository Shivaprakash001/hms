import { prisma } from "../lib/db";

async function main() {
  const events = await (prisma as any).paymentAttemptStatusEvent.findMany({
    take: 10,
    orderBy: { created_at: "desc" },
  });
  console.log("Recent status events:", JSON.stringify(events, null, 2));
}

main().catch(console.error);
