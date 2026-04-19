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
    if (error.message.startsWith("UNAUTHORIZED"))
      return apiError(error.message.split(": ")[1], "UNAUTHORIZED", 401);
    if (error.message.startsWith("NOT_FOUND"))
      return apiError(error.message.split(": ")[1], "NOT_FOUND", 404);
    return apiError(error.message || "Password change failed");
  }
}
