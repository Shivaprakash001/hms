export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { activationService } from "@/lib/services/activation-service";

/**
 * GET  /api/owner/me/activation
 *   Returns the full derived activation state from real DB data.
 *   Includes: score, completed steps, missing steps, recommendations, readiness.
 *   Also upserts the last_seen_at timestamp for abandonment detection.
 *
 * PATCH /api/owner/me/activation
 *   Persists an onboarding step server-side.
 *   Body: { step: string, skipped?: boolean, source?: string }
 */

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const [activation, readiness] = await Promise.all([
      activationService.deriveOperationalActivation(session.sub),
      activationService.checkReadiness(session.sub),
    ]);

    // Update last_seen_at silently (fire-and-forget, never fail the response)
    activationService.persistOnboardingStep(
      session.sub,
      activation.operational_state === "FULLY_OPERATIONAL" ? "COMPLETED" : (
        await activationService.getPersistedState(session.sub).then(s => s?.onboarding_step ?? "ACCOUNT_CREATED").catch(() => "ACCOUNT_CREATED")
      ),
    ).catch(() => {});

    return apiResponse({
      ...activation,
      readiness,
    });
  } catch (error: any) {
    console.error("[ACTIVATION GET]", error);
    return apiError(error?.message || "Failed to fetch activation state");
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const body = await req.json();
    const { step, skipped, source, version } = body;

    if (!step || typeof step !== "string") {
      return apiError("step is required", "VALIDATION_ERROR", 400);
    }

    await activationService.persistOnboardingStep(session.sub, step, {
      skipped: Boolean(skipped),
      source:  source ?? undefined,
      version: version ?? "v2",
    });

    // Refresh activation score cache
    const score = await activationService.refreshActivationScore(session.sub);

    return apiResponse({ ok: true, activation_score: score });
  } catch (error: any) {
    console.error("[ACTIVATION PATCH]", error);
    return apiError(error?.message || "Failed to persist onboarding step");
  }
}
