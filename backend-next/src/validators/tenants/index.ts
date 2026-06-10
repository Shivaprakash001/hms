import { z } from "zod";

export const TenantProfileUpdateSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  verification_token: z.string().optional(),
  emergency_contact: z.string().optional(),
  phone_1: z.string().optional(),
  phone_2: z.string().optional(),
  phone_3: z.string().optional(),
  // aadhaar_number removed - now stored in identification_documents table
  personal_email: z.string().trim().email().optional().nullable(),
  college_name: z.string().optional(),
  roll_number: z.string().optional(),
  course: z.string().optional().nullable(),
  year_of_study: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : val),
    z.union([z.coerce.number().int().min(1).max(6), z.literal(0)]).optional().nullable()
  ),
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

export const InvitationSchema = z.object({
  email: z.string().email().optional().or(z.literal("")).nullable(),
  name: z.string().min(2),
  phone: z.string().min(1),
  room_id: z.string().uuid(),
  monthly_rent: z.number().positive().optional(),
  advance_amount: z.number().min(0).optional(),
  maintenance_amount: z.number().min(0).optional(),
  joining_date: z.string().optional(),            // ISO date string, defaults to today
  maintenance_type: z.enum(["MONTHLY", "ONE_TIME", "NONE"]).optional(), // defaults to hostel billing policy
  payment_frequency: z.enum(["MONTHLY", "QUARTERLY", "HALF_YEARLY", "ACADEMIC_YEARLY", "CUSTOM_INSTALLMENTS"]).optional(),
});

export const InvitationUpdateSchema = z.object({
  email: z.string().email().optional().or(z.literal("")).nullable(),
  name: z.string().min(2),
  phone: z.string().min(1),
  room_id: z.string().uuid(),
  monthly_rent: z.coerce.number().positive(),
  joining_date: z.string().optional(),
  payment_frequency: z.enum(["MONTHLY", "QUARTERLY", "HALF_YEARLY", "ACADEMIC_YEARLY", "CUSTOM_INSTALLMENTS"]).optional(),
});

export const ActivationSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
  confirm_password: z.string().min(8),
});
