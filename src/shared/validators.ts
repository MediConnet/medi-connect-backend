import { z } from 'zod';

import { enum_appt_status } from '../generated/prisma/client';
// Auth validators
export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(['PATIENT', 'DOCTOR', 'PHARMACY', 'LABORATORY', 'AMBULANCE']).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
  code: z.string().min(1, 'Verification code is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const scheduleItemSchema = z.object({
  day: z.string(),
  enabled: z.boolean(),
  startTime: z.string(),
  endTime: z.string(),
});

// Doctor validators
export const updateDoctorProfileSchema = z.object({
  licenseNumber: z.string().optional(),
  specialization: z.string().optional(),
  hospital: z.string().optional(),
  bio: z.string().optional(),
  full_name: z.string().min(3, "El nombre es muy corto").optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  years_of_experience: z.number().int().min(0).optional(),
  consultation_fee: z.number().min(0).optional(),
  specialties: z.array(z.string()).optional(),
  payment_methods: z.array(z.string()).optional(), // Array de strings
  is_published: z.boolean().optional(),
  workSchedule: z.array(scheduleItemSchema).optional(),
});

// --- Validador para actualizar estado de cita ---
export const updateAppointmentStatusSchema = z.object({
  status: z.nativeEnum(enum_appt_status, {
    errorMap: () => ({ message: "Estado inválido. Valores permitidos: CONFIRMED, CANCELLED, COMPLETED" })
  }),
});

// Admin validators
export const approveRequestSchema = z.object({
  notes: z.string().optional(),
});

export const rejectRequestSchema = z.object({
  notes: z.string().optional(),
});

// Generic body parser helper
export function parseBody<T extends z.ZodTypeAny>(body: string | null | undefined, schema: T): z.infer<T> {
  if (!body) {
    throw new Error('Request body is required');
  }

  try {
    const parsed = JSON.parse(body);
    return schema.parse(parsed) as z.infer<T>;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new Error('Invalid JSON in request body');
  }
}
