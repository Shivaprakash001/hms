import { NextRequest } from "next/server";
import { apiResponse, apiError } from "@/lib/auth";
import { authService } from "@/lib/services/auth-service";
import { RegisterSchema } from "@/lib/validators";

export const runtime = "nodejs";

/**
 * 📝 AUTH REGISTER — Owner Registration
 * Public endpoint. Only creates Owner/Admin accounts.
 * Students must be invited by an owner.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = RegisterSchema.safeParse(body);

    if (!validated.success) {
      return apiError("Validation error", "VALIDATION_ERROR", 400);
    }

    const profile = await authService.registerOwner(validated.data);

    return apiResponse(profile, 201);
  } catch (error: any) {
    if (error.message.startsWith("ALREADY_EXISTS"))
      return apiError(error.message.split(": ")[1], "ALREADY_EXISTS", 400);
    if (error.message.startsWith("INTERNAL"))
      return apiError(error.message.split(": ")[1], "INTERNAL_ERROR", 500);
    return apiError(error.message || "Registration failed");
  }
}
