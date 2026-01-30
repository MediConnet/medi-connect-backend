import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse } from '../shared/response';
import { parseBody, inviteDoctorSchema, updateDoctorStatusSchema, updateDoctorOfficeSchema, extractIdFromPath } from '../shared/validators';
import { createHash, randomBytes } from 'crypto';

// GET /api/clinics/doctors
export async function getDoctors(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] GET /api/clinics/doctors - Obteniendo lista de médicos');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [CLINICS] GET /api/clinics/doctors - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};

  try {
    // Buscar clínica del usuario autenticado
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!clinic) {
      console.error('❌ [CLINICS] Clínica no encontrada');
      return notFoundResponse('Clinic not found');
    }

    // Filtro por estado
    const status = queryParams.status || 'all';
    const where: any = { clinic_id: clinic.id };
    
    if (status === 'active') {
      where.is_active = true;
    } else if (status === 'inactive') {
      where.is_active = false;
    }

    // Obtener médicos
    const doctors = await prisma.clinic_doctors.findMany({
      where,
      orderBy: {
        created_at: 'desc',
      },
    });

    console.log(`✅ [CLINICS] Médicos obtenidos exitosamente (${doctors.length} médicos)`);
    return successResponse(
      doctors.map((doctor) => ({
        id: doctor.id,
        clinicId: doctor.clinic_id,
        userId: doctor.user_id,
        email: doctor.email,
        name: doctor.name || null,
        specialty: doctor.specialty || null,
        isActive: doctor.is_active ?? true,
        isInvited: doctor.is_invited ?? false,
        invitationToken: doctor.invitation_token || null,
        invitationExpiresAt: doctor.invitation_expires_at?.toISOString() || null,
        officeNumber: doctor.office_number || null,
        profileImageUrl: doctor.profile_image_url || null,
        phone: doctor.phone || null,
        whatsapp: doctor.whatsapp || null,
        createdAt: doctor.created_at?.toISOString() || null,
        updatedAt: doctor.updated_at?.toISOString() || null,
      }))
    );
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al obtener médicos:`, error.message);
    logger.error('Error getting doctors', error);
    return internalErrorResponse('Failed to get doctors');
  }
}

// POST /api/clinics/doctors/invite
export async function inviteDoctor(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] POST /api/clinics/doctors/invite - Invitando médico');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [CLINICS] POST /api/clinics/doctors/invite - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const body = parseBody(event.body, inviteDoctorSchema);
    
    // Log para debugging
    console.log(`🔍 [CLINICS] Datos recibidos para invitar médico:`, {
      email: body.email,
    });

    // Buscar clínica del usuario autenticado
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!clinic) {
      console.error('❌ [CLINICS] Clínica no encontrada');
      return notFoundResponse('Clinic not found');
    }

    // Verificar que el email no esté ya registrado en esta clínica
    const existingDoctor = await prisma.clinic_doctors.findFirst({
      where: {
        clinic_id: clinic.id,
        email: body.email,
      },
    });

    if (existingDoctor) {
      // Si el doctor ya aceptó la invitación (is_invited: false), no permitir re-invitar
      if (!existingDoctor.is_invited) {
        console.error(`❌ [CLINICS] El email ${body.email} ya está registrado y activo en esta clínica`);
        return errorResponse('Email already registered and active in this clinic', 400);
      }
      
      // Si el doctor está invitado pero no ha aceptado (is_invited: true), actualizar la invitación
      console.log(`⚠️ [CLINICS] El email ${body.email} ya tiene una invitación pendiente. Actualizando invitación...`);
      
      // Generar nuevo token y fecha de expiración
      const invitationToken = randomBytes(32).toString('base64url');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expira en 7 días
      
      // Actualizar invitación existente y registro de médico
      const result = await prisma.$transaction(async (tx) => {
        // Actualizar invitación existente
        const existingInvitation = await tx.doctor_invitations.findFirst({
          where: {
            clinic_id: clinic.id,
            email: body.email,
            status: 'pending',
          },
        });
        
        if (existingInvitation) {
          await tx.doctor_invitations.update({
            where: { id: existingInvitation.id },
            data: {
              invitation_token: invitationToken,
              expires_at: expiresAt,
              status: 'pending',
            },
          });
        } else {
          // Crear nueva invitación si no existe
          await tx.doctor_invitations.create({
            data: {
              id: randomUUID(),
              clinic_id: clinic.id,
              email: body.email,
              invitation_token: invitationToken,
              expires_at: expiresAt,
              status: 'pending',
            },
          });
        }
        
        // Actualizar registro de médico con nuevo token (NO actualizar name ni specialty)
        const updatedDoctor = await tx.clinic_doctors.update({
          where: { id: existingDoctor.id },
          data: {
            // ❌ NO actualizar name ni specialty - se completarán al aceptar
            invitation_token: invitationToken,
            invitation_expires_at: expiresAt,
            updated_at: new Date(),
          },
        });
        
        return { doctor: updatedDoctor, invitationToken, expiresAt };
      });
      
      console.log(`✅ [CLINICS] Invitación actualizada exitosamente: ${body.email}`);
      return successResponse(
        {
          id: existingDoctor.id,
          clinicId: clinic.id,
          email: body.email,
          invitationToken: result.invitationToken,
          expiresAt: result.expiresAt.toISOString(),
          status: 'pending',
          message: 'Invitation updated successfully',
          invitationLink: `https://app.mediconnect.com/clinic/invite?token=${result.invitationToken}`,
        },
        200
      );
    }

    // Generar token único y seguro (256 bits)
    const invitationToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expira en 7 días

    // TRANSACCIÓN: Crear invitación y registro de médico
    const result = await prisma.$transaction(async (tx) => {
      // Crear registro en doctor_invitations
      const invitation = await tx.doctor_invitations.create({
        data: {
          id: randomUUID(),
          clinic_id: clinic.id,
          email: body.email,
          invitation_token: invitationToken,
          expires_at: expiresAt,
          status: 'pending',
        },
      });

      // Crear registro en clinic_doctors (name y specialty = NULL)
      const doctor = await tx.clinic_doctors.create({
        data: {
          id: randomUUID(),
          clinic_id: clinic.id,
          email: body.email,
          name: null, // ⭐ NULL - se completará al aceptar
          specialty: null, // ⭐ NULL - se completará al aceptar
          is_invited: true,
          is_active: true,
          invitation_token: invitationToken,
          invitation_expires_at: expiresAt,
        },
      });

      return { invitation, doctor };
    });

    // TODO: Enviar email con link de invitación
    // const invitationLink = `https://app.mediconnect.com/clinic/invite?token=${invitationToken}`;
    // await sendInvitationEmail(body.email, clinic.name, invitationLink);

    console.log(`✅ [CLINICS] Médico invitado exitosamente: ${body.email}`);
    return successResponse(
      {
        id: result.invitation.id,
        clinicId: clinic.id,
        email: body.email,
        invitationToken: invitationToken,
        expiresAt: expiresAt.toISOString(),
        status: 'pending',
        createdAt: result.invitation.created_at?.toISOString() || null,
        invitationLink: `https://app.mediconnect.com/clinic/invite?token=${invitationToken}`,
      },
      201
    );
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al invitar médico:`, error.message);
    logger.error('Error inviting doctor', error);
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Failed to invite doctor');
  }
}

// PATCH /api/clinics/doctors/:doctorId/status
export async function updateDoctorStatus(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] PATCH /api/clinics/doctors/{id}/status - Actualizando estado de médico');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [CLINICS] PATCH /api/clinics/doctors/{id}/status - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const doctorId = extractIdFromPath(event.requestContext.http.path, '/api/clinics/doctors/', '/status');
    const body = parseBody(event.body, updateDoctorStatusSchema);

    // Buscar clínica del usuario autenticado
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!clinic) {
      console.error('❌ [CLINICS] Clínica no encontrada');
      return notFoundResponse('Clinic not found');
    }

    // Verificar que el médico pertenece a la clínica
    const doctor = await prisma.clinic_doctors.findFirst({
      where: {
        id: doctorId,
        clinic_id: clinic.id,
      },
    });

    if (!doctor) {
      console.error(`❌ [CLINICS] Médico no encontrado: ${doctorId}`);
      return notFoundResponse('Doctor not found');
    }

    // Actualizar estado
    const updatedDoctor = await prisma.clinic_doctors.update({
      where: { id: doctorId },
      data: {
        is_active: body.isActive,
        updated_at: new Date(),
      },
    });

    console.log(`✅ [CLINICS] Estado de médico actualizado: ${doctorId}`);
    return successResponse({
      id: updatedDoctor.id,
      isActive: updatedDoctor.is_active,
      updatedAt: updatedDoctor.updated_at?.toISOString() || null,
    });
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al actualizar estado de médico:`, error.message);
    logger.error('Error updating doctor status', error);
    if (error.message.includes('Validation error') || error.message.includes('Invalid path format')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Failed to update doctor status');
  }
}

// PATCH /api/clinics/doctors/:doctorId/office
export async function updateDoctorOffice(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] PATCH /api/clinics/doctors/{id}/office - Actualizando consultorio');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [CLINICS] PATCH /api/clinics/doctors/{id}/office - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const doctorId = extractIdFromPath(event.requestContext.http.path, '/api/clinics/doctors/', '/office');
    const body = parseBody(event.body, updateDoctorOfficeSchema);

    // Buscar clínica del usuario autenticado
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!clinic) {
      console.error('❌ [CLINICS] Clínica no encontrada');
      return notFoundResponse('Clinic not found');
    }

    // Verificar que el médico pertenece a la clínica
    const doctor = await prisma.clinic_doctors.findFirst({
      where: {
        id: doctorId,
        clinic_id: clinic.id,
      },
    });

    if (!doctor) {
      console.error(`❌ [CLINICS] Médico no encontrado: ${doctorId}`);
      return notFoundResponse('Doctor not found');
    }

    // Actualizar consultorio
    const updatedDoctor = await prisma.clinic_doctors.update({
      where: { id: doctorId },
      data: {
        office_number: body.officeNumber || null,
        updated_at: new Date(),
      },
    });

    console.log(`✅ [CLINICS] Consultorio actualizado: ${doctorId}`);
    return successResponse({
      id: updatedDoctor.id,
      officeNumber: updatedDoctor.office_number,
      updatedAt: updatedDoctor.updated_at?.toISOString() || null,
    });
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al actualizar consultorio:`, error.message);
    logger.error('Error updating doctor office', error);
    if (error.message.includes('Validation error') || error.message.includes('Invalid path format')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Failed to update doctor office');
  }
}

// DELETE /api/clinics/doctors/:doctorId
export async function deleteDoctor(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] DELETE /api/clinics/doctors/{id} - Eliminando médico');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [CLINICS] DELETE /api/clinics/doctors/{id} - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const doctorId = extractIdFromPath(event.requestContext.http.path, '/api/clinics/doctors/');

    // Buscar clínica del usuario autenticado
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!clinic) {
      console.error('❌ [CLINICS] Clínica no encontrada');
      return notFoundResponse('Clinic not found');
    }

    // Verificar que el médico pertenece a la clínica
    const doctor = await prisma.clinic_doctors.findFirst({
      where: {
        id: doctorId,
        clinic_id: clinic.id,
      },
    });

    if (!doctor) {
      console.error(`❌ [CLINICS] Médico no encontrado o no pertenece a esta clínica: ${doctorId}`);
      return notFoundResponse('Doctor not found or does not belong to this clinic');
    }

    // Verificar que no se está eliminando a sí mismo (si el médico es el administrador)
    if (doctor.user_id === authContext.user.id) {
      console.error(`❌ [CLINICS] No se puede eliminar a sí mismo`);
      return errorResponse('Cannot delete yourself', 403);
    }

    // TRANSACCIÓN: Eliminar médico y actualizar invitaciones
    await prisma.$transaction(async (tx) => {
      // Si el médico tiene user_id (ya aceptó la invitación), hacer soft delete
      if (doctor.user_id) {
        // Opción A: Soft Delete (recomendado)
        await tx.clinic_doctors.update({
          where: { id: doctorId },
          data: {
            is_active: false,
            updated_at: new Date(),
          },
        });
        
        console.log(`✅ [CLINICS] Médico desactivado (soft delete): ${doctorId}`);
      } else {
        // Si solo está invitado (is_invited = true, user_id = NULL), hacer hard delete
        // Actualizar invitaciones relacionadas
        await tx.doctor_invitations.updateMany({
          where: {
            clinic_id: clinic.id,
            email: doctor.email,
            status: 'pending',
          },
          data: {
            status: 'expired',
          },
        });

        // Eliminar registro de clinic_doctors
        await tx.clinic_doctors.delete({
          where: { id: doctorId },
        });
        
        console.log(`✅ [CLINICS] Médico eliminado (hard delete): ${doctorId}`);
      }
    });

    console.log(`✅ [CLINICS] Médico eliminado exitosamente: ${doctorId}`);
    return successResponse({
      success: true,
      message: 'Médico eliminado correctamente',
    });
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al eliminar médico:`, error.message);
    logger.error('Error deleting doctor', error);
    if (error.message.includes('Invalid path format')) {
      return errorResponse('Invalid doctor ID', 400);
    }
    return internalErrorResponse('Failed to delete doctor');
  }
}
