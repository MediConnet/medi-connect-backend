/**
 * Resuelve a que pantalla de la app lleva un anuncio.
 *
 * Antes esto se congelaba al crear el anuncio: se guardaba `target_screen` a
 * partir de la categoria del proveedor y `target_id = provider.id`. Eso dejaba
 * dos fallos:
 *
 *  1. FarmaciaDetail y ClinicaDetail NO se abren con el id del proveedor:
 *     la primera necesita el id de la SUCURSAL y la segunda el de la CLINICA.
 *     Con el id del proveedor la pantalla pedia un recurso que no existe y
 *     mostraba "No encontrado".
 *  2. Si el proveedor cambiaba de categoria despues de crear el anuncio, la
 *     pantalla guardada quedaba obsoleta (por ejemplo, una farmacia apuntando
 *     a EsteticaDetail).
 *
 * Por eso el destino se calcula al leer, con la categoria y las sucursales
 * actuales del proveedor.
 */

const SLUG_TO_SCREEN: Record<string, string> = {
  doctor: "DoctorDetail",
  pharmacy: "FarmaciaDetail",
  farmacia: "FarmaciaDetail",
  laboratory: "LaboratorioDetail",
  laboratorio: "LaboratorioDetail",
  ambulance: "AmbulanciaDetail",
  ambulancia: "AmbulanciaDetail",
  supplies: "InsumoDetail",
  insumos: "InsumoDetail",
  aesthetic: "EsteticaDetail",
  estetica: "EsteticaDetail",
  clinic: "ClinicaDetail",
  clinica: "ClinicaDetail",
};

/** Nombre del parametro con el que cada pantalla de detalle recibe su id. */
const SCREEN_PARAM: Record<string, string> = {
  DoctorDetail: "doctorId",
  FarmaciaDetail: "farmaciaId",
  LaboratorioDetail: "laboratorioId",
  AmbulanciaDetail: "ambulanciaId",
  InsumoDetail: "tiendaId",
  EsteticaDetail: "esteticaId",
  ClinicaDetail: "clinicId",
};

export interface AdNavigation {
  screen: string;
  params: Record<string, string>;
}

/** Destino neutro: el anuncio se abre pero sin boton de "ver servicio". */
export const AD_NAVIGATION_HOME: AdNavigation = { screen: "Home", params: {} };

/**
 * @param prisma      cliente de Prisma ya inicializado
 * @param providerId  proveedor dueño del anuncio (null en anuncios del admin)
 * @param slug        slug de su categoria de servicio
 */
export async function resolveAdNavigation(
  prisma: any,
  providerId: string | null | undefined,
  slug: string | null | undefined,
): Promise<AdNavigation> {
  if (!providerId) return AD_NAVIGATION_HOME;

  const screen = SLUG_TO_SCREEN[(slug || "").toLowerCase()];
  if (!screen) return AD_NAVIGATION_HOME;

  let id: string = providerId;

  if (screen === "FarmaciaDetail") {
    // La app abre la sucursal, no el proveedor. Se prefiere la principal.
    const branch = await prisma.provider_branches.findFirst({
      where: { provider_id: providerId, is_active: true },
      orderBy: { is_main: "desc" },
      select: { id: true },
    });
    if (!branch) return AD_NAVIGATION_HOME;
    id = branch.id;
  }

  if (screen === "ClinicaDetail") {
    // La clinica es una fila aparte, ligada al mismo usuario que el proveedor.
    const provider = await prisma.providers.findUnique({
      where: { id: providerId },
      select: { user_id: true },
    });
    const clinic = provider?.user_id
      ? await prisma.clinics.findFirst({
          where: { user_id: provider.user_id },
          select: { id: true },
        })
      : null;
    if (!clinic) return AD_NAVIGATION_HOME;
    id = clinic.id;
  }

  return { screen, params: { [SCREEN_PARAM[screen]]: id } };
}
