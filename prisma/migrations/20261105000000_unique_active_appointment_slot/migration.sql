-- Impide dos citas activas en el mismo horario del mismo proveedor.
--
-- Hasta ahora la unica proteccion era la comprobacion de la aplicacion
-- (findFirst y despues create en appointments.controller.ts), que deja una
-- ventana entre la consulta y el insert: dos peticiones simultaneas pasaban
-- las dos la validacion y se creaban las dos citas. La base no lo impedia
-- porque provider_id y scheduled_for solo tenian indices normales.
--
-- El indice es PARCIAL a proposito: solo cubre los estados que ocupan el
-- horario. Las citas canceladas o rechazadas quedan fuera, porque es normal
-- tener varias canceladas en el mismo hueco (reintentos de pago, abandonos).
-- La lista de estados es la misma que usa la comprobacion de conflicto.
--
-- Al crear la cita, el codigo captura el error P2002 de Prisma y devuelve el
-- mismo 409 que ya devolvia la comprobacion previa.

CREATE UNIQUE INDEX IF NOT EXISTS "appointments_slot_activo_unico"
  ON "appointments" ("provider_id", "scheduled_for")
  WHERE "status" IN (
    'PENDING',
    'CONFIRMED',
    'COMPLETED',
    'PENDING_PAYMENT',
    'PROCESSING'
  );
