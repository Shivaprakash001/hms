import { prisma } from "../lib/db";

async function main() {
  const keys = Object.keys(prisma);
  console.log("Matching keys:");
  console.log("Agreements:", keys.filter(k => k.toLowerCase().includes("agreement")));
  console.log("Invitations:", keys.filter(k => k.toLowerCase().includes("invitation")));
}

main();
