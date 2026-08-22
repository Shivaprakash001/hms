import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { renewalOfferService } from "@/src/services/tenants/renewal-offer-service";

/**
 * POST — Re-send a renewal offer whose response window lapsed.
 *
 * Same terms, same offer row, fresh expiry — the owner's "Resend" action in
 * the renewal workspace when a tenant let an offer expire without responding.
 * Optional body: `{ offer_expires_at }` to set the new window explicitly
 * (defaults to 15 days out, matching offer creation).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession(req);
    if (!session?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const result = await renewalOfferService.resendOffer(params.id, session.sub, {
      offer_expires_at: body?.offer_expires_at,
    });
    return NextResponse.json({ offer: result });
  } catch (error: any) {
    const status = error.message?.startsWith("NOT_FOUND") ? 404
      : error.message?.startsWith("FORBIDDEN") ? 403
      : error.message?.startsWith("CONFLICT") ? 409
      : error.message?.startsWith("BAD_REQUEST") ? 400 : 500;
    return NextResponse.json({ error: { message: error.message } }, { status });
  }
}
