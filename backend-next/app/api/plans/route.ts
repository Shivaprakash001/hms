export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { apiResponse, apiError } from "@/lib/auth";
import { prisma } from "@/lib/db";


export async function GET() {
  try {
    const plans = await prisma.plan.findMany({
      where: { is_active: true },
      orderBy: { display_order: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        price_paise: true,
        tenant_limit: true,
        hostel_limit: true,
        features: true,
      },
    });

    return apiResponse(
      plans.map((p) => ({
        ...p,
        price: p.price_paise / 100,
        currency: "INR",
        is_popular: p.code === "PRO",
      }))
    );
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch plans");
  }
}
