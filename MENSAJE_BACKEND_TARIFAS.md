# 📢 Mensaje para Backend - Nueva Funcionalidad: Tarifas por Especialidad

**Fecha:** 20 de febrero de 2026  
**Prioridad:** MEDIA  
**Estado Frontend:** ✅ COMPLETADO

---

## 🎯 Resumen

Hemos implementado una nueva funcionalidad en el panel de médicos que permite configurar **precios diferentes para cada especialidad**. Necesitamos que implementen el endpoint para guardar y recuperar estos precios.

---

## 📸 Vista Previa

El médico ahora tiene una nueva pestaña "Tarifas de Consulta" donde puede ver todas sus especialidades y asignar un precio a cada una:

```
┌────────────────────────────────────────────────┐
│ Especialidad       │ Precio    │ Acciones    │
├────────────────────────────────────────────────┤
│ Cardiología        │ $ 50.00   │ [Editar]    │
│ Medicina General   │ $ 30.00   │ [Editar]    │
│ Dermatología       │ $ 45.00   │ [Editar]    │
└────────────────────────────────────────────────┘
```

---

## 🔧 Endpoints Requeridos

### 1. Guardar Precios de Consulta

```http
PUT /api/doctors/consultation-prices
Authorization: Bearer {token}
Content-Type: application/json

{
  "prices": {
    "Cardiología": 50.00,
    "Medicina General": 30.00,
    "Dermatología": 45.00
  }
}
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "message": "Precios actualizados correctamente"
}
```

**Respuesta Error:**
```json
{
  "success": false,
  "message": "Error al actualizar precios"
}
```

---

### 2. Obtener Precios (Modificar endpoint existente)

Agregar el campo `consultationPrices` al endpoint existente:

```http
GET /api/doctors/profile
Authorization: Bearer {token}
```

**Respuesta (agregar campo):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-123",
    "name": "Dr. Juan Pérez",
    "specialties": ["Cardiología", "Medicina General", "Dermatología"],
    "consultationPrices": {
      "Cardiología": 50.00,
      "Medicina General": 30.00,
      "Dermatología": 45.00
    },
    // ... otros campos
  }
}
```

---

## 🗄️ Estructura de Base de Datos

### Opción 1: Tabla Separada (RECOMENDADO)

```sql
CREATE TABLE doctor_specialty_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  specialty_name VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_doctor_specialty UNIQUE (doctor_id, specialty_name)
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_doctor_specialty_prices_doctor ON doctor_specialty_prices(doctor_id);
```

**Ventajas:**
- ✅ Más fácil de consultar
- ✅ Mejor para reportes y estadísticas
- ✅ Validaciones a nivel de BD
- ✅ Historial de cambios más fácil

---

### Opción 2: Campo JSON (Alternativa)

```sql
ALTER TABLE providers 
ADD COLUMN consultation_prices JSONB DEFAULT '{}';

-- Índice para búsquedas en JSON
CREATE INDEX idx_providers_consultation_prices 
ON providers USING GIN (consultation_prices);
```

**Ejemplo de datos:**
```json
{
  "Cardiología": 50.00,
  "Medicina General": 30.00
}
```

**Ventajas:**
- ✅ Más simple de implementar
- ✅ No requiere tabla adicional

---

## 💡 Lógica de Negocio

### Al Guardar Precios:

1. **Validar que el usuario sea un médico:**
   ```typescript
   if (user.role !== 'DOCTOR') {
     throw new Error('Solo los médicos pueden configurar precios');
   }
   ```

2. **Validar que los precios sean válidos:**
   ```typescript
   for (const [specialty, price] of Object.entries(prices)) {
     if (price < 0) {
       throw new Error('Los precios deben ser mayores o iguales a 0');
     }
   }
   ```

3. **Guardar en la base de datos:**
   - Si usa tabla separada: UPSERT (INSERT ... ON CONFLICT UPDATE)
   - Si usa JSON: UPDATE del campo

4. **Retornar confirmación**

---

### Al Obtener Precios:

1. **Obtener el doctor_id del token JWT**

2. **Consultar precios:**
   ```sql
   -- Opción 1: Tabla separada
   SELECT specialty_name, price 
   FROM doctor_specialty_prices 
   WHERE doctor_id = $1;
   
   -- Opción 2: JSON
   SELECT consultation_prices 
   FROM providers 
   WHERE id = $1;
   ```

3. **Formatear como objeto:**
   ```json
   {
     "Cardiología": 50.00,
     "Medicina General": 30.00
   }
   ```

4. **Incluir en la respuesta del perfil**

---

## 📋 Casos de Uso

### Caso 1: Médico configura precios por primera vez
```
Request:
{
  "prices": {
    "Cardiología": 50.00,
    "Medicina General": 30.00
  }
}

Acción: INSERT nuevos registros
```

### Caso 2: Médico actualiza un precio existente
```
Request:
{
  "prices": {
    "Cardiología": 60.00,  // Cambió de 50 a 60
    "Medicina General": 30.00
  }
}

Acción: UPDATE registro existente
```

### Caso 3: Médico agrega nueva especialidad
```
Request:
{
  "prices": {
    "Cardiología": 50.00,
    "Medicina General": 30.00,
    "Dermatología": 45.00  // Nueva
  }
}

Acción: INSERT nuevo registro para Dermatología
```

---

## ⚠️ Consideraciones Importantes

### 1. Validación de Especialidades

**Pregunta:** ¿Validamos que la especialidad exista en la lista de especialidades del médico?

**Opción A (Recomendado):**
```typescript
// Validar que el médico tenga esa especialidad
const doctorSpecialties = await getDoctorSpecialties(doctorId);
for (const specialty of Object.keys(prices)) {
  if (!doctorSpecialties.includes(specialty)) {
    throw new Error(`El médico no tiene la especialidad: ${specialty}`);
  }
}
```

**Opción B (Más flexible):**
```typescript
// Permitir cualquier especialidad (el frontend ya valida)
// No hacer validación adicional
```

---

### 2. Precio por Defecto

**Pregunta:** ¿Qué pasa si una especialidad no tiene precio configurado?

**Recomendación:**
- Retornar `0` o `null` para especialidades sin precio
- El frontend mostrará `$ 0.00`
- El médico puede configurarlo después

---

### 3. Migración de Datos Existentes

Si ya tienen un campo `consultation_fee` o `price` general:

```sql
-- Migrar precio general a todas las especialidades
INSERT INTO doctor_specialty_prices (doctor_id, specialty_name, price)
SELECT 
  p.id as doctor_id,
  ps.specialty_name,
  p.consultation_fee as price
FROM providers p
JOIN provider_specialties ps ON p.id = ps.provider_id
WHERE p.service_type = 'doctor' 
  AND p.consultation_fee IS NOT NULL;
```

---

## 🧪 Testing

### Casos de Prueba:

1. **Guardar precios nuevos:**
   - ✅ Médico con múltiples especialidades
   - ✅ Médico con una especialidad
   - ✅ Precios válidos (> 0)

2. **Actualizar precios existentes:**
   - ✅ Cambiar precio de una especialidad
   - ✅ Agregar nueva especialidad

3. **Validaciones:**
   - ❌ Precio negativo (debe fallar)
   - ❌ Usuario no es médico (debe fallar)
   - ❌ Token inválido (debe fallar)

4. **Obtener precios:**
   - ✅ Médico con precios configurados
   - ✅ Médico sin precios (retornar objeto vacío)

---

## 📊 Ejemplo Completo

### Request:
```http
PUT /api/doctors/consultation-prices
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "prices": {
    "Cardiología": 50.00,
    "Medicina General": 30.00,
    "Dermatología": 45.00
  }
}
```

### Lógica Backend (Pseudocódigo):
```typescript
async updateConsultationPrices(req, res) {
  // 1. Obtener doctor_id del token
  const doctorId = req.user.providerId;
  
  // 2. Validar que sea médico
  if (req.user.serviceType !== 'doctor') {
    return res.status(403).json({
      success: false,
      message: 'Solo los médicos pueden configurar precios'
    });
  }
  
  // 3. Obtener precios del body
  const { prices } = req.body;
  
  // 4. Validar precios
  for (const [specialty, price] of Object.entries(prices)) {
    if (price < 0) {
      return res.status(400).json({
        success: false,
        message: 'Los precios deben ser mayores o iguales a 0'
      });
    }
  }
  
  // 5. Guardar en BD (UPSERT)
  for (const [specialty, price] of Object.entries(prices)) {
    await db.query(`
      INSERT INTO doctor_specialty_prices (doctor_id, specialty_name, price)
      VALUES ($1, $2, $3)
      ON CONFLICT (doctor_id, specialty_name)
      DO UPDATE SET price = $3, updated_at = CURRENT_TIMESTAMP
    `, [doctorId, specialty, price]);
  }
  
  // 6. Retornar éxito
  return res.json({
    success: true,
    message: 'Precios actualizados correctamente'
  });
}
```

---

## ✅ Checklist de Implementación

- [ ] Crear tabla `doctor_specialty_prices` (o agregar campo JSON)
- [ ] Implementar endpoint `PUT /api/doctors/consultation-prices`
- [ ] Agregar validaciones (precio >= 0, usuario es médico)
- [ ] Modificar `GET /api/doctors/profile` para incluir `consultationPrices`
- [ ] Probar con Postman/Insomnia
- [ ] Migrar datos existentes (si aplica)
- [ ] Confirmar con frontend que funciona

---

## 📞 Dudas o Preguntas

Si tienen dudas sobre:
- Estructura de datos
- Validaciones
- Casos edge
- Formato de respuesta

Contactar al equipo frontend. Estamos disponibles para aclarar cualquier duda.

---

**¡Gracias por su colaboración!** 🚀
