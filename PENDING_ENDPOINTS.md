# 📋 Endpoints Pendientes de Consumo - Frontend MediConnet

Este documento lista **TODOS** los endpoints que el frontend está intentando consumir pero que aún no están implementados en el backend, o que están retornando errores 404/500 y el frontend está usando mocks como fallback.

**Fecha de actualización:** Enero 2025

---

## 📊 Resumen Ejecutivo

- **Total de endpoints pendientes:** 22+
- **Módulos afectados:** 5 (Médico Asociado, Clínica, Insumos, Laboratorios, Home)
- **Prioridad:** Alta (funcionalidades críticas bloqueadas)

---

## 🏥 1. Panel de Médico Asociado a Clínica

**Estado:** ⚠️ Todos los endpoints están definidos en el frontend pero retornan 404. El frontend usa mocks como fallback.

### 1.0. Información de la Clínica

#### `GET /api/doctors/clinic-info`
**Descripción:** Obtener información básica de la clínica a la que está asociado el médico.

**Headers:**
```
Authorization: Bearer <token>
```

**Response esperado:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Clínica Central",
    "address": "Av. Principal 123",
    "phone": "+593 99 123 4567",
    "whatsapp": "+593 99 123 4567",
    "logoUrl": "https://..."
  }
}
```

**Archivo frontend:** `src/features/doctor-panel/infrastructure/clinic-associated.api.ts:14`

---

### 1.1. Perfil del Médico Asociado

#### `GET /api/doctors/clinic/profile`
**Descripción:** Obtener perfil profesional del médico asociado a una clínica.

**Headers:**
```
Authorization: Bearer <token>
```

**Response esperado:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "clinicId": "uuid",
    "clinicInfo": {
      "id": "uuid",
      "name": "Clínica Central",
      "address": "Av. Principal 123",
      "phone": "+593 99 123 4567",
      "whatsapp": "+593 99 123 4567",
      "logoUrl": "https://..."
    },
    "specialty": "Cardiología",
    "experience": 10,
    "bio": "Descripción profesional...",
    "education": ["Universidad Central - Medicina"],
    "certifications": ["Certificación ABC"],
    "profileImageUrl": "https://...",
    "phone": "+593 99 123 4567",
    "whatsapp": "+593 99 123 4567",
    "email": "doctor@example.com"
  }
}
```

**Archivo frontend:** `src/features/doctor-panel/infrastructure/clinic-associated.api.ts:25`

---

#### `PUT /api/doctors/clinic/profile`
**Descripción:** Actualizar perfil profesional del médico asociado.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "specialty": "Cardiología",
  "experience": 10,
  "bio": "Descripción actualizada...",
  "education": ["Universidad Central - Medicina"],
  "certifications": ["Certificación ABC"],
  "phone": "+593 99 123 4567",
  "whatsapp": "+593 99 123 4567"
}
```

**Response:** Mismo formato que GET.

**Archivo frontend:** `src/features/doctor-panel/infrastructure/clinic-associated.api.ts:36`

---

### 1.2. Mensajería con Recepción

#### `GET /api/doctors/clinic/reception/messages`
**Descripción:** Obtener mensajes entre el médico y la recepción de la clínica.

**Headers:**
```
Authorization: Bearer <token>
```

**Response esperado:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "clinicId": "uuid",
      "doctorId": "uuid",
      "from": "reception",
      "message": "Hola, necesitamos coordinar...",
      "timestamp": "2025-01-15T10:30:00Z",
      "isRead": false,
      "senderName": "Recepción Clínica Central"
    }
  ]
}
```

**Archivo frontend:** `src/features/doctor-panel/infrastructure/clinic-associated.api.ts:50`

---

#### `POST /api/doctors/clinic/reception/messages`
**Descripción:** Enviar mensaje a la recepción de la clínica.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "message": "Hola, estoy disponible mañana"
}
```

**Response:** Mismo formato que GET (un solo mensaje).

**Archivo frontend:** `src/features/doctor-panel/infrastructure/clinic-associated.api.ts:61`

---

#### `PATCH /api/doctors/clinic/reception/messages/read`
**Descripción:** Marcar mensajes como leídos.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "messageIds": ["uuid1", "uuid2"]
}
```

**Response:**
```json
{
  "success": true
}
```

**Archivo frontend:** `src/features/doctor-panel/infrastructure/clinic-associated.api.ts:75`

---

### 1.3. Solicitudes de Bloqueo de Fechas

#### `GET /api/doctors/clinic/date-blocks`
**Descripción:** Obtener solicitudes de bloqueo de fechas del médico.

**Headers:**
```
Authorization: Bearer <token>
```

**Response esperado:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "doctorId": "uuid",
      "clinicId": "uuid",
      "startDate": "2025-02-01",
      "endDate": "2025-02-05",
      "reason": "Vacaciones",
      "status": "pending",
      "createdAt": "2025-01-15T10:30:00Z",
      "reviewedAt": null,
      "reviewedBy": null,
      "rejectionReason": null
    }
  ]
}
```

**Archivo frontend:** `src/features/doctor-panel/infrastructure/clinic-associated.api.ts:86`

---

#### `POST /api/doctors/clinic/date-blocks/request`
**Descripción:** Solicitar bloqueo de fechas.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "startDate": "2025-02-01",
  "endDate": "2025-02-05",
  "reason": "Vacaciones"
}
```

**Response:** Mismo formato que GET (una sola solicitud).

**Archivo frontend:** `src/features/doctor-panel/infrastructure/clinic-associated.api.ts:97`

---

### 1.4. Citas del Médico Asociado

#### `GET /api/doctors/clinic/appointments`
**Descripción:** Obtener citas confirmadas del médico asociado (sin información financiera).

**Headers:**
```
Authorization: Bearer <token>
```

**Response esperado:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "patientId": "uuid",
      "patientName": "Juan Pérez",
      "patientPhone": "+593 99 123 4567",
      "date": "2025-01-20",
      "time": "10:00",
      "reason": "Consulta general",
      "status": "CONFIRMED"
    }
  ]
}
```

**Archivo frontend:** `src/features/doctor-panel/infrastructure/clinic-associated.api.ts:113`

---

#### `PATCH /api/doctors/clinic/appointments/:appointmentId/status`
**Descripción:** Actualizar estado de cita (marcar como atendida o no asistió).

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "status": "COMPLETED" // o "NO_SHOW"
}
```

**Response:** Mismo formato que GET (cita actualizada).

**Archivo frontend:** `src/features/doctor-panel/infrastructure/clinic-associated.api.ts:124`

---

## 🏥 2. Panel de Clínica - Mensajería con Médicos

**Estado:** ⚠️ Endpoints definidos pero retornan 404. El frontend usa mocks como fallback.

### 2.1. Mensajería desde Recepción

#### `GET /api/clinics/reception/messages`
**Descripción:** Obtener mensajes entre la recepción de la clínica y un médico específico.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `doctorId` (opcional): `uuid` - Filtrar mensajes con un médico específico.

**Response esperado:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "clinicId": "uuid",
      "doctorId": "uuid",
      "doctorName": "Dr. Juan Pérez",
      "from": "reception",
      "message": "Hola, necesitamos coordinar...",
      "timestamp": "2025-01-15T10:30:00Z",
      "isRead": true,
      "senderName": "Recepción Clínica Central"
    }
  ]
}
```

**Archivo frontend:** `src/features/clinic-panel/infrastructure/clinic-reception-messages.api.ts:6`

---

#### `POST /api/clinics/reception/messages`
**Descripción:** Enviar mensaje desde la recepción a un médico.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "doctorId": "uuid",
  "message": "Hola, necesitamos coordinar el horario de mañana"
}
```

**Response:** Mismo formato que GET (un solo mensaje).

**Archivo frontend:** `src/features/clinic-panel/infrastructure/clinic-reception-messages.api.ts:19`

---

#### `PATCH /api/clinics/reception/messages/read`
**Descripción:** Marcar mensajes como leídos por la recepción.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "messageIds": ["uuid1", "uuid2"]
}
```

**Response:**
```json
{
  "success": true
}
```

**Archivo frontend:** `src/features/clinic-panel/infrastructure/clinic-reception-messages.api.ts:34`

---

## 🏠 3. Página Home

**Estado:** ⚠️ Endpoints tienen fallback a mocks. Funcionan pero retornan datos estáticos.

### 3.0. Contenido Principal

#### `GET /api/home/content`
**Descripción:** Obtener contenido principal de la página home (hero, features, servicios destacados, sección de unirse, footer).

**Response esperado:**
```json
{
  "success": true,
  "data": {
    "hero": {
      "title": "Tu Salud es Nuestra Prioridad",
      "subtitle": "Encuentra médicos, farmacias, laboratorios y servicios de salud cerca de ti",
      "ctaText": "Explora Nuestros Servicios",
      "ctaLink": "/services"
    },
    "features": {
      "title": "¿Por Qué Elegirnos?",
      "subtitle": "La mejor plataforma para conectar con servicios de salud"
    },
    "featuredServices": {
      "title": "Profesionales Premium",
      "subtitle": "Servicios verificados con la mejor calidad y atención",
      "rotationInterval": 5
    },
    "joinSection": {
      "title": "Únete a Medify",
      "subtitle": "La plataforma que conecta a pacientes y profesionales de la salud",
      "ctaText": "¡Regístrate ahora!",
      "ctaLink": "/register"
    },
    "footer": {
      "copyright": "Conectando salud y bienestar | Medify © 2025",
      "links": [
        { "label": "Política de privacidad", "url": "/privacy" },
        { "label": "Términos y condiciones", "url": "/terms" }
      ]
    }
  }
}
```

**Archivo frontend:** `src/features/home/infrastructure/home.api.ts:12`

---

### 3.1. Características de la Plataforma

#### `GET /api/home/features`
**Descripción:** Obtener características destacadas de la plataforma.

**Response esperado:**
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "icon": "LocationOn",
      "title": "Encuentra servicios cercanos",
      "description": "Localiza médicos, farmacias y laboratorios en tu zona",
      "order": 1
    }
  ]
}
```

**Archivo frontend:** `src/features/home/infrastructure/home.api.ts:58`

---

### 3.2. Servicios Destacados

#### `GET /api/home/featured-services`
**Descripción:** Obtener servicios destacados para mostrar en el home.

**Response esperado:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Dr. Juan Pérez",
      "specialty": "Cardiología",
      "rating": 4.8,
      "imageUrl": "https://...",
      "location": "Quito, Ecuador"
    }
  ]
}
```

**Archivo frontend:** `src/features/home/infrastructure/home.api.ts:104`

---

## 🏪 4. Panel de Insumos Médicos

**Estado:** ⚠️ TODOS los endpoints están usando mocks. No hay llamadas reales al backend.

### 4.1. Listado de Tiendas

#### `GET /api/supplies`
**Descripción:** Obtener lista de tiendas de insumos médicos.

**Response esperado:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Insumos Médicos ABC",
      "description": "Equipos y suministros médicos",
      "address": "Av. Principal 123",
      "phone": "+593 99 123 4567",
      "rating": 4.5,
      "imageUrl": "https://..."
    }
  ]
}
```

**Archivo frontend:** `src/features/supplies-panel/infrastructure/supply.api.ts:10`

---

#### `GET /api/supplies/:id`
**Descripción:** Obtener detalle de una tienda de insumos.

**Response:** Mismo formato que GET /api/supplies (un solo objeto).

**Archivo frontend:** `src/features/supplies-panel/infrastructure/supply.api.ts:24`

---

### 4.2. Reseñas de Tiendas

#### `GET /api/supplies/:id/reviews`
**Descripción:** Obtener reseñas de una tienda de insumos.

**Response esperado:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "supplyStoreId": "uuid",
      "userId": "uuid",
      "userName": "Juan Pérez",
      "rating": 5,
      "comment": "Excelente servicio",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ]
}
```

**Archivo frontend:** `src/features/supplies-panel/infrastructure/supply.api.ts:42`

---

#### `POST /api/supplies/:id/reviews`
**Descripción:** Crear una reseña para una tienda de insumos.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "rating": 5,
  "comment": "Excelente servicio"
}
```

**Response:** Mismo formato que GET (una sola reseña).

**Archivo frontend:** `src/features/supplies-panel/infrastructure/supply.api.ts:60`

---

### 4.3. Dashboard de Insumos

#### `GET /api/supplies/:userId/dashboard`
**Descripción:** Obtener dashboard de una tienda de insumos (estadísticas, productos, pedidos).

**Headers:**
```
Authorization: Bearer <token>
```

**Response esperado:**
```json
{
  "success": true,
  "data": {
    "store": {
      "id": "uuid",
      "name": "Insumos Médicos ABC",
      "description": "...",
      "address": "...",
      "phone": "...",
      "whatsapp": "..."
    },
    "stats": {
      "totalProducts": 150,
      "totalOrders": 45,
      "pendingOrders": 5,
      "completedOrders": 40
    },
    "recentOrders": [...],
    "products": [...]
  }
}
```

**Archivo frontend:** `src/features/supplies-panel/infrastructure/supplies.repository.ts:26`

---

## 🧪 5. Panel de Laboratorios

**Estado:** ⚠️ Dashboard usa mocks. No hay llamada real al backend.

### 5.1. Dashboard de Laboratorio

#### `GET /api/laboratories/:userId/dashboard`
**Descripción:** Obtener dashboard de un laboratorio (estadísticas, citas, exámenes).

**Headers:**
```
Authorization: Bearer <token>
```

**Response esperado:**
```json
{
  "success": true,
  "data": {
    "laboratory": {
      "id": "uuid",
      "name": "Laboratorio Central",
      "description": "...",
      "address": "...",
      "phone": "...",
      "whatsapp": "..."
    },
    "stats": {
      "totalAppointments": 120,
      "pendingAppointments": 10,
      "completedAppointments": 110
    },
    "recentAppointments": [...],
    "availableExams": [...]
  }
}
```

**Archivo frontend:** `src/features/laboratory-panel/infrastructure/laboratories.repository.ts:112`

---

## 📝 Notas Importantes

### Estructura de Respuesta
Todos los endpoints deben retornar la siguiente estructura:
```json
{
  "success": true,
  "data": { ... } // o [ ... ] para arrays
}
```

### Manejo de Errores
- **404 Not Found:** El frontend interpreta 404 como "recurso no encontrado" o "no asociado" (según el contexto).
- **401 Unauthorized:** El frontend redirige al login.
- **500 Internal Server Error:** El frontend muestra mensaje de error genérico.

### Autenticación
Todos los endpoints (excepto los públicos) requieren:
```
Authorization: Bearer <token>
```

El token se obtiene del login y se envía automáticamente en todas las peticiones.

---

## 🔗 Documentación Relacionada

- **Panel de Médico Asociado:** Ver `CLINIC_ASSOCIATED_DOCTOR_BACKEND_SPEC.md`
- **Panel de Clínica:** Ver `CLINIC_PANEL_BACKEND_SPEC.md`
- **Endpoints Generales:** Ver `BACKEND_ENDPOINTS.md`

---

## ✅ Checklist de Implementación

### Prioridad Alta (Funcionalidades Críticas)
- [ ] `GET /api/doctors/clinic-info`
- [ ] `GET /api/doctors/clinic/profile`
- [ ] `PUT /api/doctors/clinic/profile`
- [ ] `GET /api/doctors/clinic/reception/messages`
- [ ] `POST /api/doctors/clinic/reception/messages`
- [ ] `PATCH /api/doctors/clinic/reception/messages/read`
- [ ] `GET /api/clinics/reception/messages`
- [ ] `POST /api/clinics/reception/messages`
- [ ] `PATCH /api/clinics/reception/messages/read`
- [ ] `GET /api/doctors/clinic/appointments`
- [ ] `PATCH /api/doctors/clinic/appointments/:id/status`

### Prioridad Media
- [ ] `GET /api/doctors/clinic/date-blocks`
- [ ] `POST /api/doctors/clinic/date-blocks/request`
- [ ] `GET /api/supplies`
- [ ] `GET /api/supplies/:id`
- [ ] `GET /api/supplies/:id/reviews`
- [ ] `POST /api/supplies/:id/reviews`
- [ ] `GET /api/supplies/:userId/dashboard`
- [ ] `GET /api/laboratories/:userId/dashboard`

### Prioridad Baja (Mejoras)
- [ ] `GET /api/home/content`
- [ ] `GET /api/home/features`
- [ ] `GET /api/home/featured-services`

---

**Última actualización:** Enero 2025  
**Mantenido por:** Equipo Frontend MediConnet
