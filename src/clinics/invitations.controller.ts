import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse } from '../shared/response';
import { parseBody, acceptInvitationSchema, extractIdFromPath } from '../shared/validators';
import { createHash } from 'crypto';
import { enum_roles } from '../generated/prisma/client';

// GET /api/clinics/invite/:token
export async function validateInvitation(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] GET /api/clinics/invite/{token} - Validando token de invitación');
  
  const prisma = getPrismaClient();

  try {
    const token = extractIdFromPath(event.requestContext.http.path, '/api/clinics/invite/');

    // Buscar invitación
    const invitation = await prisma.doctor_invitations.findFirst({
      where: { invitation_token: token },
      include: {
        clinics: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!invitation) {
      console.error(`❌ [CLINICS] Token de invitación no encontrado: ${token}`);
      return notFoundResponse('Invitation token not found');
    }

    // Verificar si está expirado
    const now = new Date();
    const isExpired = invitation.expires_at < now;
    const isValid = !isExpired && invitation.status === 'pending';

    // Si está expirado, actualizar status
    if (isExpired && invitation.status === 'pending') {
      await prisma.doctor_invitations.update({
        where: { id: invitation.id },
        data: { status: 'expired' },
      });
    }

    console.log(`✅ [CLINICS] Token validado: ${isValid ? 'válido' : 'inválido'}`);
    return successResponse({
      clinic: invitation.clinics ? {
        id: invitation.clinics.id,
        name: invitation.clinics.name,
      } : null,
      email: invitation.email,
      expiresAt: invitation.expires_at.toISOString(),
      isValid,
    });
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al validar invitación:`, error.message);
    logger.error('Error validating invitation', error);
    if (error.message.includes('Invalid path format')) {
      return errorResponse('Invalid invitation token', 400);
    }
    return internalErrorResponse('Failed to validate invitation');
  }
}

// POST /api/clinics/invite/:token/accept
export async function acceptInvitation(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] POST /api/clinics/invite/{token}/accept - Aceptando invitación');
  
  const prisma = getPrismaClient();

  try {
    const token = extractIdFromPath(event.requestContext.http.path, '/api/clinics/invite/', '/accept');
    const body = parseBody(event.body, acceptInvitationSchema);

    // Buscar invitación
    const invitation = await prisma.doctor_invitations.findFirst({
      where: { invitation_token: token },
      include: {
        clinics: true,
      },
    });

    if (!invitation) {
      console.error(`❌ [CLINICS] Token de invitación no encontrado: ${token}`);
      return notFoundResponse('Invitation token not found');
    }

    // Validar token
    const now = new Date();
    if (invitation.expires_at < now) {
      console.error(`❌ [CLINICS] Token de invitación expirado`);
      return errorResponse('Invitation token has expired', 400);
    }

    if (invitation.status !== 'pending') {
      console.error(`❌ [CLINICS] Token de invitación ya fue usado o expirado`);
      return errorResponse('Invitation token is no longer valid', 400);
    }

    // Verificar que el email no esté ya registrado como usuario
    const existingUser = await prisma.users.findFirst({
      where: { email: invitation.email },
    });

    if (existingUser) {
      console.error(`❌ [CLINICS] El email ${invitation.email} ya está registrado`);
      return errorResponse('Email already registered', 400);
    }

    // TRANSACCIÓN: Crear usuario, actualizar médico e invitación
    const result = await prisma.$transaction(async (tx) => {
      // Crear hash de contraseña
      const passwordHash = createHash('sha256').update(body.password).digest('hex');

      // Crear usuario
      const user = await tx.users.create({
        data: {
          id: randomUUID(),
          email: invitation.email,
          password_hash: passwordHash,
          role: enum_roles.provider,
          is_active: true,
        },
      });

      // Buscar registro de médico
      const doctor = await tx.clinic_doctors.findFirst({
        where: {
          clinic_id: invitation.clinic_id,
          email: invitation.email,
        },
      });

      if (!doctor) {
        throw new Error('Doctor record not found');
      }

      // Actualizar registro de médico
      const updatedDoctor = await tx.clinic_doctors.update({
        where: { id: doctor.id },
        data: {
          user_id: user.id,
          name: body.name,
          specialty: body.specialty,
          phone: body.phone || null,
          whatsapp: body.whatsapp || null,
          is_invited: false,
          invitation_token: null,
          invitation_expires_at: null,
          updated_at: new Date(),
        },
      });

      // Actualizar invitación
      await tx.doctor_invitations.update({
        where: { id: invitation.id },
        data: { status: 'accepted' },
      });

      return { user, doctor: updatedDoctor };
    });

    // TODO: Generar JWT token
    // Por ahora, retornamos el usuario creado
    // En producción, deberías generar un token JWT aquí

    console.log(`✅ [CLINICS] Invitación aceptada exitosamente: ${invitation.email}`);
    return successResponse(
      {
        userId: result.user.id,
        email: result.user.email,
        token: 'TODO: Generate JWT token', // TODO: Implementar generación de JWT
        doctor: {
          id: result.doctor.id,
          clinicId: result.doctor.clinic_id,
          userId: result.doctor.user_id,
          name: result.doctor.name,
          specialty: result.doctor.specialty,
          isActive: result.doctor.is_active,
          isInvited: result.doctor.is_invited,
        },
      },
      201
    );
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al aceptar invitación:`, error.message);
    logger.error('Error accepting invitation', error);
    if (error.message.includes('Validation error') || error.message.includes('Invalid path format')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Failed to accept invitation');
  }
}
