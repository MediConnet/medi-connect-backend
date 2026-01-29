import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
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
  const clinicDoctor = await prisma.clinic_doctors.findFirst({
    where: { 
      user_id: userId,
      is_active: true,
      is_invited: false // Solo médicos que aceptaron la invitación
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
        }
      }
    }
  });

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
    // Retornar estructura vacía si es nuevo, pero incluir info de clínica si existe
    return successResponse({
      totalAppointments: 0,
      pendingAppointments: 0,
      completedAppointments: 0,
      totalRevenue: 0,
      averageRating: 0,
      totalReviews: 0,
      upcomingAppointments: [],
      provider: null,
      clinic: clinicDoctor && clinicDoctor.clinics ? {
        id: clinicDoctor.clinics.id,
        name: clinicDoctor.clinics.name,
        logoUrl: clinicDoctor.clinics.logo_url,
        address: clinicDoctor.clinics.address,
        phone: clinicDoctor.clinics.phone,
        whatsapp: clinicDoctor.clinics.whatsapp,
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
    },
    clinic: clinicDoctor && clinicDoctor.clinics ? {
      id: clinicDoctor.clinics.id,
      name: clinicDoctor.clinics.name,
      logoUrl: clinicDoctor.clinics.logo_url,
      address: clinicDoctor.clinics.address,
      phone: clinicDoctor.clinics.phone,
      whatsapp: clinicDoctor.clinics.whatsapp,
    } : null,
  });
}