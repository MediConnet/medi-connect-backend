import { randomUUID } from "crypto";
import { enum_roles } from "../generated/prisma/client";
import type { getPrismaClient } from "../shared/prisma";

type PrismaClient = ReturnType<typeof getPrismaClient>;

/** Normaliza email para comparaciones y almacenamiento consistente. */
export function normalizeInvitationEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Verifica si ya existe un médico registrado con este correo (insensible a mayúsculas).
 * Requiere usuario provider con categoría de servicio "doctor".
 */
export async function isRegisteredDoctorByEmail(
  prisma: PrismaClient,
  email: string,
): Promise<boolean> {
  const normalizedEmail = normalizeInvitationEmail(email);

  const user = await prisma.users.findFirst({
    where: {
      email: { equals: normalizedEmail, mode: "insensitive" },
    },
    select: { id: true, role: true },
  });

  if (!user || user.role !== enum_roles.provider) {
    return false;
  }

  const doctorProvider = await prisma.providers.findFirst({
    where: {
      user_id: user.id,
      service_categories: { slug: "doctor" },
    },
    select: { id: true },
  });

  return !!doctorProvider;
}

/**
 * Verifica si existe un usuario con este correo que NO es médico.
 * Retorna el rol del usuario si existe y no es doctor, o null si no existe o sí es doctor.
 */
export async function findNonDoctorUserByEmail(
  prisma: PrismaClient,
  email: string,
): Promise<{ id: string; role: string } | null> {
  const normalizedEmail = normalizeInvitationEmail(email);

  const user = await prisma.users.findFirst({
    where: {
      email: { equals: normalizedEmail, mode: "insensitive" },
    },
    select: { id: true, role: true },
  });

  if (!user) return null;
  if (user.role !== enum_roles.provider) return { id: user.id, role: user.role };

  // Es provider — verificar que no sea de categoría "doctor"
  const doctorProvider = await prisma.providers.findFirst({
    where: {
      user_id: user.id,
      service_categories: { slug: "doctor" },
    },
    select: { id: true },
  });

  if (doctorProvider) return null; // Sí es doctor
  return { id: user.id, role: user.role }; // Provider pero no doctor
}

/**
 * Resuelve doctor_exists: usa valor persistido o calcula en tiempo real (invitaciones legacy).
 */
export async function resolveDoctorExists(
  prisma: PrismaClient,
  invitation: { doctor_exists?: boolean | null; email: string },
): Promise<boolean> {
  if (typeof invitation.doctor_exists === "boolean") {
    return invitation.doctor_exists;
  }
  return isRegisteredDoctorByEmail(prisma, invitation.email);
}

/**
 * Asocia un médico autenticado a la clínica de la invitación y marca la invitación como aceptada.
 */
export async function completeClinicInvitationAssociation(
  prisma: PrismaClient,
  invitation: { id: string; clinic_id: string | null; email: string },
  userId: string,
): Promise<{ alreadyAssociated: boolean; clinicId: string }> {
  if (!invitation.clinic_id) {
    throw new Error("Invalid invitation: missing clinic");
  }

  const existingAssociation = await prisma.clinic_doctors.findFirst({
    where: {
      user_id: userId,
      clinic_id: invitation.clinic_id,
    },
  });

  if (existingAssociation) {
    await prisma.doctor_invitations.update({
      where: { id: invitation.id },
      data: { status: "accepted" },
    });
    return { alreadyAssociated: true, clinicId: invitation.clinic_id };
  }

  const provider = await prisma.providers.findFirst({
    where: { user_id: userId },
  });

  if (!provider) {
    throw new Error("Provider profile not found");
  }

  // Desactivar otras asociaciones de clínica activas para este médico
  await prisma.clinic_doctors.updateMany({
    where: {
      user_id: userId,
      clinic_id: { not: invitation.clinic_id },
      is_active: true,
    },
    data: {
      is_active: false,
      updated_at: new Date(),
    },
  });

  await prisma.clinic_doctors.create({
    data: {
      id: randomUUID(),
      clinic_id: invitation.clinic_id,
      user_id: userId,
      is_invited: false,
      is_active: true,
      invitation_token: null,
      invitation_expires_at: null,
    },
  });

  // Cleanup independent doctor schedules and consultation fees
  const branches = await prisma.provider_branches.findMany({
    where: { provider_id: provider.id },
    select: { id: true },
  });
  const branchIds = branches.map((b) => b.id);
  if (branchIds.length > 0) {
    await prisma.provider_schedules.deleteMany({
      where: { branch_id: { in: branchIds } },
    });
  }
  await prisma.consultation_prices.deleteMany({
    where: { provider_id: provider.id },
  });

  await prisma.doctor_invitations.update({
    where: { id: invitation.id },
    data: { status: "accepted" },
  });

  return { alreadyAssociated: false, clinicId: invitation.clinic_id };
}
