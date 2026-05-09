export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { resolveOwnerScope } from "@/lib/auth/resolve-operational-scope";
import { compatibilityPreferencesToPolicyPatch, hostelPolicyService } from "@/lib/services/hostel-policy-service";
import { planGate } from "@/lib/services/plan-gate-service";

const AUTOMATION_PATHS = [
  ["automation", "auto_generate_rent"],
  ["automation", "auto_apply_late_fees"],
  ["automation", "auto_send_reminders"],
] as const;
const STARTER_PATHS = [["tenant_rules", "profile_photo_required"]] as const;

function toApiError(error: any) {
  const msg = String(error?.message || "Failed to process hostel policy");
  if (msg.startsWith("FORBIDDEN")) return apiError(msg.split(":")[1]?.trim() || msg, "FORBIDDEN", 403);
  if (msg.startsWith("NOT_FOUND")) return apiError(msg.split(":")[1]?.trim() || msg, "NOT_FOUND", 404);
  if (msg.startsWith("VALIDATION")) return apiError(msg.split(":")[1]?.trim() || msg, "VALIDATION_ERROR", 400);
  return apiError(msg, "ERROR", 500);
}

function patchEnablesPath(patch: Record<string, any>, path: readonly string[]) {
  let current: any = patch;
  for (const segment of path) {
    if (!current || typeof current !== "object" || !(segment in current)) return false;
    current = current[segment];
  }
  return current === true;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req);
  try {
    const scope = resolveOwnerScope(session);
    const result = await hostelPolicyService.getHostelPolicy(params.id, scope.owner_id);
    return apiResponse(result);
  } catch (error: any) {
    return toApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req);
  try {
    const scope = resolveOwnerScope(session);
    const body = await req.json();
    const patch = body?.policy && typeof body.policy === "object"
      ? body.policy
      : compatibilityPreferencesToPolicyPatch(body);

    if (AUTOMATION_PATHS.some((path) => patchEnablesPath(patch, path))) {
      const hasAutomation = await planGate.hasFeature(scope.owner_id, "automation");
      if (!hasAutomation) {
        return NextResponse.json({
          error: "FEATURE_NOT_AVAILABLE",
          feature: "automation",
          message: "Upgrade to Starter to enable automation",
          upgrade_required: true,
          recommended_plan: "starter",
        }, { status: 402 });
      }
    }

    if (STARTER_PATHS.some((path) => patchEnablesPath(patch, path))) {
      const hasStarterPlus = await planGate.hasFeature(scope.owner_id, "automation");
      if (!hasStarterPlus) {
        return NextResponse.json({
          error: "FEATURE_NOT_AVAILABLE",
          feature: "require_profile_photo_onboarding",
          message: "Upgrade to Starter to require profile photo during onboarding",
          upgrade_required: true,
          recommended_plan: "starter",
        }, { status: 402 });
      }
    }

    const result = await hostelPolicyService.updateHostelPolicy(params.id, scope.owner_id, patch, scope.actor_id);
    return apiResponse(result);
  } catch (error: any) {
    return toApiError(error);
  }
}
