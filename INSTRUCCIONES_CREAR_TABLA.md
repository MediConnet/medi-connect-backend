# 📋 Instrucciones para Crear la Tabla consultation_prices

## Problema
La tabla `consultation_prices` no existe en tu base de datos y hay problemas de conexión con los scripts automáticos.

## Solución: Ejecutar SQL Manualmente

### Opción 1: Usar la Consola de Neon (Recomendado)

1. **Ir a Neon Console:**
   - Abre https://console.neon.tech
   - Inicia sesión
   - Selecciona tu proyecto `mediconnet_bd`

2. **Abrir SQL Editor:**
   - En el menú lateral, busca "SQL Editor" o "Query"
   - Se abrirá un editor de SQL

3. **Copiar y pegar este SQL:**

```sql
-- Crear tabla consultation_prices
CREATE TABLE IF NOT EXISTS "consultation_prices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" UUID NOT NULL,
    "specialty_id" UUID,
    "consultation_type" VARCHAR(255) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "duration_minutes" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_prices_pkey" PRIMARY KEY ("id")
);

-- Crear índices
CREATE INDEX IF NOT EXISTS "consultation_prices_provider_id_idx" 
ON "consultation_prices"("provider_id");

CREATE INDEX IF NOT EXISTS "consultation_prices_specialty_id_idx" 
ON "consultation_prices"("specialty_id");

CREATE INDEX IF NOT EXISTS "consultation_prices_is_active_idx" 
ON "consultation_prices"("is_active");

-- Agregar foreign keys
ALTER TABLE "consultation_prices" 
DROP CONSTRAINT IF EXISTS "consultation_prices_provider_id_fkey";

ALTER TABLE "consultation_prices" 
ADD CONSTRAINT "consultation_prices_provider_id_fkey" 
FOREIGN KEY ("provider_id") REFERENCES "providers"("id") 
ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "consultation_prices" 
DROP CONSTRAINT IF EXISTS "consultation_prices_specialty_id_fkey";

ALTER TABLE "consultation_prices" 
ADD CONSTRAINT "consultation_prices_specialty_id_fkey" 
FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") 
ON DELETE SET NULL ON UPDATE NO ACTION;

-- Verificar que se creó correctamente
SELECT COUNT(*) as total_registros FROM consultation_prices;
```

4. **Ejecutar el SQL:**
   - Haz clic en "Run" o presiona Ctrl+Enter
   - Deberías ver mensajes de éxito

5. **Verificar:**
   - La última consulta debe mostrar `total_registros: 0`
   - Esto confirma que la tabla existe

---

### Opción 2: Usar psql (Si lo tienes instalado)

```bash
psql "postgresql://neondb_owner:npg_d8ZNiusWS9vE@ep-sweet-boat-adx1dkso-pooler.c-2.us-east-1.aws.neon.tech/mediconnet_bd?sslmode=require" -f scripts/create-consultation-prices-table.sql
```

---

### Opción 3: Usar TablePlus, DBeaver, pgAdmin

1. Conectar a tu base de datos con estos datos:
   - Host: `ep-sweet-boat-adx1dkso-pooler.c-2.us-east-1.aws.neon.tech`
   - Port: `5432`
   - Database: `mediconnet_bd`
   - User: `neondb_owner`
   - Password: `npg_d8ZNiusWS9vE`
   - SSL: Required

2. Abrir un editor SQL

3. Copiar y pegar el SQL de arriba

4. Ejecutar

---

## Después de Crear la Tabla

Una vez que hayas creado la tabla, ejecuta estos comandos:

```bash
# 1. Regenerar Prisma Client
npx prisma generate

# 2. Verificar que todo está bien
npx prisma db pull

# 3. Reiniciar el servidor
npm run dev
```

---

## Verificar que Funcionó

Después de crear la tabla y reiniciar el servidor, prueba el endpoint:

```bash
# GET - Obtener precios (debe retornar objeto vacío si no hay precios)
curl -X GET http://localhost:3000/api/doctors/consultation-prices \
  -H "Authorization: Bearer TU_TOKEN_DE_MEDICO"

# Respuesta esperada:
# { "success": true, "data": {} }
```

---

## ¿Por qué no funcionó automáticamente?

El problema es que:
1. La migración se marcó como aplicada pero no se ejecutó
2. Hay problemas de conexión con el password que tiene caracteres especiales
3. Prisma db push dice que está sincronizado pero la tabla no existe

La solución más confiable es ejecutar el SQL manualmente en la consola de Neon.

---

## Contacto

Si tienes problemas, avísame y te ayudo con otra solución.
