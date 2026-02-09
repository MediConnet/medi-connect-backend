# 🌙 SOLICITUD: Soporte para Horarios Nocturnos

**De:** Frontend Team  
**Para:** Backend Team  
**Fecha:** 9 de Febrero, 2026  
**Prioridad:** 🔴 URGENTE

---

## 🎯 PROBLEMA ACTUAL

El backend rechaza horarios nocturnos con este error:

```
❌ "Invalid time range for tuesday: startTime must be before endTime"
```

**Ejemplo que falla:**
- Inicio: 21:00 (9 PM)
- Fin: 07:00 (7 AM del día siguiente)

**Validación actual del backend:**
```javascript
if (startTime >= endTime) {
  throw new Error("startTime must be before endTime");
}
```

---

## 🏥 CASO DE USO REAL

**Clínicas de emergencia 24/7 o con turnos nocturnos:**

- **Turno Nocturno:** 21:00 - 07:00 (9 PM a 7 AM)
- **Turno Madrugada:** 23:00 - 08:00 (11 PM a 8 AM)
- **Guardia Nocturna:** 20:00 - 06:00 (8 PM a 6 AM)

Estos horarios son **válidos y necesarios** para clínicas que operan de noche.

---

## ✅ SOLUCIÓN REQUERIDA

### Opción 1: Permitir horarios que cruzan medianoche (Recomendada)

**Cambiar validación:**

```javascript
// ❌ ACTUAL (rechaza horarios nocturnos)
if (startTime >= endTime) {
  throw new Error("startTime must be before endTime");
}

// ✅ NUEVO (permite horarios nocturnos)
// Si endTime < startTime, significa que cruza medianoche (es válido)
// Solo validar que no sean iguales
if (startTime === endTime) {
  throw new Error("startTime and endTime cannot be the same");
}
```

**Lógica de interpretación:**
- `07:00 - 17:00` = Horario de día (7 AM a 5 PM) ✅
- `21:00 - 07:00` = Horario nocturno (9 PM a 7 AM del día siguiente) ✅
- `23:00 - 23:00` = Inválido (mismo horario) ❌

---

### Opción 2: Agregar flag "crossesMidnight"

Si prefieren ser más explícitos:

```typescript
{
  "enabled": true,
  "startTime": "21:00",
  "endTime": "07:00",
  "crossesMidnight": true  // ← Nuevo campo
}
```

**Validación:**
```javascript
if (!crossesMidnight && startTime >= endTime) {
  throw new Error("startTime must be before endTime");
}

if (crossesMidnight && startTime < endTime) {
  throw new Error("If crossesMidnight is true, startTime must be after endTime");
}
```

---

## 📊 EJEMPLOS DE HORARIOS VÁLIDOS

### Horarios de Día (normales)
```json
{
  "monday": { "enabled": true, "startTime": "07:00", "endTime": "17:00" },
  "tuesday": { "enabled": true, "startTime": "08:00", "endTime": "18:00" }
}
```

### Horarios Nocturnos (cruzan medianoche)
```json
{
  "monday": { "enabled": true, "startTime": "21:00", "endTime": "07:00" },
  "tuesday": { "enabled": true, "startTime": "23:00", "endTime": "08:00" }
}
```

### Horarios 24/7
```json
{
  "monday": { "enabled": true, "startTime": "00:00", "endTime": "23:59" }
}
```

---

## 🧪 CASOS DE PRUEBA

### Test 1: Horario de día normal
```json
{ "startTime": "08:00", "endTime": "18:00" }
```
**Esperado:** ✅ Válido

### Test 2: Horario nocturno
```json
{ "startTime": "21:00", "endTime": "07:00" }
```
**Esperado:** ✅ Válido (cruza medianoche)

### Test 3: Horario inválido (mismo tiempo)
```json
{ "startTime": "10:00", "endTime": "10:00" }
```
**Esperado:** ❌ Error

### Test 4: Horario 24 horas
```json
{ "startTime": "00:00", "endTime": "23:59" }
```
**Esperado:** ✅ Válido

---

## 💡 RECOMENDACIÓN

**Usar Opción 1** (más simple):
- No requiere cambios en el frontend
- No requiere nuevo campo en la BD
- Solo cambiar la validación
- Más intuitivo para el usuario

---

## 🔧 CAMBIO NECESARIO EN BACKEND

### Archivo a modificar:
Buscar donde validan `startTime` y `endTime` en el endpoint:
- `PUT /api/clinics/schedule`

### Código actual (probablemente):
```javascript
if (startTime >= endTime) {
  return res.status(400).json({
    success: false,
    message: `Invalid time range for ${day}: startTime must be before endTime`
  });
}
```

### Código nuevo:
```javascript
// Permitir horarios nocturnos (que cruzan medianoche)
// Solo rechazar si son exactamente iguales
if (startTime === endTime) {
  return res.status(400).json({
    success: false,
    message: `Invalid time range for ${day}: startTime and endTime cannot be the same`
  });
}

// Opcional: Log para debugging
if (startTime > endTime) {
  console.log(`ℹ️ ${day}: Horario nocturno detectado (${startTime} - ${endTime})`);
}
```

---

## ⏱️ TIEMPO ESTIMADO

**Implementación:** 15-30 minutos
- Cambiar validación
- Testing
- Deploy

---

## 🚀 IMPACTO

**Sin este cambio:**
- ❌ Clínicas nocturnas no pueden usar el sistema
- ❌ Guardias de emergencia no se pueden configurar
- ❌ Turnos nocturnos no funcionan

**Con este cambio:**
- ✅ Soporte completo para cualquier horario
- ✅ Clínicas 24/7 pueden operar
- ✅ Flexibilidad total para los usuarios

---

## 📝 NOTA IMPORTANTE

Este es un caso de uso **real y necesario**. Muchas clínicas operan:
- Guardias nocturnas
- Emergencias 24/7
- Turnos rotativos
- Servicios de madrugada

El sistema debe soportar estos horarios.

---

**¿Pueden implementar esto hoy?**

**Frontend Team**  
**9 de Febrero, 2026**
