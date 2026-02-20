import { z } from 'zod';

import { enum_appt_status } from '../generated/prisma/client';

const emptyStringToUndefined = (val: unknown) =>
  val === '' || val === null ? undefined : val;

const digitsOnlyOrUndefined = (val: unknown) => {
  if (val === '' || val === null || val === undefined) return undefined;
  if (typeof val !== 'string') return val;
  const digits = val.replace(/\D/g, '');
  return digits.length === 0 ? undefined : digits;
};
// Auth validators
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  
  // Datos del Representante / Persona
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  name: z.string().optional(), // Fallback
  
  // Datos del Negocio
  serviceName: z.string().optional(), 
  
  // Nuevo campo
  yearsOfExperience: z.union([z.string(), z.number()]).optional(),
  specialties: z.array(z.string()).optional(),

  phone: z.string().optional(),
  role: z.enum(['PATIENT', 'DOCTOR', 'PHARMACY', 'LABORATORY', 'AMBULANCE', 'CLINIC', 'PROVIDER']).optional(),
  address: z.string().optional(),
  cityId: z.string().uuid().optional(),
  city: z.string().optional(),
  description: z.string().optional(),
  price: z.union([z.string(), z.number()]).optional(),
  chainId: z.string().optional(),
  type: z.string().optional(),
  invitationToken: z.string().optional(), // Token de invitación de clínica
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  // Tipo de servicio opcional (doctor, pharmacy, laboratory, ambulance, supplies, clinic, etc.)
  type: z.string().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Doctor validators
const timeHHMMNullable = z
  .string()
  .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:mm format')
  .nullable();

const scheduleItemSchema = z
  .object({
    day: z.string(),
    enabled: z.boolean(),
    startTime: timeHHMMNullable,
    endTime: timeHHMMNullable,

    // Break time (almuerzo) - enviar ambos o ninguno
    breakStart: timeHHMMNullable.optional(),
    breakEnd: timeHHMMNullable.optional(),
  })
  .refine((v) => !v.enabled || (!!v.startTime && !!v.endTime), {
    message: 'startTime y endTime son requeridos cuando enabled=true',
    path: ['startTime'],
  })
  .refine(
    (v) =>
      (v.breakStart == null && v.breakEnd == null) ||
      (v.breakStart != null && v.breakEnd != null),
    {
      message: 'breakStart y breakEnd deben enviarse juntos o ambos null',
      path: ['breakStart'],
    },
  );

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

// Doctor Bank Account validators
export const doctorBankAccountSchema = z.object({
  bankName: z.string().min(1, 'Bank name is required'),
  accountNumber: z.string()
    .min(10, 'Account number must be at least 10 digits')
    .regex(/^\d+$/, 'Account number must contain only digits'),
  accountType: z.enum(['checking', 'savings'], {
    errorMap: () => ({ message: 'Account type must be checking or savings' }),
  }),
  accountHolder: z.string().min(1, 'Account holder is required'),
  identificationNumber: z.string()
    .min(10, 'Identification number must be at least 10 digits')
    .max(13, 'Identification number must be at most 13 digits')
    .regex(/^\d+$/, 'Identification number must contain only digits')
    .optional(),
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
      const formatted = error.errors
        .map((e) => {
          const path = e.path?.length ? e.path.join('.') : '(root)';
          return `${path}: ${e.message}`;
        })
        .join(', ');
      throw new Error(`Validation error: ${formatted}`);
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

// Clinic validators
const dayScheduleSchema = z.object({
  enabled: z.boolean(),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be in HH:mm format'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be in HH:mm format'),
  breakStart: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Break start time must be in HH:mm format').nullable().optional(),
  breakEnd: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Break end time must be in HH:mm format').nullable().optional(),
});

export const clinicScheduleSchema = z.object({
  monday: dayScheduleSchema,
  tuesday: dayScheduleSchema,
  wednesday: dayScheduleSchema,
  thursday: dayScheduleSchema,
  friday: dayScheduleSchema,
  saturday: dayScheduleSchema,
  sunday: dayScheduleSchema,
});

// Schema para precios por especialidad
const consultationPriceSchema = z.object({
  specialty: z.string().min(1, 'Specialty is required'),
  price: z.coerce.number().min(0, 'Price must be >= 0'),
  isActive: z.coerce.boolean(),
});

// Schema para datos bancarios
const bankAccountSchema = z.object({
  bankName: z.string().min(1, 'Bank name is required'),
  accountNumber: z.coerce.string().min(10, 'Account number must be at least 10 digits'),
  accountType: z.enum(['checking', 'savings'], {
    errorMap: () => ({ message: 'Account type must be checking or savings' }),
  }),
  accountHolder: z.string().min(1, 'Account holder is required'),
  identificationNumber: z.coerce.string().min(10, 'Identification number must be at least 10 digits').max(13, 'Identification number must be at most 13 digits'),
});

export const updateClinicProfileSchema = z.object({
  name: z.preprocess(
    emptyStringToUndefined,
    z.string().min(3, 'Name must be at least 3 characters').optional(),
  ).optional(),
  // Aceptar null (no enviar / sin cambios), string vacío (limpiar), URL o data:image (cuando se sube base64 desde frontend)
  logoUrl: z.preprocess(
    (val) => (val === null ? undefined : val),
    z
      .union([
        z.literal(''),
        z.string().url('Logo URL must be a valid URL'),
        z.string().startsWith('data:image/', 'Logo must be a valid URL or base64 image'),
      ])
      .optional(),
  ),
  specialties: z
    .preprocess(
      (val) => {
        if (val === null || val === undefined) return undefined;
        if (Array.isArray(val) && val.length === 0) return undefined;
        return val;
      },
      z
        .array(
          z.union([
            z.string(),
            z.object({ name: z.string().optional(), id: z.string().optional() }),
          ]),
        )
        .min(1, 'At least one specialty is required')
        .optional(),
    )
    .transform((arr) =>
      (arr as any[]).map((x) => (typeof x === 'string' ? x : x?.name || x?.id)).filter(Boolean),
    )
    .optional(),
  address: z.preprocess(
    emptyStringToUndefined,
    z.string().min(5, 'Address must be at least 5 characters').optional(),
  ).optional(),
  phone: z.preprocess(
    digitsOnlyOrUndefined,
    z.string().regex(/^\d{9,10}$/, 'Phone must be 9-10 digits').optional(),
  ).optional(),
  whatsapp: z.preprocess(
    digitsOnlyOrUndefined,
    z.string().regex(/^\d{9,10}$/, 'WhatsApp must be 9-10 digits').optional(),
  ).optional(),
  description: z.preprocess(
    emptyStringToUndefined,
    z.string().min(10, 'Description must be at least 10 characters').optional(),
  ).optional(),
  generalSchedule: clinicScheduleSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  latitude: z.preprocess(
    (val) => (val === '' || val === undefined ? undefined : val),
    z
      .union([
        z
          .coerce.number()
          .min(-90, 'Latitude must be between -90 and 90')
          .max(90, 'Latitude must be between -90 and 90'),
        z.null(),
      ])
      .optional(),
  ).optional(),
  longitude: z.preprocess(
    (val) => (val === '' || val === undefined ? undefined : val),
    z
      .union([
        z
          .coerce.number()
          .min(-180, 'Longitude must be between -180 and 180')
          .max(180, 'Longitude must be between -180 and 180'),
        z.null(),
      ])
      .optional(),
  ).optional(),
  consultationPrices: z.preprocess(
    (val) => (val === null ? undefined : val),
    z.array(consultationPriceSchema).optional(),
  ).optional(),
  bankAccount: bankAccountSchema.optional().nullable(),
});

export const inviteDoctorSchema = z.object({
  email: z.string().email('Invalid email format'),
  // ❌ name y specialty ya no se envían en la invitación - se completan al aceptar
});

const validSpecialties = [
  'Medicina General',
  'Cardiología',
  'Dermatología',
  'Ginecología',
  'Pediatría',
  'Oftalmología',
  'Traumatología',
  'Neurología',
  'Psiquiatría',
  'Urología',
  'Endocrinología',
  'Gastroenterología',
  'Neumología',
  'Otorrinolaringología',
  'Oncología',
  'Reumatología',
  'Nefrología',
  'Cirugía General',
  'Anestesiología',
  'Odontología',
] as const;

export const acceptInvitationSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  specialty: z.string().min(1, 'Specialty is required')
    .refine((val) => validSpecialties.includes(val as any), {
      message: `Specialty must be one of: ${validSpecialties.join(', ')}`,
    }),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(), // Opcional para usuarios ya registrados
  phone: z.string().regex(/^\d{10}$/, 'Phone must be exactly 10 digits').optional(),
  whatsapp: z.string().regex(/^\d{10}$/, 'WhatsApp must be exactly 10 digits').optional(),
});

export const updateDoctorStatusSchema = z.object({
  isActive: z.boolean(),
});

export const updateDoctorOfficeSchema = z.object({
  officeNumber: z.string().optional(),
});

export const updateAppointmentStatusClinicSchema = z.object({
  status: z.enum(['scheduled', 'confirmed', 'attended', 'cancelled', 'no_show'], {
    errorMap: () => ({ message: 'Status must be one of: scheduled, confirmed, attended, cancelled, no-show' }),
  }),
});

export const updateReceptionStatusSchema = z.object({
  receptionStatus: z.enum(['arrived', 'not_arrived', 'attended'], {
    errorMap: () => ({ message: 'Reception status must be one of: arrived, not_arrived, attended' }),
  }),
  receptionNotes: z.string().optional(),
});

export const updateDoctorScheduleSchema = z.object({
  schedule: clinicScheduleSchema,
});

// Clinic Associated Doctor validators
export const updateClinicProfileDoctorSchema = z.object({
  specialty: z.string().optional(),
  experience: z.number().int().min(0).max(50).optional(), // Años de experiencia (0-50)
  bio: z.string().max(2000, 'Bio must be less than 2000 characters').optional(),
  education: z.array(z.string()).optional(), // Array de estudios
  certifications: z.array(z.string()).optional(), // Array de certificaciones
  officeNumber: z.string().optional(),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be exactly 10 digits').optional(),
  whatsapp: z.string().regex(/^\d{10}$/, 'WhatsApp must be exactly 10 digits').optional(),
  profileImageUrl: z.string().url('Profile image URL must be a valid URL').optional().or(z.literal('')),
});

// Schema para clínica enviando mensaje a médico (requiere doctorId)
export const createReceptionMessageSchema = z.object({
  doctorId: z.string().uuid('Invalid doctor ID format'), // ⭐ Requerido para clínica
  message: z.string().min(1, 'Message is required').max(1000, 'Message too long'),
});

// Schema para médico enviando mensaje (solo message, doctorId se obtiene del contexto)
export const createReceptionMessageDoctorSchema = z.object({
  message: z.string().min(1, 'Message is required').max(1000, 'Message too long'),
});

export const markReceptionMessagesReadSchema = z.object({
  messageIds: z.array(z.string().uuid('Invalid message ID format')).min(1, 'At least one message ID is required'),
});

// ⭐ Pharmacy Chains Validators
export const createPharmacyChainSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  logoUrl: z.string().url('Logo URL must be a valid URL').or(z.string().startsWith('data:image/', 'Logo must be a valid URL or base64 image')).optional().nullable(),
  description: z.string().max(2000, 'Description too long').optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updatePharmacyChainSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long').optional(),
  logoUrl: z.string().url('Logo URL must be a valid URL').or(z.string().startsWith('data:image/', 'Logo must be a valid URL or base64 image')).optional().nullable(),
  description: z.string().max(2000, 'Description too long').optional().nullable(),
  isActive: z.boolean().optional(),
});

export const requestDateBlockSchema = z.object({
  date: z.string().datetime('Invalid date format'),
  reason: z.string().optional(),
});

// Review validators
export const createReviewSchema = z.object({
  branch_id: z.string().min(1, 'Branch ID is required'),
  rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
  comment: z.string().optional().nullable(),
  appointment_id: z.string().uuid('Appointment ID must be a valid UUID').optional().nullable(),
});

// Doctor review validators (simplified, branch_id is obtained from doctor)
export const createDoctorReviewSchema = z.object({
  rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
  comment: z.string().optional().nullable(),
  appointment_id: z.string().uuid('Appointment ID must be a valid UUID').optional().nullable(),
});

// Appointment validators
export const createAppointmentSchema = z.object({
  doctorId: z.string().uuid('Doctor ID must be a valid UUID'),
  clinicId: z.string().uuid('Clinic ID must be a valid UUID').optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format'),
  type: z.enum(['presencial', 'virtual'], {
    errorMap: () => ({ message: 'Type must be either "presencial" or "virtual"' }),
  }).optional().default('presencial'),
  reason: z.string().min(1, 'Reason is required'),
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER'], {
    errorMap: () => ({ message: 'Payment method must be CASH, CARD, or TRANSFER' }),
  }).optional().default('CASH'),
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

/**
 * Valida que un tiempo esté en intervalos de 30 minutos (:00 o :30)
 * @param time - Tiempo en formato HH:mm
 * @returns true si es válido, false si no
 */
export function isValid30MinuteInterval(time: string | null | undefined): boolean {
  if (!time) return true; // null/undefined son válidos (campos opcionales)
  
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
  const match = time.match(timeRegex);
  
  if (!match) return false; // Formato inválido
  
  const minutes = parseInt(match[2], 10);
  return minutes === 0 || minutes === 30;
}

/**
 * Valida que todos los tiempos en un objeto estén en intervalos de 30 minutos
 * @param times - Objeto con propiedades de tiempo
 * @returns Error message si hay tiempos inválidos, null si todo está bien
 */
export function validate30MinuteIntervals(times: Record<string, string | null | undefined>): string | null {
  const invalidTimes: string[] = [];
  
  for (const [key, value] of Object.entries(times)) {
    if (value && !isValid30MinuteInterval(value)) {
      invalidTimes.push(key);
    }
  }
  
  if (invalidTimes.length > 0) {
    return `Los siguientes horarios deben estar en intervalos de 30 minutos (:00 o :30): ${invalidTimes.join(', ')}`;
  }
  
  return null;
}
