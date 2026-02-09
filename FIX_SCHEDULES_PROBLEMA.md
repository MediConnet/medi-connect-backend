# 🔧 FIX: Problema con Horarios que Cambian al Guardar

**Fecha**: 9 de febrero de 2026  
**Estado**: ✅ CORREGIDO

---

## 🐛 PROBLEMA REPORTADO

Cuando el frontend edita un horario y presiona "Guardar":
- ✅ El mensaje "Guardado exitosamente" aparece
- ❌ El horario mostrado después de guardar es diferente al ingresado

**Ejemplo**:
- Usuario ingresa: `08:00 - 16:00`
- Después de guardar muestra: `03:00 - 11:00` (o cualquier otro horario diferente)

---

## 🔍 CAUSA RAÍZ DEL PROBLEMA

**Problema de Zona Horaria (Timezone)**

### Flujo del problema:

1. **Frontend envía**: `"08:00"`
2. **Backend guarda en DB**: `1970-01-01T08:00:00Z` (UTC)
3. **Backend lee de DB**: `1970-01-01T08:00:00Z`
4. **Backend convierte con `getHours()`**: Convierte a zona horaria local del servidor
5. **Si el servidor está en UTC-5**: `08:00 UTC` → `03:00 local`
6. **Frontend recibe**: `"03:00"` ❌

### Código problemático:

```typescript
// ❌ ANTES (Incorrecto)
function formatTime(time: Date | null): string {
  if (!time) return '09:00';
  const date = new Date(time);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  //                    ^^^^^^^^^ Usa zona horaria local del servidor
}
```

**Problema**: `getHours()` convierte la hora UTC a la zona horaria local del servidor, causando que la hora cambie.

---

## ✅ SOLUCIÓN APLICADA

Usar métodos UTC para leer las horas, manteniendo la consistencia:

```typescript
// ✅ DESPUÉS (Correcto)
function formatTime(time: Date | null): string {
  if (!time) return '09:00';
  const date = new Date(time);
  // Usar UTC para evitar problemas de zona horaria
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
  //                    ^^^^^^^^^^^^ Usa UTC, mantiene la hora original
}
```

### Flujo corregido:

1. **Frontend envía**: `"08:00"`
2. **Backend guarda en DB**: `1970-01-01T08:00:00Z` (UTC)
3. **Backend lee de DB**: `1970-01-01T08:00:00Z`
4. **Backend convierte con `getUTCHours()`**: Mantiene `08:00` UTC
5. **Frontend recibe**: `"08:00"` ✅

---

## 📝 ARCHIVOS MODIFICADOS

1. ✅ `src/shared/validators.ts` - Schema actualizado para aceptar `null`
2. ✅ `src/clinics/schedules.controller.ts` - Función `formatTime()` corregida

---

## 🧪 CÓMO PROBAR

### 1. Reiniciar el servidor
```bash
npm run dev
```

### 2. Desde el frontend, actualizar horarios
```typescript
const schedule = {
  monday: {
    enabled: true,
    startTime: "08:00",  // Enviar 08:00
    endTime: "16:00",    // Enviar 16:00
    breakStart: null,
    breakEnd: null
  },
  // ... resto de días
};

await fetch(`/api/clinics/doctors/${doctorId}/schedule`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ schedule })
});
```

### 3. Verificar respuesta
La respuesta debe devolver exactamente:
```json
{
  "success": true,
  "data": {
    "schedule": {
      "monday": {
        "enabled": true,
        "startTime": "08:00",  // ✅ Mismo valor enviado
        "endTime": "16:00",    // ✅ Mismo valor enviado
        "breakStart": null,
        "breakEnd": null
      }
    }
  }
}
```

### 4. Recargar la página
Los horarios deben mantenerse exactamente como los ingresaste.

---

## 🎯 RESULTADO

✅ Los horarios se guardan correctamente  
✅ Los horarios se leen correctamente (sin cambios de zona horaria)  
✅ Al recargar la página, los horarios se mantienen exactos  
✅ No hay diferencias entre lo enviado y lo recibido

---

## 📊 COMPARACIÓN

### Antes (Incorrecto)
```
Usuario ingresa:  08:00 - 16:00
Backend guarda:   1970-01-01T08:00:00Z
Backend lee:      03:00 - 11:00  ❌ (convertido a UTC-5)
Usuario ve:       03:00 - 11:00  ❌
```

### Después (Correcto)
```
Usuario ingresa:  08:00 - 16:00
Backend guarda:   1970-01-01T08:00:00Z
Backend lee:      08:00 - 16:00  ✅ (mantiene UTC)
Usuario ve:       08:00 - 16:00  ✅
```

---

## 🔧 CAMBIOS TÉCNICOS

### 1. Validación (validators.ts)
```typescript
// Ahora acepta null para breakStart y breakEnd
breakStart: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).nullable().optional()
```

### 2. Formateo de tiempo (schedules.controller.ts)
```typescript
// Usa getUTCHours() en lugar de getHours()
date.getUTCHours()  // ✅ Mantiene hora UTC
date.getUTCMinutes() // ✅ Mantiene minutos UTC
```

---

## 📋 CHECKLIST

- [x] Schema actualizado para aceptar `null`
- [x] Función `formatTime()` corregida para usar UTC
- [x] Sin errores de TypeScript
- [x] Validación funcionando correctamente
- [x] Horarios se guardan y leen correctamente
- [x] Documentación actualizada

---

## 💬 MENSAJE PARA FRONTEND

```
✅ PROBLEMA CORREGIDO - Zona Horaria

El problema era que el backend convertía las horas a la zona horaria local del servidor al leerlas.

Cambios aplicados:
1. ✅ Validación acepta null para breakStart/breakEnd
2. ✅ Lectura de horarios usa UTC (mantiene hora original)

Reinicia tu servidor backend y prueba:
1. Ingresa: 08:00 - 16:00
2. Guarda
3. Recarga
4. Debe mostrar: 08:00 - 16:00 ✅

Si aún hay problemas, envíame:
- La hora que ingresas
- La hora que recibes
- La zona horaria de tu servidor
```

---

## 🐛 DEBUGGING

Si el problema persiste, verifica:

1. **Zona horaria del servidor**:
```bash
echo $TZ
date
```

2. **Logs del backend**:
```typescript
console.log('Hora enviada:', body.schedule.monday.startTime);
console.log('Hora guardada en DB:', startTime);
console.log('Hora leída de DB:', schedules[0].start_time);
console.log('Hora formateada:', formatTime(schedules[0].start_time));
```

3. **Request/Response del frontend**:
```typescript
console.log('Request:', JSON.stringify(schedule));
console.log('Response:', JSON.stringify(response));
```

---

**Fecha**: 9 de febrero de 2026  
**Estado**: ✅ Corregido  
**Causa**: Problema de zona horaria (timezone)  
**Solución**: Usar métodos UTC para leer horas  
**Backend Team**
