import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { AuthContext, requireAuth } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse } from '../shared/response';
import { parseBody, updatePatientProfileSchema } from '../shared/validators';

// --- GET PROFILE ---
export async function getProfile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PATIENTS] GET /api/patients/profile - Obteniendo perfil del paciente');
  
  const authResult = await requireAuth(event);
  if ('statusCode' in authResult) {
    console.error('❌ [PATIENTS] GET /api/patients/profile - Error de autenticación');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    // Buscar el paciente asociado al usuario
    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
      include: {
        users: {
          select: {
            email: true,
            profile_picture_url: true,
            created_at: true,
          },
        },
      },
    });

    if (!patient) {
      console.log('⚠️ [PATIENTS] Paciente no encontrado, retornando perfil básico del usuario');
      // Si no existe paciente, retornar datos básicos del usuario
      return successResponse({
        id: authContext.user.id,
        email: authContext.user.email,
        profile_picture_url: authContext.user.profile_picture_url,
        full_name: null,
        phone: null,
        identification: null,
        birth_date: null,
        address: null,
        is_patient_created: false,
      });
    }

    console.log('✅ [PATIENTS] Perfil obtenido exitosamente');
    return successResponse({
      id: patient.id,
      email: patient.users?.email || authContext.user.email,
      profile_picture_url: patient.users?.profile_picture_url || null,
      full_name: patient.full_name,
      phone: patient.phone,
      identification: patient.identification,
      birth_date: patient.birth_date ? new Date(patient.birth_date).toISOString().split('T')[0] : null,
      address: patient.address_text,
      is_patient_created: true,
      created_at: patient.users?.created_at,
    });
  } catch (error: any) {
    console.error('❌ [PATIENTS] Error al obtener perfil:', error.message);
    logger.error('Error getting patient profile', error);
    return internalErrorResponse('Failed to get patient profile');
  }
}

// --- UPDATE PROFILE ---
export async function updateProfile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PATIENTS] PUT /api/patients/profile - Actualizando perfil del paciente');
  
  const authResult = await requireAuth(event);
  if ('statusCode' in authResult) {
    console.error('❌ [PATIENTS] PUT /api/patients/profile - Error de autenticación');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const body = parseBody(event.body, updatePatientProfileSchema);

    // Buscar si ya existe un paciente para este usuario
    let patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      // Si no existe, crear uno nuevo
      console.log('📝 [PATIENTS] Creando nuevo registro de paciente');
      const { randomUUID } = await import('crypto');
      
      patient = await prisma.patients.create({
        data: {
          id: randomUUID(),
          user_id: authContext.user.id,
          full_name: body.full_name || '',
          phone: body.phone || null,
          identification: body.identification || null,
          birth_date: body.birth_date ? new Date(body.birth_date) : null,
          address_text: body.address || null,
        },
      });
    } else {
      // Actualizar paciente existente
      console.log('📝 [PATIENTS] Actualizando registro de paciente existente');
      patient = await prisma.patients.update({
        where: { id: patient.id },
        data: {
          full_name: body.full_name !== undefined ? body.full_name : patient.full_name,
          phone: body.phone !== undefined ? body.phone : patient.phone,
          identification: body.identification !== undefined ? body.identification : patient.identification,
          birth_date: body.birth_date !== undefined ? (body.birth_date ? new Date(body.birth_date) : null) : patient.birth_date,
          address_text: body.address !== undefined ? body.address : patient.address_text,
        },
      });
    }

    // Actualizar foto de perfil en users si se proporciona
    if (body.profile_picture_url !== undefined) {
      await prisma.users.update({
        where: { id: authContext.user.id },
        data: {
          profile_picture_url: body.profile_picture_url || null,
        },
      });
    }

    // Obtener datos actualizados
    const updatedPatient = await prisma.patients.findFirst({
      where: { id: patient.id },
      include: {
        users: {
          select: {
            email: true,
            profile_picture_url: true,
          },
        },
      },
    });

    console.log('✅ [PATIENTS] Perfil actualizado exitosamente');
    return successResponse({
      id: updatedPatient!.id,
      email: updatedPatient!.users?.email || authContext.user.email,
      profile_picture_url: updatedPatient!.users?.profile_picture_url || null,
      full_name: updatedPatient!.full_name,
      phone: updatedPatient!.phone,
      identification: updatedPatient!.identification,
      birth_date: updatedPatient!.birth_date ? new Date(updatedPatient!.birth_date).toISOString().split('T')[0] : null,
      address: updatedPatient!.address_text,
      is_patient_created: true,
    });
  } catch (error: any) {
    console.error('❌ [PATIENTS] Error al actualizar perfil:', error.message);
    logger.error('Error updating patient profile', error);
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Failed to update patient profile');
  }
}
