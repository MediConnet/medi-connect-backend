# 🚀 Solicitud de Implementación de Endpoints - Backend MediConnet

**Para:** Equipo Backend  
**De:** Equipo Frontend  
**Fecha:** Enero 2025  
**Prioridad:** 🔴 ALTA - Funcionalidades Bloqueadas

---

## 📋 Resumen Ejecutivo

El frontend de MediConnet está **70% conectado** al backend. Necesitamos implementar **26 endpoints pendientes** para completar la integración al 100%.

### Estado Actual
```
✅ Conectados:  60 endpoints (70%)
🔴 Pendientes:  26 endpoints (30%)
    ├─ 🔴 Críticos:     13 endpoints (BLOQUEANTES)
    ├─ 🟡 Importantes:   6 endpoints
    └─ 🟢 Mejoras:       7 endpoints
```

### Impacto
- ❌ **Médicos asociados a clínicas NO pueden trabajar** (10 endpoints faltantes)
- ❌ **Clínicas NO pueden comunicarse con médicos** (3 endpoints faltantes)
- ⚠️ **Módulos de Insumos y Laboratorios usan mocks** (6 endpoints faltantes)
- ⚠️ **Home y Ambulancias sin backend real** (7 endpoints faltantes)

---

## 🔴 FASE 1: CRÍTICO - Implementar ESTA SEMANA

### 1. Médico Asociado a Clínica (10 endpoints)

**Contexto:** Los médicos que trabajan en clínicas necesitan un perfil separado del perfil independiente. Deben poder ver sus citas, comunicarse con la recepción, y solicitar bloqueos de fechas.

#### 1.1. Información de la Clínica

##### `GET /api/doctors/clinic-info`
Obtener información básica de la clínica a la que está asociado el médico.

**Auth:** Bearer Token (médico)

**Response:**
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

**Lógica:**
- Obtener el `clinicId` del médico desde la relación `DoctorClinicAssociation`
- Retornar info básica de la clínica

---

#### 1.2. Perfil del Médico Asociado

##### `GET /api/doctors/clinic/profile`
Obtener perfil profesional del médico asociado a una clínica.

**Auth:** Bearer Token (médico)

**Response:**
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

**Lógica:**
- Obtener perfil del médico desde `DoctorClinicAssociation`
- Incluir información de la clínica asociada

---

##### `PUT /api/doctors/clinic/profile`
Actualizar perfil profesional del médico asociado.

**Auth:** Bearer Token (médico)

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

**Response:** Mismo formato que GET

**Lógica:**
- Actualizar campos del perfil en `DoctorClinicAssociation`
- Validar que el médico esté asociado a la clínica

---

#### 1.3. Mensajería con Recepción

##### `GET /api/doctors/clinic/reception/messages`
Obtener mensajes entre el médico y la recepción de la clínica.

**Auth:** Bearer Token (médico)

**Response:**
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

**Lógica:**
- Crear tabla `ClinicReceptionMessages` con campos: `id`, `clinicId`, `doctorId`, `from` (enum: 'doctor' | 'reception'), `message`, `timestamp`, `isRead`, `senderName`
- Filtrar mensajes por `doctorId` del token
- Ordenar por `timestamp` DESC

---

##### `POST /api/doctors/clinic/reception/messages`
Enviar mensaje a la recepción de la clínica.

**Auth:** Bearer Token (médico)

**Request:**
```json
{
  "message": "Hola, estoy disponible mañana"
}
```

**Response:** Mismo formato que GET (un solo mensaje)

**Lógica:**
- Crear mensaje con `from: 'doctor'`
- Obtener `clinicId` de la asociación del médico
- Retornar el mensaje creado

---

##### `PATCH /api/doctors/clinic/reception/messages/read`
Marcar mensajes como leídos.

**Auth:** Bearer Token (médico)

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

**Lógica:**
- Actualizar `isRead: true` para los mensajes especificados
- Validar que los mensajes pertenezcan al médico

---

#### 1.4. Solicitudes de Bloqueo de Fechas

##### `GET /api/doctors/clinic/date-blocks`
Obtener solicitudes de bloqueo de fechas del médico.

**Auth:** Bearer Token (médico)

**Response:**
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

**Lógica:**
- Crear tabla `DoctorDateBlockRequests` con campos: `id`, `doctorId`, `clinicId`, `startDate`, `endDate`, `reason`, `status` (enum: 'pending' | 'approved' | 'rejected'), `createdAt`, `reviewedAt`, `reviewedBy`, `rejectionReason`
- Filtrar por `doctorId` del token
- Ordenar por `createdAt` DESC

---

##### `POST /api/doctors/clinic/date-blocks/request`
Solicitar bloqueo de fechas.

**Auth:** Bearer Token (médico)

**Request:**
```json
{
  "startDate": "2025-02-01",
  "endDate": "2025-02-05",
  "reason": "Vacaciones"
}
```

**Response:** Mismo formato que GET (una sola solicitud)

**Lógica:**
- Crear solicitud con `status: 'pending'`
- Obtener `clinicId` de la asociación del médico
- Validar que `startDate < endDate`

---

#### 1.5. Citas del Médico Asociado

##### `GET /api/doctors/clinic/appointments`
Obtener citas confirmadas del médico asociado (sin información financiera).

**Auth:** Bearer Token (médico)

**Response:**
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

**Lógica:**
- Obtener citas de la tabla `Appointments` donde `doctorId` = médico del token
- Filtrar por `status IN ('CONFIRMED', 'COMPLETED', 'NO_SHOW')`
- NO incluir información de pagos (el médico asociado no maneja pagos)
- Ordenar por `date`, `time` ASC

---

##### `PATCH /api/doctors/clinic/appointments/:appointmentId/status`
Actualizar estado de cita (marcar como atendida o no asistió).

**Auth:** Bearer Token (médico)

**Request:**
```json
{
  "status": "COMPLETED"
}
```

**Valores permitidos:** `COMPLETED`, `NO_SHOW`

**Response:** Mismo formato que GET (cita actualizada)

**Lógica:**
- Validar que la cita pertenezca al médico
- Actualizar `status` de la cita
- Solo permitir cambios a `COMPLETED` o `NO_SHOW`

---

### 2. Mensajería Clínica-Recepción (3 endpoints)

**Contexto:** Las clínicas necesitan comunicarse con sus médicos asociados desde el panel de recepción.

##### `GET /api/clinics/reception/messages`
Obtener mensajes entre la recepción de la clínica y un médico específico.

**Auth:** Bearer Token (clínica)

**Query Params:**
- `doctorId` (opcional): `uuid` - Filtrar mensajes con un médico específico

**Response:**
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

**Lógica:**
- Usar la misma tabla `ClinicReceptionMessages`
- Filtrar por `clinicId` del token
- Si `doctorId` está presente, filtrar también por ese doctor
- Incluir nombre del doctor en la respuesta
- Ordenar por `timestamp` DESC

---

##### `POST /api/clinics/reception/messages`
Enviar mensaje desde la recepción a un médico.

**Auth:** Bearer Token (clínica)

**Request:**
```json
{
  "doctorId": "uuid",
  "message": "Hola, necesitamos coordinar el horario de mañana"
}
```

**Response:** Mismo formato que GET (un solo mensaje)

**Lógica:**
- Crear mensaje con `from: 'reception'`
- Validar que el doctor esté asociado a la clínica
- Retornar el mensaje creado

---

##### `PATCH /api/clinics/reception/messages/read`
Marcar mensajes como leídos por la recepción.

**Auth:** Bearer Token (clínica)

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

**Lógica:**
- Actualizar `isRead: true` para los mensajes especificados
- Validar que los mensajes pertenezcan a la clínica

---

## 🟡 FASE 2: IMPORTANTE - Implementar en 2 SEMANAS

### 3. Insumos Médicos (5 endpoints)

**Contexto:** Módulo completo de tiendas de insumos médicos. Actualmente usa mocks.

##### `GET /api/supplies`
Listar tiendas de insumos médicos.

**Auth:** Público (sin auth)

**Response:**
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

**Lógica:**
- Obtener tiendas de insumos de la tabla `SupplyStores`
- Incluir rating promedio calculado
- Filtrar solo tiendas activas

---

##### `GET /api/supplies/:id`
Obtener detalle de una tienda de insumos.

**Auth:** Público (sin auth)

**Response:** Mismo formato que GET /api/supplies (un solo objeto)

**Lógica:**
- Obtener tienda por ID
- Incluir información completa (horarios, ubicación, etc.)

---

##### `GET /api/supplies/:id/reviews`
Obtener reseñas de una tienda de insumos.

**Auth:** Público (sin auth)

**Response:**
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

**Lógica:**
- Obtener reseñas de la tabla `SupplyStoreReviews`
- Incluir nombre del usuario
- Ordenar por `createdAt` DESC

---

##### `POST /api/supplies/:id/reviews`
Crear una reseña para una tienda de insumos.

**Auth:** Bearer Token (usuario)

**Request:**
```json
{
  "rating": 5,
  "comment": "Excelente servicio"
}
```

**Response:** Mismo formato que GET (una sola reseña)

**Lógica:**
- Crear reseña en `SupplyStoreReviews`
- Validar que el usuario esté autenticado
- Actualizar rating promedio de la tienda

---

##### `GET /api/supplies/:userId/dashboard`
Obtener dashboard de una tienda de insumos (estadísticas, productos, pedidos).

**Auth:** Bearer Token (proveedor de insumos)

**Response:**
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

**Lógica:**
- Obtener tienda del proveedor
- Calcular estadísticas de productos y pedidos
- Incluir pedidos recientes

---

### 4. Laboratorios (1 endpoint)

##### `GET /api/laboratories/:userId/dashboard`
Obtener dashboard de un laboratorio (estadísticas, citas, exámenes).

**Auth:** Bearer Token (proveedor de laboratorio)

**Response:**
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

**Lógica:**
- Obtener laboratorio del proveedor
- Calcular estadísticas de citas
- Incluir citas recientes y exámenes disponibles

---

## 🟢 FASE 3: MEJORAS - Implementar en 1 MES

### 5. Home (3 endpoints)

**Nota:** Estos endpoints tienen fallback a mocks, por lo que el frontend funciona sin ellos.

##### `GET /api/home/content`
Obtener contenido principal de la página home.

**Auth:** Público (sin auth)

**Response:**
```json
{
  "success": true,
  "data": {
    "hero": {
      "title": "Tu Salud es Nuestra Prioridad",
      "subtitle": "Encuentra médicos, farmacias, laboratorios...",
      "ctaText": "Explora Nuestros Servicios",
      "ctaLink": "/services"
    },
    "features": {
      "title": "¿Por Qué Elegirnos?",
      "subtitle": "La mejor plataforma..."
    },
    "featuredServices": {
      "title": "Profesionales Premium",
      "subtitle": "Servicios verificados...",
      "rotationInterval": 5
    },
    "joinSection": {
      "title": "Únete a Medify",
      "subtitle": "La plataforma que conecta...",
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

**Lógica:**
- Obtener contenido desde tabla `HomeContent` (configurable desde admin)
- Si no existe, retornar valores por defecto

---

##### `GET /api/home/features`
Obtener características destacadas de la plataforma.

**Auth:** Público (sin auth)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "icon": "LocationOn",
      "title": "Encuentra servicios cercanos",
      "description": "Localiza médicos, farmacias...",
      "order": 1
    }
  ]
}
```

**Lógica:**
- Obtener features desde tabla `HomeFeatures`
- Ordenar por `order` ASC

---

##### `GET /api/home/featured-services`
Obtener servicios destacados para mostrar en el home.

**Auth:** Público (sin auth)

**Response:**
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

**Lógica:**
- Obtener proveedores destacados (campo `isFeatured: true`)
- Limitar a 10 resultados
- Ordenar por rating DESC

---

### 6. Ambulancias (4 endpoints)

**Nota:** Módulo completo sin APIs definidas. Actualmente usa mocks.

##### `GET /api/ambulances/profile`
Obtener perfil de ambulancia.

**Auth:** Bearer Token (proveedor de ambulancia)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Ambulancias Rápidas",
    "description": "Servicio de ambulancias 24/7",
    "phone": "+593 99 123 4567",
    "whatsapp": "+593 99 123 4567",
    "address": "Av. Principal 123",
    "rating": 4.8,
    "totalTrips": 150
  }
}
```

---

##### `PUT /api/ambulances/profile`
Actualizar perfil de ambulancia.

**Auth:** Bearer Token (proveedor de ambulancia)

**Request:**
```json
{
  "name": "Ambulancias Rápidas",
  "description": "Servicio de ambulancias 24/7",
  "phone": "+593 99 123 4567",
  "whatsapp": "+593 99 123 4567",
  "address": "Av. Principal 123"
}
```

**Response:** Mismo formato que GET

---

##### `GET /api/ambulances/reviews`
Obtener reseñas de ambulancia.

**Auth:** Bearer Token (proveedor de ambulancia)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "rating": 5,
      "comment": "Excelente servicio",
      "patientName": "Juan Pérez",
      "date": "2025-01-15T10:30:00Z"
    }
  ]
}
```

---

##### `GET /api/ambulances/settings`
Obtener configuración de ambulancia.

**Auth:** Bearer Token (proveedor de ambulancia)

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": {
      "email": true,
      "sms": false,
      "push": true
    },
    "privacy": {
      "showPhone": true,
      "showAddress": false
    }
  }
}
```

---

## 📊 Resumen de Implementación

### Por Fase
```
Fase 1 (Crítico):     13 endpoints - ESTA SEMANA
Fase 2 (Importante):   6 endpoints - 2 SEMANAS
Fase 3 (Mejoras):      7 endpoints - 1 MES
────────────────────────────────────────────────
TOTAL:                26 endpoints
```

### Por Módulo
```
├─ Médico Asociado:        10 endpoints 🔴
├─ Mensajería Clínica:      3 endpoints 🔴
├─ Insumos:                 5 endpoints 🟡
├─ Laboratorios:            1 endpoint  🟡
├─ Home:                    3 endpoints 🟢
└─ Ambulancias:             4 endpoints 🟢
```

---

## 🔧 Consideraciones Técnicas

### Estructura de Respuesta
Todos los endpoints deben retornar:
```json
{
  "success": true,
  "data": { ... }
}
```

En caso de error:
```json
{
  "success": false,
  "message": "Mensaje de error",
  "errors": { ... }
}
```

### Autenticación
- Usar JWT Bearer Token en header: `Authorization: Bearer <token>`
- Validar roles según el endpoint
- Retornar 401 si no está autenticado
- Retornar 403 si no tiene permisos

### Validaciones
- Validar todos los campos requeridos
- Validar formatos (email, teléfono, fechas)
- Validar relaciones (que el recurso pertenezca al usuario)
- Retornar errores descriptivos

### Base de Datos
Tablas nuevas necesarias:
- `ClinicReceptionMessages` (mensajería)
- `DoctorDateBlockRequests` (bloqueos de fechas)
- `SupplyStores` (tiendas de insumos)
- `SupplyStoreReviews` (reseñas de insumos)
- `HomeContent` (contenido del home)
- `HomeFeatures` (características del home)

---

## 📚 Documentación de Referencia

### Frontend
- **Análisis Completo:** `ANALISIS_APIS_FRONTEND.md`
- **Resumen Ejecutivo:** `RESUMEN_CONEXION_BACKEND.md`
- **Checklist:** `CHECKLIST_IMPLEMENTACION.md`
- **Estado Visual:** `ESTADO_APIS_VISUAL.md`

### Backend
- **Endpoints Generales:** `BACKEND_ENDPOINTS.md`
- **Endpoints Pendientes:** `PENDING_ENDPOINTS.md`
- **Todos los Endpoints:** `ALL_ENDPOINTS.md`

### Archivos Frontend (para referencia)
```
src/features/doctor-panel/infrastructure/clinic-associated.api.ts
src/features/clinic-panel/infrastructure/clinic-reception-messages.api.ts
src/features/supplies-panel/infrastructure/supply.api.ts
src/features/laboratory-panel/infrastructure/laboratories.repository.ts
src/features/home/infrastructure/home.api.ts
src/features/ambulance-panel/infrastructure/*.mock.ts
```

---

## ✅ Checklist de Entrega

Para cada endpoint implementado:
- [ ] Endpoint creado y funcionando
- [ ] Validaciones implementadas
- [ ] Autenticación y autorización
- [ ] Probado con Postman/Thunder Client
- [ ] Documentación actualizada
- [ ] Notificar al equipo frontend

---

## 🚀 Próximos Pasos

1. **Backend:** Implementar Fase 1 (13 endpoints críticos)
2. **Frontend:** Probar endpoints implementados
3. **Backend:** Implementar Fase 2 (6 endpoints importantes)
4. **Frontend:** Conectar y probar
5. **Backend:** Implementar Fase 3 (7 endpoints de mejoras)
6. **Frontend:** Integración final

---

## 📞 Contacto

Si tienes dudas sobre algún endpoint, request/response esperado, o lógica de negocio, contacta al equipo frontend.

**Archivos de referencia creados:**
- `ANALISIS_APIS_FRONTEND.md` - Análisis detallado
- `RESUMEN_CONEXION_BACKEND.md` - Resumen ejecutivo
- `CHECKLIST_IMPLEMENTACION.md` - Checklist para seguimiento
- `ESTADO_APIS_VISUAL.md` - Vista visual del estado

---

**Última actualización:** Enero 2025  
**Preparado por:** Equipo Frontend MediConnet  
**Prioridad:** 🔴 ALTA - Funcionalidades Bloqueadas
