import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { enum_roles } from '../generated/prisma/client';
import { requireRole } from '../shared/auth';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, paginatedResponse, successResponse } from '../shared/response';

function extractId(path: string, prefix: string): string {
  const after = path.slice(path.indexOf(prefix) + prefix.length);
  return after.split('/')[0];
}

const LETTERS_AND_SPACES_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;

export async function getCities(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) return authResult;

  const prisma = getPrismaClient();
  try {
    const queryParams = event.queryStringParameters || {};
    const page = Math.max(1, parseInt(queryParams.page || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(queryParams.limit || '20', 10)));
    const offset = (page - 1) * limit;
    const search = queryParams.search || '';

    console.log(`🔍 [getCities] page=${page}, limit=${limit}, offset=${offset}, search="${search}"`);

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { state: { contains: search, mode: 'insensitive' as const } },
            { country: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [cities, total] = await Promise.all([
      prisma.cities.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: offset,
        take: limit,
      }),
      prisma.cities.count({ where }),
    ]);

    console.log(`✅ [getCities] total=${total}, returned=${cities.length}`);
    return paginatedResponse(cities, total, page, limit);
  } catch (error: any) {
    console.error('Error getCities:', error);
    return internalErrorResponse('Error al obtener ciudades');
  }
}

export async function createCity(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) return authResult;

  const prisma = getPrismaClient();
  try {
    const body = JSON.parse(event.body || '{}');
    const { name, state, country } = body;

    if (!name || name.trim().length < 3) {
      return errorResponse('El nombre debe tener al menos 3 caracteres', 400);
    }

    if (!LETTERS_AND_SPACES_REGEX.test(name.trim())) {
      return errorResponse('El nombre de la ciudad solo debe contener letras y espacios', 400);
    }

    if (state && !LETTERS_AND_SPACES_REGEX.test(state.trim())) {
      return errorResponse('El estado o provincia solo debe contener letras y espacios', 400);
    }

    if (country && !LETTERS_AND_SPACES_REGEX.test(country.trim())) {
      return errorResponse('El país solo debe contener letras y espacios', 400);
    }

    const existing = await prisma.cities.findFirst({
      where: { name: { equals: name.trim(), mode: 'insensitive' } },
    });

    if (existing) {
      return errorResponse('Ya existe una ciudad con ese nombre', 409);
    }

    const city = await prisma.cities.create({
      data: {
        id: randomUUID(),
        name: name.trim(),
        state: state ? state.trim() : null,
        country: country ? country.trim() : 'Ecuador', // Predeterminar Ecuador si no se especifica
      },
    });

    console.log(`✅ [createCity] Creada ciudad: ${city.name} (${city.id})`);
    return successResponse(city, 201);
  } catch (error: any) {
    console.error('Error createCity:', error);
    return internalErrorResponse('Error al crear ciudad');
  }
}

export async function updateCity(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) return authResult;

  const prisma = getPrismaClient();
  try {
    const id = extractId(event.requestContext.http.path, '/api/admin/cities/');
    const body = JSON.parse(event.body || '{}');
    const { name, state, country } = body;

    const existing = await prisma.cities.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('Ciudad no encontrada', 404);
    }

    if (name) {
      if (name.trim().length < 3) {
        return errorResponse('El nombre debe tener al menos 3 caracteres', 400);
      }
      if (!LETTERS_AND_SPACES_REGEX.test(name.trim())) {
        return errorResponse('El nombre de la ciudad solo debe contener letras y espacios', 400);
      }

      const duplicate = await prisma.cities.findFirst({
        where: { name: { equals: name.trim(), mode: 'insensitive' }, NOT: { id } },
      });
      if (duplicate) {
        return errorResponse('Ya existe una ciudad con ese nombre', 409);
      }
    }

    if (state && !LETTERS_AND_SPACES_REGEX.test(state.trim())) {
      return errorResponse('El estado o provincia solo debe contener letras y espacios', 400);
    }

    if (country && !LETTERS_AND_SPACES_REGEX.test(country.trim())) {
      return errorResponse('El país solo debe contener letras y espacios', 400);
    }

    const updated = await prisma.cities.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(state !== undefined && { state: state ? state.trim() : null }),
        ...(country !== undefined && { country: country ? country.trim() : null }),
      },
    });

    console.log(`✅ [updateCity] Actualizada ciudad: ${updated.name} (${updated.id})`);
    return successResponse(updated);
  } catch (error: any) {
    console.error('Error updateCity:', error);
    return internalErrorResponse('Error al actualizar ciudad');
  }
}

export async function deleteCity(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) return authResult;

  const prisma = getPrismaClient();
  try {
    const id = extractId(event.requestContext.http.path, '/api/admin/cities/');

    const existing = await prisma.cities.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('Ciudad no encontrada', 404);
    }

    const linkedBranches = await prisma.provider_branches.count({ where: { city_id: id } });
    if (linkedBranches > 0) {
      return errorResponse(`No se puede eliminar la ciudad porque tiene ${linkedBranches} sucursal(es) de proveedor asociada(s)`, 409);
    }

    await prisma.cities.delete({ where: { id } });

    console.log(`✅ [deleteCity] Eliminada ciudad: ${existing.name} (${existing.id})`);
    return successResponse({ message: 'Ciudad eliminada correctamente' });
  } catch (error: any) {
    console.error('Error deleteCity:', error);
    return internalErrorResponse('Error al eliminar ciudad');
  }
}
