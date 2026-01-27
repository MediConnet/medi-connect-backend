import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, successResponse } from '../shared/response';

export async function getPatients(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] GET /api/doctors/patients - Obteniendo pacientes');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) return authResult;
  
  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  const provider = await prisma.providers.findFirst({
    where: { user_id: authContext.user.id },
  });

  if (!provider) return errorResponse('Proveedor no encontrado', 404);

  // Obtener pacientes únicos que han tenido citas con este doctor
  const patientsData = await prisma.appointments.findMany({
    where: { provider_id: provider.id },
    select: {
      patients: {
        select: {
          id: true,
          full_name: true,
          phone: true,
          birth_date: true,
          users: {
            select: {
              email: true
            }
          }
        }
      }
    },
    distinct: ['patient_id']
  });

  // Limpiar y aplanar la estructura para el frontend
  const cleanPatients = patientsData
    .map(p => p.patients)
    .filter(p => p !== null)
    .map(patient => ({
        id: patient.id,
        full_name: patient.full_name,
        phone: patient.phone,
        birth_date: patient.birth_date,
        email: patient.users?.email || null, 
    }));

  return successResponse({ patients: cleanPatients });
}