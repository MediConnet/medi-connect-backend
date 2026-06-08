import { randomUUID } from "crypto";
import type { clinics, providers } from "../generated/prisma/client";
import { enum_verification } from "../generated/prisma/client";
import { getPrismaClient } from "../shared/prisma";

const CLINIC_CATEGORY_SLUGS = new Set(["clinic", "clinica"]);

export function isClinicCategorySlug(slug: string | null | undefined): boolean {
  return slug != null && CLINIC_CATEGORY_SLUGS.has(slug);
}

export function isProviderApproved(
  status: string | null | undefined,
): boolean {
  return (
    status === enum_verification.APPROVED ||
    status === "APPROVED"
  );
}

type ResolveOptions = {
  /** Crea fila en `clinics` si hay provider de categoría clínica (default: true) */
  createIfMissing?: boolean;
  /** Activa `clinics.is_active` al crear o al resolver (p. ej. tras aprobación admin) */
  ensureActive?: boolean;
};

/**
 * Resuelve la clínica del usuario autenticado (admin de clínica).
 * Evita 404 cuando el provider existe pero falta la fila en `clinics`.
 */
export async function resolveClinicForAuthUser(
  userId: string,
  options: ResolveOptions = {},
): Promise<{
  clinic: clinics | null;
  provider: providers | null;
}> {
  const prisma = getPrismaClient();
  const createIfMissing = options.createIfMissing !== false;
  const ensureActive = options.ensureActive === true;

  let clinic = await prisma.clinics.findFirst({
    where: { user_id: userId },
  });

  const provider = await prisma.providers.findFirst({
    where: { user_id: userId },
    include: {
      service_categories: { select: { slug: true, name: true } },
      provider_branches: {
        where: { is_main: true },
        take: 1,
      },
    },
  });

  const isClinicProvider = isClinicCategorySlug(
    provider?.service_categories?.slug,
  );

  if (!clinic && createIfMissing && provider && isClinicProvider) {
    const branch = provider.provider_branches?.[0];
    const approved = isProviderApproved(provider.verification_status);

    clinic = await prisma.clinics.create({
      data: {
        id: randomUUID(),
        user_id: userId,
        name: provider.commercial_name || "Clínica",
        address: branch?.address_text || "Dirección no especificada",
        phone: branch?.phone_contact || "0000000000",
        whatsapp: branch?.phone_contact || "0000000000",
        description: provider.description || "",
        is_active: ensureActive || approved,
      },
    });
  }

  if (
    clinic &&
    !clinic.is_active &&
    (ensureActive ||
      (provider && isProviderApproved(provider.verification_status)))
  ) {
    clinic = await prisma.clinics.update({
      where: { id: clinic.id },
      data: { is_active: true },
    });
  }

  return { clinic, provider };
}

/** Activa la clínica del usuario tras aprobación admin */
export async function activateClinicForApprovedProvider(
  userId: string,
): Promise<void> {
  const prisma = getPrismaClient();
  const { clinic } = await resolveClinicForAuthUser(userId, {
    createIfMissing: true,
    ensureActive: true,
  });

  if (clinic) {
    await prisma.clinics.update({
      where: { id: clinic.id },
      data: { is_active: true },
    });
  }
}
