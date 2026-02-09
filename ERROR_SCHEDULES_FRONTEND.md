# ⚠️ ERROR EN RUTA DE SCHEDULES

## 🐛 Problema Detectado

Tu frontend está usando una **ruta incorrecta** para los horarios de médicos.

---

## ❌ RUTA INCORRECTA (Lo que estás usando)

```
/api/clinics/db_a20fae6fe/schedules
```

**Problemas**:
1. Falta `/doctors/` en la ruta
2. Tiene `schedules` (plural) en lugar de `schedule` (singular)

---

## ✅ RUTA CORRECTA (Lo que debes usar)

```
/api/clinics/doctors/db_a20fae6fe/schedule
```

---

## 📝 ENDPOINTS CORRECTOS

### GET - Obtener horarios del médico
```typescript
GET /api/clinics/doctors/{doctorId}/schedule
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "data": {
    "doctorId": "db_a20fae6fe",
    "clinicId": "clinic-001",
    "schedule": {
      "monday": {
        "enabled": true,
        "startTime": "09:00",
        "endTime": "17:00",
        "breakStart": "13:00",
        "breakEnd": "14:00"
      },
      "tuesday": {
        "enabled": true,
        "startTime": "09:00",
        "endTime": "17:00",
        "breakStart": null,
        "breakEnd": null
      },
      // ... resto de días
    }
  }
}
```

### PUT - Actualizar horarios del médico
```typescript
PUT /api/clinics/doctors/{doctorId}/schedule
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "schedule": {
    "monday": {
      "enabled": true,
      "startTime": "09:00",
      "endTime": "17:00",
      "breakStart": "13:00",
      "breakEnd": "14:00"
    },
    "tuesday": {
      "enabled": true,
      "startTime": "09:00",
      "endTime": "17:00",
      "breakStart": null,
      "breakEnd": null
    },
    "wednesday": {
      "enabled": false,
      "startTime": "09:00",
      "endTime": "17:00",
      "breakStart": null,
      "breakEnd": null
    },
    // ... resto de días (TODOS los días son requeridos)
  }
}

Response 200:
{
  "success": true,
  "data": {
    "doctorId": "db_a20fae6fe",
    "clinicId": "clinic-001",
    "schedule": { /* horarios actualizados */ }
  }
}
```

---

## 🔧 CORRECCIÓN EN TU CÓDIGO

### Antes (Incorrecto)
```typescript
// ❌ INCORRECTO
const url = `/api/clinics/${clinicId}/schedules`;
```

### Después (Correcto)
```typescript
// ✅ CORRECTO
const url = `/api/clinics/doctors/${doctorId}/schedule`;
```

---

## ⚠️ VALIDACIONES IMPORTANTES

### Campos Requeridos en PUT
```typescript
{
  "schedule": {
    // TODOS los días son requeridos (monday, tuesday, wednesday, thursday, friday, saturday, sunday)
    "monday": {
      "enabled": boolean,      // Requerido
      "startTime": string,     // Requerido (formato "HH:mm")
      "endTime": string,       // Requerido (formato "HH:mm")
      "breakStart": string | null,  // Opcional
      "breakEnd": string | null     // Opcional
    },
    // ... resto de días con la misma estructura
  }
}
```

### Formato de Tiempo
- Debe ser string en formato `"HH:mm"` (24 horas)
- Ejemplos válidos: `"09:00"`, `"17:30"`, `"13:15"`
- Ejemplos inválidos: `"9:00"`, `"17:30:00"`, `"5pm"`

---

## 🐛 OTROS ERRORES EN TU CONSOLA

### Error: "divider is not defined"
Este es un error de JavaScript en tu frontend. Revisa si estás usando una variable `divider` que no está definida.

### Error: "validation error: Required"
Esto significa que estás enviando un objeto sin todos los campos requeridos. Asegúrate de enviar TODOS los días de la semana en el objeto `schedule`.

---

## ✅ EJEMPLO COMPLETO

```typescript
// Función para obtener horarios
const getDoctorSchedule = async (doctorId: string) => {
  const response = await fetch(
    `${API_BASE_URL}/api/clinics/doctors/${doctorId}/schedule`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return await response.json();
};

// Función para actualizar horarios
const updateDoctorSchedule = async (doctorId: string, schedule: any) => {
  const response = await fetch(
    `${API_BASE_URL}/api/clinics/doctors/${doctorId}/schedule`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ schedule })
    }
  );
  
  return await response.json();
};

// Ejemplo de uso
const schedule = {
  monday: { enabled: true, startTime: "09:00", endTime: "17:00", breakStart: null, breakEnd: null },
  tuesday: { enabled: true, startTime: "09:00", endTime: "17:00", breakStart: null, breakEnd: null },
  wednesday: { enabled: true, startTime: "09:00", endTime: "17:00", breakStart: null, breakEnd: null },
  thursday: { enabled: true, startTime: "09:00", endTime: "17:00", breakStart: null, breakEnd: null },
  friday: { enabled: true, startTime: "09:00", endTime: "17:00", breakStart: null, breakEnd: null },
  saturday: { enabled: false, startTime: "09:00", endTime: "13:00", breakStart: null, breakEnd: null },
  sunday: { enabled: false, startTime: "09:00", endTime: "13:00", breakStart: null, breakEnd: null }
};

await updateDoctorSchedule("db_a20fae6fe", schedule);
```

---

## 📋 RESUMEN DE CAMBIOS

1. ✅ Cambiar `/api/clinics/{id}/schedules` → `/api/clinics/doctors/{doctorId}/schedule`
2. ✅ Asegurar que todos los días estén en el objeto `schedule`
3. ✅ Usar formato `"HH:mm"` para los tiempos
4. ✅ Enviar `breakStart` y `breakEnd` como `null` si no hay descanso
5. ✅ Corregir el error de `divider is not defined` en tu código JavaScript

---

**Fecha**: 9 de febrero de 2026  
**Backend Team**
