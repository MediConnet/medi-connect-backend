import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse } from '../shared/response';
import { parseBody, inviteDoctorSchema, updateDoctorStatusSchema, updateDoctorOfficeSchema, extractIdFromPath } from '../shared/validators';
import { randomBytes } from 'crypto';

// Helper para obtener datos del doctor desde las relaciones
async function getDoctorData(clinicDoctor: any, prisma: any) {
  if (!clinicDoctor.user_id) {
    // Doctor no ha aceptado invitación
    return {
      email: clinicDoctor.users?.email || null,
      name: null,
      specialty: null,
      phone: null,
      whatsapp: null,
      profileImageUrl: null,
    };
  }

  // Doctor ha aceptado, obtener datos de provider
  const provider = await prisma.providers.findFirst({
    where: { user_id: clinicDoctor.user_id },
    include: {
      provider_specialties: {
        include: {
          specialties: {
            select: { name: true }
          }
        },
        take: 1
      },
      provider_branches: {
        where: { is_main: true },
        select: {
          phone_contact: true
        },
        take: 1
      }
    }
  });

  return {
    email: clinicDoctor.users?.email || null,
    name: provider?.commercial_name || null,
    specialty: provider?.provider_specialties[0]?.specialties.name || null,
    phone: provider?.provider_branches[0]?.phone_contact || null,
    whatsapp: provider?.provider_branches[0]?.phone_contact || null,
    profileImageUrl: clinicDoctor.users?.profile_picture_url || provider?.logo_url || null,
  };
}

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
    const where: any = { 
      clinic_id: clinic.id,
      is_invited: false, // Solo mostrar médicos que ya aceptaron
    };
    
    if (status === 'active') {
      where.is_active = true;
    } else if (status === 'inactive') {
      where.is_active = false;
    }

    // Obtener médicos con relaciones
    const doctors = await prisma.clinic_doctors.findMany({
      where,
      include: {
        users: {
          select: {
            email: true,
            profile_picture_url: true
          }
        }
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    console.log(`✅ [CLINICS] Médicos obtenidos exitosamente (${doctors.length} médicos)`);
    
    // Mapear médicos a formato de respuesta
    const doctorsData = await Promise.all(doctors.map(async (doctor) => {
      const doctorData = await getDoctorData(doctor, prisma);
      
      return {
        id: doctor.id,
        clinicId: doctor.clinic_id,
        userId: doctor.user_id || null,
        email: doctorData.email,
        name: doctorData.name,
        specialty: doctorData.specialty,
        isActive: doctor.is_active ?? true,
        isInvited: doctor.is_invited ?? false,
        officeNumber: doctor.office_number || null,
        profileImageUrl: doctorData.profileImageUrl,
        phone: doctorData.phone,
        whatsapp: doctorData.whatsapp,
        createdAt: doctor.created_at?.toISOString() || null,
        updatedAt: doctor.updated_at?.toISOString() || null,
      };
    }));

    return successResponse(doctorsData);
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
        users: {
          email: body.email
        }
      },
    });

    if (existingDoctor) {
      if (!existingDoctor.is_invited) {
        console.error(`❌ [CLINICS] El email ${body.email} ya está registrado y activo en esta clínica`);
        return errorResponse('Email already registered and active in this clinic', 400);
      }
      
      console.log(`⚠️ [CLINICS] El email ${body.email} ya tiene una invitación pendiente. Actualizando invitación...`);
      
      const invitationToken = randomBytes(32).toString('base64url');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      const result = await prisma.$transaction(async (tx) => {
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
        
        const updatedDoctor = await tx.clinic_doctors.update({
          where: { id: existingDoctor.id },
          data: {
            invitation_token: invitationToken,
            invitation_expires_at: expiresAt,
            updated_at: new Date(),
          },
        });
        
        return { doctor: updatedDoctor, invitationToken, expiresAt };
      });
      
      console.log(`✅ [CLINICS] Invitación actualizada exitosamente: ${body.email}`);
      
      // Enviar email de invitación (asíncrono, no bloquea la respuesta)
      const frontendUrl = process.env.FRONTEND_URL || 'https://docalink.com';
      const invitationLink = `${frontendUrl}/clinic/invite?token=${result.invitationToken}`;
      
      const { sendEmail } = await import('../shared/email-adapter');
      const { generateDoctorInvitationEmail } = await import('../shared/email');
      
      const emailHtml = generateDoctorInvitationEmail({
        clinicName: clinic.name,
        invitationLink,
      });

      console.log(`📧 [CLINICS] Iniciando envío de email de invitación a: ${body.email}`);
      
      sendEmail({
        to: body.email,
        subject: `Invitación de ${clinic.name} - DOCALINK`,
        html: emailHtml,
      })
        .then((emailSent) => {
          if (emailSent) {
            console.log(`✅ [CLINICS] Email de invitación enviado exitosamente a: ${body.email}`);
          } else {
            console.error(`❌ [CLINICS] FALLO: No se pudo enviar email de invitación a ${body.email}`);
          }
        })
        .catch((error: any) => {
          console.error(`❌ [CLINICS] ERROR al enviar email de invitación a ${body.email}:`, error.message);
        });
      
      return successResponse(
        {
          id: existingDoctor.id,
          clinicId: clinic.id,
          email: body.email,
          invitationToken: result.invitationToken,
          expiresAt: result.expiresAt.toISOString(),
          status: 'pending',
          message: 'Invitation updated successfully',
          invitationLink,
        },
        200
      );
    }

    const invitationToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const result = await prisma.$transaction(async (tx) => {
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

      const doctor = await tx.clinic_doctors.create({
        data: {
          id: randomUUID(),
          clinic_id: clinic.id,
          user_id: null, // Se asignará al aceptar
          is_invited: true,
          is_active: true,
          invitation_token: invitationToken,
          invitation_expires_at: expiresAt,
        },
      });

      return { invitation, doctor };
    });

    console.log(`✅ [CLINICS] Médico invitado exitosamente: ${body.email}`);
    
    // Enviar email de invitación (asíncrono, no bloquea la respuesta)
    const frontendUrl = process.env.FRONTEND_URL || 'https://docalink.com';
    const invitationLink = `${frontendUrl}/clinic/invite?token=${invitationToken}`;
    
    const { sendEmail } = await import('../shared/email-adapter');
    const { generateDoctorInvitationEmail } = await import('../shared/email');
    
    const emailHtml = generateDoctorInvitationEmail({
      clinicName: clinic.name,
      invitationLink,
    });

    console.log(`📧 [CLINICS] Iniciando envío de email de invitación a: ${body.email}`);
    
    sendEmail({
      to: body.email,
      subject: `Invitación de ${clinic.name} - DOCALINK`,
      html: emailHtml,
    })
      .then((emailSent) => {
        if (emailSent) {
          console.log(`✅ [CLINICS] Email de invitación enviado exitosamente a: ${body.email}`);
        } else {
          console.error(`❌ [CLINICS] FALLO: No se pudo enviar email de invitación a ${body.email}`);
        }
      })
      .catch((error: any) => {
        console.error(`❌ [CLINICS] ERROR al enviar email de invitación a ${body.email}:`, error.message);
      });
    
    return successResponse(
      {
        id: result.invitation.id,
        clinicId: clinic.id,
        email: body.email,
        invitationToken: invitationToken,
        expiresAt: expiresAt.toISOString(),
        status: 'pending',
        createdAt: result.invitation.created_at?.toISOString() || null,
        invitationLink,
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

    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!clinic) {
      console.error('❌ [CLINICS] Clínica no encontrada');
      return notFoundResponse('Clinic not found');
    }

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

    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!clinic) {
      console.error('❌ [CLINICS] Clínica no encontrada');
      return notFoundResponse('Clinic not found');
    }

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

    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!clinic) {
      console.error('❌ [CLINICS] Clínica no encontrada');
      return notFoundResponse('Clinic not found');
    }

    const doctor = await prisma.clinic_doctors.findFirst({
      where: {
        id: doctorId,
        clinic_id: clinic.id,
      },
      include: {
        users: {
          select: { email: true }
        }
      }
    });

    if (!doctor) {
      console.error(`❌ [CLINICS] Médico no encontrado o no pertenece a esta clínica: ${doctorId}`);
      return notFoundResponse('Doctor not found or does not belong to this clinic');
    }

    if (doctor.user_id === authContext.user.id) {
      console.error(`❌ [CLINICS] No se puede eliminar a sí mismo`);
      return errorResponse('Cannot delete yourself', 403);
    }

    await prisma.$transaction(async (tx) => {
      if (doctor.user_id) {
        await tx.clinic_doctors.update({
          where: { id: doctorId },
          data: {
            is_active: false,
            updated_at: new Date(),
          },
        });
        
        console.log(`✅ [CLINICS] Médico desactivado (soft delete): ${doctorId}`);
      } else {
        await tx.doctor_invitations.updateMany({
          where: {
            clinic_id: clinic.id,
            email: doctor.users?.email || '',
            status: 'pending',
          },
          data: {
            status: 'expired',
          },
        });

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

// GET /api/clinics/doctors/:doctorId/profile
export async function getDoctorProfile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] GET /api/clinics/doctors/{id}/profile - Obteniendo perfil completo del médico');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [CLINICS] GET /api/clinics/doctors/{id}/profile - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const doctorId = extractIdFromPath(event.requestContext.http.path, '/api/clinics/doctors/', '/profile');

    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!clinic) {
      console.error('❌ [CLINICS] Clínica no encontrada');
      return notFoundResponse('Clinic not found');
    }

    const doctor = await prisma.clinic_doctors.findFirst({
      where: {
        id: doctorId,
        clinic_id: clinic.id,
      },
      include: {
        users: {
          select: {
            email: true,
            profile_picture_url: true
          }
        }
      }
    });

    if (!doctor) {
      console.error(`❌ [CLINICS] Médico no encontrado o no pertenece a esta clínica: ${doctorId}`);
      return notFoundResponse('Doctor not found or does not belong to this clinic');
    }

    const doctorData = await getDoctorData(doctor, prisma);

    const response = {
      id: doctor.id,
      clinicId: doctor.clinic_id,
      userId: doctor.user_id || null,
      email: doctorData.email,
      name: doctorData.name,
      specialty: doctorData.specialty,
      isActive: doctor.is_active ?? true,
      officeNumber: doctor.office_number || null,
      profileImageUrl: doctorData.profileImageUrl,
      phone: doctorData.phone,
      whatsapp: doctorData.whatsapp,
      createdAt: doctor.created_at?.toISOString() || null,
      updatedAt: doctor.updated_at?.toISOString() || null,
    };

    console.log(`✅ [CLINICS] Perfil del médico obtenido exitosamente: ${doctorId}`);
    return successResponse(response);
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al obtener perfil del médico:`, error.message);
    logger.error('Error getting doctor profile', error);
    if (error.message.includes('Invalid path format')) {
      return errorResponse('Invalid doctor ID', 400);
    }
    return internalErrorResponse('Failed to get doctor profile');
  }
}
