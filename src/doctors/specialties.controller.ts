import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { internalErrorResponse, successResponse } from '../shared/response';

export async function getSpecialties(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [SPECIALTIES] GET /api/specialties - Obteniendo especialidades');
  try {
    const prisma = getPrismaClient();
    
    const specialties = await prisma.specialties.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        color_hex: true,
        description: true
      }
    });

    console.log(`✅ [SPECIALTIES] Se encontraron ${specialties.length} especialidades`);
    return successResponse(specialties);
  } catch (error: any) {
    console.error('❌ [SPECIALTIES] Error al obtener especialidades:', error.message);
    logger.error('Error fetching specialties', error);
    return internalErrorResponse('Failed to fetch specialties');
  }
}