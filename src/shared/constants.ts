import { enum_verification } from "../generated/prisma/client";

// ── Verification status (maps to Prisma enum_verification) ──
export const VERIFICATION_STATUS = enum_verification;

// Payment methods (Prisma enum_payment_method only has CASH, CARD)
export const PAYMENT_METHODS = {
  CASH: "CASH" as const,
  CARD: "CARD" as const,
  TRANSFER: "TRANSFER" as const,
} as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

// ── Reception statuses (no Prisma enum) ──
export const RECEPTION_STATUSES = ["arrived", "not_arrived", "attended"] as const;
export type ReceptionStatus = (typeof RECEPTION_STATUSES)[number];

// ── Consultation types (no Prisma enum) ──
export const CONSULTATION_TYPES = ["presencial", "virtual"] as const;
export type ConsultationType = (typeof CONSULTATION_TYPES)[number];

// ── Bank account types (no Prisma enum) ──
export const BANK_ACCOUNT_TYPES = ["checking", "savings"] as const;
export type BankAccountType = (typeof BANK_ACCOUNT_TYPES)[number];

// ── Pharmacy order statuses (no Prisma enum) ──
export const PHARMACY_ORDER_STATUSES = [
  "pending", "confirmed", "preparing", "ready", "delivered", "cancelled",
] as const;
export type PharmacyOrderStatus = (typeof PHARMACY_ORDER_STATUSES)[number];

// ── Clinic appointment statuses (no Prisma enum; the DB stores different values) ──
export const CLINIC_APPOINTMENT_STATUSES = [
  "scheduled", "confirmed", "attended", "cancelled", "no_show", "pending_confirmation",
] as const;
export type ClinicAppointmentStatus = (typeof CLINIC_APPOINTMENT_STATUSES)[number];

// ── Allowed registration roles (mapped to enum_roles in auth.controller) ──
export const REGISTRATION_ROLES = [
  "PATIENT", "DOCTOR", "PHARMACY", "LABORATORY", "AMBULANCE", "CLINIC", "PROVIDER",
] as const;
export type RegistrationRole = (typeof REGISTRATION_ROLES)[number];

// ── Registration type → service category slug (DB service_categories) ──
export const TYPE_TO_SLUG: Record<string, string> = {
  doctor: "doctor",
  pharmacy: "pharmacy",
  lab: "laboratory",
  laboratory: "laboratory",
  ambulance: "ambulance",
  supplies: "supplies",
  clinic: "clinica",
  clinica: "clinica",
  clinics: "clinica",
};

/** Canonical provider type returned in auth (login/me) for clinic admins. */
export const CLINICS_PROVIDER_TYPE = "clinics" as const;

const CLINIC_AUTH_TYPE_ALIASES = new Set(["clinic", "clinica", "clinics", "clínica"]);

/**
 * Normalizes provider serviceType/tipo in auth responses.
 * Legacy values (clinica, clinic) map to `clinics`; DB slugs stay separate via TYPE_TO_SLUG.
 */
export function normalizeProviderServiceType(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const key = String(value).trim().toLowerCase();
  if (CLINIC_AUTH_TYPE_ALIASES.has(key)) return CLINICS_PROVIDER_TYPE;
  if (key === "lab") return "laboratory";
  return key;
}

// ── User-facing role string → enum_roles ──
export const ROLE_TO_ENUM: Record<string, string> = {
  PATIENT: "patient",
  DOCTOR: "provider",
  PHARMACY: "provider",
  LABORATORY: "provider",
  AMBULANCE: "provider",
  CLINIC: "provider",
  PROVIDER: "provider",
  patient: "patient",
  doctor: "provider",
  provider: "provider",
  admin: "admin",
  user: "user",
};

// ── Payout types ──
export const PAYOUT_TYPES = ["clinic", "doctor"] as const;
export type PayoutType = (typeof PAYOUT_TYPES)[number];
export const PAYOUT_TYPE_CLINIC = "clinic" as const;
export const PAYOUT_TYPE_DOCTOR = "doctor" as const;

// ── Lab category slugs ──
export const LAB_CATEGORY_SLUGS = ["laboratory", "laboratorio"];

// ── Payment status groupings ──
export const DIRECT_PAYMENT_SOURCES = ["admin", "ADMIN", "PAYPHONE", "payphone", "NUVEI", "nuvei"];
export const CHARGED_PAYMENT_STATUSES = ["PAID", "paid", "completed", "COMPLETED"];
export const CARD_METHODS = [PAYMENT_METHODS.CARD, "card", "CREDIT", "DEBIT", "credit", "debit"];
