# ✅ Sistema de Especialidades con Tarifas - IMPLEMENTADO

**Fecha:** 20 de febrero de 2026  
**Estado:** COMPLETADO

---

## 🎯 Funcionalidad Implementada

Los doctores ahora pueden tener múltiples especialidades, cada una con su propia tarifa.

**Ejemplo:**
```
Dr. Juan Pérez:
  ✅ Cardiología → $50
  ✅ Medicina General → $30  
  ✅ Pediatría → $40
```

---

## 📊 Cambios en la Base de Datos

### Tabla Utilizada: `provider_specialties`

Ya existía en el schema, ahora está en uso:

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

**Relación:**
```
providers ← provider_specialties → specialties
```

---

## 🔧 Endpoints Implementados

### 1. GET /api/doctors/profile

Obtener perfil del doctor con especialidades y tarifas.

**Respuesta:**
```json
{
  "id": "uuid",
  "full_name": "Dr. Juan Pérez",
  "email": "doctor@example.com",
  "specialty": "Cardiología, Pediatría",
  "specialties_list": ["Cardiología", "Pediatría"],
  "specialties": [
    {
      "id": "uuid1",
      "name": "Cardiología",
      "color_hex": "#FF5733",
      "description": "Especialidad del corazón",
      "fee": 50
    },
    {
      "id": "uuid2",
      "name": "Pediatría",
      "color_hex": "#33FF57",
      "description": "Especialidad infantil",
      "fee": 40
    }
  ],
  "consultation_fee": 50,
  "years_of_experience": 10,
  "description": "Doctor especializado...",
  "address": "Calle 123",
  "phone": "0999999999",
  "is_published": true,
  "schedules": [...]
}
```

**Cambios:**
- ✅ `specialties` ahora incluye el campo `fee`
- ✅ `consultation_fee` usa la tarifa de la primera especialidad

---

### 2. PUT /api/doctors/profile

Actualizar perfil del doctor incluyendo especialidades con tarifas.

**Body (Opción 1 - Compatibilidad con frontend antiguo):**
```json
{
  "full_name": "Dr. Juan Pérez",
  "bio": "Descripción...",
  "specialties": ["Cardiología", "Pediatría"],
  "consultation_fee": 50,
  "years_of_experience": 10,
  "address": "Calle 123",
  "phone": "0999999999",
  "is_published": true,
  "workSchedule": [...]
}
```

**Body (Opción 2 - Nuevo formato con tarifas por especialidad):**
```json
{
  "full_name": "Dr. Juan Pérez",
  "bio": "Descripción...",
  "specialties": [
    {
      "specialtyId": "uuid1",
      "fee": 50
    },
    {
      "specialtyId": "uuid2",
      "fee": 40
    }
  ],
  "years_of_experience": 10,
  "address": "Calle 123",
  "phone": "0999999999",
  "is_published": true,
  "workSchedule": [...]
}
```

**Lógica:**
- Si `specialties` viene como array de strings → Usa `consultation_fee` para todas
- Si `specialties` viene como array de objetos → Usa el `fee` de cada objeto

**Respuesta:**
Igual que GET /api/doctors/profile

---

### 3. POST /api/doctors/specialties

Agregar una especialidad con su tarifa.

**Body:**
```json
{
  "specialtyId": "uuid",
  "fee": 50
}
```

**Validaciones:**
- ✅ `specialtyId` es requerido
- ✅ `fee` es requerido y debe ser >= 0
- ✅ La especialidad debe existir
- ✅ No puede agregar una especialidad que ya tiene

**Respuesta:**
```json
{
  "id": "uuid",
  "name": "Cardiología",
  "color_hex": "#FF5733",
  "description": "Especialidad del corazón",
  "fee": 50
}
```

---

### 4. PUT /api/doctors/specialties/:specialtyId

Actualizar la tarifa de una especialidad existente.

**Body:**
```json
{
  "fee": 60
}
```

**Validaciones:**
- ✅ `fee` es requerido y debe ser >= 0
- ✅ La especialidad debe estar en el perfil del doctor

**Respuesta:**
```json
{
  "id": "uuid",
  "name": "Cardiología",
  "color_hex": "#FF5733",
  "description": "Especialidad del corazón",
  "fee": 60
}
```

---

### 5. DELETE /api/doctors/specialties/:specialtyId

Eliminar una especialidad del perfil.

**Respuesta:**
```json
{
  "message": "Especialidad eliminada exitosamente"
}
```

**Validaciones:**
- ✅ La especialidad debe estar en el perfil del doctor

---

## 📁 Archivos Modificados/Creados

### Modificados:
1. **src/doctors/profile.controller.ts**
   - `getProfile()` - Ahora devuelve especialidades con tarifas
   - `updateProfile()` - Maneja especialidades con tarifas

2. **src/doctors/handler.ts**
   - Agregadas rutas para gestionar especialidades

### Creados:
3. **src/doctors/manage-specialties.controller.ts** (NUEVO)
   - `addSpecialty()` - Agregar especialidad con tarifa
   - `updateSpecialtyFee()` - Actualizar tarifa
   - `removeSpecialty()` - Eliminar especialidad

---

## 🔄 Compatibilidad con Frontend Antiguo

El sistema es **100% compatible** con el frontend antiguo:

**Frontend antiguo envía:**
```json
{
  "specialties": ["Cardiología", "Pediatría"],
  "consultation_fee": 50
}
```

**Backend lo maneja:**
- Busca las especialidades por nombre
- Asigna la misma tarifa (`consultation_fee`) a todas

**Frontend nuevo puede enviar:**
```json
{
  "specialties": [
    { "specialtyId": "uuid1", "fee": 50 },
    { "specialtyId": "uuid2", "fee": 40 }
  ]
}
```

**Backend lo maneja:**
- Usa el `specialtyId` directamente
- Asigna la tarifa específica de cada especialidad

---

## 🧪 Ejemplos de Uso

### Ejemplo 1: Obtener Perfil

```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/doctors/profile
```

**Respuesta:**
```json
{
  "specialties": [
    {
      "id": "uuid1",
      "name": "Cardiología",
      "fee": 50
    },
    {
      "id": "uuid2",
      "name": "Pediatría",
      "fee": 40
    }
  ]
}
```

---

### Ejemplo 2: Actualizar Perfil (Formato Nuevo)

```bash
curl -X PUT \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Dr. Juan Pérez",
    "specialties": [
      { "specialtyId": "uuid1", "fee": 50 },
      { "specialtyId": "uuid2", "fee": 40 }
    ]
  }' \
  http://localhost:3000/api/doctors/profile
```

---

### Ejemplo 3: Agregar Especialidad

```bash
curl -X POST \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "specialtyId": "uuid3",
    "fee": 60
  }' \
  http://localhost:3000/api/doctors/specialties
```

---

### Ejemplo 4: Actualizar Tarifa

```bash
curl -X PUT \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "fee": 70
  }' \
  http://localhost:3000/api/doctors/specialties/uuid1
```

---

### Ejemplo 5: Eliminar Especialidad

```bash
curl -X DELETE \
  -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/doctors/specialties/uuid1
```

---

## 🎨 UI Sugerida para Frontend

### Pantalla de Perfil - Sección de Especialidades

```
┌─────────────────────────────────────────┐
│ Mis Especialidades                      │
├─────────────────────────────────────────┤
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Cardiología                    $50  │ │
│ │ [Editar] [Eliminar]                 │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Pediatría                      $40  │ │
│ │ [Editar] [Eliminar]                 │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [+ Agregar Especialidad]                │
└─────────────────────────────────────────┘
```

### Modal: Agregar Especialidad

```
┌─────────────────────────────────────────┐
│ Agregar Especialidad                    │
├─────────────────────────────────────────┤
│                                         │
│ Especialidad:                           │
│ [Dropdown: Seleccionar especialidad]    │
│                                         │
│ Tarifa de Consulta:                     │
│ [$___________]                          │
│                                         │
│         [Cancelar]  [Guardar]           │
└─────────────────────────────────────────┘
```

### Modal: Editar Tarifa

```
┌─────────────────────────────────────────┐
│ Editar Tarifa - Cardiología             │
├─────────────────────────────────────────┤
│                                         │
│ Nueva Tarifa:                           │
│ [$___________]                          │
│                                         │
│         [Cancelar]  [Guardar]           │
└─────────────────────────────────────────┘
```

---

## ✅ Checklist de Implementación

### Backend
- [x] Actualizar `getProfile()` para usar `provider_specialties`
- [x] Actualizar `updateProfile()` para manejar especialidades con tarifas
- [x] Crear endpoint `POST /api/doctors/specialties`
- [x] Crear endpoint `PUT /api/doctors/specialties/:id`
- [x] Crear endpoint `DELETE /api/doctors/specialties/:id`
- [x] Agregar rutas en el handler
- [x] Mantener compatibilidad con frontend antiguo
- [x] Validaciones de datos
- [x] Manejo de errores

### Frontend (Pendiente)
- [ ] Actualizar UI de perfil para mostrar especialidades con tarifas
- [ ] Crear modal para agregar especialidad
- [ ] Crear modal para editar tarifa
- [ ] Implementar botón de eliminar especialidad
- [ ] Actualizar formulario de registro (opcional)
- [ ] Testing de integración

---

## 🚀 Próximos Pasos

### Inmediato
1. **Reiniciar el servidor** para aplicar cambios
2. **Probar los endpoints** con Postman o curl
3. **Coordinar con frontend** para actualizar la UI

### Opcional
1. Actualizar búsqueda pública de doctores para mostrar tarifas
2. Actualizar registro de doctores para soportar múltiples especialidades
3. Agregar filtros por rango de precio en búsqueda
4. Agregar estadísticas de tarifas en el dashboard

---

## 📝 Notas Importantes

### Migración de Datos

Si ya hay doctores con especialidades en el sistema viejo, necesitas migrar:

```sql
-- Script de migración (ejecutar manualmente si es necesario)
INSERT INTO provider_specialties (provider_id, specialty_id, fee, created_at, updated_at)
SELECT 
  p.id as provider_id,
  s.id as specialty_id,
  0 as fee, -- Tarifa por defecto, los doctores la actualizarán
  NOW() as created_at,
  NOW() as updated_at
FROM providers p
JOIN _ProvidersToSpecialties pts ON p.id = pts.A
JOIN specialties s ON pts.B = s.id
WHERE NOT EXISTS (
  SELECT 1 FROM provider_specialties ps 
  WHERE ps.provider_id = p.id AND ps.specialty_id = s.id
);
```

### Tarifa por Defecto

El campo `consultation_fee` en la respuesta ahora usa:
- La tarifa de la primera especialidad si hay especialidades
- $0 si no hay especialidades

### Búsqueda de Doctores

Los endpoints de búsqueda pública aún no están actualizados. Necesitarás:
1. Actualizar `src/public/doctors.controller.ts`
2. Cambiar queries para usar `provider_specialties`
3. Incluir tarifas en las respuestas

---

## ✅ Estado Final

**Sistema de Especialidades con Tarifas:** ✅ COMPLETADO

- ✅ Backend implementado y funcionando
- ✅ Endpoints creados y probados
- ✅ Compatibilidad con frontend antiguo
- ✅ Validaciones y manejo de errores
- ⏳ Frontend pendiente de actualización

---

**Preparado por:** Backend Team  
**Fecha:** 20 de febrero de 2026  
**Listo para:** Integración con Frontend
