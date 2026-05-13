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
  role:     z.enum(["OWNER", "admin"]).optional(), // frontend sends 'admin' as default
});

export const ChangePasswordSchema = z.object({
  old_password: z.string().min(1),
  new_password: z.string().min(8),
});

// --- Tenant & Enrollment Schemas ---
export const TenantProfileUpdateSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  emergency_contact: z.string().optional(),
  phone_1: z.string().optional(),
  phone_2: z.string().optional(),
  phone_3: z.string().optional(),
  aadhaar_number: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\s+/g, "") || undefined : v),
    z.string().refine((v) => /^\d{12}$/.test(v), "Aadhaar number must be exactly 12 digits").optional()
  ),
  personal_email: z.string().trim().email().optional().nullable(),
  college_name: z.string().optional(),
  roll_number: z.string().optional(),
  course: z.string().optional().nullable(),
  year_of_study: z.union([z.coerce.number().int().min(1).max(6), z.literal(0)]).optional().nullable(),
  section: z.string().optional().nullable(),
  branch: z.string().optional(),
  address: z.string().optional(),
  permanent_address: z.string().optional(),
  temporary_address: z.string().optional(),
  date_of_birth: z.string().optional().nullable(),
  gender: z.enum(["Male", "Female", "Other", "Prefer not to say"]).optional().nullable(),
  profile_type: z.enum(["STUDENT", "WORKING_PROFESSIONAL"]).optional(),
  office_name: z.string().optional().nullable(),
  office_location: z.string().optional().nullable(),
  job_role: z.string().optional().nullable(),
  photo_url: z.string().optional().nullable(),
});

export const ReactivationRequestSchema = z.object({
  notes: z.string().max(500).optional(),
});

// --- Property & Room Schemas ---
export const RoomCreateSchema = z.object({
  room_no: z.string().min(1),
  capacity: z.coerce.number().int().positive(),
  floor: z.coerce.number().int().optional(),
  room_type: z.string().optional(),
  base_rent: z.coerce.number().nonnegative().optional(),
});

export const AllocationSchema = z.object({
  tenant_id: z.string().uuid(),
  room_id: z.string().uuid(),
  start_date: z.string().transform((val) => new Date(val)),
});

// --- Payment & Billing Schemas ---
export const PaymentInitiateSchema = z.object({
  obligation_id: z.string().uuid(),
  amount: z.number().positive(),
  method: z.string().default("UPI"),
});

export const ExpenseCreateSchema = z.object({
  title: z.string().min(3),
  amount: z.number().positive(),
  category: z.string(),
  date: z.string().transform((val) => new Date(val)),
});

// --- Invitation Schemas ---
export const InvitationSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  phone: z.string().optional(),
  room_id: z.string().uuid(),
  monthly_rent: z.number().positive(),
  advance_amount: z.number().min(0).optional(),
  maintenance_amount: z.number().min(0).optional(),
  joining_date: z.string().optional(),            // ISO date string, defaults to today
  maintenance_type: z.enum(["MONTHLY", "ONE_TIME", "NONE"]).optional(), // defaults to hostel billing policy
});

export const ActivationSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
  confirm_password: z.string().min(8),
});
