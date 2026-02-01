import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { AuthContext, requireAuth } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse } from '../shared/response';
import { extractIdFromPath, parseBody } from '../shared/validators';
import { z } from 'zod';

// Schemas de validación
const createReminderSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
  type: z.enum(['medicamento', 'cita', 'general']).optional().default('general'),
  note: z.string().optional(),
  active: z.boolean().optional().default(true),
});

const updateReminderSchema = z.object({
  title: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  type: z.enum(['medicamento', 'cita', 'general']).optional(),
  note: z.string().optional(),
  active: z.boolean().optional(),
});

/**
 * Listar recordatorios del paciente
 * GET /api/patients/reminders
 */
export async function getReminders(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [REMINDERS] GET /api/patients/reminders - Listando recordatorios');
  
  const authResult = await requireAuth(event);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    // Buscar el paciente
    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      return successResponse([], 200, event);
    }

    const queryParams = event.queryStringParameters || {};
    const active = queryParams.active;
    const type = queryParams.type;
    const date = queryParams.date;

    // Construir where
    const where: any = {
      patient_id: patient.id,
    };

    if (active !== undefined) {
      where.active = active === 'true';
    }

    if (type) {
      where.type = type;
    }

    if (date) {
      where.date = date;
    }

    // NOTA: Esta tabla no existe aún en el schema, por lo que esto fallará
    // hasta que se cree la migración. Por ahora retornamos estructura vacía
    // con un mensaje indicando que necesita implementación.
    
    // TODO: Crear tabla patient_reminders con los siguientes campos:
    // - id (UUID)
    // - patient_id (UUID, FK a patients)
    // - title (VARCHAR)
    // - date (DATE)
    // - time (TIME)
    // - type (VARCHAR o ENUM: 'medicamento', 'cita', 'general')
    // - note (TEXT, nullable)
    // - active (BOOLEAN, default true)
    // - created_at (TIMESTAMP)
    // - updated_at (TIMESTAMP)

    // Por ahora, retornamos un array vacío con un mensaje
    console.log('⚠️ [REMINDERS] Tabla patient_reminders no existe aún. Retornando estructura vacía.');
    
    return successResponse({
      reminders: [],
      message: 'Reminders feature pending database migration',
    }, 200, event);

    // Código que funcionará cuando se cree la tabla:
    /*
    const reminders = await prisma.patient_reminders.findMany({
      where,
      orderBy: [
        { date: 'asc' },
        { time: 'asc' },
      ],
    });

    return successResponse(reminders, 200, event);
    */
  } catch (error: any) {
    console.error('❌ [REMINDERS] Error al listar recordatorios:', error.message);
    logger.error('Error fetching reminders', error);
    return internalErrorResponse('Failed to fetch reminders', event);
  }
}

/**
 * Crear recordatorio
 * POST /api/patients/reminders
 */
export async function createReminder(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [REMINDERS] POST /api/patients/reminders - Creando recordatorio');
  
  const authResult = await requireAuth(event);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const body = parseBody(event.body, createReminderSchema);

    // Buscar el paciente
    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      return errorResponse('Patient not found', 404, undefined, event);
    }

    // NOTA: Esta tabla no existe aún
    console.log('⚠️ [REMINDERS] Tabla patient_reminders no existe aún. No se puede crear recordatorio.');
    
    return errorResponse('Reminders feature pending database migration', 501, undefined, event);

    // Código que funcionará cuando se cree la tabla:
    /*
    const reminder = await prisma.patient_reminders.create({
      data: {
        patient_id: patient.id,
        title: body.title,
        date: new Date(body.date),
        time: body.time,
        type: body.type || 'general',
        note: body.note || null,
        active: body.active !== undefined ? body.active : true,
      },
    });

    return successResponse(reminder, 201, event);
    */
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.errors, event);
    }
    console.error('❌ [REMINDERS] Error al crear recordatorio:', error.message);
    logger.error('Error creating reminder', error);
    return internalErrorResponse('Failed to create reminder', event);
  }
}

/**
 * Actualizar recordatorio
 * PATCH /api/patients/reminders/{id}
 */
export async function updateReminder(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [REMINDERS] PATCH /api/patients/reminders/{id} - Actualizando recordatorio');
  
  const authResult = await requireAuth(event);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const reminderId = extractIdFromPath(event.requestContext.http.path, '/api/patients/reminders/');
    
    if (!reminderId) {
      return errorResponse('Reminder ID is required', 400, undefined, event);
    }

    const body = parseBody(event.body, updateReminderSchema);

    // Buscar el paciente
    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      return errorResponse('Patient not found', 404, undefined, event);
    }

    // NOTA: Esta tabla no existe aún
    console.log('⚠️ [REMINDERS] Tabla patient_reminders no existe aún. No se puede actualizar recordatorio.');
    
    return errorResponse('Reminders feature pending database migration', 501, undefined, event);

    // Código que funcionará cuando se cree la tabla:
    /*
    const updateData: any = {};
    if (body.title) updateData.title = body.title;
    if (body.date) updateData.date = new Date(body.date);
    if (body.time) updateData.time = body.time;
    if (body.type) updateData.type = body.type;
    if (body.note !== undefined) updateData.note = body.note;
    if (body.active !== undefined) updateData.active = body.active;
    updateData.updated_at = new Date();

    const reminder = await prisma.patient_reminders.updateMany({
      where: {
        id: reminderId,
        patient_id: patient.id, // Verificar ownership
      },
      data: updateData,
    });

    if (reminder.count === 0) {
      return notFoundResponse('Reminder not found', event);
    }

    const updatedReminder = await prisma.patient_reminders.findUnique({
      where: { id: reminderId },
    });

    return successResponse(updatedReminder, 200, event);
    */
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, error.errors, event);
    }
    console.error('❌ [REMINDERS] Error al actualizar recordatorio:', error.message);
    logger.error('Error updating reminder', error);
    return internalErrorResponse('Failed to update reminder', event);
  }
}

/**
 * Eliminar recordatorio
 * DELETE /api/patients/reminders/{id}
 */
export async function deleteReminder(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [REMINDERS] DELETE /api/patients/reminders/{id} - Eliminando recordatorio');
  
  const authResult = await requireAuth(event);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const reminderId = extractIdFromPath(event.requestContext.http.path, '/api/patients/reminders/');
    
    if (!reminderId) {
      return errorResponse('Reminder ID is required', 400, undefined, event);
    }

    // Buscar el paciente
    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      return errorResponse('Patient not found', 404, undefined, event);
    }

    // NOTA: Esta tabla no existe aún
    console.log('⚠️ [REMINDERS] Tabla patient_reminders no existe aún. No se puede eliminar recordatorio.');
    
    return errorResponse('Reminders feature pending database migration', 501, undefined, event);

    // Código que funcionará cuando se cree la tabla:
    /*
    const reminder = await prisma.patient_reminders.deleteMany({
      where: {
        id: reminderId,
        patient_id: patient.id, // Verificar ownership
      },
    });

    if (reminder.count === 0) {
      return notFoundResponse('Reminder not found', event);
    }

    return successResponse({ message: 'Reminder deleted successfully' }, 200, event);
    */
  } catch (error: any) {
    console.error('❌ [REMINDERS] Error al eliminar recordatorio:', error.message);
    logger.error('Error deleting reminder', error);
    return internalErrorResponse('Failed to delete reminder', event);
  }
}

/**
 * Activar/desactivar recordatorio
 * PATCH /api/patients/reminders/{id}/toggle
 */
export async function toggleReminder(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [REMINDERS] PATCH /api/patients/reminders/{id}/toggle - Toggle recordatorio');
  
  const authResult = await requireAuth(event);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const reminderId = extractIdFromPath(event.requestContext.http.path, '/api/patients/reminders/', '/toggle');
    
    if (!reminderId) {
      return errorResponse('Reminder ID is required', 400, undefined, event);
    }

    // Buscar el paciente
    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      return errorResponse('Patient not found', 404, undefined, event);
    }

    // NOTA: Esta tabla no existe aún
    console.log('⚠️ [REMINDERS] Tabla patient_reminders no existe aún. No se puede toggle recordatorio.');
    
    return errorResponse('Reminders feature pending database migration', 501, undefined, event);

    // Código que funcionará cuando se cree la tabla:
    /*
    // Primero obtener el recordatorio para ver su estado actual
    const currentReminder = await prisma.patient_reminders.findFirst({
      where: {
        id: reminderId,
        patient_id: patient.id,
      },
    });

    if (!currentReminder) {
      return notFoundResponse('Reminder not found', event);
    }

    const updatedReminder = await prisma.patient_reminders.update({
      where: { id: reminderId },
      data: {
        active: !currentReminder.active,
        updated_at: new Date(),
      },
    });

    return successResponse(updatedReminder, 200, event);
    */
  } catch (error: any) {
    console.error('❌ [REMINDERS] Error al toggle recordatorio:', error.message);
    logger.error('Error toggling reminder', error);
    return internalErrorResponse('Failed to toggle reminder', event);
  }
}


