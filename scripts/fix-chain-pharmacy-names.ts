import { getPrismaClient } from "../src/shared/prisma";

/**
 * Corrige las farmacias de cadena que quedaron registradas con el nombre del
 * representante legal en lugar del nombre de la cadena.
 *
 * El formulario de registro no pide "nombre del establecimiento" cuando se
 * elige una cadena, y el backend caía al nombre de la persona. Eso se mostraba
 * en el listado de sucursales y en las notificaciones de "nueva farmacia".
 *
 * Uso:
 *   npx ts-node scripts/fix-chain-pharmacy-names.ts            (solo reporta)
 *   npx ts-node scripts/fix-chain-pharmacy-names.ts --apply    (corrige)
 */
async function fixChainPharmacyNames() {
  const apply = process.argv.includes("--apply");
  const prisma = getPrismaClient();

  try {
    const pharmacies = await prisma.providers.findMany({
      where: { chain_id: { not: null } },
      include: {
        pharmacy_chains: { select: { name: true } },
        provider_branches: { select: { id: true, name: true } },
      },
    });

    console.log(`\n📊 Farmacias con cadena asignada: ${pharmacies.length}`);

    const wrong = pharmacies.filter(
      (p) => p.pharmacy_chains?.name && p.commercial_name !== p.pharmacy_chains.name,
    );

    if (wrong.length === 0) {
      console.log("✅ No hay nombres por corregir.");
      return;
    }

    console.log(`\n⚠️  ${wrong.length} farmacia(s) con nombre incorrecto:\n`);
    wrong.forEach((p) => {
      console.log(`  - ${p.commercial_name} -> ${p.pharmacy_chains!.name}`);
      p.provider_branches.forEach((b) => {
        if (b.name !== p.pharmacy_chains!.name) {
          console.log(`      sucursal: ${b.name} -> ${p.pharmacy_chains!.name}`);
        }
      });
    });

    if (!apply) {
      console.log("\n💡 Ejecución en seco. Vuelve a correr con --apply para guardar los cambios.");
      return;
    }

    for (const p of wrong) {
      const chainName = p.pharmacy_chains!.name;

      await prisma.providers.update({
        where: { id: p.id },
        data: { commercial_name: chainName },
      });

      await prisma.provider_branches.updateMany({
        where: { provider_id: p.id },
        data: { name: chainName },
      });
    }

    console.log(`\n✅ ${wrong.length} farmacia(s) corregida(s).`);
  } catch (error: any) {
    console.error("❌ Error corrigiendo nombres de farmacias:", error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

fixChainPharmacyNames();
