import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { getPrismaClient } from '../shared/prisma';
import { successResponse } from '../shared/response';

export async function getDashboard(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] GET /api/doctors/dashboard - Obteniendo dashboard');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) return authResult;

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();
  const userId = authContext.user.id;

  // 1. Verificar si el médico está asociado a una clínica
  // IMPORTANTE: Solo buscar médicos que YA aceptaron la invitación (is_invited: false)
  // y que estén activos (is_active: true) y tengan clínica asignada (clinic_id not null)
  let clinicDoctor = await prisma.clinic_doctors.findFirst({
    where: { 
      user_id: userId,
      is_active: true,
      is_invited: false, // Solo médicos que aceptaron la invitación
      clinic_id: { not: null }, // Asegurar que tiene clínica asignada
    },
    include: {
      clinics: {
        select: {
          id: true,
          name: true,
          logo_url: true,
          address: true,
          phone: true,
          whatsapp: true,
        },
      },
      doctor_bank_accounts: true,
    },
  });

  // Determinar si el doctor está realmente asociado a una clínica
  // Solo si clinicDoctor existe, tiene clínica, y está activo
  let isClinicAssociated = clinicDoctor && 
                              clinicDoctor.clinic_id && 
                              clinicDoctor.clinics && 
                              clinicDoctor.is_active && 
                              !clinicDoctor.is_invited;

  // Log para debugging
  if (clinicDoctor) {
    console.log(`🔍 [DOCTORS DASHBOARD] Doctor tiene registro en clinic_doctors:`, {
      clinicId: clinicDoctor.clinic_id,
      isActive: clinicDoctor.is_active,
      isInvited: clinicDoctor.is_invited,
      hasClinic: !!clinicDoctor.clinics,
      isClinicAssociated,
    });
  } else {
    console.log(`🔍 [DOCTORS DASHBOARD] Doctor NO está asociado a ninguna clínica`);
  }

  // Si NO está asociado, verificar si hay invitaciones pendientes y asociar automáticamente
  if (!isClinicAssociated) {
    const user = await prisma.users.findFirst({
      where: { id: userId },
      select: { email: true },
    });

    if (user) {
      const pendingInvitation = await prisma.doctor_invitations.findFirst({
        where: {
          email: user.email,
          status: 'pending',
          expires_at: { gte: new Date() },
        },
        include: {
          clinics: {
            select: {
              id: true,
              name: true,
              logo_url: true,
              address: true,
              phone: true,
              whatsapp: true,
            },
          },
        },
      });

      // Si hay invitación pendiente, asociar automáticamente
      if (pendingInvitation && pendingInvitation.clinic_id) {
        const provider = await prisma.providers.findFirst({
          where: { user_id: userId },
        });

        if (provider) {
          // Verificar que no esté ya asociado
          const existingAssociation = await prisma.clinic_doctors.findFirst({
            where: {
              user_id: userId,
              clinic_id: pendingInvitation.clinic_id,
            },
          });

          if (!existingAssociation) {
            try {
              // Asociar automáticamente
              await prisma.clinic_doctors.create({
                data: {
                  id: randomUUID(),
                  clinic_id: pendingInvitation.clinic_id,
                  user_id: userId,
                  is_invited: false,
                  is_active: true,
                },
              });

              // Marcar invitación como aceptada
              await prisma.doctor_invitations.update({
                where: { id: pendingInvitation.id },
                data: { status: 'accepted' },
              });

              console.log(`✅ [DOCTORS DASHBOARD] Invitación aceptada automáticamente para clínica ${pendingInvitation.clinic_id}`);

              // Re-buscar clinicDoctor después de asociar
              const updatedClinicDoctor = await prisma.clinic_doctors.findFirst({
                where: {
                  user_id: userId,
                  is_active: true,
                  is_invited: false,
                  clinic_id: { not: null },
                },
                include: {
                  clinics: {
                    select: {
                      id: true,
                      name: true,
                      logo_url: true,
                      address: true,
                      phone: true,
                      whatsapp: true,
                    },
                  },
                  doctor_bank_accounts: true,
                },
              });

              // Actualizar variables
              if (updatedClinicDoctor) {
                clinicDoctor = updatedClinicDoctor;
                isClinicAssociated = updatedClinicDoctor.clinic_id &&
                                    updatedClinicDoctor.clinics &&
                                    updatedClinicDoctor.is_active &&
                                    !updatedClinicDoctor.is_invited;
              }
            } catch (error: any) {
              console.error(`❌ [DOCTORS DASHBOARD] Error al asociar automáticamente:`, error.message);
              // Continuar sin bloquear el dashboard
            }
          }
        }
      }
    }
  }

  // 2. Buscar Provider
  const provider = await prisma.providers.findFirst({
    where: { user_id: userId },
    include: {
      provider_branches: {
        select: { id: true, name: true, address_text: true, phone_contact: true, email_contact: true },
      },
      service_categories: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!provider) {
    // Retornar estructura vacía si es nuevo
    // Solo incluir info de clínica si realmente está asociado
    return successResponse({
      totalAppointments: 0,
      pendingAppointments: 0,
      completedAppointments: 0,
      totalRevenue: 0,
      averageRating: 0,
      totalReviews: 0,
      upcomingAppointments: [],
      provider: null,
      clinic: isClinicAssociated && clinicDoctor?.clinics ? {
        id: clinicDoctor.clinics.id || null,
        name: clinicDoctor.clinics.name || null,
        logoUrl: clinicDoctor.clinics.logo_url || null,
        address: clinicDoctor.clinics.address || null, // ⭐ SIEMPRE presente (null si no existe)
        phone: clinicDoctor.clinics.phone || null,
        whatsapp: clinicDoctor.clinics.whatsapp || null,
      } : null,
    });
  }

  // 2. Obtener IDs para calcular revenue (suma de pagos)
  const providerAppointments = await prisma.appointments.findMany({
    where: { provider_id: provider.id },
    select: { id: true },
  });
  const appointmentIds = providerAppointments.map(a => a.id);

  // 3. Consultas Paralelas (Optimización)
  const [
    totalAppointments,
    pendingAppointments,
    completedAppointments,
    totalRevenue,
    averageRating,
    totalReviews,
  ] = await Promise.all([
    prisma.appointments.count({ where: { provider_id: provider.id } }),
    prisma.appointments.count({ where: { provider_id: provider.id, status: 'CONFIRMED' } }),
    prisma.appointments.count({ where: { provider_id: provider.id, status: 'COMPLETED' } }),
    // Suma de pagos
    appointmentIds.length > 0
      ? prisma.payments.aggregate({
          where: { appointment_id: { in: appointmentIds }, status: 'completed' },
          _sum: { provider_amount: true },
        })
      : Promise.resolve({ _sum: { provider_amount: 0 } }),
    // Rating promedio
    prisma.reviews.aggregate({
      where: { provider_branches: { provider_id: provider.id } },
      _avg: { rating: true },
    }),
    // Total Reviews
    prisma.reviews.count({ where: { provider_branches: { provider_id: provider.id } } }),
  ]);

  // 4. Próximas Citas (Top 5)
  const upcomingAppointments = await prisma.appointments.findMany({
    where: {
      provider_id: provider.id,
      status: 'CONFIRMED',
      scheduled_for: { gte: new Date() },
    },
    include: {
      patients: { select: { id: true, full_name: true, phone: true } },
      provider_branches: { select: { id: true, name: true } },
    },
    orderBy: { scheduled_for: 'asc' },
    take: 5,
  });

  // Construir objeto de cuenta bancaria del doctor (si existe)
  const doctorBankAccount = clinicDoctor?.doctor_bank_accounts
    ? {
        bankName: clinicDoctor.doctor_bank_accounts.bank_name,
        accountNumber: clinicDoctor.doctor_bank_accounts.account_number,
        accountType: clinicDoctor.doctor_bank_accounts.account_type,
        accountHolder: clinicDoctor.doctor_bank_accounts.account_holder,
        identificationNumber:
          clinicDoctor.doctor_bank_accounts.identification_number || null,
      }
    : null;

  return successResponse({
    totalAppointments,
    pendingAppointments,
    completedAppointments,
    totalRevenue: Number(totalRevenue._sum?.provider_amount || 0),
    averageRating: Number(averageRating._avg?.rating || 0),
    totalReviews,
    upcomingAppointments: upcomingAppointments.map(apt => ({
      id: apt.id,
      scheduledFor: apt.scheduled_for,
      status: apt.status,
      reason: apt.reason,
      patient: apt.patients ? {
        id: apt.patients.id,
        fullName: apt.patients.full_name,
        phone: apt.patients.phone,
      } : null,
      branch: apt.provider_branches ? {
        id: apt.provider_branches.id,
        name: apt.provider_branches.name,
      } : null,
    })),
    provider: {
      id: provider.id,
      commercial_name: provider.commercial_name,
      description: provider.description,
      logoUrl: provider.logo_url,
      specialty: null, // Placeholder
      category: provider.service_categories,
      branches: provider.provider_branches,
      bankAccount: doctorBankAccount,
    },
    // Solo devolver información de clínica si realmente está asociado
    clinic: isClinicAssociated && clinicDoctor?.clinics ? {
      id: clinicDoctor.clinics.id || null,
      name: clinicDoctor.clinics.name || null,
      logoUrl: clinicDoctor.clinics.logo_url || null,
      address: clinicDoctor.clinics.address || null, // ⭐ SIEMPRE presente (null si no existe)
      phone: clinicDoctor.clinics.phone || null,
      whatsapp: clinicDoctor.clinics.whatsapp || null,
    } : null,
  });
}