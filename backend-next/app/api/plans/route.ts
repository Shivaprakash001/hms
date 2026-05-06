export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { apiResponse, apiError } from "@/lib/auth";
import { prisma } from "@/lib/db";


export async function GET() {
  try {
    const plans = await prisma.plan.findMany({
        orderBy: { price_inr: "asc" },
        select: {
          id: true,
          name: true,
          price_inr: true,
          tenant_limit: true,
          hostel_limit: true,
          automation: true,
          multi_hostel: true,
          analytics: true,
          can_generate_receipts: true,
        },
      });

      return apiResponse(
        plans.map((p) => ({
          ...p,
          price: p.price_inr / 100,
          amount_paise: p.price_inr,
          currency: "INR",
          addons_enabled: p.id !== "FREE",
          is_custom_pricing: p.id === "SCALE",
          is_popular: p.id === "GROWTH",
        }))
      );
    } catch (error: any) {
      return apiError(error.message || "Failed to fetch plans");
    }
  }
