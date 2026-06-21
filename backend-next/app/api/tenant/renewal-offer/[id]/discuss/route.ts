import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { renewalOfferService } from "@/src/services/tenants/renewal-offer-service";

/** POST — Tenant requests to discuss a renewal offer */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const result = await renewalOfferService.discussOffer(params.id, session.user.id, body.message);
    return NextResponse.json(result);
  } catch (error: any) {
    const status = error.message?.startsWith("NOT_FOUND") ? 404
      : error.message?.startsWith("FORBIDDEN") ? 403
      : error.message?.startsWith("BAD_REQUEST") ? 400 : 500;
    return NextResponse.json({ error: { message: error.message } }, { status });
  }
}
