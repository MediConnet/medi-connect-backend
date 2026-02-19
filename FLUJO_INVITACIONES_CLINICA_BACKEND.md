# Flujo de Invitaciones de Clínica - Documentación para Backend

## 📋 Resumen

Este documento describe el flujo completo de invitaciones de médicos a clínicas y qué debe implementar el backend para que funcione correctamente.

---

## 🔄 Flujo Actual Implementado en Frontend

### 1. **Generar Link de Invitación**
- **Endpoint usado:** `POST /api/clinics/doctors/invite/link`
- **Request:**
  ```json
  {
    "email": "doctor@example.com"
  }
  ```
- **Response esperado:**
  ```json
  {
    "success": true,
    "data": {
      "invitationLink": "http://localhost:5174/clinic/invite/TOKEN_AQUI",
      "expiresAt": "2026-02-25T00:00:00.000Z"
    }
  }
  ```
- **Nota:** El frontend construye la URL completa si el backend solo devuelve el token o una ruta relativa.

### 2. **Validar Token de Invitación (Público)**
- **Endpoint usado:** `GET /api/clinics/invite/:token`
- **Response esperado:**
  ```json
  {
    "success": true,
    "data": {
      "clinic": {
        "id": "clinic-id",
        "name": "Nombre de la Clínica"
      },
      "email": "doctor@example.com",
      "expiresAt": "2026-02-25T00:00:00.000Z",
      "isValid": true
    }
  }
  ```

### 3. **Aceptar Invitación**

#### Caso A: Usuario NO está registrado
- El frontend redirige a: `/register?invitation=TOKEN&type=doctor`
- **El backend debe:**
  1. Cuando el usuario se registra con el token de invitación en el query string
  2. **Asociar automáticamente** al médico a la clínica después del registro
  3. El médico debe quedar vinculado a la clínica inmediatamente

#### Caso B: Usuario YA está registrado
- Si el usuario ya está logueado y es doctor con el mismo email de la invitación
- El frontend redirige a `/doctor/dashboard`
- **El backend debe:**
  1. Detectar que el usuario tiene una invitación pendiente (por email)
  2. **Asociar automáticamente** al médico a la clínica cuando accede al dashboard
  3. O proporcionar un endpoint para aceptar la invitación directamente

### 4. **Rechazar Invitación**
- **Endpoint usado:** `POST /api/clinics/invite/:token/reject`
- **Request:** Sin body
- **Response esperado:**
  ```json
  {
    "success": true
  }
  ```

---

## ⚠️ REQUERIMIENTOS CRÍTICOS PARA EL BACKEND

### 1. **Asociación Automática al Aceptar**

Cuando un médico acepta una invitación (ya sea en registro o si ya está registrado), el backend **DEBE**:

1. **Asociar el médico a la clínica** en la base de datos
2. **Marcar la invitación como aceptada** (`status: 'accepted'`)
3. **Retornar en el dashboard del doctor** la información de la clínica

### 2. **Estructura de Datos del Dashboard del Doctor**

Cuando el médico está asociado a una clínica, el endpoint `GET /api/doctors/dashboard` **DEBE** retornar:

```json
{
  "success": true,
  "data": {
    "doctor": { ... },
    "clinic": {
      "id": "clinic-id",
      "name": "Nombre de la Clínica",
      "address": "Dirección",
      "phone": "0999999999",
      "whatsapp": "0999999999",
      "logoUrl": "https://..."
    },
    // ... otros datos del dashboard
  }
  }
}
```

**IMPORTANTE:** Si el médico NO está asociado, `clinic` debe ser `null` o `undefined`.

### 3. **Endpoint de Registro con Invitación**

El endpoint `POST /api/auth/register` debe:

1. **Aceptar el parámetro `invitationToken`** en el body o query string
2. Si se proporciona un `invitationToken` válido:
   - Validar que el token existe y no ha expirado
   - Validar que el email del registro coincide con el email de la invitación
   - Crear el usuario
   - **Asociar automáticamente** al médico a la clínica
   - Marcar la invitación como aceptada

**Ejemplo de Request:**
```json
{
  "email": "doctor@example.com",
  "password": "password123",
  "name": "Dr. Juan Pérez",
  "role": "PROFESIONAL",
  "type": "doctor",
  "invitationToken": "TOKEN_DE_INVITACION"
}
```

### 4. **Endpoint para Aceptar Invitación (Usuario Ya Registrado)**

Si el usuario ya está registrado y quiere aceptar una invitación, el backend puede:

**Opción A:** Asociar automáticamente cuando accede al dashboard (recomendado)
- El backend detecta invitaciones pendientes por email
- Las acepta automáticamente al acceder al dashboard

**Opción B:** Crear endpoint específico
- `POST /api/clinics/invite/:token/accept` (para usuarios ya registrados)
- Debe verificar que el usuario logueado tiene el mismo email que la invitación
- Asociar al médico a la clínica

---

## 🔍 Detección de Médico Asociado en Frontend

El frontend detecta si un médico está asociado a una clínica de dos formas:

1. **Desde el dashboard:** Si `dashboardData.clinic !== null`
2. **Desde el hook `useClinicAssociatedDoctor`:** Hace una petición a `GET /api/doctors/clinic` o similar

**El backend debe retornar:**
- Si está asociado: Objeto con información de la clínica
- Si NO está asociado: `null` o `404` (el frontend maneja ambos casos)

---

## 📝 Endpoints Requeridos

### ✅ Ya Implementados (Verificar que funcionen correctamente)

1. `POST /api/clinics/doctors/invite/link` - Generar link de invitación
2. `GET /api/clinics/invite/:token` - Validar token (público)
3. `POST /api/clinics/invite/:token/reject` - Rechazar invitación

### ⚠️ Necesitan Verificación/Implementación

1. **`POST /api/auth/register`** - Debe aceptar `invitationToken` y asociar automáticamente
2. **`GET /api/doctors/dashboard`** - Debe retornar `clinic: {...}` o `clinic: null`
3. **`GET /api/doctors/clinic`** (opcional) - Para verificar asociación directamente

---

## 🎯 Comportamiento Esperado

### Escenario 1: Médico Nuevo Acepta Invitación
1. Médico recibe link de invitación
2. Hace clic en "Aceptar Invitación"
3. Se redirige a `/register?invitation=TOKEN&type=doctor`
4. Completa el registro
5. **Backend asocia automáticamente al médico a la clínica**
6. Se redirige a `/doctor/dashboard`
7. **El dashboard muestra las pestañas de médico asociado** (Dashboard, Mi Perfil, Mis Citas, Pacientes, Recepción, Horario Laboral, etc.)

### Escenario 2: Médico Ya Registrado Acepta Invitación
1. Médico recibe link de invitación
2. Hace clic en "Aceptar Invitación"
3. Si ya está logueado con el mismo email → redirige a `/doctor/dashboard`
4. **Backend detecta invitación pendiente y asocia automáticamente**
5. **El dashboard muestra las pestañas de médico asociado**

### Escenario 3: Médico Rechaza Invitación
1. Médico recibe link de invitación
2. Hace clic en "Rechazar"
3. **Backend marca la invitación como rechazada**
4. El médico NO queda asociado a la clínica
5. Si accede al dashboard, verá las pestañas de médico independiente (no asociado)

---

## 🔑 Puntos Clave

1. **La asociación debe ser AUTOMÁTICA** cuando se acepta la invitación
2. **El dashboard del doctor DEBE retornar `clinic`** (objeto o null)
3. **El frontend detecta automáticamente** si está asociado y muestra las pestañas correctas
4. **Si rechaza, NO debe quedar asociado**

---

## 📞 Contacto

Si hay dudas sobre la implementación, consultar con el equipo de frontend.

**Última actualización:** Diciembre 2024
