import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID, randomBytes } from 'crypto';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse } from '../shared/response';
import { parseBody, acceptInvitationSchema, extractIdFromPath } from '../shared/validators';
import { createHash } from 'crypto';
import { enum_roles, PrismaClient } from '../generated/prisma/client';
import { generateJWT, getJWTClaims, requireRole, AuthContext } from '../shared/auth';
import { sendEmail } from '../shared/email-adapter';
import { z } from 'zod';

/**
 * POST /api/clinics/doctors/invite/link
 * Generar link de invitación único para un médico (sin enviar email)
 */
export async function generateInvitationLink(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] POST /api/clinics/doctors/invite/link - Generando link de invitación');
  
  // Validar autenticación y permisos de clínica
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [CLINICS] Error de autenticación/autorización');
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
      console.error('❌ [CLINICS] Clínica no encontrada para el usuario');
      return notFoundResponse('Clínica no encontrada');
    }

    // Verificar si ya existe una invitación pendiente para este email
    const existingInvitation = await prisma.doctor_invitations.findFirst({
      where: {
        clinic_id: clinic.id,
        email: body.email,
        status: 'pending',
        expires_at: {
          gte: new Date(),
        },
      },
    });

    // Si existe una invitación pendiente válida, retornar el link existente
    if (existingInvitation) {
      // Frontend espera la ruta: https://www.docalink.com/clinic/invite/{TOKEN}
      const frontendUrl = process.env.FRONTEND_URL || 'https://docalink.com';
      const invitationLink = `${frontendUrl}/clinic/invite/${existingInvitation.invitation_token}`;
      
      console.log(`✅ [CLINICS] Invitación existente encontrada para: ${body.email}`);
      return successResponse({
        invitationLink,
        expiresAt: existingInvitation.expires_at.toISOString(),
      });
    }

    // Verificar si el médico ya está registrado en la clínica
    const existingDoctor = await prisma.clinic_doctors.findFirst({
      where: {
        clinic_id: clinic.id,
        users: {
          email: body.email
        },
        is_invited: false, // Ya aceptó la invitación
      },
    });

    if (existingDoctor) {
      return errorResponse('Este médico ya está registrado en la clínica', 400);
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
        email: body.email,
        invitation_token: invitationToken,
        expires_at: expiresAt,
        status: 'pending',
      },
    });

    // Generar URL de invitación
    // Frontend espera la ruta: https://www.docalink.com/clinic/invite/{TOKEN}
    const frontendUrl = process.env.FRONTEND_URL || 'https://docalink.com';
    const invitationLink = `${frontendUrl}/clinic/invite/${invitationToken}`;

    console.log(`✅ [CLINICS] Link de invitación generado exitosamente para: ${body.email}`);
    return successResponse({
      invitationLink,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al generar link de invitación:`, error.message);
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
  console.log('✅ [CLINICS] POST /api/clinics/doctors/invite - Enviando invitación por email');
  
  const prisma = getPrismaClient();

  try {
    // Obtener claims del JWT
    const claims = getJWTClaims(event);
    if (!claims || !claims.sub) {
      console.error('❌ [CLINICS] No se pudo obtener claims del token');
      return errorResponse('Token de autenticación inválido', 401);
    }

    const userId = claims.sub;
    console.log(`✅ [CLINICS] Usuario autenticado: ${userId}`);

    // Obtener datos del body
    const body = JSON.parse(event.body || '{}');
    const { email, clinicId: bodyClinicId } = body;

    if (!email) {
      return errorResponse('Email es requerido', 400);
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse('Formato de email inválido', 400);
    }

    // Obtener clinicId del body o buscar la clínica del usuario
    let clinicId = bodyClinicId;
    
    if (!clinicId) {
      // Buscar la clínica asociada al usuario
      const userClinic = await prisma.clinics.findFirst({
        where: { user_id: userId },
      });

      if (!userClinic) {
        console.error('❌ [CLINICS] No se encontró clínica para el usuario:', userId);
        return errorResponse('No se encontró clínica asociada al usuario', 404);
      }

      clinicId = userClinic.id;
      console.log(`✅ [CLINICS] Clínica obtenida automáticamente: ${clinicId}`);
    }

    // Verificar que la clínica existe
    const clinic = await prisma.clinics.findUnique({
      where: { id: clinicId },
    });

    if (!clinic) {
      return notFoundResponse('Clínica no encontrada');
    }

    // Verificar si ya existe una invitación pendiente
    const existingInvitation = await prisma.doctor_invitations.findFirst({
      where: {
        clinic_id: clinicId,
        email: email,
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
          email: email
        },
        is_invited: false, // Ya aceptó la invitación
      },
    });

    if (existingDoctor) {
      return errorResponse('Este médico ya está registrado en la clínica', 400);
    }

    // Generar token de invitación
    const invitationToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expira en 7 días

    // Crear invitación en la base de datos
    // ⭐ IMPORTANTE: NO crear registro en clinic_doctors hasta que el médico acepte
    const invitation = await prisma.doctor_invitations.create({
      data: {
        id: randomUUID(),
        clinic_id: clinicId,
        email: email,
        invitation_token: invitationToken,
        expires_at: expiresAt,
        status: 'pending',
      },
    });

    // Generar URL de invitación
    // Frontend espera la ruta pública principal: https://www.docalink.com/clinic/invite/{TOKEN}
    // (también existe alias /invite/{TOKEN}, pero usamos la principal)
    const baseFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const invitationUrl = `${baseFrontendUrl}/clinic/invite/${invitationToken}`;

    // Enviar email de invitación
    console.log(`📧 [CLINICS] Enviando email a: ${email}`);
    const emailSent = await sendEmail({
      to: email,
      subject: `Invitación para unirte a ${clinic.name} - MediConnect`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #667eea;">¡Has sido invitado!</h1>
          <p>Hola,</p>
          <p>La clínica <strong>${clinic.name}</strong> te ha invitado a unirte a su equipo médico en MediConnect.</p>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Clínica:</strong> ${clinic.name}</p>
            <p style="margin: 10px 0 0 0;"><strong>Dirección:</strong> ${clinic.address || 'No especificada'}</p>
          </div>

          <p>Para aceptar la invitación y completar tu registro, haz clic en el siguiente botón:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationUrl}" 
               style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Aceptar Invitación
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">
            O copia y pega este enlace en tu navegador:<br>
            <a href="${invitationUrl}" style="color: #667eea;">${invitationUrl}</a>
          </p>

          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            Esta invitación expira el ${expiresAt.toLocaleDateString('es-ES', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}.
          </p>

          <hr style="margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">
            Este correo fue enviado desde MediConnect. Si no esperabas esta invitación, puedes ignorar este mensaje.
          </p>
        </div>
      `,
    });

    if (emailSent) {
      console.log(`✅ [CLINICS] Email enviado exitosamente a: ${email}`);
    } else {
      console.error('❌ [CLINICS] Error al enviar email de invitación');
      logger.error('Failed to send invitation email', new Error('Email sending failed'), { email, clinicId });
    }

    console.log(`✅ [CLINICS] Invitación creada exitosamente para: ${email}`);
    return successResponse({
      message: 'Invitación enviada exitosamente',
      email: email,
      expiresAt: expiresAt.toISOString(),
      invitationUrl: invitationUrl,
      emailSent: emailSent,
    }, 201);
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al enviar invitación:`, error.message);
    console.error(`❌ [CLINICS] Stack:`, error.stack);
    logger.error('Error sending invitation', error);
    return internalErrorResponse('Failed to send invitation');
  }
}

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

    console.log(`✅ [CLINICS] Token validado: ${isValid ? 'válido' : 'inválido'} (status: ${invitation.status}, expirado: ${isExpired})`);
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

// POST /api/clinics/invite/:token/reject
export async function rejectInvitation(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('❌ [CLINICS] POST /api/clinics/invite/{token}/reject - Rechazando invitación');
  
  const prisma = getPrismaClient();

  try {
    const token = extractIdFromPath(event.requestContext.http.path, '/api/clinics/invite/', '/reject');

    // Buscar invitación
    const invitation = await prisma.doctor_invitations.findFirst({
      where: { invitation_token: token },
    });

    if (!invitation) {
      console.error(`❌ [CLINICS] Token de invitación no encontrado: ${token}`);
      return notFoundResponse('Invitation token not found');
    }

    // Validar que el token no ha expirado
    const now = new Date();
    if (invitation.expires_at < now) {
      console.error(`❌ [CLINICS] Token de invitación expirado`);
      return errorResponse('Invitation token has expired', 400);
    }

    // Validar que la invitación no fue ya aceptada
    if (invitation.status === 'accepted') {
      console.error(`❌ [CLINICS] Invitación ya fue aceptada`);
      return errorResponse('Invitation has already been accepted', 400);
    }

    // Validar que la invitación no fue ya rechazada
    if (invitation.status === 'rejected') {
      console.error(`❌ [CLINICS] Invitación ya fue rechazada`);
      return errorResponse('Invitation has already been rejected', 400);
    }

    // Solo permitir rechazar si está en estado 'pending'
    if (invitation.status !== 'pending') {
      console.error(`❌ [CLINICS] Invitación no está en estado válido para rechazar: ${invitation.status}`);
      return errorResponse('Invitation is not in a valid state to be rejected', 400);
    }

    // Marcar invitación como rechazada
    await prisma.doctor_invitations.update({
      where: { id: invitation.id },
      data: { status: 'rejected' },
    });

    console.log(`✅ [CLINICS] Invitación rechazada exitosamente: ${invitation.email}`);
    return successResponse({
      success: true,
      message: 'Invitación rechazada correctamente',
    });
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al rechazar invitación:`, error.message);
    logger.error('Error rejecting invitation', error);
    if (error.message.includes('Invalid path format')) {
      return errorResponse('Invalid invitation token', 400);
    }
    return internalErrorResponse('Failed to reject invitation');
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

    // Verificar si el usuario ya existe
    const existingUser = await prisma.users.findFirst({
      where: { email: invitation.email },
    });

    // CASO: Usuario ya registrado - verificar autenticación y asociar
    if (existingUser) {
      console.log(`🔍 [CLINICS] Usuario ya registrado, verificando autenticación...`);
      
      // Verificar autenticación (opcional pero recomendado)
      try {
        const authResult = await requireRole(event, [enum_roles.provider]);
        if ('statusCode' in authResult) {
          // Si no está autenticado, permitir continuar pero con advertencia
          console.log(`⚠️ [CLINICS] Usuario no autenticado, pero continuando con asociación`);
        } else {
          const authContext = authResult as AuthContext;
          // Verificar que el usuario autenticado es el mismo de la invitación
          if (authContext.user.id !== existingUser.id) {
            console.error(`❌ [CLINICS] Usuario autenticado no coincide con el email de la invitación`);
            return errorResponse('You can only accept invitations for your own email', 403);
          }
        }
      } catch (authError) {
        // Si falla la autenticación, continuar de todas formas (para casos donde no se requiere)
        console.log(`⚠️ [CLINICS] Error en autenticación, continuando sin verificar`);
      }

      // Verificar que es provider
      if (existingUser.role !== enum_roles.provider) {
        console.error(`❌ [CLINICS] Usuario no es provider`);
        return errorResponse('Only providers can accept clinic invitations', 400);
      }

      // Verificar que no esté ya asociado a esta clínica
      const existingAssociation = await prisma.clinic_doctors.findFirst({
        where: {
          user_id: existingUser.id,
          clinic_id: invitation.clinic_id,
        },
      });

      if (existingAssociation) {
        // Ya está asociado, solo marcar invitación como aceptada
        await prisma.doctor_invitations.update({
          where: { id: invitation.id },
          data: { status: 'accepted' },
        });

        console.log(`✅ [CLINICS] Usuario ya estaba asociado a esta clínica`);
        return successResponse({
          message: 'Already associated with this clinic',
          clinicId: invitation.clinic_id,
          userId: existingUser.id,
        });
      }

      // Buscar provider
      const provider = await prisma.providers.findFirst({
        where: { user_id: existingUser.id },
      });

      if (!provider) {
        console.error(`❌ [CLINICS] Provider no encontrado para usuario ${existingUser.id}`);
        return errorResponse('Provider profile not found', 404);
      }

      // Asociar médico a la clínica
      await prisma.clinic_doctors.create({
        data: {
          id: randomUUID(),
          clinic_id: invitation.clinic_id,
          user_id: existingUser.id,
          is_invited: false, // Ya aceptó
          is_active: true,
        },
      });

      // Marcar invitación como aceptada
      await prisma.doctor_invitations.update({
        where: { id: invitation.id },
        data: { status: 'accepted' },
      });

      console.log(`✅ [CLINICS] Médico existente asociado a clínica ${invitation.clinic_id}`);

      return successResponse({
        message: 'Invitation accepted successfully',
        clinicId: invitation.clinic_id,
        userId: existingUser.id,
        doctor: {
          clinicId: invitation.clinic_id,
          userId: existingUser.id,
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
      console.error(`❌ [CLINICS] Categoría de servicio "doctor" no encontrada`);
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
      // Crear hash de contraseña
      const passwordHash = createHash('sha256').update(password).digest('hex');

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

    console.log(`✅ [CLINICS] Invitación aceptada exitosamente: ${invitation.email}`);
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
    console.error(`❌ [CLINICS] Error al aceptar invitación:`, error.message);
    logger.error('Error accepting invitation', error);
    if (error.message.includes('Validation error') || error.message.includes('Invalid path format')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Failed to accept invitation');
  }
}
