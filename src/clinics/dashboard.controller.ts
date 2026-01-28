import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, successResponse } from '../shared/response';
import { getProfile } from './profile.controller';

// GET /api/clinics/dashboard
export async function getDashboard(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] GET /api/clinics/dashboard - Obteniendo dashboard de clínica');
  console.log('🔍 [CLINICS] Headers recibidos:', {
    authorization: event.headers.authorization ? 'Presente' : 'Ausente',
    Authorization: event.headers.Authorization ? 'Presente' : 'Ausente',
  });
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [CLINICS] GET /api/clinics/dashboard - Error de autenticación/autorización');
    console.error('❌ [CLINICS] Status code:', authResult.statusCode);
    console.error('❌ [CLINICS] Body:', authResult.body);
    return authResult;
  }
  
  const authContext = authResult as AuthContext;
  console.log(`🔍 [CLINICS] Usuario autenticado: ${authContext.user.email} (${authContext.user.role})`);
  const prisma = getPrismaClient();

  try {
    // Buscar clínica del usuario autenticado
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!clinic) {
      console.log('⚠️ [CLINICS] Clínica no encontrada para userId:', authContext.user.id);
      console.log('💡 [CLINICS] Intentando obtener perfil básico...');
      
      // Intentar obtener perfil básico del provider
      try {
        const profileResult = await getProfile(event);
        if (profileResult.statusCode === 200) {
          const profileBody = JSON.parse(profileResult.body);
          const clinicProfile = profileBody.data;
          return successResponse({
            totalDoctors: 0,
            activeDoctors: 0,
            totalAppointments: 0,
            todayAppointments: 0,
            pendingAppointments: 0,
            completedAppointments: 0,
            clinic: clinicProfile,
          });
        }
      } catch (profileError: any) {
        console.error('❌ [CLINICS] Error al obtener perfil:', profileError.message);
      }
      
      // Si no se pudo obtener perfil, retornar valores en 0
      return successResponse({
        totalDoctors: 0,
        activeDoctors: 0,
        totalAppointments: 0,
        todayAppointments: 0,
        pendingAppointments: 0,
        completedAppointments: 0,
        clinic: null,
      });
    }

    // Obtener estadísticas
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalDoctors,
      activeDoctors,
      totalAppointments,
      todayAppointments,
      pendingAppointments,
      completedAppointments,
    ] = await Promise.all([
      // Total de médicos
      prisma.clinic_doctors.count({
        where: { clinic_id: clinic.id },
      }),
      // Médicos activos
      prisma.clinic_doctors.count({
        where: {
          clinic_id: clinic.id,
          is_active: true,
        },
      }),
      // Total de citas (histórico)
      prisma.appointments.count({
        where: { clinic_id: clinic.id },
      }),
      // Citas de hoy
      prisma.appointments.count({
        where: {
          clinic_id: clinic.id,
          scheduled_for: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),
      // Citas pendientes (scheduled o confirmed)
      prisma.appointments.count({
        where: {
          clinic_id: clinic.id,
          status: {
            in: ['CONFIRMED', 'scheduled', 'confirmed'],
          },
        },
      }),
      // Citas completadas (attended)
      prisma.appointments.count({
        where: {
          clinic_id: clinic.id,
          status: 'attended',
        },
      }),
    ]);

    // Obtener perfil completo de la clínica
    const profileResult = await getProfile(event);
    if (profileResult.statusCode !== 200) {
      return profileResult;
    }
    const profileBody = JSON.parse(profileResult.body);
    const clinicProfile = profileBody.data;

    console.log('✅ [CLINICS] Dashboard obtenido exitosamente');
    return successResponse({
      totalDoctors,
      activeDoctors,
      totalAppointments,
      todayAppointments,
      pendingAppointments,
      completedAppointments,
      clinic: clinicProfile,
    });
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al obtener dashboard:`, error.message);
    logger.error('Error getting clinic dashboard', error);
    return internalErrorResponse('Failed to get clinic dashboard');
  }
}
