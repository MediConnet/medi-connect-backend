import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { internalErrorResponse, successResponse } from '../shared/response';

export async function getCities(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const prisma = getPrismaClient();
    const cities = await prisma.cities.findMany({
      orderBy: { name: 'asc' },
      select: { 
        id: true, 
        name: true, 
        state: true 
      }
    });
    
    return successResponse(cities);
  } catch (error: any) {
    logger.error('Error fetching cities', error);
    return internalErrorResponse('Failed to fetch cities');
  }
}