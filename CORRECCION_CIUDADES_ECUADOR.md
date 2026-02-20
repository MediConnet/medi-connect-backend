# 🔧 Corrección de Ciudades de Ecuador

**Fecha:** 20 de febrero de 2026  
**Problema:** Error de tipeo "Queti" en lugar de "Quito"  
**Prioridad:** ALTA

---

## ⚠️ Problema Reportado por Frontend

En el selector de ciudades del formulario de registro aparece **"Queti"** (error de tipeo) en lugar de **"Quito"**.

![Evidencia del problema](imagen mostrando: Cuenca, Guayaquil, Queti, Quito)

---

## 🔧 Solución

### Opción 1: Ejecutar Script SQL (RECOMENDADO)

1. Conectarse a la base de datos PostgreSQL en Neon
2. Ejecutar el script: `scripts/fix-cities.sql`

```bash
# Si tienes psql instalado:
psql $DATABASE_URL -f scripts/fix-cities.sql

# O copiar y pegar el contenido del archivo en el SQL Editor de Neon
```

### Opción 2: Ejecutar Comandos SQL Manualmente

Conectarse a la base de datos y ejecutar:

```sql
-- 1. Verificar si existe "Queti"
SELECT * FROM cities WHERE name = 'Queti';

-- 2. Si existe "Queti" y también existe "Quito", eliminar "Queti"
DELETE FROM cities WHERE name = 'Queti';

-- 3. Si existe "Queti" pero NO existe "Quito", actualizar
UPDATE cities 
SET name = 'Quito', state = 'Pichincha' 
WHERE name = 'Queti';

-- 4. Verificar que "Quito" existe
SELECT * FROM cities WHERE name = 'Quito';

-- 5. Si no existe "Quito", crearlo
INSERT INTO cities (id, name, state, country, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Quito',
  'Pichincha',
  'Ecuador',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Quito');

-- 6. Verificar resultado
SELECT name, state FROM cities ORDER BY name;
```

### Opción 3: Usar Script TypeScript (Si la conexión funciona)

```bash
npx ts-node scripts/fix-cities.ts
```

---

## 📋 Ciudades Principales que Deben Existir

Después de la corrección, estas ciudades deben estar en la base de datos:

### Top 15 Ciudades de Ecuador:

1. **Quito** (Pichincha) - Capital
2. **Guayaquil** (Guayas) - Ciudad más poblada
3. **Cuenca** (Azuay)
4. **Santo Domingo** (Santo Domingo de los Tsáchilas)
5. **Machala** (El Oro)
6. **Manta** (Manabí)
7. **Portoviejo** (Manabí)
8. **Ambato** (Tungurahua)
9. **Riobamba** (Chimborazo)
10. **Loja** (Loja)
11. **Esmeraldas** (Esmeraldas)
12. **Quevedo** (Los Ríos)
13. **Ibarra** (Imbabura)
14. **Latacunga** (Cotopaxi)
15. **Salinas** (Santa Elena)

El script SQL incluye la creación de todas estas ciudades si no existen.

---

## ✅ Verificación

Después de ejecutar la corrección:

### 1. Verificar en la Base de Datos

```sql
-- Ver todas las ciudades
SELECT name, state FROM cities ORDER BY name;

-- Buscar "Queti" (no debe existir)
SELECT * FROM cities WHERE name = 'Queti';

-- Buscar "Quito" (debe existir)
SELECT * FROM cities WHERE name = 'Quito';

-- Contar ciudades
SELECT COUNT(*) FROM cities;
```

### 2. Verificar en el Endpoint

```bash
# Probar el endpoint público de ciudades
curl http://localhost:3000/api/public/cities
```

Respuesta esperada:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "name": "Ambato",
      "state": "Tungurahua"
    },
    {
      "id": "uuid-2",
      "name": "Cuenca",
      "state": "Azuay"
    },
    {
      "id": "uuid-3",
      "name": "Guayaquil",
      "state": "Guayas"
    },
    {
      "id": "uuid-4",
      "name": "Quito",
      "state": "Pichincha"
    }
    // ... más ciudades
  ]
}
```

### 3. Verificar en el Frontend

1. Abrir el formulario de registro
2. Hacer clic en el selector de ciudades
3. Verificar que aparece "Quito" (no "Queti")
4. Verificar que no hay duplicados

---

## 📊 Estructura de la Tabla `cities`

```sql
CREATE TABLE cities (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  state VARCHAR(100),
  country VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_cities_name ON cities(name);
CREATE INDEX idx_cities_state ON cities(state);
```

---

## 🎯 Endpoint Afectado

**Endpoint:** `GET /api/public/cities`

**Archivo:** `src/public/public.controller.ts`

**Handler:** `src/public/handler.ts` (línea 40)

Este endpoint es público (no requiere autenticación) y es usado por:
- Formulario de registro de proveedores
- Formulario de registro de pacientes
- Filtros de búsqueda

---

## 🚨 Impacto

**ALTA PRIORIDAD** - Este error es visible para:
- ✅ Todos los usuarios que se registran
- ✅ Todos los proveedores que actualizan su perfil
- ✅ Todos los que buscan servicios por ciudad

---

## 📝 Checklist de Corrección

- [ ] Conectarse a la base de datos
- [ ] Ejecutar script SQL de corrección
- [ ] Verificar que "Queti" ya no existe
- [ ] Verificar que "Quito" existe correctamente
- [ ] Verificar que hay al menos 15 ciudades principales
- [ ] Probar endpoint `GET /api/public/cities`
- [ ] Probar en el frontend (selector de ciudades)
- [ ] Confirmar con el equipo de frontend que el problema está resuelto

---

## 📞 Siguiente Paso

1. **Ejecutar el script SQL** en la base de datos de Neon
2. **Verificar** que la corrección funcionó
3. **Informar al frontend** que el problema está resuelto
4. **Probar** el formulario de registro

---

## 🎉 Resultado Esperado

Después de la corrección:
- ❌ "Queti" eliminado
- ✅ "Quito" existe correctamente
- ✅ 15+ ciudades principales disponibles
- ✅ Frontend muestra ciudades correctas
- ✅ Sin duplicados

---

**Archivos Creados:**
- `scripts/fix-cities.sql` - Script SQL para ejecutar en la BD
- `scripts/fix-cities.ts` - Script TypeScript alternativo
- `CIUDADES_ECUADOR_CORRECTAS.md` - Documentación del frontend
- `CORRECCION_CIUDADES_ECUADOR.md` - Este documento

