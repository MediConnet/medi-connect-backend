import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { internalErrorResponse, successResponse } from '../shared/response';

export async function getSpecialties(_event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [SPECIALTIES] GET /api/specialties - Obteniendo especialidades');
  
  try {
    const prisma = getPrismaClient();
    
    const specialties = await prisma.specialties.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        color_hex: true,
        description: true,
        _count: {
          select: {
            provider_specialties: true
          }
        }
      }
    });

    // Mapeamos para limpiar la estructura del _count y devolver un JSON plano
    const formattedSpecialties = specialties.map(s => ({
      id: s.id,
      name: s.name,
      color_hex: s.color_hex,
      description: s.description,
      doctorsCount: s._count.provider_specialties 
    }));

    console.log(`✅ [SPECIALTIES] Se encontraron ${formattedSpecialties.length} especialidades`);
    return successResponse(formattedSpecialties);

  } catch (error: any) {
    console.error('❌ [SPECIALTIES] Error al obtener especialidades:', error.message);
    logger.error('Error fetching specialties', error);
    return internalErrorResponse('Failed to fetch specialties');
  }
}