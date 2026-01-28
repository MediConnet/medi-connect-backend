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

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Doctor validators
const scheduleItemSchema = z.object({
  day: z.string(),
  enabled: z.boolean(),
  startTime: z.string(),
  endTime: z.string(),
});

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

export const createDiagnosisSchema = z.object({
  diagnosis: z.string().min(3, "El diagnóstico es obligatorio (Ej: Faringitis)"),
  treatment: z.string().min(3, "El tratamiento es obligatorio"),
  indications: z.string().min(3, "Las indicaciones son obligatorias"),
  observations: z.string().optional(), // Opcional
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
  reason: z.string().optional(),
});

// Patient validators
export const updatePatientProfileSchema = z.object({
  full_name: z.string().min(1, 'Full name is required').optional(),
  phone: z.string().optional(),
  identification: z.string().optional(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Birth date must be in YYYY-MM-DD format').optional(),
  address: z.string().optional(),
  profile_picture_url: z.string().url('Profile picture URL must be a valid URL').optional().or(z.literal('')),
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

// Pharmacy validators
const pharmacyScheduleItemSchema = z.object({
  day: z.string(),
  enabled: z.boolean(),
  startTime: z.string(),
  endTime: z.string(),
});

export const updatePharmacyProfileSchema = z.object({
  full_name: z.string().min(3, "El nombre es muy corto").optional(),
  bio: z.string().optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  is_published: z.boolean().optional(),
  has_delivery: z.boolean().optional(),
  is_24h: z.boolean().optional(),
  workSchedule: z.array(pharmacyScheduleItemSchema).optional(),
});

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  price: z.number().min(0, 'Price must be positive'),
  is_available: z.boolean().optional().default(true),
  image_url: z.string().url('Image URL must be a valid URL').optional().or(z.literal('')),
  type: z.string().optional().default('product'),
});

export const updateProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').optional(),
  description: z.string().optional(),
  price: z.number().min(0, 'Price must be positive').optional(),
  is_available: z.boolean().optional(),
  image_url: z.string().url('Image URL must be a valid URL').optional().or(z.literal('')),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'], {
    errorMap: () => ({ message: 'Status must be one of: pending, confirmed, preparing, ready, delivered, cancelled' }),
  }),
});

// Helper para extraer ID de la URL
export function extractIdFromPath(path: string, prefix: string, suffix: string = ''): string {
  const start = prefix.length;
  const end = suffix ? path.indexOf(suffix) : path.length;
  if (end === -1 || start >= end) {
    throw new Error('Invalid path format');
  }
  return path.substring(start, end);
}
