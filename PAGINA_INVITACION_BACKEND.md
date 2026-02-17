# 📋 Especificación Técnica: Página de Invitación de Clínica

## 🎯 Resumen

Se implementó una página pública donde los médicos pueden ver las invitaciones de clínicas y decidir si aceptarlas o rechazarlas. La página muestra información de la clínica y permite al médico tomar una decisión antes de registrarse.

**Flujo completo:**
1. Admin de clínica genera link de invitación → se envía por email
2. Médico hace clic en el link → ve la página de invitación
3. Médico ve información de la clínica y decide:
   - **Aceptar**: Se redirige al registro para completar su perfil
   - **Rechazar**: La invitación se marca como rechazada

---

## 🔌 Endpoints Requeridos

### 1. **GET `/api/clinics/invite/:token`** ✅ (Ya existe)
**Propósito:** Validar y obtener información de la invitación

**Respuesta esperada:**
```json
{
  "success": true,
  "data": {
    "clinic": {
      "id": "string",
      "name": "string"
    },
    "email": "string",
    "expiresAt": "2024-12-31T23:59:59.000Z",
    "isValid": true
  }
}
```

**⚠️ IMPORTANTE:**
- El campo `isValid` debe ser `false` si:
  - El token no existe
  - El token ha expirado
  - El token ya fue usado (aceptado o rechazado)
- El campo `clinic.name` es necesario para mostrar en la página

---

### 2. **POST `/api/clinics/invite/:token/reject`** ⚠️ (NUEVO - Necesita implementarse)
**Propósito:** Rechazar una invitación de clínica

**Request:** No requiere body (solo el token en la URL)

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Invitación rechazada correctamente"
}
```

**Comportamiento esperado:**
- Marcar la invitación como `status: "rejected"` en la base de datos
- No debe permitir rechazar si ya fue aceptada
- No debe permitir rechazar si ya fue rechazada previamente
- No debe permitir rechazar si el token ha expirado

---

### 3. **POST `/api/clinics/invite/:token/accept`** ✅ (Ya existe)
**Propósito:** Aceptar la invitación y crear el registro del médico

**Nota:** Este endpoint ya existe y funciona. Solo lo mencionamos para contexto.

---

## 📄 Página Pública Implementada

### Ruta: `/clinic/invite/:token`

**Características:**
- ✅ Página pública (no requiere autenticación)
- ✅ Muestra información de la clínica
- ✅ Muestra email asociado a la invitación
- ✅ Muestra fecha de expiración
- ✅ Botones de "Aceptar" y "Rechazar"
- ✅ Validación del token antes de mostrar opciones
- ✅ Manejo de errores (token inválido, expirado, etc.)

**Estados de la página:**
1. **Cargando**: Muestra spinner mientras valida el token
2. **Válida**: Muestra información y botones Aceptar/Rechazar
3. **Inválida/Expirada**: Muestra mensaje de error
4. **Rechazada**: Muestra confirmación de rechazo

---

## 🔄 Flujo Completo del Sistema

### 1. Generación del Link (Ya implementado)
```
Admin → Genera link → Copia link → Envía por email
```

### 2. Visualización de Invitación (NUEVO)
```
Médico → Hace clic en link → GET /api/clinics/invite/:token
→ Página muestra información → Médico decide
```

### 3. Decisión del Médico (NUEVO)

**Si ACEPTA:**
```
Médico → Clic en "Aceptar" → Redirige a /register?invitation=:token&type=doctor
→ Completa registro → POST /api/clinics/invite/:token/accept
→ Se asocia con la clínica
```

**Si RECHAZA:**
```
Médico → Clic en "Rechazar" → POST /api/clinics/invite/:token/reject
→ Invitación marcada como rechazada → No se asocia con la clínica
```

---

## ✅ Checklist para Backend

### Endpoint de Rechazo (NUEVO)
- [ ] Crear endpoint `POST /api/clinics/invite/:token/reject`
- [ ] Validar que el token existe
- [ ] Validar que el token no ha expirado
- [ ] Validar que la invitación no fue ya aceptada
- [ ] Validar que la invitación no fue ya rechazada
- [ ] Marcar invitación como `status: "rejected"` en la base de datos
- [ ] Retornar formato: `{ success: boolean, message?: string }`

### Endpoint de Validación (Ya existe, verificar)
- [ ] Verificar que retorna `clinic.name` (necesario para la página)
- [ ] Verificar que `isValid` es `false` cuando:
  - Token no existe
  - Token expirado
  - Token ya usado (aceptado o rechazado)
- [ ] Verificar que retorna `expiresAt` en formato ISO 8601

### Base de Datos
- [ ] Verificar que la tabla de invitaciones tiene campo `status`
- [ ] Valores posibles de `status`: `pending`, `accepted`, `rejected`, `expired`
- [ ] Actualizar `status` cuando se rechaza la invitación

---

## 📝 Modelo de Datos Sugerido

```typescript
interface ClinicInvitation {
  id: string;
  clinicId: string;
  email: string;
  token: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  expiresAt: Date;
  createdAt: Date;
  rejectedAt?: Date;
  acceptedAt?: Date;
}
```

---

## 🚀 Mejoras Futuras (Opcional)

1. **Notificación al admin:**
   - Notificar cuando un médico acepta la invitación
   - Notificar cuando un médico rechaza la invitación

2. **Estadísticas:**
   - Contar invitaciones aceptadas vs rechazadas
   - Tiempo promedio de respuesta a invitaciones

3. **Reenvío:**
   - Permitir regenerar link si fue rechazado
   - Permitir enviar recordatorio si está pendiente

---

## 🐛 Troubleshooting

### Si la página no carga:
1. Verificar que el endpoint `GET /api/clinics/invite/:token` funciona
2. Verificar que retorna el formato correcto
3. Verificar que `clinic.name` está presente
4. Revisar la consola del navegador para errores

### Si el botón "Rechazar" no funciona:
1. Verificar que el endpoint `POST /api/clinics/invite/:token/reject` existe
2. Verificar que retorna el formato correcto
3. Verificar permisos (debe ser público, no requiere autenticación)
4. Revisar logs del backend

### Si el botón "Aceptar" no funciona:
1. Verificar que el endpoint `POST /api/clinics/invite/:token/accept` funciona
2. Verificar que la redirección a `/register` funciona
3. Verificar que el token se pasa correctamente en la URL

---

## 📞 Contacto

Si tienen preguntas sobre la implementación del frontend o necesitan ajustar algo, pueden contactar al equipo de frontend.

**Fecha de implementación:** $(date)
**Versión:** 1.0.0

---

## 📋 Resumen de Cambios

### Frontend:
- ✅ Página pública `/clinic/invite/:token` creada
- ✅ Integración con endpoint de validación
- ✅ Integración con endpoint de rechazo (nuevo)
- ✅ Redirección a registro si acepta
- ✅ Manejo de estados (cargando, válida, inválida, rechazada)

### Backend (Necesita implementarse):
- ⚠️ Endpoint `POST /api/clinics/invite/:token/reject` (NUEVO)
- ✅ Endpoint `GET /api/clinics/invite/:token` (Ya existe, verificar formato)
- ✅ Endpoint `POST /api/clinics/invite/:token/accept` (Ya existe)
