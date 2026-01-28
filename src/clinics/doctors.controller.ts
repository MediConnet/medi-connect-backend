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
      console.error(`❌ [CLINICS] El email ${body.email} ya está registrado en esta clínica`);
      return errorResponse('Email already registered in this clinic', 400);
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

      // Crear registro en clinic_doctors
      const doctor = await tx.clinic_doctors.create({
        data: {
          id: randomUUID(),
          clinic_id: clinic.id,
          email: body.email,
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
