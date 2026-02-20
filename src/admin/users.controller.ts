import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { getPrismaClient } from '../shared/prisma';
import { successResponse, errorResponse, internalErrorResponse, notFoundResponse } from '../shared/response';
import { logger } from '../shared/logger';
import { requireRole } from '../shared/auth';
import { enum_roles } from '../generated/prisma/client';

/**
 * GET /api/admin/users
 * Obtener todos los usuarios del sistema
 */
export async function getUsers(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [ADMIN] GET /api/admin/users - Obteniendo usuarios');
  
  // Verificar que sea admin
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const prisma = getPrismaClient();

  try {
    const queryParams = event.queryStringParameters || {};
    const roleFilter = queryParams.role; // 'admin', 'provider', 'patient', etc.
    const searchQuery = queryParams.search; // Buscar por nombre o email
    const limit = parseInt(queryParams.limit || '100', 10);
    const offset = parseInt(queryParams.offset || '0', 10);

    // Construir filtros
    const where: any = {};
    
    if (roleFilter && roleFilter !== 'Todos') {
      // Mapear roles del frontend a roles de BD
      const roleMap: Record<string, string> = {
        'Administrador': 'admin',
        'Médico': 'provider',
        'Paciente': 'patient',
        'admin': 'admin',
        'provider': 'provider',
        'patient': 'patient',
        'user': 'user',
      };
      where.role = roleMap[roleFilter] || roleFilter.toLowerCase();
    }

    if (searchQuery) {
      where.OR = [
        { email: { contains: searchQuery, mode: 'insensitive' } },
      ];
    }

    // Obtener usuarios con sus relaciones
    const users = await prisma.users.findMany({
      where,
      include: {
        providers: {
          select: {
            id: true,
            commercial_name: true,
            verification_status: true,
            service_categories: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
          take: 1, // Solo el primero
        },
        patients: {
          select: {
            id: true,
            full_name: true,
            phone: true,
          },
          take: 1, // Solo el primero
        },
        clinics: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      take: limit,
      skip: offset,
    });

    console.log(`📊 [ADMIN] Total usuarios obtenidos: ${users.length}`);
    
    // Debug: Contar cuántos de cada tipo
    const typeCounts = {
      withClinic: users.filter(u => u.clinics).length,
      withProvider: users.filter(u => u.providers.length > 0).length,
      withPatient: users.filter(u => u.patients.length > 0).length,
      admins: users.filter(u => u.role === 'admin').length,
    };
    console.log(`📊 [ADMIN] Distribución:`, typeCounts);
    
    // Debug: Mostrar usuarios con clínica
    const usersWithClinic = users.filter(u => u.clinics);
    if (usersWithClinic.length > 0) {
      console.log(`🏥 [ADMIN] Usuarios con clínica:`, usersWithClinic.map(u => ({
        email: u.email,
        role: u.role,
        clinicName: u.clinics?.name
      })));
    }

    // Mapear a formato del frontend
    const mappedUsers = users.map((user) => {
      let displayName = user.email;
      let additionalInfo = '';
      let frontendRole: string = user.role; // Usar string en lugar de enum

      // Obtener el primer elemento de los arrays
      const provider = user.providers[0];
      const patient = user.patients[0];
      const clinic = user.clinics;

      // Determinar nombre y tipo según el rol y las relaciones
      // IMPORTANTE: Verificar primero las relaciones, no solo el rol
      if (clinic) {
        // Si tiene clínica, es una clínica
        displayName = clinic.name || user.email;
        additionalInfo = 'Clínica';
        frontendRole = 'clinic'; // Rol personalizado para el frontend
      } else if (user.role === 'admin') {
        displayName = 'Admin General';
        additionalInfo = 'Administrador';
      } else if (provider) {
        // Si tiene provider, es un proveedor
        displayName = provider.commercial_name || user.email;
        additionalInfo = provider.service_categories?.name || 'Proveedor';
      } else if (patient) {
        // Si tiene patient, es un paciente
        displayName = patient.full_name || user.email;
        additionalInfo = 'Paciente';
      } else {
        // Fallback basado en rol
        displayName = user.email;
        additionalInfo = user.role || 'Usuario';
      }

      const mappedUser = {
        id: user.id,
        email: user.email,
        role: frontendRole, // Usar el rol para frontend
        displayName,
        additionalInfo,
        isActive: user.is_active || false,
        profilePictureUrl: user.profile_picture_url,
        createdAt: user.created_at?.toISOString(),
        
        // Información adicional según el tipo
        provider: provider ? {
          id: provider.id,
          commercialName: provider.commercial_name,
          verificationStatus: provider.verification_status,
          serviceType: provider.service_categories?.slug,
        } : undefined,
        
        patient: patient ? {
          id: patient.id,
          fullName: patient.full_name,
          phone: patient.phone,
        } : undefined,
        
        clinic: clinic ? {
          id: clinic.id,
          name: clinic.name,
          phone: clinic.phone,
          address: clinic.address,
        } : undefined,
      };

      // Debug: Log usuarios con clínica
      if (clinic) {
        console.log(`🏥 [ADMIN] Usuario mapeado con clínica:`, {
          email: user.email,
          displayName,
          clinicName: clinic.name
        });
      }

      return mappedUser;
    });

    // Obtener total de usuarios para paginación
    const totalUsers = await prisma.users.count({ where });

    // Debug final
    const clinicsInResponse = mappedUsers.filter(u => u.clinic).length;
    console.log(`✅ [ADMIN] ${mappedUsers.length} usuarios mapeados (total: ${totalUsers})`);
    console.log(`🏥 [ADMIN] ${clinicsInResponse} clínicas en la respuesta`);
    
    if (clinicsInResponse > 0) {
      console.log(`🏥 [ADMIN] Clínicas en respuesta:`, mappedUsers
        .filter(u => u.clinic)
        .map(u => ({ email: u.email, name: u.displayName, clinic: u.clinic?.name }))
      );
    }

    return successResponse({
      users: mappedUsers,
      total: totalUsers,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('❌ [ADMIN] Error al obtener usuarios:', error.message);
    logger.error('Error getting users', error);
    return internalErrorResponse('Failed to get users');
  }
}

/**
 * GET /api/admin/users/:id
 * Obtener detalle de un usuario específico
 */
export async function getUserDetail(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [ADMIN] GET /api/admin/users/:id - Obteniendo detalle de usuario');
  
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const prisma = getPrismaClient();

  try {
    const pathParts = event.requestContext.http.path.split('/');
    const userId = pathParts[pathParts.length - 1];

    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: {
        providers: {
          include: {
            service_categories: true,
            provider_branches: {
              include: {
                cities: true,
              },
            },
          },
        },
        patients: true,
        clinics: {
          include: {
            clinic_doctors: {
              where: { is_active: true },
            },
          },
        },
      },
    });

    if (!user) {
      return notFoundResponse('User not found');
    }

    console.log(`✅ [ADMIN] Usuario ${userId} obtenido`);
    return successResponse(user);
  } catch (error: any) {
    console.error('❌ [ADMIN] Error al obtener detalle de usuario:', error.message);
    logger.error('Error getting user detail', error);
    return internalErrorResponse('Failed to get user detail');
  }
}

/**
 * PATCH /api/admin/users/:id/status
 * Activar o desactivar un usuario
 */
export async function updateUserStatus(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [ADMIN] PATCH /api/admin/users/:id/status - Actualizando estado de usuario');
  
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const prisma = getPrismaClient();

  try {
    const pathParts = event.requestContext.http.path.split('/');
    const userId = pathParts[pathParts.indexOf('users') + 1];

    const body = JSON.parse(event.body || '{}');
    const { isActive } = body;

    if (typeof isActive !== 'boolean') {
      return errorResponse('isActive debe ser un booleano', 400);
    }

    // Actualizar usuario
    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: { is_active: isActive },
    });

    console.log(`✅ [ADMIN] Usuario ${userId} ${isActive ? 'activado' : 'desactivado'}`);
    return successResponse({
      id: updatedUser.id,
      isActive: updatedUser.is_active,
    });
  } catch (error: any) {
    console.error('❌ [ADMIN] Error al actualizar estado de usuario:', error.message);
    logger.error('Error updating user status', error);
    return internalErrorResponse('Failed to update user status');
  }
}

/**
 * PUT /api/admin/users/:id
 * Editar información de un usuario
 */
export async function updateUser(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [ADMIN] PUT /api/admin/users/:id - Actualizando usuario');
  
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const prisma = getPrismaClient();

  try {
    const pathParts = event.requestContext.http.path.split('/');
    const userId = pathParts[pathParts.length - 1];

    const body = JSON.parse(event.body || '{}');
    const { email, role, isActive } = body;

    // Construir datos a actualizar
    const updateData: any = {};
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (typeof isActive === 'boolean') updateData.is_active = isActive;

    // Actualizar usuario
    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: updateData,
    });

    console.log(`✅ [ADMIN] Usuario ${userId} actualizado`);
    return successResponse({
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      isActive: updatedUser.is_active,
    });
  } catch (error: any) {
    console.error('❌ [ADMIN] Error al actualizar usuario:', error.message);
    logger.error('Error updating user', error);
    return internalErrorResponse('Failed to update user');
  }
}

/**
 * DELETE /api/admin/users/:id
 * Eliminar un usuario permanentemente
 * 
 * Validaciones:
 * - Solo administradores pueden eliminar
 * - No puede eliminarse a sí mismo
 * - Elimina todos los datos relacionados (CASCADE)
 */
export async function deleteUser(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('🗑️ [ADMIN] DELETE /api/admin/users/:id - Eliminando usuario');
  
  // Verificar que sea admin
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const prisma = getPrismaClient();

  try {
    const pathParts = event.requestContext.http.path.split('/');
    const userId = pathParts[pathParts.length - 1];
    
    // Obtener el usuario que hace la petición (del token)
    const requestingUserId = authResult.user.id;

    // 1. Verificar que no se esté eliminando a sí mismo
    if (requestingUserId === userId) {
      console.log(`⚠️ [ADMIN] Admin ${requestingUserId} intentó eliminarse a sí mismo`);
      return errorResponse('No puedes eliminar tu propia cuenta de administrador', 400);
    }

    // 2. Buscar usuario a eliminar
    const userToDelete = await prisma.users.findUnique({
      where: { id: userId },
      include: {
        providers: {
          select: { id: true, commercial_name: true },
        },
        patients: {
          select: { id: true, full_name: true },
        },
        clinics: {
          select: { id: true, name: true },
        },
      },
    });

    if (!userToDelete) {
      console.log(`⚠️ [ADMIN] Intento de eliminar usuario inexistente: ${userId}`);
      return notFoundResponse('Usuario no encontrado');
    }

    // 3. Log de auditoría
    const userType = userToDelete.clinics ? 'Clínica' : 
                     userToDelete.providers.length > 0 ? 'Proveedor' : 
                     userToDelete.patients.length > 0 ? 'Paciente' : 
                     'Usuario';
    const userName = userToDelete.clinics?.name || 
                     userToDelete.providers[0]?.commercial_name || 
                     userToDelete.patients[0]?.full_name || 
                     userToDelete.email;

    console.log(`🗑️ [ADMIN] Eliminando ${userType}: ${userName} (${userToDelete.email}) - ID: ${userId}`);
    console.log(`👤 [ADMIN] Solicitado por admin: ${authResult.user.email} (ID: ${requestingUserId})`);

    // 4. Eliminar datos relacionados que tienen onDelete: NoAction
    // Esto debe hacerse ANTES de eliminar el usuario
    
    // 4.1. Si el usuario tiene un paciente, eliminar sus citas primero
    if (userToDelete.patients.length > 0) {
      const patientId = userToDelete.patients[0].id;
      console.log(`🔄 [ADMIN] Eliminando citas del paciente ${patientId}...`);
      
      const appointmentsCount = await prisma.appointments.count({
        where: { patient_id: patientId },
      });
      
      if (appointmentsCount > 0) {
        await prisma.appointments.deleteMany({
          where: { patient_id: patientId },
        });
        console.log(`✅ [ADMIN] ${appointmentsCount} citas eliminadas`);
      }
    }

    // 4.2. Si el usuario es un proveedor, eliminar citas asociadas
    if (userToDelete.providers.length > 0) {
      for (const provider of userToDelete.providers) {
        console.log(`🔄 [ADMIN] Eliminando citas del proveedor ${provider.id}...`);
        
        const appointmentsCount = await prisma.appointments.count({
          where: { provider_id: provider.id },
        });
        
        if (appointmentsCount > 0) {
          await prisma.appointments.deleteMany({
            where: { provider_id: provider.id },
          });
          console.log(`✅ [ADMIN] ${appointmentsCount} citas del proveedor eliminadas`);
        }
      }
    }

    // 4.3. Si el usuario tiene una clínica, eliminar citas asociadas
    if (userToDelete.clinics) {
      console.log(`🔄 [ADMIN] Eliminando citas de la clínica ${userToDelete.clinics.id}...`);
      
      const appointmentsCount = await prisma.appointments.count({
        where: { clinic_id: userToDelete.clinics.id },
      });
      
      if (appointmentsCount > 0) {
        await prisma.appointments.deleteMany({
          where: { clinic_id: userToDelete.clinics.id },
        });
        console.log(`✅ [ADMIN] ${appointmentsCount} citas de la clínica eliminadas`);
      }
    }

    // 5. Ahora sí, eliminar el usuario (CASCADE eliminará el resto de datos relacionados)
    console.log(`🔄 [ADMIN] Ejecutando DELETE del usuario en la base de datos...`);
    
    try {
      const deleteResult = await prisma.users.delete({
        where: { id: userId },
      });
      console.log(`✅ [ADMIN] DELETE ejecutado. Resultado:`, deleteResult);
    } catch (deleteError: any) {
      console.error(`❌ [ADMIN] Error específico al ejecutar DELETE:`, deleteError);
      console.error(`❌ [ADMIN] Código de error:`, deleteError.code);
      console.error(`❌ [ADMIN] Mensaje:`, deleteError.message);
      console.error(`❌ [ADMIN] Meta:`, deleteError.meta);
      throw deleteError; // Re-lanzar para que sea capturado por el catch principal
    }

    // 6. Verificar que se eliminó
    console.log(`🔍 [ADMIN] Verificando eliminación...`);
    const userStillExists = await prisma.users.findUnique({
      where: { id: userId },
    });

    if (userStillExists) {
      console.error(`❌ [ADMIN] ERROR CRÍTICO: El usuario AÚN EXISTE después del DELETE`);
      return internalErrorResponse('Error: El usuario no pudo ser eliminado de la base de datos');
    }

    console.log(`✅ [ADMIN] Usuario ${userName} (${userToDelete.email}) eliminado exitosamente y verificado`);

    return successResponse({
      success: true,
      message: 'Usuario eliminado correctamente',
    });

  } catch (error: any) {
    console.error('❌ [ADMIN] Error al eliminar usuario:', error.message);
    console.error('❌ [ADMIN] Código de error:', error.code);
    console.error('❌ [ADMIN] Stack:', error.stack);
    logger.error('Error deleting user', error);
    
    // Manejar errores específicos
    if (error.code === 'P2025') {
      return notFoundResponse('Usuario no encontrado');
    }
    
    if (error.code === 'P2003') {
      console.error('❌ [ADMIN] Error de foreign key constraint');
      return errorResponse('No se puede eliminar el usuario porque tiene datos relacionados. Contacta al administrador del sistema.', 400);
    }
    
    return internalErrorResponse(`Error al eliminar usuario: ${error.message}`);
  }
}
