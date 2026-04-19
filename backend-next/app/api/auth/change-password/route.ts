import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { authService } from "@/lib/services/auth-service";
import { ChangePasswordSchema } from "@/lib/validators";

export const runtime = "nodejs";

/**
 * 🔒 AUTH CHANGE PASSWORD
 * Requires authentication.
 */
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  try {
    const body = await req.json();
    const validated = ChangePasswordSchema.safeParse(body);

    if (!validated.success) {
      return apiError("Validation error", "VALIDATION_ERROR", 400);
    }

    const result = await authService.changePassword(
      session.sub,
      validated.data.old_password,
      validated.data.new_password
    );

    return apiResponse(result);
  } catch (error: any) {
    const msg = String(error?.message ?? error ?? "Password change failed");
    if (msg.startsWith("UNAUTHORIZED"))
      return apiError(msg.split(": ")[1] ?? msg, "UNAUTHORIZED", 401);
    if (msg.startsWith("NOT_FOUND"))
      return apiError(msg.split(": ")[1] ?? msg, "NOT_FOUND", 404);
    return apiError(msg || "Password change failed");
  }
}
