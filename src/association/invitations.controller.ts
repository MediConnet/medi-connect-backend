import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID, randomBytes } from 'crypto';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse } from '../shared/response';
import { parseBody, acceptInvitationSchema, extractIdFromPath } from '../shared/validators';
import * as bcrypt from 'bcrypt';
import { enum_roles, PrismaClient } from '../generated/prisma/client';
import { generateJWT, getJWTClaims, requireRole, AuthContext } from '../shared/auth';
import { sendEmail } from '../shared/email-adapter';
import { z } from 'zod';
import {
  completeClinicInvitationAssociation,
  isRegisteredDoctorByEmail,
  findNonDoctorUserByEmail,
  normalizeInvitationEmail,
  resolveDoctorExists,
} from './invitation-helpers';

/**
 * POST /api/clinics/doctors/invite/link
 * Generar link de invitación único para un médico (sin enviar email)
 */
export async function generateInvitationLink(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [ASSOCIATION] POST /api/association/doctors/invite/link - Generando link de invitación');
  
  // Validar autenticación y permisos de clínica
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [ASSOCIATION] Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    // Validar body
    const bodySchema = z.object({
      email: z.string().email('Email inválido'),
    });
    const body = parseBody(event.body, bodySchema);

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return errorResponse('Formato de email inválido', 400);
    }

    // Buscar clínica del usuario autenticado
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!clinic) {
      console.error('❌ [ASSOCIATION] Clínica no encontrada para el usuario');
      return notFoundResponse('Clínica no encontrada');
    }

    const normalizedEmail = normalizeInvitationEmail(body.email);

    // PASO 1: CASO B — Validar rol antes que nada
    const nonDoctorUser = await findNonDoctorUserByEmail(prisma, normalizedEmail);
    if (nonDoctorUser) {
      console.error(`❌ [ASSOCIATION] El email ${normalizedEmail} pertenece al rol ${nonDoctorUser.role} — no es médico`);
      return errorResponse(
        'El usuario existe pero no pertenece al rol Médico. Solo es posible asociar usuarios médicos a una clínica.',
        400,
      );
    }

    // PASO 2: Verificar si el médico ya está registrado en la clínica
    const existingDoctor = await prisma.clinic_doctors.findFirst({
      where: {
        clinic_id: clinic.id,
        users: {
          email: { equals: normalizedEmail, mode: 'insensitive' },
        },
        is_invited: false,
      },
    });

    if (existingDoctor) {
      return errorResponse('Este médico ya está registrado en la clínica', 400);
    }

    // PASO 3: Verificar si ya existe una invitación pendiente válida
    const existingInvitation = await prisma.doctor_invitations.findFirst({
      where: {
        clinic_id: clinic.id,
        email: { equals: normalizedEmail, mode: 'insensitive' },
        status: 'pending',
        expires_at: {
          gte: new Date(),
        },
      },
    });

    if (existingInvitation) {
      const frontendUrl = process.env.FRONTEND_URL || 'https://docalink.com';
      const invitationLink = `${frontendUrl}/clinic/invite/${existingInvitation.invitation_token}`;
      const doctorExisteExisting = await resolveDoctorExists(prisma, existingInvitation);
      
      console.log(`✅ [ASSOCIATION] Invitación existente encontrada para: ${normalizedEmail}`);
      return successResponse({
        invitationLink,
        expiresAt: existingInvitation.expires_at.toISOString(),
        doctorExiste: doctorExisteExisting,
      });
    }

    const doctorExists = await isRegisteredDoctorByEmail(prisma, normalizedEmail);

    if (doctorExists) {
      console.log(`📧 [ASSOCIATION] Invitación para usuario existente (médico registrado): ${normalizedEmail}`);
    } else {
      console.log(`📧 [ASSOCIATION] Invitación para usuario nuevo: ${normalizedEmail}`);
    }

    // Generar token único y seguro (256 bits)
    const invitationToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expira en 7 días

    // Crear invitación en la base de datos
    const invitation = await prisma.doctor_invitations.create({
      data: {
        id: randomUUID(),
        clinic_id: clinic.id,
        email: normalizedEmail,
        invitation_token: invitationToken,
        expires_at: expiresAt,
        status: 'pending',
        doctor_exists: doctorExists,
      },
    });

    // Generar URL de invitación
    // Frontend espera la ruta: https://www.docalink.com/clinic/invite/{TOKEN}
    const frontendUrl = process.env.FRONTEND_URL || 'https://docalink.com';
    const invitationLink = `${frontendUrl}/clinic/invite/${invitationToken}`;

    console.log(`✅ [ASSOCIATION] Link de invitación generado exitosamente para: ${normalizedEmail}`);
    return successResponse({
      invitationLink,
      expiresAt: expiresAt.toISOString(),
      doctorExiste: doctorExists,
    });
  } catch (error: any) {
    console.error(`❌ [ASSOCIATION] Error al generar link de invitación:`, error.message);
    logger.error('Error generating invitation link', error);
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Error al generar link de invitación');
  }
}

/**
 * POST /api/clinics/doctors/invite
 * Enviar invitación por email a un médico
 */
export async function sendInvitation(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [ASSOCIATION] POST /api/association/doctors/invite - Enviando invitación por email');
  
  const prisma = getPrismaClient();

  try {
    // Validar body con parseBody (Zod)
    const bodySchema = z.object({
      email: z.string().email('Email inválido'),
      clinicId: z.string().uuid().optional(),
    });
    const body = parseBody(event.body, bodySchema);

    // Obtener claims del JWT
    const claims = getJWTClaims(event);
    if (!claims || !claims.sub) {
      console.error('❌ [ASSOCIATION] No se pudo obtener claims del token');
      return errorResponse('Token de autenticación inválido', 401);
    }

    const userId = claims.sub;
    console.log(`✅ [ASSOCIATION] Usuario autenticado: ${userId}`);

    // Obtener clinicId del body o buscar la clínica del usuario
    let clinicId = body.clinicId;
    
    if (!clinicId) {
      const userClinic = await prisma.clinics.findFirst({
        where: { user_id: userId },
      });

      if (!userClinic) {
        console.error('❌ [ASSOCIATION] No se encontró clínica para el usuario:', userId);
        return errorResponse('No se encontró clínica asociada al usuario', 404);
      }

      clinicId = userClinic.id;
      console.log(`✅ [ASSOCIATION] Clínica obtenida automáticamente: ${clinicId}`);
    }

    // Verificar que la clínica existe
    const clinic = await prisma.clinics.findUnique({
      where: { id: clinicId },
    });

    if (!clinic) {
      return notFoundResponse('Clínica no encontrada');
    }

    const normalizedEmail = normalizeInvitationEmail(body.email);

    // CASO B: Verificar que el email no pertenezca a un usuario con rol no-médico
    const nonDoctorUser = await findNonDoctorUserByEmail(prisma, normalizedEmail);
    if (nonDoctorUser) {
      console.error(`❌ [ASSOCIATION] El email ${normalizedEmail} pertenece al rol ${nonDoctorUser.role} — no es médico`);
      return errorResponse(
        'El usuario existe pero no pertenece al rol Médico. Solo es posible asociar usuarios médicos a una clínica.',
        400,
      );
    }

    // Verificar si ya existe una invitación pendiente
    const existingInvitation = await prisma.doctor_invitations.findFirst({
      where: {
        clinic_id: clinicId,
        email: { equals: normalizedEmail, mode: 'insensitive' },
        status: 'pending',
        expires_at: {
          gte: new Date(),
        },
      },
    });

    if (existingInvitation) {
      return errorResponse('Ya existe una invitación pendiente para este email', 400);
    }

    // Verificar si el médico ya está registrado en la clínica
    const existingDoctor = await prisma.clinic_doctors.findFirst({
      where: {
        clinic_id: clinicId,
        users: {
          email: { equals: normalizedEmail, mode: 'insensitive' },
        },
        is_invited: false,
      },
    });

    if (existingDoctor) {
      return errorResponse('Este médico ya está registrado en la clínica', 400);
    }

    const doctorExists = await isRegisteredDoctorByEmail(prisma, normalizedEmail);

    if (doctorExists) {
      console.log(`📧 [ASSOCIATION] Invitación enviada a usuario existente: ${normalizedEmail}`);
    } else {
      console.log(`📧 [ASSOCIATION] Invitación enviada a usuario nuevo: ${normalizedEmail}`);
    }

    // Generar token de invitación seguro (256 bits)
    const invitationToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Crear invitación en la base de datos
    const invitation = await prisma.doctor_invitations.create({
      data: {
        id: randomUUID(),
        clinic_id: clinicId,
        email: normalizedEmail,
        invitation_token: invitationToken,
        expires_at: expiresAt,
        status: 'pending',
        doctor_exists: doctorExists,
      },
    });

    // Generar URL de invitación
    // Frontend espera la ruta pública principal: https://www.docalink.com/clinic/invite/{TOKEN}
    // (también existe alias /invite/{TOKEN}, pero usamos la principal)
    const baseFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const invitationUrl = `${baseFrontendUrl}/clinic/invite/${invitationToken}`;

    const { generateDoctorInvitationEmail } = await import('../shared/email');
    const invitationUrlForEmail = invitationUrl;
    const emailHtml = generateDoctorInvitationEmail({
      clinicName: clinic.name,
      invitationLink: invitationUrlForEmail,
      doctorExists,
    });

    // Enviar email de invitación
    console.log(`📧 [ASSOCIATION] Enviando email a: ${normalizedEmail}`);
    const emailSent = await sendEmail({
      to: normalizedEmail,
      subject: `Invitación para unirte a ${clinic.name} - MediConnect`,
      html: emailHtml,
    });

    if (emailSent) {
      console.log(`✅ [ASSOCIATION] Email enviado exitosamente a: ${normalizedEmail}`);
    } else {
      console.error('❌ [ASSOCIATION] Error al enviar email de invitación');
      logger.error('Failed to send invitation email', new Error('Email sending failed'), { email: normalizedEmail, clinicId });
    }

    console.log(`✅ [ASSOCIATION] Invitación creada exitosamente para: ${normalizedEmail}`);
    return successResponse({
      message: 'Invitación enviada exitosamente',
      email: normalizedEmail,
      expiresAt: expiresAt.toISOString(),
      invitationUrl: invitationUrl,
      emailSent: emailSent,
      doctorExiste: doctorExists,
    }, 201);
  } catch (error: any) {
    console.error(`❌ [ASSOCIATION] Error al enviar invitación:`, error.message);
    console.error(`❌ [ASSOCIATION] Stack:`, error.stack);
    logger.error('Error sending invitation', error);
    return internalErrorResponse('Failed to send invitation');
  }
}

// GET /api/clinics/invite/:token
export async function validateInvitation(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [ASSOCIATION] GET /api/association/invite/{token} - Validando token de invitación');
  
  const prisma = getPrismaClient();

  try {
    const token = extractIdFromPath(event.requestContext.http.path, '/api/association/invite/');

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
      console.error(`❌ [ASSOCIATION] Token de invitación no encontrado: ${token}`);
      // Retornar respuesta con isValid: false en lugar de 404 para que el frontend pueda mostrar el mensaje
      return successResponse({
        clinic: null,
        email: '',
        expiresAt: new Date().toISOString(),
        isValid: false,
      });
    }

    // Verificar si está expirado
    const now = new Date();
    const isExpired = invitation.expires_at < now;
    
    // isValid es true solo si: no está expirado Y está en estado 'pending'
    const isValid = !isExpired && invitation.status === 'pending';

    // Si está expirado y aún está en estado 'pending', actualizar status
    if (isExpired && invitation.status === 'pending') {
      await prisma.doctor_invitations.update({
        where: { id: invitation.id },
        data: { status: 'expired' },
      });
    }

    const doctorExiste = await resolveDoctorExists(prisma, invitation);

    console.log(
      `✅ [ASSOCIATION] Token validado: ${isValid ? 'válido' : 'inválido'} (status: ${invitation.status}, expirado: ${isExpired}, doctorExiste: ${doctorExiste})`,
    );
    return successResponse({
      clinic: invitation.clinics ? {
        id: invitation.clinics.id,
        name: invitation.clinics.name,
      } : null,
      email: invitation.email,
      expiresAt: invitation.expires_at.toISOString(),
      isValid,
      doctorExiste,
    });
  } catch (error: any) {
    console.error(`❌ [ASSOCIATION] Error al validar invitación:`, error.message);
    logger.error('Error validating invitation', error);
    if (error.message.includes('Invalid path format')) {
      return errorResponse('Invalid invitation token', 400);
    }
    return internalErrorResponse('Failed to validate invitation');
  }
}

// POST /api/clinics/invite/:token/reject
export async function rejectInvitation(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('❌ [ASSOCIATION] POST /api/association/invite/{token}/reject - Rechazando invitación');
  
  const prisma = getPrismaClient();

  try {
    const token = extractIdFromPath(event.requestContext.http.path, '/api/association/invite/', '/reject');

    // Buscar invitación
    const invitation = await prisma.doctor_invitations.findFirst({
      where: { invitation_token: token },
    });

    if (!invitation) {
      console.error(`❌ [ASSOCIATION] Token de invitación no encontrado: ${token}`);
      return notFoundResponse('Invitation token not found');
    }

    // Validar que la invitación no fue ya aceptada (aunque haya expirado)
    if (invitation.status === 'accepted') {
      console.error(`❌ [ASSOCIATION] Invitación ya fue aceptada`);
      return errorResponse('Invitation has already been accepted', 400);
    }

    // Validar que la invitación no fue ya rechazada
    if (invitation.status === 'rejected') {
      console.error(`❌ [ASSOCIATION] Invitación ya fue rechazada`);
      return errorResponse('Invitation has already been rejected', 400);
    }

    // Validar que el token no ha expirado
    const now = new Date();
    if (invitation.expires_at < now) {
      console.error(`❌ [ASSOCIATION] Token de invitación expirado`);
      return errorResponse('Invitation token has expired', 400);
    }

    // Solo permitir rechazar si está en estado 'pending'
    if (invitation.status !== 'pending') {
      console.error(`❌ [ASSOCIATION] Invitación no está en estado válido para rechazar: ${invitation.status}`);
      return errorResponse('Invitation is not in a valid state to be rejected', 400);
    }

    // Marcar invitación como rechazada
    await prisma.doctor_invitations.update({
      where: { id: invitation.id },
      data: { status: 'rejected' },
    });

    console.log(`✅ [ASSOCIATION] Invitación rechazada exitosamente: ${invitation.email}`);
    return successResponse({
      success: true,
      message: 'Invitación rechazada correctamente',
    });
  } catch (error: any) {
    console.error(`❌ [ASSOCIATION] Error al rechazar invitación:`, error.message);
    logger.error('Error rejecting invitation', error);
    if (error.message.includes('Invalid path format')) {
      return errorResponse('Invalid invitation token', 400);
    }
    return internalErrorResponse('Failed to reject invitation');
  }
}

// POST /api/clinics/invite/:token/accept
export async function acceptInvitation(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [ASSOCIATION] POST /api/association/invite/{token}/accept - Aceptando invitación');
  
  const prisma = getPrismaClient();

  try {
    const token = extractIdFromPath(event.requestContext.http.path, '/api/association/invite/', '/accept');
    const body = parseBody(event.body, acceptInvitationSchema);

    // Validar que la especialidad exista en la base de datos
    const specialtyRecord = await prisma.specialties.findFirst({
      where: { name: { equals: body.specialty, mode: 'insensitive' } },
    });
    if (!specialtyRecord) {
      return errorResponse(`La especialidad "${body.specialty}" no existe. Las especialidades son gestionadas por el administrador.`, 400);
    }

    // Buscar invitación
    const invitation = await prisma.doctor_invitations.findFirst({
      where: { invitation_token: token },
      include: {
        clinics: true,
      },
    });

    if (!invitation) {
      console.error(`❌ [ASSOCIATION] Token de invitación no encontrado: ${token}`);
      return notFoundResponse('Invitation token not found');
    }

    // Validar token
    const now = new Date();
    if (invitation.expires_at < now) {
      console.error(`❌ [ASSOCIATION] Token de invitación expirado`);
      return errorResponse('Invitation token has expired', 400);
    }

    if (invitation.status !== 'pending') {
      console.error(`❌ [ASSOCIATION] Token de invitación ya fue usado o expirado`);
      return errorResponse('Invitation token is no longer valid', 400);
    }

    const doctorExiste = await resolveDoctorExists(prisma, invitation);

    // Verificar si el usuario ya existe (correo exacto, sin distinguir mayúsculas)
    const existingUser = await prisma.users.findFirst({
      where: { email: { equals: invitation.email, mode: 'insensitive' } },
    });

    // CASO: Usuario ya registrado - requiere autenticación (flujo post-login)
    if (existingUser) {
      console.log(`🔍 [ASSOCIATION] Aceptación de médico existente (doctorExiste=${doctorExiste})`);

      const authResult = await requireRole(event, [enum_roles.provider]);
      if ('statusCode' in authResult) {
        console.log(`🔀 [ASSOCIATION] Redirección a login requerida: usuario no autenticado`);
        return errorResponse(
          'Debes iniciar sesión para aceptar esta invitación. Usa el enlace de invitación y el botón Aceptar.',
          401,
        );
      }

      const authContext = authResult as AuthContext;
      if (
        normalizeInvitationEmail(authContext.user.email) !==
        normalizeInvitationEmail(invitation.email)
      ) {
        console.error(`❌ [ASSOCIATION] Usuario autenticado no coincide con el email de la invitación`);
        return errorResponse('Solo puedes aceptar invitaciones enviadas a tu correo', 403);
      }

      if (authContext.user.id !== existingUser?.id) {
        return errorResponse('Sesión no coincide con el usuario de la invitación', 403);
      }

      if (existingUser && existingUser.role !== enum_roles.provider) {
        console.error(`❌ [ASSOCIATION] Usuario no es provider`);
        return errorResponse('Solo los médicos pueden aceptar invitaciones de clínica', 400);
      }

      const provider = await prisma.providers.findFirst({
        where: { user_id: authContext.user.id },
      });

      if (!provider) {
        return errorResponse('Perfil de médico no encontrado', 404);
      }

      const association = await completeClinicInvitationAssociation(
        prisma,
        invitation,
        authContext.user.id,
      );

      console.log(`✅ [ASSOCIATION] Médico existente asociado a clínica ${association.clinicId}`);

      return successResponse({
        message: association.alreadyAssociated
          ? 'Ya estabas asociado a esta clínica'
          : 'Invitación aceptada correctamente',
        clinicId: association.clinicId,
        userId: authContext.user.id,
        doctorExiste: true,
        doctor: {
          clinicId: association.clinicId,
          userId: authContext.user.id,
          name: body.name || provider.commercial_name,
        },
      });
    }

    // Buscar la categoría de servicio "doctor"
    const doctorCategory = await prisma.service_categories.findFirst({
      where: {
        slug: 'doctor',
      },
    });

    if (!doctorCategory) {
      console.error(`❌ [ASSOCIATION] Categoría de servicio "doctor" no encontrada`);
      return errorResponse('Doctor service category not found', 500);
    }

    // CASO: Usuario NO existe - crear nuevo usuario
    // Validar que se proporcionó password para nuevo usuario
    if (!body.password) {
      return errorResponse('Password is required for new user registration', 400);
    }

    // Guardar password en variable para que TypeScript sepa que no es undefined
    const password = body.password;

    // TRANSACCIÓN: Crear usuario, provider, actualizar médico e invitación
    const result = await prisma.$transaction(async (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => {
      // Crear hash de contraseña con bcrypt (compatible con el login)
      const passwordHash = await bcrypt.hash(password, 10);

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

      // Crear provider con serviceType = 'doctor'
      const provider = await tx.providers.create({
        data: {
          id: randomUUID(),
          user_id: user.id,
          category_id: doctorCategory.id, // ⭐ category_id es Int, no service_category_id
          commercial_name: body.name, // Usar el nombre del médico
          description: `Médico especialista en ${body.specialty}`,
          verification_status: 'APPROVED', // Aprobado automáticamente al aceptar invitación de clínica
        },
      });

      // ⭐ CREAR registro de médico (ahora que aceptó la invitación)
      const doctor = await tx.clinic_doctors.create({
        data: {
          id: randomUUID(),
          clinic_id: invitation.clinic_id,
          user_id: user.id,
          is_invited: false, // Ya aceptó, no es invitado
          is_active: true, // Activo desde que acepta
          invitation_token: null,
          invitation_expires_at: null,
        },
      });

      // Actualizar invitación
      await tx.doctor_invitations.update({
        where: { id: invitation.id },
        data: { status: 'accepted' },
      });

      return { user, provider, doctor };
    });

    // Generar JWT token
    const jwtToken = generateJWT({
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
    });

    console.log(`✅ [ASSOCIATION] Invitación aceptada exitosamente: ${invitation.email}`);
    return successResponse(
      {
        userId: result.user.id,
        email: result.user.email,
        token: jwtToken,
        serviceType: 'doctor', // ⭐ serviceType = 'doctor'
        tipo: 'doctor', // ⭐ tipo = 'doctor'
        doctor: {
          id: result.doctor.id,
          clinicId: result.doctor.clinic_id,
          userId: result.doctor.user_id,
          name: body.name,
          specialty: body.specialty,
          isActive: result.doctor.is_active,
          isInvited: result.doctor.is_invited,
        },
      },
      201
    );
  } catch (error: any) {
    console.error(`❌ [ASSOCIATION] Error al aceptar invitación:`, error.message);
    logger.error('Error accepting invitation', error);
    if (error.message.includes('Validation error') || error.message.includes('Invalid path format')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Failed to accept invitation');
  }
}

/**
 * POST /api/clinics/invite/:token/associate
 * Asocia un médico ya autenticado a la clínica (tras login desde invitación).
 */
export async function associateInvitation(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log('✅ [ASSOCIATION] POST /api/association/invite/{token}/associate - Asociando médico autenticado');

  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const token = extractIdFromPath(
      event.requestContext.http.path,
      '/api/association/invite/',
      '/associate',
    );

    const invitation = await prisma.doctor_invitations.findFirst({
      where: { invitation_token: token },
      include: { clinics: true },
    });

    if (!invitation) {
      return notFoundResponse('Invitation token not found');
    }

    const now = new Date();
    if (invitation.expires_at < now) {
      console.error(`❌ [ASSOCIATION] Token de invitación expirado`);
      return errorResponse('Invitation token has expired', 400);
    }

    if (invitation.status !== 'pending') {
      return errorResponse('Invitation token is no longer valid', 400);
    }

    if (
      normalizeInvitationEmail(authContext.user.email) !==
      normalizeInvitationEmail(invitation.email)
    ) {
      return errorResponse('Solo puedes aceptar invitaciones enviadas a tu correo', 403);
    }

    const doctorExiste = await resolveDoctorExists(prisma, invitation);
    console.log(
      `🔗 [ASSOCIATION] Asociando invitación post-login (doctorExiste=${doctorExiste}, email=${invitation.email})`,
    );

    const association = await completeClinicInvitationAssociation(
      prisma,
      invitation,
      authContext.user.id,
    );

    console.log(`✅ [ASSOCIATION] Asociación completada para clínica ${association.clinicId}`);

    return successResponse({
      message: association.alreadyAssociated
        ? 'Ya estabas asociado a esta clínica'
        : 'Te has unido a la clínica correctamente',
      clinicId: association.clinicId,
      clinicName: invitation.clinics?.name,
      userId: authContext.user.id,
      doctorExiste: true,
    });
  } catch (error: any) {
    console.error(`❌ [ASSOCIATION] Error al asociar invitación:`, error.message);
    logger.error('Error associating invitation', error);
    if (error.message.includes('Invalid path format')) {
      return errorResponse('Invalid invitation token', 400);
    }
    return internalErrorResponse('Failed to associate invitation');
  }
}
