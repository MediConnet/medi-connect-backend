# 📋 Tareas Pendientes - Backend MediConnect

**Última actualización**: 2026-01-29

Este documento contiene las tareas pendientes después de la implementación del módulo de Clínicas y el Panel de Médico Asociado a Clínica.

---

## ✅ Completado Recientemente

- ✅ Módulo de Clínicas (perfil, dashboard, médicos, citas, recepción, horarios)
- ✅ Panel de Médico Asociado a Clínica (12 endpoints)
- ✅ Sistema de notificaciones automáticas (email, dashboard)
- ✅ Servicio de email con Nodemailer (templates HTML)
- ✅ Job de recordatorios 24h antes de citas
- ✅ Campos de coordenadas (latitude/longitude) para clínicas
- ✅ Seed data para clínicas y médicos asociados

---

## 🔴 CRÍTICO - Módulos Faltantes

### 1. Módulo de Pacientes (`/api/patients`)

**Estado**: ❌ No existe  
**Prioridad**: 🔴 CRÍTICA  
**Bloquea**: Citas, Pagos, Reseñas

#### Endpoints necesarios:
- [ ] `GET /api/patients/profile` - Obtener perfil del paciente
- [ ] `PUT /api/patients/profile` - Actualizar perfil del paciente
- [ ] `GET /api/patients/appointments` - Listar citas del paciente
- [ ] `GET /api/patients/appointments/:id` - Detalle de cita
- [ ] `DELETE /api/patients/appointments/:id` - Cancelar cita
- [ ] `GET /api/patients/medical-history` - Historial médico
- [ ] `GET /api/patients/favorites` - Listar favoritos
- [ ] `POST /api/patients/favorites` - Agregar a favoritos
- [ ] `DELETE /api/patients/favorites/:id` - Eliminar de favoritos
- [ ] `GET /api/patients/notifications` - Notificaciones
- [ ] `PUT /api/patients/notifications/:id/read` - Marcar como leída

**Archivos a crear**:
- `src/patients/handler.ts`
- `src/patients/profile.controller.ts`
- `src/patients/appointments.controller.ts`
- `src/patients/medical-history.controller.ts`
- `src/patients/favorites.controller.ts`
- `src/patients/notifications.controller.ts`

---

### 2. Módulo de Citas (`/api/appointments`)

**Estado**: ❌ No existe  
**Prioridad**: 🔴 CRÍTICA  
**Bloquea**: Sistema de booking, Pagos

#### Endpoints necesarios:
- [ ] `GET /api/appointments/available-slots` - Horarios disponibles (CRÍTICO)
  - Calcular basado en `provider_schedules`
  - Excluir citas ya reservadas
  - Excluir horarios pasados
- [ ] `POST /api/appointments` - Crear cita (público)
  - Validar disponibilidad
  - Validar que no sea en el pasado
  - Crear notificación para el provider
- [ ] `GET /api/appointments` - Listar citas (con filtros)
- [ ] `GET /api/appointments/:id` - Detalle de cita
- [ ] `PUT /api/appointments/:id` - Actualizar cita
- [ ] `DELETE /api/appointments/:id` - Cancelar cita

**Archivos a crear**:
- `src/appointments/handler.ts`
- `src/appointments/booking.controller.ts`
- `src/appointments/availability.controller.ts`

**Lógica crítica**:
- Función para calcular horarios disponibles
- Validación de conflictos
- Integración con `provider_schedules` y `doctor_schedules`

---

### 3. Sistema de Pagos (`/api/payments`)

**Estado**: ❌ No existe  
**Prioridad**: 🔴 CRÍTICA  
**Depende de**: Módulo de Citas

#### Endpoints necesarios:
- [ ] `POST /api/payments` - Crear pago
  - Calcular `amount_total`
  - Calcular `platform_fee` (comisión)
  - Calcular `provider_amount`
- [ ] `POST /api/payments/:id/confirm` - Confirmar pago
  - Actualizar status a `completed`
  - Actualizar `is_paid` en `appointments`
- [ ] `GET /api/payments` - Listar pagos
- [ ] `GET /api/payments/:id` - Detalle de pago
- [ ] `GET /api/payments/methods` - Métodos de pago disponibles

**Integraciones pendientes**:
- [ ] Stripe SDK (opcional para MVP)
- [ ] Webhooks de confirmación
- [ ] Manejo de reembolsos

**Archivos a crear**:
- `src/payments/handler.ts`
- `src/payments/processing.controller.ts`

---

## 🟡 ALTA PRIORIDAD - Completar Módulos Existentes

### 4. Módulo de Farmacias (`/api/pharmacies`)

**Estado**: ⚠️ Handler existe pero está vacío  
**Prioridad**: 🟡 ALTA

#### Endpoints faltantes:
- [ ] `GET /api/pharmacies/profile` - Perfil de farmacia
- [ ] `PUT /api/pharmacies/profile` - Actualizar perfil
- [ ] `GET /api/pharmacies/dashboard` - Dashboard
- [ ] `GET /api/pharmacies/products` - Productos
- [ ] `POST /api/pharmacies/products` - Agregar producto
- [ ] `PUT /api/pharmacies/products/:id` - Actualizar producto
- [ ] `DELETE /api/pharmacies/products/:id` - Eliminar producto
- [ ] `GET /api/pharmacies/orders` - Pedidos recibidos
- [ ] `PUT /api/pharmacies/orders/:id/status` - Actualizar estado
- [ ] `GET /api/pharmacies/reviews` - Reseñas
- [ ] `GET /api/pharmacies/payments` - Pagos e ingresos

**Nota**: Los controladores parciales ya existen, solo falta implementar la lógica completa.

---

### 5. Módulo de Laboratorios (`/api/laboratories`)

**Estado**: ⚠️ Handler existe pero está vacío  
**Prioridad**: 🟡 ALTA

#### Endpoints faltantes:
- [ ] `GET /api/laboratories/profile` - Perfil de laboratorio
- [ ] `PUT /api/laboratories/profile` - Actualizar perfil
- [ ] `GET /api/laboratories/dashboard` - Dashboard
- [ ] `GET /api/laboratories/tests` - Lista de exámenes
- [ ] `POST /api/laboratories/tests` - Agregar examen
- [ ] `PUT /api/laboratories/tests/:id` - Actualizar examen
- [ ] `DELETE /api/laboratories/tests/:id` - Eliminar examen
- [ ] `GET /api/laboratories/appointments` - Citas/exámenes programados
- [ ] `POST /api/laboratories/appointments` - Crear cita de examen
- [ ] `GET /api/laboratories/results` - Resultados de exámenes
- [ ] `POST /api/laboratories/results` - Subir resultado (PDF/imagen)

**Nota**: Similar estructura a farmacias pero con exámenes y resultados.

---

### 6. Módulo de Ambulancias (`/api/ambulances`)

**Estado**: ⚠️ Handler existe pero está vacío  
**Prioridad**: 🟡 ALTA

#### Endpoints faltantes:
- [ ] `GET /api/ambulances/profile` - Perfil de ambulancia
- [ ] `PUT /api/ambulances/profile` - Actualizar perfil
- [ ] `GET /api/ambulances/dashboard` - Dashboard
- [ ] `GET /api/ambulances/requests` - Solicitudes de servicio
- [ ] `POST /api/ambulances/requests` - Crear solicitud
- [ ] `PUT /api/ambulances/requests/:id/accept` - Aceptar solicitud
- [ ] `PUT /api/ambulances/requests/:id/status` - Actualizar estado
- [ ] `GET /api/ambulances/location` - Ubicación actual (GPS)
- [ ] `PUT /api/ambulances/location` - Actualizar ubicación (tracking en tiempo real)
- [ ] `GET /api/ambulances/reviews` - Reseñas
- [ ] `GET /api/ambulances/payments` - Pagos e ingresos

**Nota**: Requiere tracking GPS en tiempo real y notificaciones push urgentes.

---

## 🟢 MEDIA PRIORIDAD - Mejoras y Funcionalidades

### 7. Sistema de Reseñas (`/api/reviews`)

**Estado**: ❌ No existe  
**Prioridad**: 🟢 MEDIA

#### Endpoints necesarios:
- [ ] `GET /api/reviews` - Listar reseñas (público)
- [ ] `GET /api/reviews/provider/:id` - Reseñas de un provider
- [ ] `POST /api/reviews` - Crear reseña
  - Validar que el paciente tuvo una cita completada
  - Calcular rating promedio y actualizar `rating_cache`
- [ ] `PUT /api/reviews/:id` - Actualizar reseña
- [ ] `DELETE /api/reviews/:id` - Eliminar reseña (admin)

**Archivos a crear**:
- `src/reviews/handler.ts`
- `src/reviews/reviews.controller.ts`

---

### 8. Endpoints Públicos de Doctores

**Estado**: ⚠️ Parcialmente implementado  
**Prioridad**: 🟢 MEDIA

#### Endpoints faltantes:
- [ ] `GET /api/doctors` - Listar doctores (público, con filtros)
- [ ] `GET /api/doctors/:id` - Detalle de doctor (público)
- [ ] `GET /api/doctors/:id/reviews` - Reseñas de doctor (público)
- [ ] `POST /api/doctors/:id/reviews` - Crear reseña
- [ ] `GET /api/doctors/branches` - Listar sucursales
- [ ] `GET /api/doctors/branches/:id` - Detalle de sucursal

**Nota**: Necesarios para el catálogo público de servicios.

---

### 9. Sistema de Notificaciones Global (`/api/notifications`)

**Estado**: ⚠️ Parcialmente implementado (solo para clínicas)  
**Prioridad**: 🟢 MEDIA

#### Endpoints faltantes:
- [ ] `GET /api/notifications` - Listar notificaciones del usuario
- [ ] `GET /api/notifications/unread` - Contador de no leídas
- [ ] `PUT /api/notifications/:id/read` - Marcar como leída
- [ ] `PUT /api/notifications/read-all` - Marcar todas como leídas
- [ ] `DELETE /api/notifications/:id` - Eliminar notificación

**Nota**: El sistema de creación automática ya existe, falta el endpoint para consultarlas.

**Archivos a crear**:
- `src/notifications/handler.ts`
- `src/notifications/notifications.controller.ts`

---

### 10. Historial Médico (`/api/medical-history`)

**Estado**: ⚠️ Parcialmente implementado (solo creación desde doctores)  
**Prioridad**: 🟢 MEDIA

#### Endpoints faltantes:
- [ ] `GET /api/medical-history` - Listar historial del paciente
- [ ] `GET /api/medical-history/:id` - Detalle de registro
- [ ] `GET /api/medical-history/patient/:id` - Historial de paciente (doctor)
- [ ] `PUT /api/medical-history/:id` - Actualizar registro
- [ ] `DELETE /api/medical-history/:id` - Eliminar registro

**Nota**: El POST existe en `/api/doctors/appointments/:id/diagnosis`, falta endpoint dedicado.

**Archivos a crear**:
- `src/medical-history/handler.ts`
- `src/medical-history/history.controller.ts`

---

## 🔵 BAJA PRIORIDAD - Mejoras y Optimizaciones

### 11. TODOs en Código Existente

#### Clínicas
- [ ] **Validación de horarios de clínica** (`src/clinics/schedules.controller.ts:220`)
  - Validar que los horarios del médico estén dentro de los horarios de la clínica
- [ ] **Generación de JWT token** (`src/clinics/invitations.controller.ts:177`)
  - Generar token real para invitaciones de médicos
- [ ] **Envío de email con link de invitación** (`src/clinics/doctors.controller.ts:156`)
  - Enviar email con link de invitación al médico

#### Notificaciones
- [ ] **Programar recordatorio 24h antes** (`src/shared/notifications.ts:262`)
  - Ya existe el job, pero verificar que se ejecute correctamente

#### Admin
- [ ] **Implementar modelos de documentos** (`src/admin/handler.ts:633`)
  - Agregar campo de razón de rechazo
  - Implementar gestión de documentos

---

### 12. Servicios Opcionales

#### WhatsApp
- [ ] Integración con API de WhatsApp (Twilio, WhatsApp Business API)
- [ ] Envío de recordatorios por WhatsApp
- [ ] Notificaciones urgentes por WhatsApp

#### Push Notifications
- [ ] Integración con Firebase Cloud Messaging (FCM)
- [ ] Integración con OneSignal
- [ ] Notificaciones push para:
  - Recordatorios de citas
  - Cambios de estado de citas
  - Resultados de exámenes
  - Pedidos de farmacia/insumos
  - Solicitudes de ambulancia (urgente)

---

### 13. Autenticación - Endpoints Faltantes

**Estado**: ⚠️ Parcialmente implementado  
**Prioridad**: 🔵 BAJA

#### Endpoints faltantes:
- [ ] `POST /api/auth/change-password` - Cambiar contraseña (actualmente mock)
- [ ] `POST /api/auth/forgot-password` - Solicitar recuperación (actualmente mock)
- [ ] `POST /api/auth/reset-password` - Resetear contraseña (actualmente mock)
- [ ] `POST /api/auth/logout` - Cerrar sesión (invalidar tokens)
- [ ] `POST /api/auth/verify-email` - Verificar email

---

### 14. Búsqueda y Filtros

**Estado**: ❌ No existe  
**Prioridad**: 🔵 BAJA

#### Funcionalidades:
- [ ] Búsqueda de providers por:
  - Nombre
  - Especialidad
  - Ciudad
  - Servicio
  - Rating
- [ ] Filtros avanzados:
  - Precio
  - Disponibilidad
  - Horarios
  - Métodos de pago
- [ ] Búsqueda de productos (farmacias/insumos)
- [ ] Búsqueda de exámenes (laboratorios)
- [ ] Ordenamiento (por relevancia, rating, precio, distancia)

---

### 15. Geolocalización

**Estado**: ⚠️ Parcialmente implementado (campos lat/lng)  
**Prioridad**: 🔵 BAJA

#### Funcionalidades:
- [ ] Búsqueda por proximidad (usando lat/lng)
- [ ] Cálculo de distancias entre paciente y provider
- [ ] Filtro por radio (ej: "dentro de 5km")
- [ ] Tracking en tiempo real para ambulancias
- [ ] Mapas interactivos (integración con Google Maps/Mapbox)

---

### 16. Gestión de Archivos

**Estado**: ❌ No existe  
**Prioridad**: 🔵 BAJA

#### Funcionalidades:
- [ ] Subida de imágenes (logos, fotos de perfil)
- [ ] Subida de documentos (licencias, certificados, resultados)
- [ ] Almacenamiento en S3 (o similar)
- [ ] Validación de tipos de archivo
- [ ] Límites de tamaño
- [ ] Generación de URLs firmadas para acceso privado

---

### 17. Catálogo de Servicios/Productos

**Estado**: ❌ No existe  
**Prioridad**: 🔵 BAJA

#### Endpoints necesarios:
- [ ] `GET /api/doctors/catalog` - Catálogo de servicios
- [ ] `POST /api/doctors/catalog` - Agregar servicio
- [ ] `PUT /api/doctors/catalog/:id` - Actualizar servicio
- [ ] `DELETE /api/doctors/catalog/:id` - Eliminar servicio

---

### 18. Sistema de Anuncios

**Estado**: ⚠️ Parcialmente implementado (solo creación)  
**Prioridad**: 🔵 BAJA

#### Endpoints faltantes:
- [ ] `GET /api/doctors/ads` - Anuncios del doctor
- [ ] `PUT /api/doctors/ads/:id` - Actualizar anuncio
- [ ] `DELETE /api/doctors/ads/:id` - Eliminar anuncio
- [ ] `PUT /api/admin/ad-requests/:id/approve` - Aprobar anuncio (admin)
- [ ] `PUT /api/admin/ad-requests/:id/reject` - Rechazar anuncio (admin)

---

## 📊 Resumen por Prioridad

### 🔴 CRÍTICO (Bloquea MVP)
1. Módulo de Pacientes
2. Módulo de Citas
3. Sistema de Pagos

### 🟡 ALTA (Completa funcionalidad)
4. Módulo de Farmacias
5. Módulo de Laboratorios
6. Módulo de Ambulancias

### 🟢 MEDIA (Mejora UX)
7. Sistema de Reseñas
8. Endpoints Públicos de Doctores
9. Sistema de Notificaciones Global
10. Historial Médico

### 🔵 BAJA (Nice to have)
11. TODOs en código existente
12. Servicios opcionales (WhatsApp, Push)
13. Autenticación - Endpoints faltantes
14. Búsqueda y Filtros
15. Geolocalización
16. Gestión de Archivos
17. Catálogo de Servicios
18. Sistema de Anuncios

---

## 🎯 Plan de Implementación Sugerido

### Sprint 1 (2 semanas) - MVP Crítico
- [ ] Módulo de Pacientes
- [ ] Módulo de Citas (con cálculo de disponibilidad)
- [ ] Sistema de Pagos básico (sin Stripe inicialmente)

### Sprint 2 (2 semanas) - Completar Providers
- [ ] Módulo de Farmacias
- [ ] Módulo de Laboratorios
- [ ] Módulo de Ambulancias

### Sprint 3 (1 semana) - Mejoras UX
- [ ] Sistema de Reseñas
- [ ] Endpoints Públicos de Doctores
- [ ] Sistema de Notificaciones Global
- [ ] Historial Médico

### Sprint 4 (1 semana) - Optimizaciones
- [ ] TODOs en código existente
- [ ] Integración con Stripe (pagos)
- [ ] Búsqueda y Filtros básicos

---

## 📝 Notas Importantes

1. **Seguir el patrón existente**: Revisar `src/clinics/` y `src/doctors/` como referencia
2. **Validaciones**: Usar Zod schemas como en `src/shared/validators.ts`
3. **Autenticación**: Usar `requireRole` para endpoints protegidos
4. **Respuestas**: Usar `successResponse`, `errorResponse`, etc. de `src/shared/response.ts`
5. **Notificaciones**: Usar funciones de `src/shared/notifications.ts` para notificaciones automáticas
6. **Testing**: Probar cada endpoint con Insomnia/Postman antes de continuar

---

**Última revisión**: 2026-01-29  
**Próxima revisión**: Después de cada sprint o implementación importante
