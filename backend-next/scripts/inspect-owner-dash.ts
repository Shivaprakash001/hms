import { prisma } from "../lib/db";
import { getRedisClient } from "../lib/redis/client";

async function main() {
  try {
    const owners = await prisma.profile.findMany({
      where: {
        role: "OWNER"
      }
    });
    console.log("=== OWNERS ===");
    console.log(owners.map(o => ({ id: o.id, name: o.name, email: o.email })));

    const hostels = await prisma.hostels.findMany({
      include: {
        profiles: {
          select: { id: true, name: true }
        }
      }
    });
    console.log("\n=== HOSTELS ===");
    console.log(hostels.map(h => ({
      id: h.id,
      name: h.name,
      ownerId: h.owner_id,
      ownerName: h.profiles?.name,
      is_active: h.is_active
    })));

    const { portfolioPerformanceService } = await import("../lib/services/portfolio-performance-service");
    const res = await portfolioPerformanceService.getPortfolioPerformance("0b301633-272e-4856-b9a5-773faf3a58da", 6);
    console.log("\n=== PORTFOLIO PERFORMANCE SERVICE RESULT ===");
    console.log(JSON.stringify(res, null, 2));

    const client = getRedisClient();
    if (client) {
      const pKey = "hms:v1:portfolio:shell:0b301633-272e-4856-b9a5-773faf3a58da:months:6";
      const val = await client.get(pKey);
      console.log("\n=== PORTFOLIO SHELL CACHE VALUE ===");
      console.log(JSON.stringify(val, null, 2));
    }
  } catch (err: any) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
