import { z } from "zod";

// --- Auth Schemas ---
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  role: z.enum(["OWNER", "WARDEN", "ADMIN", "STUDENT"]).default("OWNER"),
});

// --- Student & Enrollment Schemas ---
export const StudentProfileUpdateSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  aadhaar_number: z.string().length(12).optional(),
  college_name: z.string().optional(),
  roll_number: z.string().optional(),
  course: z.string().optional(),
  year_of_study: z.number().int().min(1).max(5).optional(),
  permanent_address: z.string().optional(),
  temporary_address: z.string().optional(),
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
