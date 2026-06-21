import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { renewalOfferService } from "@/src/services/tenants/renewal-offer-service";

/** POST — Send an offer */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await renewalOfferService.sendOffer(params.id, session.user.id);
    return NextResponse.json({ offer: result });
  } catch (error: any) {
    const status = error.message?.startsWith("NOT_FOUND") ? 404
      : error.message?.startsWith("FORBIDDEN") ? 403
      : error.message?.startsWith("BAD_REQUEST") ? 400 : 500;
    return NextResponse.json({ error: { message: error.message } }, { status });
  }
}
