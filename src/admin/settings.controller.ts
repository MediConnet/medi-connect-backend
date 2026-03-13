import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { enum_roles } from '../generated/prisma/client';
import { requireRole } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, successResponse } from '../shared/response';
import { parseBody } from '../shared/validators';

// Schema de validación para actualizar settings
const updateSettingsSchema = z.object({
  commissionDoctor: z.number().min(0).max(100).optional(),
  commissionClinic: z.number().min(0).max(100).optional(),
  commissionLaboratory: z.number().min(0).max(100).optional(),
  commissionPharmacy: z.number().min(0).max(100).optional(),
  commissionSupplies: z.number().min(0).max(100).optional(),
  commissionAmbulance: z.number().min(0).max(100).optional(),
  notifyNewRequests: z.boolean().optional(),
  notifyEmailSummary: z.boolean().optional(),
  autoApproveServices: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  onlyAdminCanPublishAds: z.boolean().optional(),
  requireAdApproval: z.boolean().optional(),
  maxAdsPerProvider: z.number().int().min(0).optional(),
  adApprovalRequired: z.boolean().optional(),
  serviceApprovalRequired: z.boolean().optional(),
  allowServiceSelfActivation: z.boolean().optional(),
  allowAdSelfPublishing: z.boolean().optional(),
});

/**
 * GET /api/admin/settings
 * Obtiene la configuración actual del sistema
 */
export async function getSettings(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('⚙️ [GET_SETTINGS] Obteniendo configuración del sistema');
  
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    console.error('❌ [GET_SETTINGS] Error de autenticación');
    return authResult;
  }

  const prisma = getPrismaClient();

  try {
    // Buscar el registro de configuración (siempre debe ser id = 1)
    let settings = await prisma.admin_settings.findUnique({
      where: { id: 1 },
    });

    // Si no existe, crear con valores por defecto
    if (!settings) {
      console.log('📝 [GET_SETTINGS] No existe configuración, creando valores por defecto');
      settings = await prisma.admin_settings.create({
        data: { id: 1 },
      });
    }

    // Mapear a camelCase para el frontend
    const response = {
      commissionDoctor: Number(settings.commission_doctor),
      commissionClinic: Number(settings.commission_clinic),
      commissionLaboratory: Number(settings.commission_laboratory),
      commissionPharmacy: Number(settings.commission_pharmacy),
      commissionSupplies: Number(settings.commission_supplies),
      commissionAmbulance: Number(settings.commission_ambulance),
      notifyNewRequests: settings.notify_new_requests,
      notifyEmailSummary: settings.notify_email_summary,
      autoApproveServices: settings.auto_approve_services,
      maintenanceMode: settings.maintenance_mode,
      onlyAdminCanPublishAds: settings.only_admin_can_publish_ads,
      requireAdApproval: settings.require_ad_approval,
      maxAdsPerProvider: settings.max_ads_per_provider,
      adApprovalRequired: settings.ad_approval_required,
      serviceApprovalRequired: settings.service_approval_required,
      allowServiceSelfActivation: settings.allow_service_self_activation,
      allowAdSelfPublishing: settings.allow_ad_self_publishing,
    };

    console.log('✅ [GET_SETTINGS] Configuración obtenida exitosamente');
    return successResponse(response);
  } catch (error: any) {
    console.error('❌ [GET_SETTINGS] Error al obtener configuración:', error);
    logger.error('Error getting admin settings', error);
    return internalErrorResponse(error.message || 'Error al obtener configuración');
  }
}

/**
 * PUT /api/admin/settings
 * Actualiza la configuración del sistema
 */
export async function updateSettings(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('⚙️ [UPDATE_SETTINGS] Actualizando configuración del sistema');
  
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    console.error('❌ [UPDATE_SETTINGS] Error de autenticación');
    return authResult;
  }

  // Validar el body
  const bodyResult = parseBody(event.body, updateSettingsSchema);
  if ('statusCode' in bodyResult) {
    console.error('❌ [UPDATE_SETTINGS] Error de validación:', bodyResult);
    return bodyResult as APIGatewayProxyResult;
  }

  const data = bodyResult as z.infer<typeof updateSettingsSchema>;
  console.log('📝 [UPDATE_SETTINGS] Datos a actualizar:', data);

  const prisma = getPrismaClient();

  try {
    // Preparar datos para actualizar (mapear de camelCase a snake_case)
    const updateData: any = {};
    
    if (data.commissionDoctor !== undefined) updateData.commission_doctor = data.commissionDoctor;
    if (data.commissionClinic !== undefined) updateData.commission_clinic = data.commissionClinic;
    if (data.commissionLaboratory !== undefined) updateData.commission_laboratory = data.commissionLaboratory;
    if (data.commissionPharmacy !== undefined) updateData.commission_pharmacy = data.commissionPharmacy;
    if (data.commissionSupplies !== undefined) updateData.commission_supplies = data.commissionSupplies;
    if (data.commissionAmbulance !== undefined) updateData.commission_ambulance = data.commissionAmbulance;
    if (data.notifyNewRequests !== undefined) updateData.notify_new_requests = data.notifyNewRequests;
    if (data.notifyEmailSummary !== undefined) updateData.notify_email_summary = data.notifyEmailSummary;
    if (data.autoApproveServices !== undefined) updateData.auto_approve_services = data.autoApproveServices;
    if (data.maintenanceMode !== undefined) updateData.maintenance_mode = data.maintenanceMode;
    if (data.onlyAdminCanPublishAds !== undefined) updateData.only_admin_can_publish_ads = data.onlyAdminCanPublishAds;
    if (data.requireAdApproval !== undefined) updateData.require_ad_approval = data.requireAdApproval;
    if (data.maxAdsPerProvider !== undefined) updateData.max_ads_per_provider = data.maxAdsPerProvider;
    if (data.adApprovalRequired !== undefined) updateData.ad_approval_required = data.adApprovalRequired;
    if (data.serviceApprovalRequired !== undefined) updateData.service_approval_required = data.serviceApprovalRequired;
    if (data.allowServiceSelfActivation !== undefined) updateData.allow_service_self_activation = data.allowServiceSelfActivation;
    if (data.allowAdSelfPublishing !== undefined) updateData.allow_ad_self_publishing = data.allowAdSelfPublishing;

    // Actualizar timestamp
    updateData.updated_at = new Date();

    // Actualizar o crear el registro
    const settings = await prisma.admin_settings.upsert({
      where: { id: 1 },
      update: updateData,
      create: { id: 1, ...updateData },
    });

    // Mapear a camelCase para el frontend
    const response = {
      commissionDoctor: Number(settings.commission_doctor),
      commissionClinic: Number(settings.commission_clinic),
      commissionLaboratory: Number(settings.commission_laboratory),
      commissionPharmacy: Number(settings.commission_pharmacy),
      commissionSupplies: Number(settings.commission_supplies),
      commissionAmbulance: Number(settings.commission_ambulance),
      notifyNewRequests: settings.notify_new_requests,
      notifyEmailSummary: settings.notify_email_summary,
      autoApproveServices: settings.auto_approve_services,
      maintenanceMode: settings.maintenance_mode,
      onlyAdminCanPublishAds: settings.only_admin_can_publish_ads,
      requireAdApproval: settings.require_ad_approval,
      maxAdsPerProvider: settings.max_ads_per_provider,
      adApprovalRequired: settings.ad_approval_required,
      serviceApprovalRequired: settings.service_approval_required,
      allowServiceSelfActivation: settings.allow_service_self_activation,
      allowAdSelfPublishing: settings.allow_ad_self_publishing,
    };

    console.log('✅ [UPDATE_SETTINGS] Configuración actualizada exitosamente');
    return successResponse({
      message: 'Configuración actualizada correctamente',
      ...response,
    });
  } catch (error: any) {
    console.error('❌ [UPDATE_SETTINGS] Error al actualizar configuración:', error);
    logger.error('Error updating admin settings', error);
    return internalErrorResponse(error.message || 'Error al actualizar configuración');
  }
}
