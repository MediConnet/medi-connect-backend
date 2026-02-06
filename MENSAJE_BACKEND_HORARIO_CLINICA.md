# 📋 Backend: Incluir Horario de Clínica en Endpoint de Médicos

Hola equipo! 👋

Hemos agregado una funcionalidad para que los médicos asociados a clínicas puedan ver el horario laboral de su clínica. Necesitamos que el backend incluya esta información en un endpoint existente.

---

## 🎯 Endpoint a Modificar

### GET /api/doctors/clinic-info

**Descripción:** Este endpoint ya existe y devuelve información de la clínica a la que está asociado el médico.

**Cambio Requerido:** Agregar el campo `generalSchedule` con el horario de la clínica.

---

## 📊 Estructura de Datos Requerida

### Response Actual (lo que ya devuelven):
```json
{
  "success": true,
  "data": {
    "id": "clinic-1",
    "name": "Clínica Central",
    "address": "Av. Principal 123, Quito",
    "phone": "0991234567",
    "whatsapp": "0991234567",
    "logoUrl": "https://..."
  }
}
```

### Response Esperado (con el nuevo campo):
```json
{
  "success": true,
  "data": {
    "id": "clinic-1",
    "name": "Clínica Central",
    "address": "Av. Principal 123, Quito",
    "phone": "0991234567",
    "whatsapp": "0991234567",
    "logoUrl": "https://...",
    "generalSchedule": {
      "monday": {
        "enabled": true,
        "startTime": "08:00",
        "endTime": "18:00"
      },
      "tuesday": {
        "enabled": true,
        "startTime": "08:00",
        "endTime": "18:00"
      },
      "wednesday": {
        "enabled": true,
        "startTime": "08:00",
        "endTime": "18:00"
      },
      "thursday": {
        "enabled": true,
        "startTime": "08:00",
        "endTime": "18:00"
      },
      "friday": {
        "enabled": true,
        "startTime": "08:00",
        "endTime": "18:00"
      },
      "saturday": {
        "enabled": true,
        "startTime": "09:00",
        "endTime": "13:00"
      },
      "sunday": {
        "enabled": false,
        "startTime": "09:00",
        "endTime": "13:00"
      }
    }
  }
}
```

---

## 🗄️ Estructura en Base de Datos

El horario de la clínica ya debe estar guardado en la tabla de clínicas. Necesitan incluirlo en la respuesta del endpoint.

### Opción 1: Si tienen el horario en columnas JSON
```sql
SELECT 
  c.id,
  c.name,
  c.address,
  c.phone,
  c.whatsapp,
  c.logo_url,
  c.general_schedule  -- ⭐ Este campo ya existe en la tabla clinics
FROM clinics c
INNER JOIN clinic_doctors cd ON cd.clinic_id = c.id
WHERE cd.user_id = {doctor_user_id};
```

### Opción 2: Si tienen el horario en tabla relacionada
```sql
SELECT 
  c.id,
  c.name,
  c.address,
  c.phone,
  c.whatsapp,
  c.logo_url,
  cs.day_of_week,
  cs.enabled,
  cs.start_time,
  cs.end_time
FROM clinics c
INNER JOIN clinic_doctors cd ON cd.clinic_id = c.id
LEFT JOIN clinic_schedules cs ON cs.clinic_id = c.id
WHERE cd.user_id = {doctor_user_id};
```

Luego transformar a la estructura JSON esperada.

---

## 📝 Formato de Campos

### enabled (boolean)
- `true`: La clínica está abierta ese día
- `false`: La clínica está cerrada ese día

### startTime (string)
- Formato: `"HH:mm"` (24 horas)
- Ejemplos: `"08:00"`, `"09:30"`, `"14:00"`

### endTime (string)
- Formato: `"HH:mm"` (24 horas)
- Ejemplos: `"18:00"`, `"13:00"`, `"20:30"`

### Días de la semana
- `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, `sunday`
- Todos en minúsculas
- Todos deben estar presentes en la respuesta

---

## 🔍 Ejemplo Real: Clínica Central

Para la clínica `clinic@medicones.com`, el horario debería ser algo como:

```json
{
  "generalSchedule": {
    "monday": { "enabled": true, "startTime": "08:00", "endTime": "18:00" },
    "tuesday": { "enabled": true, "startTime": "08:00", "endTime": "18:00" },
    "wednesday": { "enabled": true, "startTime": "08:00", "endTime": "18:00" },
    "thursday": { "enabled": true, "startTime": "08:00", "endTime": "18:00" },
    "friday": { "enabled": true, "startTime": "08:00", "endTime": "18:00" },
    "saturday": { "enabled": true, "startTime": "09:00", "endTime": "13:00" },
    "sunday": { "enabled": false, "startTime": "09:00", "endTime": "13:00" }
  }
}
```

---

## ✅ Validaciones

1. **Todos los días deben estar presentes** - Incluir los 7 días de la semana
2. **enabled es requerido** - Debe ser `true` o `false`
3. **startTime y endTime son requeridos** - Incluso si `enabled: false`
4. **Formato de hora** - Debe ser `"HH:mm"` (ej: `"08:00"`, no `"8:00"`)
5. **startTime < endTime** - La hora de inicio debe ser menor que la de fin

---

## 🧪 Testing

### Request de Prueba:
```http
GET http://localhost:3000/api/doctors/clinic-info
Authorization: Bearer {token_de_medico_asociado}
```

### Médico de Prueba:
```
Email: dr.juan.perez@clinicacentral.com
Password: doctor123
```

### Verificar:
1. El endpoint devuelve el campo `generalSchedule`
2. Tiene los 7 días de la semana
3. Cada día tiene `enabled`, `startTime`, `endTime`
4. Los horarios coinciden con lo configurado en la clínica

---

## 🚨 Casos Especiales

### Si la clínica NO tiene horario configurado:
```json
{
  "generalSchedule": {
    "monday": { "enabled": false, "startTime": "09:00", "endTime": "18:00" },
    "tuesday": { "enabled": false, "startTime": "09:00", "endTime": "18:00" },
    "wednesday": { "enabled": false, "startTime": "09:00", "endTime": "18:00" },
    "thursday": { "enabled": false, "startTime": "09:00", "endTime": "18:00" },
    "friday": { "enabled": false, "startTime": "09:00", "endTime": "18:00" },
    "saturday": { "enabled": false, "startTime": "09:00", "endTime": "18:00" },
    "sunday": { "enabled": false, "startTime": "09:00", "endTime": "18:00" }
  }
}
```

### Si el médico NO está asociado a clínica:
El endpoint ya debe devolver `null` o `404` en este caso (comportamiento actual).

---

## 📌 Resumen

**¿Qué hacer?**
1. Modificar el endpoint `GET /api/doctors/clinic-info`
2. Agregar el campo `generalSchedule` a la respuesta
3. Obtener el horario de la tabla de clínicas en la base de datos
4. Formatear según la estructura especificada arriba

**¿De dónde sale el horario?**
- De la tabla `clinics` (campo `general_schedule` o similar)
- Es el mismo horario que la clínica configura en su panel
- Es el mismo formato que ya usan en `PUT /api/clinics/profile`

**¿Es obligatorio?**
- Sí, debe estar presente en la respuesta
- Si no hay horario configurado, devolver todos los días con `enabled: false`

---

## 💬 ¿Dudas?

Si tienen preguntas sobre:
- La estructura de datos
- Cómo transformar desde su base de datos
- Casos especiales

¡Avisen! 🚀

---

**Fecha:** 2026-02-06  
**Prioridad:** Media  
**Endpoint:** GET /api/doctors/clinic-info  
**Campo Nuevo:** generalSchedule
