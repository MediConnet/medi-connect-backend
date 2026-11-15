-- Duracion de cita por proveedor.
--
-- El panel ya ofrecia elegir entre 30 y 60 minutos, pero el valor no se
-- guardaba en ningun lado: el backend no conocia el campo, asi que al recargar
-- volvia siempre a 30. Y la agenda generaba los turnos con una constante fija,
-- de modo que una consulta de 60 minutos habria dejado libre el turno de la
-- media hora siguiente y se habrian podido encimar dos citas.
--
-- 30 por defecto, que es lo que la agenda venia asumiendo para todos.

ALTER TABLE "providers"
  ADD COLUMN IF NOT EXISTS "appointment_duration_minutes" INTEGER DEFAULT 30;
