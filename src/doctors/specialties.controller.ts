import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { internalErrorResponse, successResponse } from '../shared/response';

export async function getSpecialties(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
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

    return successResponse(specialties);
  } catch (error: any) {
    logger.error('Error fetching specialties', error);
    return internalErrorResponse('Failed to fetch specialties');
  }
}