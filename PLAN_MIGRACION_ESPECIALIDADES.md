# 📋 Plan de Migración: Sistema de Especialidades con Tarifas

**Fecha:** 20 de febrero de 2026  
**Objetivo:** Permitir que doctores tengan múltiples especialidades, cada una con su propia tarifa

---

## 🎯 Lo Que Tu Jefe Quiere

**Funcionalidad deseada:**
- Un doctor puede tener múltiples especialidades
- Cada especialidad tiene su propia tarifa
- En la app web, el doctor puede:
  1. Elegir una especialidad de la lista
  2. Poner la tarifa para esa especialidad
  3. Guardar la relación

**Ejemplo:**
```
Dr. Juan Pérez:
  - Cardiología: $50
  - Medicina General: $30
  - Pediatría: $40
```

---

## 📊 Cambios en la Base de Datos

### Tabla Nueva: `provider_specialties`

Ya existe en el schema, solo necesitamos usarla:

```sql
CREATE TABLE provider_specialties (
  provider_id  UUID,
  specialty_id UUID,
  fee          DECIMAL(10,2) DEFAULT 0,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (provider_id, specialty_id)
);
```

**Campos:**
- `provider_id` - ID del doctor
- `specialty_id` - ID de la especialidad
- `fee` - Tarifa de consulta para esa especialidad
- `created_at`, `updated_at` - Timestamps

---

## 🔧 Cambios Necesarios en el Backend

### 1. Endpoints de Perfil de Doctor

#### GET /api/doctors/profile

**ANTES:**
```json
{
  "id": "uuid",
  "name": "Dr. Juan Pérez",
  "specialties": ["Cardiología", "Pediatría"],
  "consultation_fee": 50
}
```

**AHORA:**
```json
{
  "id": "uuid",
  "name": "Dr. Juan Pérez",
  "specialties": [
    {
      "id": "uuid",
      "name": "Cardiología",
      "fee": 50
    },
    {
      "id": "uuid",
      "name": "Pediatría",
      "fee": 40
    }
  ]
}
```

#### PUT /api/doctors/profile

**ANTES:**
```json
{
  "specialties": ["uuid1", "uuid2"],
  "consultation_fee": 50
}
```

**AHORA:**
```json
{
  "specialties": [
    {
      "specialtyId": "uuid1",
      "fee": 50
    },
    {
      "specialtyId": "uuid2",
      "fee": 40
    }
  ]
}
```

---

### 2. Endpoint Nuevo: Gestionar Especialidades

#### POST /api/doctors/specialties
Agregar una especialidad con su tarifa

**Body:**
```json
{
  "specialtyId": "uuid",
  "fee": 50
}
```

#### DELETE /api/doctors/specialties/:specialtyId
Eliminar una especialidad

#### PUT /api/doctors/specialties/:specialtyId
Actualizar la tarifa de una especialidad

**Body:**
```json
{
  "fee": 60
}
```

---

### 3. Búsqueda Pública de Doctores

#### GET /api/public/doctors

**Cambio en el query:**

**ANTES:**
```typescript
where: {
  specialties: {
    some: { id: specialtyId }
  }
}
```

**AHORA:**
```typescript
where: {
  provider_specialties: {
    some: { specialty_id: specialtyId }
  }
}
```

**Respuesta incluye tarifa:**
```json
{
  "doctors": [
    {
      "id": "uuid",
      "name": "Dr. Juan Pérez",
      "specialties": [
        {
          "name": "Cardiología",
          "fee": 50
        }
      ]
    }
  ]
}
```

---

### 4. Registro de Doctores

#### POST /api/auth/register (type=DOCTOR)

**ANTES:**
```json
{
  "email": "doctor@example.com",
  "password": "password",
  "name": "Dr. Juan Pérez",
  "specialties": ["uuid1", "uuid2"],
  "price": 50
}
```

**AHORA:**
```json
{
  "email": "doctor@example.com",
  "password": "password",
  "name": "Dr. Juan Pérez",
  "specialties": [
    {
      "specialtyId": "uuid1",
      "fee": 50
    },
    {
      "specialtyId": "uuid2",
      "fee": 40
    }
  ]
}
```

---

## 📝 Archivos a Modificar

### Backend

1. **src/doctors/profile.controller.ts**
   - `getProfile()` - Incluir especialidades con tarifas
   - `updateProfile()` - Actualizar especialidades con tarifas

2. **src/doctors/specialties.controller.ts** (NUEVO)
   - `addSpecialty()` - Agregar especialidad con tarifa
   - `updateSpecialtyFee()` - Actualizar tarifa
   - `removeSpecialty()` - Eliminar especialidad

3. **src/doctors/handler.ts**
   - Agregar rutas para gestionar especialidades

4. **src/auth/auth.controller.ts**
   - `register()` - Actualizar lógica de registro de doctores

5. **src/public/doctors.controller.ts**
   - `searchDoctors()` - Actualizar queries y respuestas

6. **src/shared/validators.ts**
   - Agregar validadores para especialidades con tarifas

---

## 🧪 Plan de Implementación

### Fase 1: Preparación (1 hora)
1. ✅ Verificar estado actual de la BD
2. ✅ Documentar cambios necesarios
3. ⏳ Crear script de migración de datos (si hay datos existentes)

### Fase 2: Backend Core (2-3 horas)
1. Actualizar `getProfile()` para incluir especialidades con tarifas
2. Actualizar `updateProfile()` para manejar especialidades con tarifas
3. Crear endpoints nuevos para gestionar especialidades
4. Actualizar validadores

### Fase 3: Búsqueda y Registro (1-2 horas)
1. Actualizar búsqueda pública de doctores
2. Actualizar registro de doctores
3. Actualizar endpoints de clínicas que usan especialidades

### Fase 4: Testing (1 hora)
1. Probar registro de doctor con especialidades
2. Probar agregar/actualizar/eliminar especialidades
3. Probar búsqueda por especialidad
4. Probar obtener perfil con especialidades

### Fase 5: Frontend (Coordinación)
1. Actualizar formulario de registro
2. Actualizar perfil de doctor
3. Agregar UI para gestionar especialidades

---

## ⚠️ Consideraciones Importantes

### 1. Migración de Datos Existentes

Si ya hay doctores en la BD con especialidades en el sistema viejo, necesitamos:

**Opción A: Migración automática**
```sql
-- Migrar especialidades existentes con tarifa por defecto
INSERT INTO provider_specialties (provider_id, specialty_id, fee)
SELECT 
  p.id,
  s.id,
  COALESCE(p.consultation_fee, 0) -- Usar tarifa general como default
FROM providers p
JOIN specialties s ON ... -- Relación vieja
WHERE NOT EXISTS (
  SELECT 1 FROM provider_specialties ps 
  WHERE ps.provider_id = p.id AND ps.specialty_id = s.id
);
```

**Opción B: Pedir a doctores que configuren**
- Dejar que cada doctor configure sus tarifas manualmente
- Más trabajo pero más preciso

### 2. Compatibilidad con Frontend

**¿El frontend está listo para esto?**
- ¿Tienen UI para agregar múltiples especialidades?
- ¿Tienen campos para ingresar tarifa por especialidad?
- ¿O necesitan desarrollar esto primero?

### 3. Tarifa por Defecto

**¿Qué pasa si un doctor no pone tarifa?**
- Opción 1: Requerir tarifa (obligatorio)
- Opción 2: Usar $0 como default
- Opción 3: Usar una tarifa general del doctor

---

## 📋 Checklist Antes de Empezar

- [ ] Verificar cuántos doctores hay en la BD
- [ ] Verificar si ya hay datos en `provider_specialties`
- [ ] Confirmar con frontend si están listos
- [ ] Decidir estrategia de migración de datos
- [ ] Decidir manejo de tarifas por defecto
- [ ] Crear backup de la BD

---

## 🚀 Siguiente Paso

**Necesitamos saber:**

1. **¿Hay doctores en la BD actualmente?**
   - Si sí: Necesitamos migrar sus datos
   - Si no: Podemos empezar limpio

2. **¿El frontend está listo?**
   - Si sí: Podemos implementar todo
   - Si no: Coordinamos con ellos primero

3. **¿Cuándo quieren esto?**
   - Urgente: Implementamos lo básico primero
   - Con tiempo: Hacemos todo bien desde el inicio

**Para verificar el estado actual, puedes:**
1. Conectarte a la BD de Neon
2. Ejecutar el script `scripts/check-db-simple.sql`
3. Ver cuántos doctores hay y si tienen especialidades

**O dime y yo te ayudo a revisar la BD directamente.**

---

**¿Qué prefieres hacer primero?**
1. Revisar la BD para ver qué hay
2. Empezar a implementar asumiendo que está vacía
3. Coordinar con frontend primero
