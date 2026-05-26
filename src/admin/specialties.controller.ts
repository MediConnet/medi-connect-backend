import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { enum_roles } from '../generated/prisma/client';
import { requireRole } from '../shared/auth';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, successResponse } from '../shared/response';

function extractId(path: string, prefix: string): string {
  const after = path.slice(path.indexOf(prefix) + prefix.length);
  return after.split('/')[0];
}

export async function getSpecialties(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) return authResult;

  const prisma = getPrismaClient();
  try {
    const specialties = await prisma.specialties.findMany({
      orderBy: { name: 'asc' },
      
    });


    console.log("-------------------");
    console.log(specialties);
    console.log("-------------------");

    return successResponse(specialties);
  } catch (error: any) {
    console.error('Error getSpecialties:', error);
    return internalErrorResponse('Error al obtener especialidades');
  }
}

export async function createSpecialty(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) return authResult;

  const prisma = getPrismaClient();
  try {
    const body = JSON.parse(event.body || '{}');
    const { name, description, color_hex } = body;

    if (!name || name.trim().length < 3) {
      return errorResponse('El nombre debe tener al menos 3 caracteres', 400);
    }

    const existing = await prisma.specialties.findFirst({
      where: { name: { equals: name.trim(), mode: 'insensitive' } },
    });

    if (existing) {
      return errorResponse('Ya existe una especialidad con ese nombre', 409);
    }

    const specialty = await prisma.specialties.create({
      data: {
        id: randomUUID(),
        name: name.trim(),
        description: description || null,
        color_hex: color_hex || null,
      },
    });

    return successResponse(specialty, 201);
  } catch (error: any) {
    console.error('Error createSpecialty:', error);
    return internalErrorResponse('Error al crear especialidad');
  }
}

export async function updateSpecialty(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) return authResult;

  const prisma = getPrismaClient();
  try {
    const id = extractId(event.requestContext.http.path, '/api/admin/specialties/');
    const body = JSON.parse(event.body || '{}');
    const { name, description, color_hex } = body;

    const existing = await prisma.specialties.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('Especialidad no encontrada', 404);
    }

    if (name && name.trim().length < 3) {
      return errorResponse('El nombre debe tener al menos 3 caracteres', 400);
    }

    if (name) {
      const duplicate = await prisma.specialties.findFirst({
        where: { name: { equals: name.trim(), mode: 'insensitive' }, NOT: { id } },
      });
      if (duplicate) {
        return errorResponse('Ya existe una especialidad con ese nombre', 409);
      }
    }

    const updated = await prisma.specialties.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description || null }),
        ...(color_hex !== undefined && { color_hex: color_hex || null }),
      },
    });

    return successResponse(updated);
  } catch (error: any) {
    console.error('Error updateSpecialty:', error);
    return internalErrorResponse('Error al actualizar especialidad');
  }
}

export async function deleteSpecialty(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) return authResult;

  const prisma = getPrismaClient();
  try {
    const id = extractId(event.requestContext.http.path, '/api/admin/specialties/');

    const existing = await prisma.specialties.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('Especialidad no encontrada', 404);
    }

    const linkedDoctors = await prisma.provider_specialties.count({ where: { specialty_id: id } });
    if (linkedDoctors > 0) {
      return errorResponse(`No se puede eliminar: ${linkedDoctors} médico(s) tienen esta especialidad`, 409);
    }

    const linkedPrices = await prisma.consultation_prices.count({ where: { specialty_id: id } });
    if (linkedPrices > 0) {
      return errorResponse(`No se puede eliminar: ${linkedPrices} precio(s) de consulta usan esta especialidad`, 409);
    }

    await prisma.specialties.delete({ where: { id } });

    return successResponse({ message: 'Especialidad eliminada correctamente' });
  } catch (error: any) {
    console.error('Error deleteSpecialty:', error);
    return internalErrorResponse('Error al eliminar especialidad');
  }
}
