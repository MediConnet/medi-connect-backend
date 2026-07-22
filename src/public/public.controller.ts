import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { internalErrorResponse, successResponse } from '../shared/response';
import { TYPE_TO_SLUG } from '../shared/constants';

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

export async function getPublicSettings(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const prisma = getPrismaClient();
    const settings = await prisma.admin_settings.findUnique({
      where: { id: 1 },
      select: {
        require_backup_documents: true
      }
    });
    
    return successResponse({
      requireBackupDocuments: settings ? settings.require_backup_documents : true
    });
  } catch (error: any) {
    logger.error('Error fetching public settings', error);
    return internalErrorResponse('Failed to fetch settings');
  }
}

export async function getPublicProviders(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const queryParams = event.queryStringParameters || {};
  const rawType = (queryParams.type || queryParams.providerType || "").toLowerCase();
  const targetSlug = TYPE_TO_SLUG[rawType] || rawType;
  const search = queryParams.q || queryParams.search || "";
  const prisma = getPrismaClient();

  try {
    const where: any = {
      users: { is_active: true },
      provider_branches: { some: { is_active: true } },
    };

    if (targetSlug) {
      where.OR = [
        { service_categories: { slug: targetSlug } },
        { service_categories: { name: { contains: rawType, mode: "insensitive" } } },
      ];
    }

    if (search.trim()) {
      const s = search.trim();
      where.AND = [
        {
          OR: [
            { commercial_name: { contains: s, mode: "insensitive" } },
            { description: { contains: s, mode: "insensitive" } },
          ],
        },
      ];
    }

    let providersRaw: any[] = await (prisma.providers as any).findMany({
      where,
      include: {
        users: { select: { email: true, profile_picture_url: true } },
        provider_branches: {
          where: { is_active: true },
          include: { cities: true },
        },
        service_categories: true,
        provider_catalog: {
          where: { is_available: true },
        },
      },
    });

    // Fallback: Si no hay proveedores estrictos con el slug "aesthetic", retornar proveedores activos
    if (providersRaw.length === 0 && (targetSlug === "aesthetic" || targetSlug === "estetica")) {
      providersRaw = await (prisma.providers as any).findMany({
        where: {
          users: { is_active: true },
          provider_branches: { some: { is_active: true } },
        },
        include: {
          users: { select: { email: true, profile_picture_url: true } },
          provider_branches: {
            where: { is_active: true },
            include: { cities: true },
          },
          service_categories: true,
          provider_catalog: {
            where: { is_available: true },
          },
        },
      });
    }

    const formatted = await Promise.all(providersRaw.map(async (p: any) => {
      const mainBranch = p.provider_branches?.find((b: any) => b.is_main) || p.provider_branches?.[0];
      const branchId = mainBranch?.id;
      let rating = 5.0;
      let totalReviews = 0;

      if (branchId) {
        const [agg, count] = await Promise.all([
          prisma.reviews.aggregate({
            where: { branch_id: branchId },
            _avg: { rating: true },
          }),
          prisma.reviews.count({
            where: { branch_id: branchId },
          }),
        ]);
        if (agg._avg.rating != null) {
          rating = Number(agg._avg.rating);
        } else if (mainBranch?.rating_cache != null) {
          rating = Number(mainBranch.rating_cache);
        }
        totalReviews = count;
      }

      return {
        id: p.id,
        commercial_name: p.commercial_name || "Centro Estético",
        name: p.commercial_name || "Centro Estético",
        description: p.description || "",
        logo_url: p.logo_url || p.users?.profile_picture_url || "",
        profile_picture_url: p.logo_url || p.users?.profile_picture_url || "",
        address: mainBranch?.address_text || "",
        city: mainBranch?.cities?.name || "",
        phone: mainBranch?.phone || mainBranch?.phone_contact || "",
        rating: Number(rating.toFixed(1)),
        total_reviews: totalReviews,
        services: p.provider_catalog || [],
      };
    }));

    return successResponse(formatted);
  } catch (error: any) {
    logger.error("Error fetching public providers", error);
    return internalErrorResponse("Failed to fetch public providers");
  }
}

export async function getPublicProviderById(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const path = event.requestContext.http.path;
  const pathParts = path.split("/");
  const providerId = pathParts[pathParts.length - 1];
  const prisma = getPrismaClient();

  try {
    const provider: any = await (prisma.providers as any).findUnique({
      where: { id: providerId },
      include: {
        users: { select: { email: true, profile_picture_url: true } },
        provider_branches: {
          where: { is_active: true },
          include: {
            cities: true,
            provider_schedules: {
              where: { is_active: true },
              orderBy: { day_of_week: "asc" },
            },
          },
        },
        service_categories: true,
        provider_catalog: {
          where: { is_available: true },
        },
      },
    });

    if (!provider) {
      return internalErrorResponse("Proveedor no encontrado");
    }

    const mainBranch = provider.provider_branches?.find((b: any) => b.is_main) || provider.provider_branches?.[0];
    let rating = 5.0;
    let totalReviews = 0;

    if (mainBranch?.id) {
      const [agg, count] = await Promise.all([
        prisma.reviews.aggregate({
          where: { branch_id: mainBranch.id },
          _avg: { rating: true },
        }),
        prisma.reviews.count({
          where: { branch_id: mainBranch.id },
        }),
      ]);
      if (agg._avg.rating != null) {
        rating = Number(agg._avg.rating);
      } else if (mainBranch?.rating_cache != null) {
        rating = Number(mainBranch.rating_cache);
      }
      totalReviews = count;
    }

    const images: string[] = [];
    if (provider.logo_url) images.push(provider.logo_url);
    if (provider.users?.profile_picture_url && !images.includes(provider.users.profile_picture_url)) {
      images.push(provider.users.profile_picture_url);
    }
    if (Array.isArray(mainBranch?.preview_images)) {
      images.push(...mainBranch.preview_images);
    }

    const services = (provider.provider_catalog && provider.provider_catalog.length > 0)
      ? provider.provider_catalog
      : [
          { id: "s1", name: "Limpieza Facial Profunda", price: 45.0, duration_minutes: 60, description: "Exfoliación, extracción de impurezas e hidratación médica." },
          { id: "s2", name: "Tratamiento de Rejuvenecimiento", price: 80.0, duration_minutes: 90, description: "Tecnología láser y ácido hialurónico." },
          { id: "s3", name: "Masaje Relajante & Spa", price: 55.0, duration_minutes: 60, description: "Alivio de tensión corporal e hidroterapia." }
        ];

    const specPriceRecord = await prisma.provider_specialties.findFirst({
      where: { provider_id: providerId },
    });
    const priceRecord = await prisma.consultation_prices.findFirst({
      where: { provider_id: providerId },
    });
    const consultationPrice = specPriceRecord?.fee != null && Number(specPriceRecord.fee) > 0
      ? Number(specPriceRecord.fee)
      : (priceRecord?.price ? Number(priceRecord.price) : 55.0);

    const formatted = {
      id: provider.id,
      branchId: mainBranch?.id || provider.id,
      mainBranchId: mainBranch?.id || provider.id,
      commercial_name: provider.commercial_name || "Centro Estético",
      name: provider.commercial_name || "Centro Estético",
      description: provider.description || "Especialistas en belleza, tratamientos faciales, corporales y bienestar integral.",
      logo_url: provider.logo_url || provider.users?.profile_picture_url || "",
      profile_picture_url: provider.logo_url || provider.users?.profile_picture_url || "",
      images: images.length > 0 ? images : [provider.logo_url || "https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=800"],
      address: mainBranch?.address_text || "Quito, Ecuador",
      city: mainBranch?.cities?.name || "Quito",
      phone: mainBranch?.phone || mainBranch?.phone_contact || "",
      price: consultationPrice,
      consultation_price: consultationPrice,
      tarifas: { consulta: consultationPrice },
      rating: Number(rating.toFixed(1)),
      total_reviews: totalReviews,
      services: services,
      schedules: mainBranch?.provider_schedules || [],
      reviews: []
    };

    return successResponse(formatted);
  } catch (error: any) {
    logger.error("Error fetching provider by id", error);
    return internalErrorResponse("Error al obtener detalle del centro");
  }
}