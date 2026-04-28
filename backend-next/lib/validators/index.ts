import { z } from "zod";

// --- Auth Schemas ---
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(64),
  name: z.string().min(2),
  phone: z.string().optional(),
  hostel_name: z.string().min(2).max(200),
  hostel_phone: z.string().min(10).max(15),
  hostel_address: z.string().min(5).max(500),
  hostel_city: z.string().min(2).max(100),
  hostel_state: z.string().min(2).max(100),
  hostel_pincode: z.string().min(4).max(10),
  upi_id: z.string().max(100).optional(),
  gst_number: z.string().max(30).optional(),
});

export const ChangePasswordSchema = z.object({
  old_password: z.string().min(1),
  new_password: z.string().min(8),
});

// --- Student & Enrollment Schemas ---
export const StudentProfileUpdateSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  emergency_contact: z.string().optional(),
  phone_1: z.string().optional(),
  phone_2: z.string().optional(),
  phone_3: z.string().optional(),
  aadhaar_number: z.string()
    .transform((v) => v.replace(/\s+/g, ""))
    .refine((v) => /^\d{12}$/.test(v), "Aadhaar number must be exactly 12 digits")
    .optional(),
  personal_email: z.string().trim().email().optional().nullable(),
  college_name: z.string().optional(),
  roll_number: z.string().optional(),
  course: z.string().optional().nullable(),
  year_of_study: z.coerce.number().int().min(1).max(6).optional(),
  section: z.string().optional().nullable(),
  branch: z.string().optional(),
  address: z.string().optional(),
  permanent_address: z.string().optional(),
  temporary_address: z.string().optional(),
  gender: z.enum(["Male", "Female", "Other"]).optional().nullable(),
});

export const ReactivationRequestSchema = z.object({
  notes: z.string().max(500).optional(),
});

// --- Property & Room Schemas ---
export const RoomCreateSchema = z.object({
  room_no: z.string().min(1),
  capacity: z.number().int().positive(),
  floor: z.number().int().optional(),
  room_type: z.string().optional(),
});

export const AllocationSchema = z.object({
  student_id: z.string().uuid(),
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
});

export const ActivationSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
  confirm_password: z.string().min(8),
});
