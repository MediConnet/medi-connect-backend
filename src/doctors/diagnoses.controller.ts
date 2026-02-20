import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, successResponse } from '../shared/response';
import { createDiagnosisSchema, parseBody } from '../shared/validators';

export async function createDiagnosis(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireRole(event, [enum_roles.provider]);
    if ('statusCode' in authResult) return authResult;
    
    const authContext = authResult as AuthContext;
    const prisma = getPrismaClient();

    let appointmentId = event.pathParameters?.id;
    if (!appointmentId && event.requestContext?.http?.path) {
        const pathParts = event.requestContext.http.path.split('/');
        if (pathParts.length >= 2) appointmentId = pathParts[pathParts.length - 2];
    }
    if (!appointmentId) return errorResponse('ID de cita requerido', 400);

    const body = parseBody(event.body, createDiagnosisSchema);

    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
      include: { 
        provider_specialties: {
          include: {
            specialties: {
              select: { name: true }
            }
          },
          take: 1
        }
      }
    });
    if (!provider) return errorResponse('Proveedor no encontrado', 404);

    const appointment = await prisma.appointments.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment || appointment.provider_id !== provider.id) {
      return errorResponse('Cita no encontrada o no autorizada', 404);
    }

    const existingHistory = await prisma.medical_history.findFirst({
        where: { appointment_id: appointmentId }
    });

    const specialtySnapshot = provider.provider_specialties.length > 0 
      ? provider.provider_specialties[0].specialties.name 
      : 'General';
    let resultHistory;

    if (existingHistory) {
        // A) ACTUALIZAR (UPDATE)
        console.log(`🔄 [DIAGNOSIS] Actualizando historial existente: ${existingHistory.id}`);
        resultHistory = await prisma.medical_history.update({
            where: { id: existingHistory.id },
            data: {
                diagnosis: body.diagnosis,
                treatment: body.treatment,
                indications: body.indications,
                observations: body.observations || null,
                updated_at: new Date()
            }
        });
    } else {
        // B) CREAR (CREATE)
        console.log(`✨ [DIAGNOSIS] Creando nuevo historial para cita: ${appointmentId}`);
        resultHistory = await prisma.medical_history.create({
            data: {
                id: randomUUID(),
                patient_id: appointment.patient_id,
                provider_id: provider.id,
                appointment_id: appointmentId,
                
                doctor_name_snapshot: provider.commercial_name || "Dr. Sin Nombre",
                specialty_snapshot: specialtySnapshot,
                
                diagnosis: body.diagnosis,
                treatment: body.treatment,
                indications: body.indications,
                observations: body.observations || null,
                
                date: new Date(),
                created_at: new Date(),
                updated_at: new Date()
            }
        });
    }

    return successResponse({
      success: true,
      message: existingHistory ? 'Diagnóstico actualizado correctamente' : 'Diagnóstico creado correctamente',
      data: resultHistory
    });

  } catch (error) {
    console.error('❌ [DIAGNOSIS] Error:', error);
    const message = error instanceof Error ? error.message : 'Error interno';
    return errorResponse(message, 500);
  }
}

export async function getDiagnosis(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireRole(event, [enum_roles.provider]);
    if ('statusCode' in authResult) return authResult;
    const prisma = getPrismaClient();

    let appointmentId = event.pathParameters?.id;
    if (!appointmentId && event.requestContext?.http?.path) {
        const pathParts = event.requestContext.http.path.split('/');
        if (pathParts.length >= 2) appointmentId = pathParts[pathParts.length - 2];
    }
    if (!appointmentId) return errorResponse('ID de cita requerido', 400);

    const diagnosis = await prisma.medical_history.findFirst({
      where: { appointment_id: appointmentId }
    });

    if (!diagnosis) {
      return errorResponse('Diagnóstico no encontrado', 404);
    }

    return successResponse(diagnosis);

  } catch (error) {
    console.error('❌ [DIAGNOSIS GET] Error:', error);
    return internalErrorResponse('Error al obtener diagnóstico');
  }
}