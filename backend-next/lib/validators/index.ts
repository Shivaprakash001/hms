import { z } from "zod";

// --- Auth Schemas ---
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const RegisterSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8).max(64),
  name:     z.string().min(2),
  phone:    z.string().optional(),
  verification_token: z.string().min(1),
  role:     z.enum(["OWNER", "admin"]).optional(), // frontend sends 'admin' as default
});

export const ChangePasswordSchema = z.object({
  old_password: z.string().min(1),
  new_password: z.string().min(8),
});

// --- Tenant & Enrollment Schemas ---
export { 
  TenantProfileUpdateSchema, 
  ReactivationRequestSchema 
} from "../../src/validators/tenants";

// --- Property & Room Schemas ---
// Re-exported from domain validators
export { RoomCreateSchema, AllocationSchema } from "../../src/validators/rooms";

// --- Payment & Billing Schemas ---
export {
  PaymentInitiateSchema,
  ExpenseCreateSchema
} from "../../src/validators/payments";

// --- Invitation Schemas ---
export { 
  InvitationSchema, 
  InvitationUpdateSchema, 
  ActivationSchema 
} from "../../src/validators/tenants";
