-- Una resena por paciente y sucursal.
--
-- La tabla no tenia ninguna restriccion, asi que un mismo paciente podia
-- publicar resenas ilimitadas sobre el mismo local; cada una entraba en el
-- promedio (rating_cache) y permitia inflar o hundir la calificacion a
-- voluntad. El controlador ahora actualiza la resena existente en lugar de
-- crear otra, y este indice lo garantiza aunque lleguen dos peticiones a la vez.
--
-- Las filas con patient_id o branch_id nulos quedan fuera: en Postgres los
-- nulos no colisionan entre si, y ademas no representan una resena atribuible.

CREATE UNIQUE INDEX IF NOT EXISTS "reviews_paciente_sucursal_unico"
  ON "reviews" ("patient_id", "branch_id")
  WHERE "patient_id" IS NOT NULL AND "branch_id" IS NOT NULL;
