# 📋 TODO Completo del Backend - MediConnect

Este documento contiene **TODAS** las tareas pendientes, funcionalidades faltantes, endpoints por implementar, mejoras necesarias y correcciones requeridas en el backend de MediConnect.

**Última actualización**: 2026-01-XX

---

## 📑 Índice

1. [Endpoints Faltantes](#1-endpoints-faltantes)
2. [Handlers y Módulos por Implementar](#2-handlers-y-módulos-por-implementar)
3. [Funcionalidades Pendientes](#3-funcionalidades-pendientes)
4. [Mejoras y Optimizaciones](#4-mejoras-y-optimizaciones)
5. [Correcciones y Bugs](#5-correcciones-y-bugs)
6. [Integraciones Pendientes](#6-integraciones-pendientes)
7. [Seguridad y Validaciones](#7-seguridad-y-validaciones)
8. [Testing y Documentación](#8-testing-y-documentación)
9. [Deployment y DevOps](#9-deployment-y-devops)

---

## 1. Endpoints Faltantes

### 1.1. Autenticación (`/api/auth`)

| Método | Endpoint | Descripción | Estado | Prioridad |
|--------|----------|-------------|--------|-----------|
| `POST` | `/api/auth/change-password` | Cambiar contraseña | ⚠️ Mock | Alta |
| `POST` | `/api/auth/forgot-password` | Solicitar recuperación | ⚠️ Mock | Alta |
| `POST` | `/api/auth/reset-password` | Resetear contraseña | ⚠️ Mock | Alta |
| `POST` | `/api/auth/logout` | Cerrar sesión | ❌ No existe | Media |
| `POST` | `/api/auth/verify-email` | Verificar email | ❌ No existe | Baja |

**Notas**:
- Los endpoints de cambio/recuperación de contraseña están como mock, necesitan implementación real
- El logout debería invalidar tokens en la tabla `sessions`
- La verificación de email es necesaria para producción

---

### 1.2. Pacientes (`/api/patients`)

| Método | Endpoint | Descripción | Estado | Prioridad |
|--------|----------|-------------|--------|-----------|
| `GET` | `/api/patients/profile` | Obtener perfil del paciente | ❌ No existe | Alta |
| `PUT` | `/api/patients/profile` | Actualizar perfil del paciente | ❌ No existe | Alta |
| `GET` | `/api/patients/appointments` | Listar citas del paciente | ❌ No existe | Alta |
| `POST` | `/api/patients/appointments` | Crear nueva cita | ❌ No existe | Alta |
| `PUT` | `/api/patients/appointments/:id` | Actualizar cita | ❌ No existe | Media |
| `DELETE` | `/api/patients/appointments/:id` | Cancelar cita | ❌ No existe | Alta |
| `GET` | `/api/patients/medical-history` | Historial médico | ❌ No existe | Alta |
| `GET` | `/api/patients/favorites` | Listar favoritos | ❌ No existe | Media |
| `POST` | `/api/patients/favorites` | Agregar a favoritos | ❌ No existe | Media |
| `DELETE` | `/api/patients/favorites/:id` | Eliminar de favoritos | ❌ No existe | Media |
| `GET` | `/api/patients/notifications` | Notificaciones | ❌ No existe | Alta |
| `PUT` | `/api/patients/notifications/:id/read` | Marcar como leída | ❌ No existe | Alta |

**Notas**:
- **CRÍTICO**: El módulo completo de pacientes no existe
- Necesario para que los usuarios puedan gestionar sus citas y perfil
- Las notificaciones son esenciales para recordatorios de citas

---

### 1.3. Citas/Appointments (`/api/appointments`)

| Método | Endpoint | Descripción | Estado | Prioridad |
|--------|----------|-------------|--------|-----------|
| `GET` | `/api/appointments` | Listar citas (público/admin) | ❌ No existe | Media |
| `GET` | `/api/appointments/:id` | Detalle de cita | ❌ No existe | Media |
| `POST` | `/api/appointments` | Crear cita (público) | ❌ No existe | Alta |
| `PUT` | `/api/appointments/:id` | Actualizar cita | ❌ No existe | Media |
| `DELETE` | `/api/appointments/:id` | Cancelar cita | ❌ No existe | Alta |
| `GET` | `/api/appointments/available-slots` | Horarios disponibles | ❌ No existe | Alta |
| `POST` | `/api/appointments/:id/confirm` | Confirmar cita | ❌ No existe | Media |

**Notas**:
- El endpoint de horarios disponibles es crítico para el booking
- Necesita integración con `provider_schedules`

---

### 1.4. Doctores/Providers (`/api/doctors`)

| Método | Endpoint | Descripción | Estado | Prioridad |
|--------|----------|-------------|--------|-----------|
| `GET` | `/api/doctors` | Listar doctores (público) | ❌ No existe | Alta |
| `GET` | `/api/doctors/:id` | Detalle de doctor (público) | ❌ No existe | Alta |
| `GET` | `/api/doctors/:id/reviews` | Reseñas de doctor (público) | ❌ No existe | Media |
| `POST` | `/api/doctors/:id/reviews` | Crear reseña | ❌ No existe | Media |
| `GET` | `/api/doctors/branches` | Listar sucursales | ❌ No existe | Media |
| `GET` | `/api/doctors/branches/:id` | Detalle de sucursal | ❌ No existe | Media |
| `GET` | `/api/doctors/catalog` | Catálogo de servicios | ❌ No existe | Baja |
| `POST` | `/api/doctors/catalog` | Agregar servicio al catálogo | ❌ No existe | Baja |
| `PUT` | `/api/doctors/catalog/:id` | Actualizar servicio | ❌ No existe | Baja |
| `DELETE` | `/api/doctors/catalog/:id` | Eliminar servicio | ❌ No existe | Baja |
| `GET` | `/api/doctors/ads` | Anuncios del doctor | ❌ No existe | Baja |
| `POST` | `/api/doctors/ads` | Crear anuncio | ❌ No existe | Baja |
| `PUT` | `/api/doctors/ads/:id` | Actualizar anuncio | ❌ No existe | Baja |
| `DELETE` | `/api/doctors/ads/:id` | Eliminar anuncio | ❌ No existe | Baja |
| `GET` | `/api/doctors/bank-details` | Datos bancarios | ❌ No existe | Media |
| `PUT` | `/api/doctors/bank-details` | Actualizar datos bancarios | ❌ No existe | Media |

**Notas**:
- Los endpoints públicos son necesarios para el catálogo de servicios
- El catálogo permite a doctores ofrecer servicios adicionales
- Los anuncios permiten promociones

---

### 1.5. Farmacias (`/api/pharmacies`)

| Método | Endpoint | Descripción | Estado | Prioridad |
|--------|----------|-------------|--------|-----------|
| `GET` | `/api/pharmacies` | Listar farmacias (público) | ❌ No existe | Alta |
| `GET` | `/api/pharmacies/:id` | Detalle de farmacia (público) | ❌ No existe | Alta |
| `GET` | `/api/pharmacies/profile` | Perfil de farmacia | ❌ No existe | Alta |
| `PUT` | `/api/pharmacies/profile` | Actualizar perfil | ❌ No existe | Alta |
| `GET` | `/api/pharmacies/dashboard` | Dashboard de farmacia | ❌ No existe | Alta |
| `GET` | `/api/pharmacies/products` | Productos de la farmacia | ❌ No existe | Alta |
| `POST` | `/api/pharmacies/products` | Agregar producto | ❌ No existe | Alta |
| `PUT` | `/api/pharmacies/products/:id` | Actualizar producto | ❌ No existe | Alta |
| `DELETE` | `/api/pharmacies/products/:id` | Eliminar producto | ❌ No existe | Alta |
| `GET` | `/api/pharmacies/orders` | Pedidos recibidos | ❌ No existe | Alta |
| `PUT` | `/api/pharmacies/orders/:id/status` | Actualizar estado de pedido | ❌ No existe | Alta |
| `GET` | `/api/pharmacies/reviews` | Reseñas | ❌ No existe | Media |
| `GET` | `/api/pharmacies/payments` | Pagos e ingresos | ❌ No existe | Media |

**Notas**:
- **CRÍTICO**: El handler de farmacias existe pero está vacío
- Similar estructura a doctores pero con productos en lugar de servicios
- Los pedidos son críticos para farmacias

---

### 1.6. Laboratorios (`/api/laboratories`)

| Método | Endpoint | Descripción | Estado | Prioridad |
|--------|----------|-------------|--------|-----------|
| `GET` | `/api/laboratories` | Listar laboratorios (público) | ❌ No existe | Alta |
| `GET` | `/api/laboratories/:id` | Detalle de laboratorio (público) | ❌ No existe | Alta |
| `GET` | `/api/laboratories/profile` | Perfil de laboratorio | ❌ No existe | Alta |
| `PUT` | `/api/laboratories/profile` | Actualizar perfil | ❌ No existe | Alta |
| `GET` | `/api/laboratories/dashboard` | Dashboard | ❌ No existe | Alta |
| `GET` | `/api/laboratories/tests` | Lista de exámenes | ❌ No existe | Alta |
| `POST` | `/api/laboratories/tests` | Agregar examen | ❌ No existe | Alta |
| `PUT` | `/api/laboratories/tests/:id` | Actualizar examen | ❌ No existe | Alta |
| `DELETE` | `/api/laboratories/tests/:id` | Eliminar examen | ❌ No existe | Alta |
| `GET` | `/api/laboratories/appointments` | Citas/exámenes programados | ❌ No existe | Alta |
| `POST` | `/api/laboratories/appointments` | Crear cita de examen | ❌ No existe | Alta |
| `GET` | `/api/laboratories/results` | Resultados de exámenes | ❌ No existe | Alta |
| `POST` | `/api/laboratories/results` | Subir resultado | ❌ No existe | Alta |
| `GET` | `/api/laboratories/reviews` | Reseñas | ❌ No existe | Media |
| `GET` | `/api/laboratories/payments` | Pagos e ingresos | ❌ No existe | Media |

**Notas**:
- **CRÍTICO**: El handler de laboratorios existe pero está vacío
- Similar a farmacias pero con exámenes y resultados
- Los resultados deben poder subirse como archivos PDF/imágenes

---

### 1.7. Ambulancias (`/api/ambulances`)

| Método | Endpoint | Descripción | Estado | Prioridad |
|--------|----------|-------------|--------|-----------|
| `GET` | `/api/ambulances` | Listar ambulancias (público) | ❌ No existe | Alta |
| `GET` | `/api/ambulances/:id` | Detalle de ambulancia (público) | ❌ No existe | Alta |
| `GET` | `/api/ambulances/profile` | Perfil de ambulancia | ❌ No existe | Alta |
| `PUT` | `/api/ambulances/profile` | Actualizar perfil | ❌ No existe | Alta |
| `GET` | `/api/ambulances/dashboard` | Dashboard | ❌ No existe | Alta |
| `GET` | `/api/ambulances/requests` | Solicitudes de servicio | ❌ No existe | Alta |
| `POST` | `/api/ambulances/requests` | Crear solicitud de ambulancia | ❌ No existe | Alta |
| `PUT` | `/api/ambulances/requests/:id/accept` | Aceptar solicitud | ❌ No existe | Alta |
| `PUT` | `/api/ambulances/requests/:id/status` | Actualizar estado | ❌ No existe | Alta |
| `GET` | `/api/ambulances/location` | Ubicación actual (GPS) | ❌ No existe | Alta |
| `PUT` | `/api/ambulances/location` | Actualizar ubicación | ❌ No existe | Alta |
| `GET` | `/api/ambulances/reviews` | Reseñas | ❌ No existe | Media |
| `GET` | `/api/ambulances/payments` | Pagos e ingresos | ❌ No existe | Media |

**Notas**:
- **CRÍTICO**: El handler de ambulancias existe pero está vacío
- Las ambulancias necesitan tracking en tiempo real (GPS)
- Las solicitudes son urgentes y requieren notificaciones push

---

### 1.8. Insumos Médicos (`/api/supplies`)

| Método | Endpoint | Descripción | Estado | Prioridad |
|--------|----------|-------------|--------|-----------|
| `GET` | `/api/supplies/stores` | Listar tiendas | ✅ Implementado | - |
| `GET` | `/api/supplies/stores/:id` | Detalle de tienda | ✅ Implementado | - |
| `GET` | `/api/supplies/products` | Listar productos | ✅ Implementado | - |
| `GET` | `/api/supplies/profile` | Perfil de tienda | ❌ No existe | Alta |
| `PUT` | `/api/supplies/profile` | Actualizar perfil | ❌ No existe | Alta |
| `GET` | `/api/supplies/dashboard` | Dashboard | ❌ No existe | Alta |
| `POST` | `/api/supplies/products` | Agregar producto | ❌ No existe | Alta |
| `PUT` | `/api/supplies/products/:id` | Actualizar producto | ❌ No existe | Alta |
| `DELETE` | `/api/supplies/products/:id` | Eliminar producto | ❌ No existe | Alta |
| `GET` | `/api/supplies/orders` | Pedidos recibidos | ❌ No existe | Alta |
| `PUT` | `/api/supplies/orders/:id/status` | Actualizar estado | ❌ No existe | Alta |
| `GET` | `/api/supplies/reviews` | Reseñas | ❌ No existe | Media |
| `GET` | `/api/supplies/payments` | Pagos e ingresos | ❌ No existe | Media |

**Notas**:
- Los endpoints públicos están implementados pero con datos mock
- Necesitan conectarse a la base de datos real
- Similar estructura a farmacias

---

### 1.9. Reseñas (`/api/reviews`)

| Método | Endpoint | Descripción | Estado | Prioridad |
|--------|----------|-------------|--------|-----------|
| `GET` | `/api/reviews` | Listar reseñas (público) | ❌ No existe | Media |
| `GET` | `/api/reviews/:id` | Detalle de reseña | ❌ No existe | Baja |
| `POST` | `/api/reviews` | Crear reseña | ❌ No existe | Alta |
| `PUT` | `/api/reviews/:id` | Actualizar reseña | ❌ No existe | Media |
| `DELETE` | `/api/reviews/:id` | Eliminar reseña | ❌ No existe | Media |
| `GET` | `/api/reviews/provider/:id` | Reseñas de un provider | ❌ No existe | Media |
| `GET` | `/api/reviews/branch/:id` | Reseñas de una sucursal | ❌ No existe | Media |

**Notas**:
- Las reseñas solo pueden crearse después de una cita completada
- Necesita validación de que el paciente tuvo una cita con el provider

---

### 1.10. Pagos (`/api/payments`)

| Método | Endpoint | Descripción | Estado | Prioridad |
|--------|----------|-------------|--------|-----------|
| `GET` | `/api/payments` | Listar pagos | ❌ No existe | Alta |
| `GET` | `/api/payments/:id` | Detalle de pago | ❌ No existe | Media |
| `POST` | `/api/payments` | Crear pago | ❌ No existe | Alta |
| `POST` | `/api/payments/:id/confirm` | Confirmar pago | ❌ No existe | Alta |
| `GET` | `/api/payments/methods` | Métodos de pago disponibles | ❌ No existe | Media |
| `GET` | `/api/payments/history` | Historial de pagos | ❌ No existe | Media |

**Notas**:
- **CRÍTICO**: Integración con Stripe/PayPal necesaria
- Los pagos deben actualizar el estado de las citas
- Necesita webhooks para confirmación

---

### 1.11. Notificaciones (`/api/notifications`)

| Método | Endpoint | Descripción | Estado | Prioridad |
|--------|----------|-------------|--------|-----------|
| `GET` | `/api/notifications` | Listar notificaciones | ❌ No existe | Alta |
| `GET` | `/api/notifications/unread` | Notificaciones no leídas | ❌ No existe | Alta |
| `PUT` | `/api/notifications/:id/read` | Marcar como leída | ❌ No existe | Alta |
| `PUT` | `/api/notifications/read-all` | Marcar todas como leídas | ❌ No existe | Media |
| `DELETE` | `/api/notifications/:id` | Eliminar notificación | ❌ No existe | Baja |
| `POST` | `/api/notifications/send` | Enviar notificación (admin) | ❌ No existe | Baja |

**Notas**:
- Las notificaciones deben crearse automáticamente para:
  - Recordatorios de citas (24h antes)
  - Confirmación de citas
  - Cambios de estado de citas
  - Resultados de exámenes
  - Pedidos de farmacia/insumos

---

### 1.12. Historial Médico (`/api/medical-history`)

| Método | Endpoint | Descripción | Estado | Prioridad |
|--------|----------|-------------|--------|-----------|
| `GET` | `/api/medical-history` | Listar historial | ❌ No existe | Alta |
| `GET` | `/api/medical-history/:id` | Detalle de registro | ❌ No existe | Media |
| `GET` | `/api/medical-history/patient/:id` | Historial de paciente | ❌ No existe | Alta |
| `POST` | `/api/medical-history` | Crear registro | ⚠️ Parcial | Alta |
| `PUT` | `/api/medical-history/:id` | Actualizar registro | ❌ No existe | Media |
| `DELETE` | `/api/medical-history/:id` | Eliminar registro | ❌ No existe | Baja |

**Notas**:
- El POST existe en `/api/doctors/appointments/:id/diagnosis` pero falta endpoint dedicado
- El historial debe ser accesible solo por el paciente y su doctor

---

### 1.13. Favoritos (`/api/favorites`)

| Método | Endpoint | Descripción | Estado | Prioridad |
|--------|----------|-------------|--------|-----------|
| `GET` | `/api/favorites` | Listar favoritos | ❌ No existe | Media |
| `POST` | `/api/favorites` | Agregar a favoritos | ❌ No existe | Media |
| `DELETE` | `/api/favorites/:id` | Eliminar de favoritos | ❌ No existe | Media |
| `GET` | `/api/favorites/check/:branchId` | Verificar si es favorito | ❌ No existe | Baja |

**Notas**:
- Los favoritos son por sucursal (`provider_branches`)
- Un paciente puede tener múltiples favoritos

---

### 1.14. Ciudades (`/api/cities`)

| Método | Endpoint | Descripción | Estado | Prioridad |
|--------|----------|-------------|--------|-----------|
| `GET` | `/api/cities` | Listar ciudades | ❌ No existe | Media |
| `GET` | `/api/cities/:id` | Detalle de ciudad | ❌ No existe | Baja |
| `POST` | `/api/cities` | Crear ciudad (admin) | ❌ No existe | Baja |
| `PUT` | `/api/cities/:id` | Actualizar ciudad (admin) | ❌ No existe | Baja |
| `DELETE` | `/api/cities/:id` | Eliminar ciudad (admin) | ❌ No existe | Baja |

**Notas**:
- Las ciudades se crean automáticamente al registrar providers
- Útil para filtros en el frontend

---

### 1.15. Categorías de Servicio (`/api/service-categories`)

| Método | Endpoint | Descripción | Estado | Prioridad |
|--------|----------|-------------|--------|-----------|
| `GET` | `/api/service-categories` | Listar categorías | ❌ No existe | Media |
| `GET` | `/api/service-categories/:id` | Detalle de categoría | ❌ No existe | Baja |
| `POST` | `/api/service-categories` | Crear categoría (admin) | ❌ No existe | Baja |
| `PUT` | `/api/service-categories/:id` | Actualizar categoría (admin) | ❌ No existe | Baja |
| `DELETE` | `/api/service-categories/:id` | Eliminar categoría (admin) | ❌ No existe | Baja |

**Notas**:
- Similar a ciudades, se crean automáticamente
- Útil para filtros y navegación

---

### 1.16. Especialidades (`/api/specialties`)

| Método | Endpoint | Descripción | Estado | Prioridad |
|--------|----------|-------------|--------|-----------|
| `GET` | `/api/specialties` | Listar especialidades | ✅ Implementado | - |
| `GET` | `/api/specialties/:id` | Detalle de especialidad | ❌ No existe | Baja |
| `POST` | `/api/specialties` | Crear especialidad (admin) | ❌ No existe | Baja |
| `PUT` | `/api/specialties/:id` | Actualizar especialidad (admin) | ❌ No existe | Baja |
| `DELETE` | `/api/specialties/:id` | Eliminar especialidad (admin) | ❌ No existe | Baja |

**Notas**:
- El GET está implementado
- Los endpoints de administración son opcionales

---

### 1.17. Administración (`/api/admin`)

| Método | Endpoint | Descripción | Estado | Prioridad |
|--------|----------|-------------|--------|-----------|
| `GET` | `/api/admin/dashboard/stats` | Estadísticas | ✅ Implementado | - |
| `GET` | `/api/admin/requests` | Solicitudes de proveedores | ✅ Implementado | - |
| `GET` | `/api/admin/ad-requests` | Solicitudes de anuncios | ⚠️ Mock | Media |
| `GET` | `/api/admin/provider-requests` | Solicitudes (alternativo) | ⚠️ Mock | Baja |
| `GET` | `/api/admin/activity` | Historial de actividad | ⚠️ Mock | Media |
| `GET` | `/api/admin/history` | Historial | ⚠️ Mock | Media |
| `GET` | `/api/admin/rejected-services` | Servicios rechazados | ⚠️ Mock | Media |
| `PUT` | `/api/admin/requests/:id/approve` | Aprobar solicitud | ✅ Implementado | - |
| `PUT` | `/api/admin/requests/:id/reject` | Rechazar solicitud | ✅ Implementado | - |
| `PUT` | `/api/admin/ad-requests/:id/approve` | Aprobar anuncio | ⚠️ Mock | Media |
| `PUT` | `/api/admin/ad-requests/:id/reject` | Rechazar anuncio | ⚠️ Mock | Media |
| `GET` | `/api/admin/users` | Listar usuarios | ❌ No existe | Media |
| `PUT` | `/api/admin/users/:id/activate` | Activar usuario | ❌ No existe | Media |
| `PUT` | `/api/admin/users/:id/deactivate` | Desactivar usuario | ❌ No existe | Media |
| `GET` | `/api/admin/providers` | Listar providers | ❌ No existe | Media |
| `PUT` | `/api/admin/providers/:id` | Actualizar provider | ❌ No existe | Media |
| `GET` | `/api/admin/appointments` | Listar todas las citas | ❌ No existe | Media |
| `GET` | `/api/admin/payments` | Listar todos los pagos | ❌ No existe | Media |
| `GET` | `/api/admin/reports` | Reportes y analytics | ❌ No existe | Baja |

**Notas**:
- Los endpoints mock necesitan implementación real
- La gestión de usuarios es importante para moderación
- Los reportes son útiles para analytics

---

## 2. Handlers y Módulos por Implementar

### 2.1. Módulos Completamente Faltantes

| Módulo | Archivo | Descripción | Prioridad |
|--------|---------|-------------|-----------|
| **Pacientes** | `src/patients/handler.ts` | ❌ No existe | **CRÍTICA** |
| **Citas** | `src/appointments/handler.ts` | ❌ No existe | **CRÍTICA** |
| **Reseñas** | `src/reviews/handler.ts` | ❌ No existe | Alta |
| **Pagos** | `src/payments/handler.ts` | ❌ No existe | **CRÍTICA** |
| **Notificaciones** | `src/notifications/handler.ts` | ❌ No existe | Alta |
| **Favoritos** | `src/favorites/handler.ts` | ❌ No existe | Media |
| **Historial Médico** | `src/medical-history/handler.ts` | ❌ No existe | Alta |
| **Ciudades** | `src/cities/handler.ts` | ❌ No existe | Baja |
| **Categorías** | `src/service-categories/handler.ts` | ❌ No existe | Baja |
| **Sucursales** | `src/branches/handler.ts` | ❌ No existe | Media |
| **Catálogo** | `src/catalog/handler.ts` | ❌ No existe | Baja |
| **Anuncios** | `src/ads/handler.ts` | ❌ No existe | Baja |

### 2.2. Módulos Parcialmente Implementados

| Módulo | Archivo | Estado | Pendiente |
|--------|---------|--------|-----------|
| **Farmacias** | `src/pharmacies/handler.ts` | ⚠️ Vacío | Todos los endpoints |
| **Laboratorios** | `src/laboratories/handler.ts` | ⚠️ Vacío | Todos los endpoints |
| **Ambulancias** | `src/ambulances/handler.ts` | ⚠️ Vacío | Todos los endpoints |
| **Insumos** | `src/supplies/handler.ts` | ⚠️ Mock | Conectar a BD real |
| **Autenticación** | `src/auth/handler.ts` | ✅ Parcial | Cambio/recuperación de contraseña |
| **Admin** | `src/admin/handler.ts` | ✅ Parcial | Endpoints mock, gestión de usuarios |
| **Doctores** | `src/doctors/handler.ts` | ✅ Parcial | Endpoints públicos, catálogo, anuncios |

---

## 3. Funcionalidades Pendientes

### 3.1. Sistema de Reservas/Booking

- [ ] **Calcular horarios disponibles** basado en `provider_schedules`
- [ ] **Validar conflictos** de citas existentes
- [ ] **Bloquear horarios** ya reservados
- [ ] **Soporte para múltiples sucursales** del mismo provider
- [ ] **Recordatorios automáticos** (24h antes de la cita)
- [ ] **Confirmación de citas** por parte del provider
- [ ] **Cancelación con políticas** (tiempo límite, penalizaciones)

### 3.2. Sistema de Pagos

- [ ] **Integración con Stripe** (o PayPal)
- [ ] **Procesamiento de pagos** en línea
- [ ] **Cálculo automático de comisiones** (`commission_percentage`)
- [ ] **División de pagos** (provider_amount, platform_fee)
- [ ] **Webhooks de confirmación** de pago
- [ ] **Actualización automática** del estado de citas al pagar
- [ ] **Sistema de reembolsos**
- [ ] **Historial de transacciones**
- [ ] **Reportes de ingresos** para providers

### 3.3. Sistema de Notificaciones

- [ ] **Crear notificaciones automáticas** para eventos:
  - Recordatorios de citas
  - Confirmación de citas
  - Cambios de estado
  - Resultados de exámenes
  - Pedidos de farmacia/insumos
- [ ] **Integración con servicios push** (Firebase, OneSignal)
- [ ] **Notificaciones por email** (opcional)
- [ ] **Notificaciones por SMS** (opcional, para recordatorios críticos)
- [ ] **Marcar como leídas** en la BD
- [ ] **Contador de no leídas**

### 3.4. Sistema de Reseñas

- [ ] **Validar que el paciente tuvo una cita** antes de reseñar
- [ ] **Calcular rating promedio** y actualizar `rating_cache` en `provider_branches`
- [ ] **Moderación de reseñas** (admin puede eliminar)
- [ ] **Respuestas de providers** a reseñas
- [ ] **Filtros y ordenamiento** (por fecha, rating, etc.)

### 3.5. Búsqueda y Filtros

- [ ] **Búsqueda de providers** por:
  - Nombre
  - Especialidad
  - Ciudad
  - Servicio
  - Rating
- [ ] **Filtros avanzados**:
  - Precio
  - Disponibilidad
  - Horarios
  - Métodos de pago
- [ ] **Búsqueda de productos** (farmacias/insumos)
- [ ] **Búsqueda de exámenes** (laboratorios)
- [ ] **Ordenamiento** (por relevancia, rating, precio, distancia)

### 3.6. Geolocalización

- [ ] **Búsqueda por proximidad** (usando lat/lng)
- [ ] **Cálculo de distancias** entre paciente y provider
- [ ] **Filtro por radio** (ej: "dentro de 5km")
- [ ] **Tracking en tiempo real** para ambulancias
- [ ] **Mapas interactivos** (integración con Google Maps/Mapbox)

### 3.7. Gestión de Archivos

- [ ] **Subida de imágenes** (logos, fotos de perfil)
- [ ] **Subida de documentos** (licencias, certificados, resultados)
- [ ] **Almacenamiento en S3** (o similar)
- [ ] **Validación de tipos de archivo**
- [ ] **Límites de tamaño**
- [ ] **Generación de URLs firmadas** para acceso privado

### 3.8. Sistema de Payouts

- [ ] **Cálculo de pagos pendientes** para providers
- [ ] **Generación de payouts** periódicos
- [ ] **Integración con datos bancarios** (`provider_bank_details`)
- [ ] **Historial de payouts**
- [ ] **Estados de payout** (pending, processing, completed, failed)

### 3.9. Sistema de Anuncios

- [ ] **Crear anuncios** desde el panel de providers
- [ ] **Aprobación de anuncios** por admin
- [ ] **Programación de fechas** (start_date, end_date)
- [ ] **Priorización** (priority_order)
- [ ] **Estadísticas de visualizaciones** (opcional)

### 3.10. Catálogo de Servicios/Productos

- [ ] **Gestión de catálogo** para providers
- [ ] **Categorización** de productos/servicios
- [ ] **Control de disponibilidad** (is_available)
- [ ] **Precios dinámicos**
- [ ] **Imágenes de productos**

---

## 4. Mejoras y Optimizaciones

### 4.1. Performance

- [ ] **Índices en la base de datos**:
  - `appointments.provider_id`
  - `appointments.patient_id`
  - `appointments.scheduled_for`
  - `reviews.branch_id`
  - `payments.appointment_id`
  - `notifications.patient_id`
- [ ] **Caché de consultas frecuentes**:
  - Lista de ciudades
  - Categorías de servicio
  - Especialidades
  - Ratings de providers
- [ ] **Paginación** en todos los endpoints de listado
- [ ] **Lazy loading** de relaciones en Prisma
- [ ] **Compresión de respuestas** (gzip)

### 4.2. Validaciones

- [ ] **Validación de emails** únicos
- [ ] **Validación de teléfonos** (formato internacional)
- [ ] **Validación de fechas** (no permitir citas en el pasado)
- [ ] **Validación de horarios** (dentro del rango de disponibilidad)
- [ ] **Validación de precios** (positivos, formato decimal)
- [ ] **Validación de coordenadas** (lat/lng válidos)
- [ ] **Rate limiting** en endpoints públicos
- [ ] **Validación de tamaño de payload**

### 4.3. Manejo de Errores

- [ ] **Códigos de error consistentes**
- [ ] **Mensajes de error descriptivos** (sin exponer detalles internos)
- [ ] **Logging estructurado** de errores
- [ ] **Manejo de errores de Prisma** (traducir a mensajes amigables)
- [ ] **Retry logic** para operaciones críticas
- [ ] **Circuit breakers** para servicios externos

### 4.4. Seguridad

- [ ] **Sanitización de inputs** (prevenir SQL injection, XSS)
- [ ] **Validación de roles** en todos los endpoints protegidos
- [ ] **Verificación de ownership** (un usuario solo puede modificar sus propios datos)
- [ ] **CORS configurado correctamente**
- [ ] **Headers de seguridad** (HSTS, CSP, etc.)
- [ ] **Encriptación de datos sensibles** (datos bancarios)
- [ ] **Auditoría de acciones** (log de cambios importantes)

### 4.5. Código

- [ ] **Refactorizar código duplicado**
- [ ] **Extraer constantes** a archivos de configuración
- [ ] **Documentar funciones** con JSDoc
- [ ] **Type safety** mejorado (evitar `any`)
- [ ] **Unit tests** para funciones críticas
- [ ] **Integration tests** para endpoints
- [ ] **Linting** y formateo consistente

---

## 5. Correcciones y Bugs

### 5.1. Conocidos

- [ ] **Verificar que `is_active` en `provider_schedules`** existe en el schema (actualmente no está)
- [ ] **Normalización de roles** a minúsculas (ya implementado, verificar consistencia)
- [ ] **Manejo de usuarios inactivos** en desarrollo (ya implementado, verificar)
- [ ] **Respuesta de `/api/admin/requests`** debe ser array directo (ya corregido)
- [ ] **Estructura de dashboard de admin** debe incluir todos los campos (ya corregido)

### 5.2. Pendientes de Verificación

- [ ] **Verificar que todos los endpoints retornan el formato correcto** `{ success, data }`
- [ ] **Verificar que los errores retornan el formato correcto** `{ success: false, message }`
- [ ] **Verificar que los códigos HTTP son correctos** (200, 201, 400, 401, 403, 404, 500)
- [ ] **Verificar que CORS funciona** en todos los endpoints
- [ ] **Verificar que la autenticación funciona** en todos los endpoints protegidos

---

## 6. Integraciones Pendientes

### 6.1. Servicios de Terceros

- [ ] **Stripe/PayPal** para pagos
- [ ] **AWS S3** para almacenamiento de archivos
- [ ] **Firebase/OneSignal** para notificaciones push
- [ ] **SendGrid/AWS SES** para emails
- [ ] **Twilio** para SMS (opcional)
- [ ] **Google Maps/Mapbox** para mapas y geolocalización
- [ ] **AWS Cognito** (ya configurado pero con fallback local)

### 6.2. Servicios Internos

- [ ] **Sistema de colas** (RabbitMQ/SQS) para:
  - Procesamiento de pagos asíncronos
  - Envío de notificaciones
  - Generación de reportes
- [ ] **Sistema de cache** (Redis) para:
  - Sesiones
  - Datos frecuentes
  - Rate limiting

---

## 7. Seguridad y Validaciones

### 7.1. Autenticación y Autorización

- [ ] **JWT expiration** configurado correctamente
- [ ] **Refresh tokens** implementados (✅ ya implementado)
- [ ] **Invalidación de tokens** en logout
- [ ] **Verificación de roles** en todos los endpoints
- [ ] **Verificación de ownership** (usuario solo modifica sus datos)
- [ ] **Rate limiting** por IP/usuario
- [ ] **Protección contra brute force** en login

### 7.2. Validaciones de Datos

- [ ] **Zod schemas** para todos los endpoints (parcialmente implementado)
- [ ] **Validación de UUIDs** en parámetros de ruta
- [ ] **Validación de fechas** (no pasadas, formato correcto)
- [ ] **Validación de emails** (formato, dominio)
- [ ] **Validación de teléfonos** (formato internacional)
- [ ] **Validación de URLs** (para logos, documentos)
- [ ] **Validación de coordenadas** (lat: -90 a 90, lng: -180 a 180)
- [ ] **Sanitización de strings** (prevenir XSS)

### 7.3. Protección de Datos

- [ ] **Encriptación de datos sensibles** (contraseñas ✅, datos bancarios)
- [ ] **Máscara de datos** en logs (no loggear contraseñas, tokens)
- [ ] **GDPR compliance** (derecho al olvido, exportación de datos)
- [ ] **Backup automático** de base de datos
- [ ] **Retención de datos** (políticas de eliminación)

---

## 8. Testing y Documentación

### 8.1. Testing

- [ ] **Unit tests** para:
  - Validadores
  - Helpers
  - Utilidades
- [ ] **Integration tests** para:
  - Endpoints de autenticación
  - Endpoints CRUD
  - Flujos completos (crear cita, pagar, etc.)
- [ ] **E2E tests** para:
  - Flujo de registro
  - Flujo de booking
  - Flujo de pago
- [ ] **Test coverage** > 80%
- [ ] **CI/CD** con tests automáticos

### 8.2. Documentación

- [ ] **API Documentation** (Swagger/OpenAPI)
- [ ] **README actualizado** con instrucciones de setup
- [ ] **Guía de deployment**
- [ ] **Guía de contribución**
- [ ] **Documentación de arquitectura**
- [ ] **Ejemplos de requests/responses**
- [ ] **Diagramas de flujo**

---

## 9. Deployment y DevOps

### 9.1. Infraestructura

- [ ] **Configuración de AWS Lambda** para producción
- [ ] **API Gateway** configurado
- [ ] **CloudFormation/SAM** templates actualizados
- [ ] **Variables de entorno** en AWS Systems Manager
- [ ] **Secrets management** (AWS Secrets Manager)
- [ ] **Monitoring** (CloudWatch, Datadog, etc.)
- [ ] **Alertas** configuradas

### 9.2. CI/CD

- [ ] **Pipeline de CI** (GitHub Actions, CircleCI, etc.)
- [ ] **Tests automáticos** en CI
- [ ] **Linting** en CI
- [ ] **Build automático** en CI
- [ ] **Deployment automático** a staging
- [ ] **Deployment manual** a producción (con aprobación)
- [ ] **Rollback** automático en caso de error

### 9.3. Monitoreo y Logging

- [ ] **Structured logging** (JSON)
- [ ] **Log aggregation** (CloudWatch Logs, ELK, etc.)
- [ ] **Error tracking** (Sentry, Rollbar, etc.)
- [ ] **Performance monitoring** (APM)
- [ ] **Uptime monitoring**
- [ ] **Dashboards** de métricas

---

## 10. Priorización Sugerida

### Fase 1: Crítico (MVP)
1. ✅ Autenticación básica
2. ✅ Registro de providers
3. ✅ Dashboard de admin
4. ❌ **Módulo de pacientes** (CRÍTICO)
5. ❌ **Módulo de citas** (CRÍTICO)
6. ❌ **Sistema de booking** (CRÍTICO)
7. ❌ **Sistema de pagos** (CRÍTICO)

### Fase 2: Alta Prioridad
1. ❌ Módulo de farmacias (completo)
2. ❌ Módulo de laboratorios (completo)
3. ❌ Módulo de ambulancias (completo)
4. ❌ Sistema de notificaciones
5. ❌ Sistema de reseñas
6. ❌ Historial médico

### Fase 3: Media Prioridad
1. ❌ Favoritos
2. ❌ Búsqueda y filtros
3. ❌ Geolocalización
4. ❌ Gestión de archivos
5. ❌ Catálogo de servicios

### Fase 4: Baja Prioridad
1. ❌ Anuncios
2. ❌ Reportes avanzados
3. ❌ Analytics
4. ❌ Optimizaciones de performance

---

## 11. Notas Finales

- **Este documento debe actualizarse** conforme se implementen las funcionalidades
- **Las prioridades pueden cambiar** según necesidades del negocio
- **Algunas funcionalidades pueden requerir** cambios en el schema de Prisma
- **La integración con servicios externos** puede requerir configuración adicional
- **El testing es crítico** antes de deployment a producción

---

**Última revisión**: 2026-01-XX  
**Próxima revisión**: Semanal o después de cada sprint
