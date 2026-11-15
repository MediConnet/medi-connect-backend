/**
 * Resuelve el descuento de un anuncio desde la base, no desde el cliente.
 *
 * La app manda `discount` en el alta de la cita cuando el paciente llega desde
 * un anuncio, y hasta ahora el backend aplicaba ese numero tal cual. Es decir:
 * el paciente decidia su propio descuento. Mandando `discount: 100` la cita
 * salia en $0 sin que existiera ningun anuncio.
 *
 * Ahora el valor que manda el cliente solo sirve como señal de "vengo de un
 * anuncio"; el porcentaje real se busca en provider_ads, exigiendo que el
 * anuncio este aprobado, activo y dentro de sus fechas.
 */

/**
 * Extrae el porcentaje del titulo de un anuncio.
 *
 * La regla es deliberadamente estricta: el titulo vale como descuento SOLO si
 * es un numero pelado ("30", "12.5"). El proveedor escribe nada mas el numero
 * y el simbolo "%" lo pone la interfaz al mostrarlo.
 *
 * Antes se buscaba el primer numero dentro de cualquier texto, asi que "2x1"
 * se leia como 2% y los banners del admin con titulo libre tambien pasaban por
 * descuento. Cualquier titulo que no sea un numero se trata como texto y no
 * descuenta nada.
 */
export function parseDiscountPercent(raw: unknown): number {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : 0;
  }
  if (typeof raw !== "string") return 0;

  const texto = raw.trim();
  if (!/^\d+(?:\.\d+)?$/.test(texto)) return 0;

  return parseFloat(texto);
}

/** true si el titulo del anuncio es un porcentaje y no texto libre. */
export function isDiscountTitle(raw: unknown): boolean {
  return parseDiscountPercent(raw) > 0;
}

/**
 * Devuelve el porcentaje de descuento vigente del proveedor, o 0 si no tiene
 * ningun anuncio que lo respalde.
 *
 * @param prisma      cliente de Prisma ya inicializado
 * @param providerId  proveedor con el que se agenda la cita
 */
export async function resolveActiveAdDiscount(
  prisma: any,
  providerId: string | null | undefined,
): Promise<number> {
  if (!providerId) return 0;

  const ahora = new Date();

  const anuncio = await prisma.provider_ads.findFirst({
    where: {
      provider_id: providerId,
      status: "APPROVED",
      is_active: true,
      start_date: { lte: ahora },
      OR: [{ end_date: null }, { end_date: { gt: ahora } }],
    },
    // Si hubiera varios vigentes se toma el de mayor prioridad, el mismo orden
    // con el que se muestran en el carrusel.
    orderBy: [{ priority_order: "asc" }, { start_date: "desc" }],
    select: { id: true, title: true },
  });

  if (!anuncio) return 0;

  const porcentaje = parseDiscountPercent(anuncio.title);

  // Un anuncio puede no ser de descuento (texto libre). Fuera de 1-100 no se
  // aplica nada.
  if (!(porcentaje > 0) || porcentaje > 100) return 0;

  return porcentaje;
}
