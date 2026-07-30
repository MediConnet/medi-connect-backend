import { admin_settings } from "../generated/prisma/client";

/**
 * Mapea el slug de service_categories del proveedor al campo de comisión
 * correspondiente en admin_settings. Mismo set de slugs que TYPE_TO_SLUG
 * en shared/constants.ts.
 */
const CATEGORY_TO_COMMISSION_FIELD: Record<string, keyof admin_settings> = {
  doctor: "commission_doctor",
  aesthetic: "commission_aesthetic",
  pharmacy: "commission_pharmacy",
  laboratory: "commission_laboratory",
  ambulance: "commission_ambulance",
  clinica: "commission_clinic",
  supplies: "commission_supplies",
};

interface AppointmentForCommission {
  clinic_id?: string | null;
  providers?: {
    service_categories?: { slug?: string | null } | null;
  } | null;
}

/**
 * Resuelve el % de comisión de plataforma para una cita: comisión de
 * clínica si la cita está asociada a una, o la comisión del tipo de
 * proveedor (médico, estética, farmacia, etc.) según service_categories.slug,
 * con fallback a commission_doctor si la categoría no está mapeada.
 */
export function resolveCommissionPercent(
  appointment: AppointmentForCommission,
  settings: admin_settings,
): number {
  if (appointment.clinic_id) {
    return Number(settings.commission_clinic);
  }

  const slug = appointment.providers?.service_categories?.slug;
  const field = (slug && CATEGORY_TO_COMMISSION_FIELD[slug]) || "commission_doctor";
  return Number(settings[field] ?? settings.commission_doctor);
}
