# 📡 Endpoints Backend - Guía para Frontend

**Última actualización**: 2026-01-29  
**Base URL**: `http://localhost:3000` (desarrollo) / `https://api.mediconnect.com` (producción)

---

## 🔐 Autenticación

**Todos los endpoints (excepto los marcados como públicos) requieren:**

```
Headers:
  Authorization: Bearer <JWT_TOKEN>
  Content-Type: application/json
```

---

## ✅ ENDPOINTS IMPLEMENTADOS

### 🏥 Módulo de Clínicas (`/api/clinics`)

#### 1. Perfil de Clínica

**GET `/api/clinics/profile`**
- **Descripción**: Obtener perfil de la clínica autenticada
- **Autenticación**: ✅ Requerida (rol: clinic admin)
- **Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Clínica Central",
    "logoUrl": "https://...",
    "address": "Calle Principal 123",
    "phone": "0991234567",
    "whatsapp": "0991234567",
    "description": "Descripción...",
    "latitude": -0.1806532,
    "longitude": -78.4678382,
    "isActive": true
  }
}
```

**PUT `/api/clinics/profile`**
- **Descripción**: Actualizar perfil de la clínica
- **Autenticación**: ✅ Requerida
- **Request Body**:
```json
{
  "name": "Nuevo Nombre",
  "address": "Nueva Dirección",
  "phone": "0991234567",
  "whatsapp": "0991234567",
  "description": "Nueva descripción",
  "latitude": -0.1806532,
  "longitude": -78.4678382
}
```

---

#### 2. Dashboard de Clínica

**GET `/api/clinics/dashboard`**
- **Descripción**: Estadísticas del dashboard
- **Autenticación**: ✅ Requerida
- **Response**:
```json
{
  "success": true,
  "data": {
    "totalAppointments": 150,
    "pendingAppointments": 25,
    "todayAppointments": 8,
    "totalDoctors": 12,
    "activeDoctors": 10,
    "clinic": {
      "id": "uuid",
      "name": "Clínica Central",
      "address": "Calle Principal 123",
      "phone": "0991234567",
      "whatsapp": "0991234567"
    }
  }
}
```

---

#### 3. Gestión de Médicos

**GET `/api/clinics/doctors`**
- **Descripción**: Listar todos los médicos de la clínica
- **Autenticación**: ✅ Requerida
- **Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "clinicId": "uuid",
      "userId": "uuid" | null,
      "email": "doctor@example.com",
      "name": "Dr. Juan Pérez" | null,
      "specialty": "Cardiología" | null,
      "isActive": true,
      "isInvited": false,
      "officeNumber": "101",
      "profileImageUrl": "https://...",
      "phone": "0991234567",
      "whatsapp": "0991234567",
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

**POST `/api/clinics/doctors/invite`**
- **Descripción**: Invitar médico a la clínica
- **Autenticación**: ✅ Requerida
- **Request Body**:
```json
{
  "email": "nuevo.doctor@example.com"
}
```
- **Response**:
```json
{
  "success": true,
  "data": {
    "message": "Invitación enviada correctamente",
    "invitationToken": "uuid-token"
  }
}
```

**DELETE `/api/clinics/doctors/:doctorId`**
- **Descripción**: Eliminar médico de la clínica
- **Autenticación**: ✅ Requerida
- **Response**:
```json
{
  "success": true,
  "message": "Médico eliminado correctamente"
}
```

**PATCH `/api/clinics/doctors/:doctorId/status`**
- **Descripción**: Activar/desactivar médico
- **Autenticación**: ✅ Requerida
- **Request Body**:
```json
{
  "isActive": true
}
```

**PATCH `/api/clinics/doctors/:doctorId/office`**
- **Descripción**: Actualizar consultorio del médico
- **Autenticación**: ✅ Requerida
- **Request Body**:
```json
{
  "officeNumber": "102"
}
```

**GET `/api/clinics/doctors/:doctorId/schedule`**
- **Descripción**: Obtener horario del médico
- **Autenticación**: ✅ Requerida
- **Response**:
```json
{
  "success": true,
  "data": {
    "monday": {
      "enabled": true,
      "startTime": "09:00",
      "endTime": "17:00",
      "breakStart": null,
      "breakEnd": null
    },
    "tuesday": { ... },
    // ... todos los días de la semana
  }
}
```

**PUT `/api/clinics/doctors/:doctorId/schedule`**
- **Descripción**: Actualizar horario del médico
- **Autenticación**: ✅ Requerida
- **Request Body**:
```json
{
  "monday": {
    "enabled": true,
    "startTime": "09:00",
    "endTime": "17:00",
    "breakStart": "13:00",
    "breakEnd": "14:00"
  },
  // ... otros días
}
```

---

#### 4. Invitaciones de Médicos (Públicas)

**GET `/api/clinics/invite/:token`**
- **Descripción**: Validar token de invitación
- **Autenticación**: ❌ Público
- **Response**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "clinicName": "Clínica Central",
    "email": "doctor@example.com"
  }
}
```

**POST `/api/clinics/invite/:token/accept`**
- **Descripción**: Aceptar invitación y crear cuenta
- **Autenticación**: ❌ Público
- **Request Body**:
```json
{
  "name": "Dr. Juan Pérez",
  "specialty": "Cardiología",
  "password": "SecurePass123!",
  "phone": "0991234567",
  "whatsapp": "0991234567"
}
```
- **Response**:
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "email": "doctor@example.com",
    "token": "JWT_TOKEN",
    "serviceType": "doctor",
    "tipo": "doctor"
  }
}
```

**⚠️ IMPORTANTE**: `specialty` debe ser una de estas 20 especialidades:
- Medicina General
- Cardiología
- Dermatología
- Ginecología
- Pediatría
- Oftalmología
- Traumatología
- Neurología
- Psiquiatría
- Urología
- Endocrinología
- Gastroenterología
- Neumología
- Otorrinolaringología
- Oncología
- Reumatología
- Nefrología
- Cirugía General
- Anestesiología
- Odontología

---

#### 5. Citas de Clínica

**GET `/api/clinics/appointments`**
- **Descripción**: Listar citas de la clínica
- **Autenticación**: ✅ Requerida
- **Query Parameters** (opcionales):
  - `date`: `YYYY-MM-DD` (filtrar por fecha)
  - `doctorId`: `uuid` (filtrar por médico)
  - `status`: `scheduled|confirmed|attended|cancelled|no_show`
- **Nota**: Si no se envían parámetros, retorna TODAS las citas (para gráficos del dashboard)
- **Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "clinicId": "uuid",
      "doctorId": "uuid",
      "doctorName": "Dr. Juan Pérez",
      "doctorSpecialty": "Cardiología",
      "patientId": "uuid",
      "patientName": "Paciente Ejemplo",
      "patientPhone": "0991234567",
      "patientEmail": "paciente@example.com",
      "date": "2025-01-15",
      "time": "10:00",
      "reason": "Consulta de rutina",
      "status": "confirmed",
      "receptionStatus": "arrived",
      "receptionNotes": null,
      "createdAt": null,
      "updatedAt": null
    }
  ]
}
```

**PATCH `/api/clinics/appointments/:appointmentId/status`**
- **Descripción**: Actualizar estado de cita
- **Autenticación**: ✅ Requerida
- **Request Body**:
```json
{
  "status": "confirmed"
}
```
- **Valores válidos**: `scheduled`, `confirmed`, `attended`, `cancelled`, `no_show`

---

#### 6. Recepción

**GET `/api/clinics/reception/today`**
- **Descripción**: Citas de hoy en recepción
- **Autenticación**: ✅ Requerida
- **Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "patientName": "Paciente Ejemplo",
      "scheduledFor": "2025-01-29T10:00:00Z",
      "status": "confirmed",
      "receptionStatus": "waiting"
    }
  ]
}
```

**PATCH `/api/clinics/appointments/:appointmentId/reception`**
- **Descripción**: Actualizar estado de recepción
- **Autenticación**: ✅ Requerida
- **Request Body**:
```json
{
  "receptionStatus": "arrived",
  "receptionNotes": "Paciente llegó puntual"
}
```

---

#### 7. Mensajes de Recepción

**GET `/api/clinics/reception/messages`**
- **Descripción**: Obtener mensajes con médicos
- **Autenticación**: ✅ Requerida
- **Query Parameters** (opcionales):
  - `doctorId`: `uuid` (filtrar por médico)
  - `limit`: `number` (default: 50)
- **Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "clinicId": "uuid",
      "doctorId": "uuid",
      "doctorName": "Dr. Juan Pérez",
      "from": "reception" | "doctor",
      "message": "Mensaje de texto",
      "timestamp": "2025-01-29T10:00:00Z",
      "isRead": false,
      "senderName": "Clínica Central" | "Dr. Juan Pérez"
    }
  ]
}
```

**POST `/api/clinics/reception/messages`**
- **Descripción**: Enviar mensaje a médico desde recepción
- **Autenticación**: ✅ Requerida
- **Request Body**:
```json
{
  "doctorId": "uuid",
  "message": "Mensaje de texto"
}
```

**PATCH `/api/clinics/reception/messages/read`**
- **Descripción**: Marcar mensajes como leídos
- **Autenticación**: ✅ Requerida
- **Request Body**:
```json
{
  "messageIds": ["uuid1", "uuid2", ...]
}
```

---

#### 8. Notificaciones de Clínica

**GET `/api/clinics/notifications`**
- **Descripción**: Obtener notificaciones
- **Autenticación**: ✅ Requerida
- **Query Parameters** (opcionales):
  - `unreadOnly`: `true|false`
  - `limit`: `number`
- **Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "appointment_new" | "appointment_confirmed" | "appointment_cancelled",
      "title": "Nueva cita",
      "message": "Nueva cita programada...",
      "isRead": false,
      "createdAt": "2025-01-29T10:00:00Z"
    }
  ]
}
```

**GET `/api/clinics/notifications/unread-count`**
- **Descripción**: Contador de no leídas
- **Autenticación**: ✅ Requerida
- **Response**:
```json
{
  "success": true,
  "data": {
    "count": 5
  }
}
```

**PATCH `/api/clinics/notifications/read-all`**
- **Descripción**: Marcar todas como leídas
- **Autenticación**: ✅ Requerida

**PATCH `/api/clinics/notifications/:notificationId/read`**
- **Descripción**: Marcar una como leída
- **Autenticación**: ✅ Requerida

---

### 👨‍⚕️ Módulo de Médicos (`/api/doctors`)

#### 1. Perfil de Médico

**GET `/api/doctors/profile`**
- **Descripción**: Obtener perfil del médico
- **Autenticación**: ✅ Requerida (rol: provider)
- **Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "commercialName": "Dr. Juan Pérez",
    "description": "Especialista en...",
    "logoUrl": "https://...",
    "specialty": "Cardiología",
    "schedules": {
      "monday": { "enabled": true, "startTime": "09:00", "endTime": "17:00" },
      // ... todos los días
    }
  }
}
```

**PUT `/api/doctors/profile`**
- **Descripción**: Actualizar perfil
- **Autenticación**: ✅ Requerida

---

#### 2. Dashboard de Médico

**GET `/api/doctors/dashboard`**
- **Descripción**: Estadísticas del dashboard
- **Autenticación**: ✅ Requerida
- **Response**:
```json
{
  "success": true,
  "data": {
    "totalAppointments": 150,
    "pendingAppointments": 25,
    "completedAppointments": 100,
    "totalRevenue": 5000.00,
    "averageRating": 4.5,
    "totalReviews": 50,
    "upcomingAppointments": [...],
    "provider": { ... },
    "clinic": {
      "id": "uuid",
      "name": "Clínica Central",
      "logoUrl": "https://...",
      "address": "Calle Principal 123",
      "phone": "0991234567",
      "whatsapp": "0991234567"
    } | null
  }
}
```

**⚠️ IMPORTANTE**: El campo `clinic` puede ser `null` si el médico NO está asociado a una clínica. El frontend debe validar esto antes de acceder a `clinic.address`.

---

#### 3. Panel de Médico Asociado a Clínica

**GET `/api/doctors/clinic-info`**
- **Descripción**: Información básica de la clínica asociada
- **Autenticación**: ✅ Requerida
- **Response**:
```json
{
  "success": true,
  "data": {
    "clinicId": "uuid",
    "clinicName": "Clínica Central",
    "clinicAddress": "Calle Principal 123" | null,
    "clinicPhone": "0991234567" | null,
    "clinicWhatsapp": "0991234567" | null,
    "doctorId": "uuid",
    "officeNumber": "101" | null,
    "isActive": true
  }
}
```

**⚠️ IMPORTANTE**: Si el médico NO está asociado, retorna objeto con todos los campos en `null` (NO retorna 404).

**GET `/api/doctors/clinic/profile`**
- **Descripción**: Perfil completo de la clínica asociada
- **Autenticación**: ✅ Requerida
- **Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid" | null,
    "name": "Clínica Central" | null,
    "logoUrl": "https://..." | null,
    "address": "Calle Principal 123" | null,
    "phone": "0991234567" | null,
    "whatsapp": "0991234567" | null,
    "description": "..." | null,
    "latitude": -0.1806532 | null,
    "longitude": -78.4678382 | null,
    "doctorInfo": {
      "id": "uuid" | null,
      "name": "Dr. Juan Pérez" | null,
      "specialty": "Cardiología" | null,
      "officeNumber": "101" | null,
      "profileImageUrl": "https://..." | null,
      "phone": "0991234567" | null,
      "whatsapp": "0991234567" | null
    }
  }
}
```

**⚠️ CRÍTICO**: El frontend DEBE validar que `data.address` no sea `null` antes de acceder. Si es `null`, significa que el médico no está asociado o la clínica no tiene dirección.

**PUT `/api/doctors/clinic/profile`**
- **Descripción**: Actualizar perfil del médico en la clínica
- **Autenticación**: ✅ Requerida
- **Request Body**:
```json
{
  "officeNumber": "102",
  "phone": "0991234567",
  "whatsapp": "0991234567",
  "profileImageUrl": "https://..."
}
```

---

**GET `/api/doctors/clinic/appointments`**
- **Descripción**: Citas del médico en la clínica
- **Autenticación**: ✅ Requerida
- **Query Parameters** (opcionales):
  - `date`: `YYYY-MM-DD`
  - `status`: `scheduled|confirmed|attended|cancelled|no_show`
- **Response**: Similar a `/api/clinics/appointments` pero filtrado por el médico autenticado

**PATCH `/api/doctors/clinic/appointments/:appointmentId/status`**
- **Descripción**: Actualizar estado de cita
- **Autenticación**: ✅ Requerida

---

**GET `/api/doctors/clinic/reception/messages`**
- **Descripción**: Mensajes con recepción
- **Autenticación**: ✅ Requerida
- **Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "clinicId": "uuid",
      "doctorId": "uuid",
      "doctorName": "Dr. Juan Pérez",
      "from": "doctor" | "reception",
      "message": "Mensaje de texto",
      "timestamp": "2025-01-29T10:00:00Z",
      "isRead": false,
      "senderName": "Dr. Juan Pérez" | "Clínica Central"
    }
  ]
}
```

**⚠️ IMPORTANTE**: El campo `from` puede ser `"doctor"` (cuando el médico envía) o `"reception"` (cuando la recepción envía).

**POST `/api/doctors/clinic/reception/messages`**
- **Descripción**: Enviar mensaje a recepción
- **Autenticación**: ✅ Requerida
- **Request Body**:
```json
{
  "message": "Mensaje de texto"
}
```
- **Response**: Retorna el mensaje creado con `from: "doctor"`

**PATCH `/api/doctors/clinic/reception/messages/read`**
- **Descripción**: Marcar mensajes como leídos
- **Autenticación**: ✅ Requerida
- **Request Body**:
```json
{
  "messageIds": ["uuid1", "uuid2", ...]
}
```

---

**GET `/api/doctors/clinic/date-blocks`**
- **Descripción**: Obtener bloqueos de fecha solicitados
- **Autenticación**: ✅ Requerida

**POST `/api/doctors/clinic/date-blocks/request`**
- **Descripción**: Solicitar bloqueo de fecha
- **Autenticación**: ✅ Requerida
- **Request Body**:
```json
{
  "date": "2025-02-15",
  "reason": "Vacaciones"
}
```

---

**GET `/api/doctors/clinic/notifications`**
- **Descripción**: Notificaciones del médico en la clínica
- **Autenticación**: ✅ Requerida

---

### 🔐 Autenticación (`/api/auth`)

**POST `/api/auth/login`**
- **Descripción**: Iniciar sesión
- **Autenticación**: ❌ Público
- **Request Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```
- **Response**:
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "email": "user@example.com",
    "token": "JWT_TOKEN",
    "role": "provider" | "patient" | "admin",
    "serviceType": "doctor" | "clinic" | "pharmacy" | "laboratory" | "ambulance",
    "tipo": "doctor" | "clinic" | "pharmacy" | "laboratory" | "ambulance"
  }
}
```

**⚠️ IMPORTANTE**: El frontend debe usar `serviceType` y `tipo` para redirigir:
- `serviceType: "clinic"` → Dashboard de clínica
- `serviceType: "doctor"` → Dashboard de médico
- `tipo: "clinic"` → Dashboard de clínica
- `tipo: "doctor"` → Dashboard de médico

---

## ❌ ENDPOINTS FALTANTES (CRÍTICOS)

### 1. Módulo de Pacientes (`/api/patients`)

**Estado**: ❌ No implementado  
**Prioridad**: 🔴 CRÍTICA

#### Endpoints necesarios:

- [ ] `GET /api/patients/profile` - Obtener perfil del paciente
- [ ] `PUT /api/patients/profile` - Actualizar perfil
- [ ] `GET /api/patients/appointments` - Listar citas del paciente
- [ ] `GET /api/patients/appointments/:id` - Detalle de cita
- [ ] `DELETE /api/patients/appointments/:id` - Cancelar cita
- [ ] `GET /api/patients/medical-history` - Historial médico
- [ ] `GET /api/patients/favorites` - Listar favoritos
- [ ] `POST /api/patients/favorites` - Agregar a favoritos
- [ ] `DELETE /api/patients/favorites/:id` - Eliminar de favoritos
- [ ] `GET /api/patients/notifications` - Notificaciones
- [ ] `PUT /api/patients/notifications/:id/read` - Marcar como leída

---

### 2. Módulo de Citas Público (`/api/appointments`)

**Estado**: ❌ No implementado  
**Prioridad**: 🔴 CRÍTICA  
**Bloquea**: Sistema de booking

#### Endpoints necesarios:

- [ ] `GET /api/appointments/available-slots` - Horarios disponibles (CRÍTICO)
  - **Query Parameters**:
    - `providerId`: `uuid` (requerido)
    - `date`: `YYYY-MM-DD` (requerido)
  - **Response**:
```json
{
  "success": true,
  "data": {
    "date": "2025-02-15",
    "availableSlots": [
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      // ...
    ]
  }
}
```

- [ ] `POST /api/appointments` - Crear cita (público)
  - **Request Body**:
```json
{
  "providerId": "uuid",
  "patientId": "uuid",
  "scheduledFor": "2025-02-15T10:00:00Z",
  "reason": "Consulta de rutina"
}
```

- [ ] `GET /api/appointments` - Listar citas (con filtros)
- [ ] `GET /api/appointments/:id` - Detalle de cita
- [ ] `PUT /api/appointments/:id` - Actualizar cita
- [ ] `DELETE /api/appointments/:id` - Cancelar cita

---

### 3. Sistema de Pagos (`/api/payments`)

**Estado**: ❌ No implementado  
**Prioridad**: 🔴 CRÍTICA

#### Endpoints necesarios:

- [ ] `POST /api/payments` - Crear pago
- [ ] `POST /api/payments/:id/confirm` - Confirmar pago
- [ ] `GET /api/payments` - Listar pagos
- [ ] `GET /api/payments/:id` - Detalle de pago
- [ ] `GET /api/payments/methods` - Métodos de pago disponibles

---

### 4. Catálogo Público (`/api/catalog`)

**Estado**: ❌ No implementado  
**Prioridad**: 🟡 Alta

#### Endpoints necesarios:

- [ ] `GET /api/catalog/providers` - Listar proveedores (doctores, clínicas, etc.)
  - **Query Parameters**:
    - `category`: `doctor|clinic|pharmacy|laboratory|ambulance`
    - `specialty`: `Cardiología|...` (solo para doctores)
    - `city`: `Quito|Guayaquil|...`
    - `latitude`: `number`
    - `longitude`: `number`
    - `radius`: `number` (km)
- [ ] `GET /api/catalog/providers/:id` - Detalle de proveedor
- [ ] `GET /api/catalog/providers/:id/schedule` - Horarios disponibles

---

### 5. Reseñas (`/api/reviews`)

**Estado**: ❌ No implementado  
**Prioridad**: 🟡 Alta

#### Endpoints necesarios:

- [ ] `GET /api/reviews` - Listar reseñas
- [ ] `POST /api/reviews` - Crear reseña
- [ ] `PUT /api/reviews/:id` - Actualizar reseña
- [ ] `DELETE /api/reviews/:id` - Eliminar reseña

---

## ⚠️ NOTAS IMPORTANTES PARA EL FRONTEND

### 1. Manejo de Errores

**Todos los endpoints retornan esta estructura en caso de error:**

```json
{
  "success": false,
  "message": "Mensaje de error descriptivo",
  "errors": [] // Opcional, array de errores de validación
}
```

**Códigos HTTP:**
- `200` - Éxito
- `201` - Creado
- `400` - Bad Request (validación)
- `401` - Unauthorized (no autenticado)
- `403` - Forbidden (sin permisos)
- `404` - Not Found
- `500` - Internal Server Error

---

### 2. Validación de Campos Null

**⚠️ CRÍTICO**: Muchos endpoints retornan campos como `null` en lugar de `undefined`. El frontend DEBE validar esto:

```typescript
// ❌ INCORRECTO
const address = data.address; // Puede ser null

// ✅ CORRECTO
const address = data.address || 'Sin dirección';
// O
if (data.address) {
  // Usar address
}
```

**Endpoints que retornan campos null:**
- `GET /api/doctors/clinic/profile` - `address`, `phone`, `whatsapp`, etc. pueden ser `null`
- `GET /api/doctors/clinic-info` - Todos los campos pueden ser `null` si no hay clínica
- `GET /api/doctors/dashboard` - `clinic` puede ser `null`

---

### 3. Estructura de Respuestas

**Todos los endpoints exitosos retornan:**

```json
{
  "success": true,
  "data": { ... }
}
```

**El frontend debe acceder a `response.data`, no directamente a `response`.**

---

### 4. Autenticación

**Todos los endpoints protegidos requieren:**

```
Authorization: Bearer <JWT_TOKEN>
```

**El token se obtiene del login y debe guardarse en localStorage/sessionStorage.**

---

### 5. CORS

**El backend está configurado para aceptar requests desde:**
- `http://localhost:5173` (Vite dev server)
- `http://localhost:3000` (Otros servidores locales)
- Configurable mediante `CORS_ORIGINS` en variables de entorno

---

### 6. Query Parameters

**Los query parameters deben enviarse como strings:**

```
GET /api/clinics/appointments?date=2025-01-15&doctorId=uuid&status=confirmed
```

**No usar objetos JSON en query parameters.**

---

### 7. Formato de Fechas

**El backend espera y retorna fechas en formato ISO 8601:**

```
2025-01-15T10:00:00Z
```

**Para fechas sin hora:**

```
2025-01-15
```

---

### 8. Especialidades Médicas

**Las 20 especialidades válidas son:**

1. Medicina General
2. Cardiología
3. Dermatología
4. Ginecología
5. Pediatría
6. Oftalmología
7. Traumatología
8. Neurología
9. Psiquiatría
10. Urología
11. Endocrinología
12. Gastroenterología
13. Neumología
14. Otorrinolaringología
15. Oncología
16. Reumatología
17. Nefrología
18. Cirugía General
19. Anestesiología
20. Odontología

**El frontend debe validar que la especialidad seleccionada esté en esta lista.**

---

## 📝 Ejemplo de Uso (Frontend)

### Login y Redirección

```typescript
// Login
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

const { success, data } = await response.json();

if (success) {
  // Guardar token
  localStorage.setItem('token', data.token);
  
  // Redirigir según serviceType
  if (data.serviceType === 'clinic') {
    router.push('/clinic/dashboard');
  } else if (data.serviceType === 'doctor') {
    router.push('/doctor/dashboard');
  }
}
```

### Obtener Perfil de Clínica (Médico Asociado)

```typescript
const response = await fetch('http://localhost:3000/api/doctors/clinic/profile', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const { success, data } = await response.json();

if (success) {
  // ⚠️ IMPORTANTE: Validar que address no sea null
  if (data.address) {
    console.log('Dirección:', data.address);
  } else {
    console.log('No hay dirección disponible');
  }
}
```

---

## 🔄 Próximos Pasos

1. **Implementar módulo de pacientes** (CRÍTICO)
2. **Implementar sistema de booking** (CRÍTICO)
3. **Implementar sistema de pagos** (CRÍTICO)
4. **Implementar catálogo público** (Alta prioridad)
5. **Implementar sistema de reseñas** (Alta prioridad)

---

**¿Preguntas?** Contacta al equipo de backend.
