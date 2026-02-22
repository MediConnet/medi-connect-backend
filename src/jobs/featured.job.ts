/**
 * Cron Job: Actualización de Servicios Destacados
 * Se podría configurar en AWS EventBridge para ejecutarse cada 12 o 24 horas.
 * Expresión Cron sugerida: cron(0 3 * * ? *) -> Todos los días a las 3:00 AM UTC
 */

import { randomUUID } from "crypto";
import { getPrismaClient } from "../shared/prisma";

export async function updateFeaturedBranches(event?: any): Promise<void> {
  console.log("🚀 [CRON] Iniciando actualización de servicios destacados...");
  const prisma = getPrismaClient();

  try {
    const candidates = await prisma.provider_branches.findMany({
      where: {
        is_active: true,
        image_url: { not: null },
        rating_cache: { gte: 4.5 },
        providers: {
          service_categories: {
            slug: {
              in: ["doctor", "pharmacy", "laboratory", "ambulance", "supplies"],
            },
          },
        },
      },
      include: {
        providers: {
          include: {
            service_categories: { select: { slug: true } },
          },
        },
        _count: {
          select: {
            reviews: true,
            appointments: {
              where: { status: "COMPLETED" },
            },
          },
        },
      },
    });

    console.log(
      `🔍 [CRON] Evaluando ${candidates.length} sucursales candidatas...`,
    );

    // Utilizamos un Map para asegurar que solo guardemos el Top 1 de cada categoría
    const topBranchesByCategory = new Map<string, any>();

    for (const branch of candidates) {
      if (branch._count.reviews < 10) {
        continue;
      }

      const categorySlug = branch.providers?.service_categories?.slug;

      if (!categorySlug) continue;

      let isFeatured = false;
      let reason = "";

      let score = (branch.rating_cache || 0) * 10 + branch._count.reviews * 0.5;

      switch (categorySlug) {
        case "doctor":
          // Criterio: Más de 10 citas completadas
          if (branch._count.appointments >= 10) {
            isFeatured = true;
            reason = "TOP_DOCTOR";
            score += branch._count.appointments * 2;
          }
          break;

        case "pharmacy":
        case "supplies":
          // Criterio: Tiene delivery o es 24 horas
          if (branch.has_delivery || branch.is_24h) {
            isFeatured = true;
            reason = branch.is_24h ? "24_7_SERVICE" : "FAST_DELIVERY";
            if (branch.has_delivery) score += 10;
            if (branch.is_24h) score += 15;
          }
          break;

        case "ambulance":
          // Criterio: 24 horas y con área de cobertura definida
          if (branch.is_24h && branch.coverage_area) {
            isFeatured = true;
            reason = "24_7_EMERGENCY";
            score += 20;
          }
          break;

        case "laboratory":
          // Criterio: Para laboratorios nos basta el rating alto y las reseñas
          isFeatured = true;
          reason = branch.is_24h ? "24_7_LAB" : "TOP_RATED_LAB";
          if (branch.is_24h) score += 15;
          break;
      }

      // Si cumple los requisitos, evaluamos si es el mejor de su categoría
      if (isFeatured) {
        const currentScore = parseFloat(score.toFixed(2));
        const existingTop = topBranchesByCategory.get(categorySlug);

        // Si la categoría aún no tiene un destacado, o si el actual supera el score del que ya estaba guardado, lo reemplazamos
        if (!existingTop || currentScore > existingTop.score) {
          topBranchesByCategory.set(categorySlug, {
            id: randomUUID(),
            branch_id: branch.id,
            score: currentScore,
            featured_reason: reason,
            is_active: true,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
          });
        }
      }
    }

    const newFeaturedBranches = Array.from(topBranchesByCategory.values());

    console.log(
      `🏆 [CRON] ${newFeaturedBranches.length} sucursales ganaron el puesto (Top 1 por categoría).`,
    );

    if (newFeaturedBranches.length > 0) {
      await prisma.$transaction([
        prisma.featured_branches.deleteMany({}),
        prisma.featured_branches.createMany({
          data: newFeaturedBranches,
        }),
      ]);
      console.log("✅ [CRON] Tabla de destacados actualizada con éxito.");
    } else {
      await prisma.featured_branches.deleteMany({});
      console.log(
        "⚠️ [CRON] Ninguna sucursal cumplió los requisitos hoy. Tabla limpiada.",
      );
    }
  } catch (error) {
    console.error("❌ [CRON] Error crítico actualizando destacados:", error);
    throw error;
  }
}
