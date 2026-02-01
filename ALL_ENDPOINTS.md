# ALL_ENDPOINTS - MediConnet

Este documento consolida los endpoints que el frontend consume y los endpoints documentados para que puedas validar si el backend los implementa todos.

> Uso: compara este archivo con las rutas de tu backend. Los endpoints están agrupados por módulo. "Estado" indica si el frontend los espera (Usado) o si están en la lista de pendientes (Pendiente). Si un endpoint aparece en `BACKEND_ENDPOINTS.md`, está documentado allí — marca como "Implementado" si tu backend responde correctamente.

---

## Resumen rápido

- Documentación base: [BACKEND_ENDPOINTS.md](BACKEND_ENDPOINTS.md)
- Endpoints pendientes reportados por el frontend: [PENDING_ENDPOINTS.md](PENDING_ENDPOINTS.md)

---

## Autenticación

- POST `/api/auth/register` — Registrar usuario. (Usado por frontend) — Estado: Verificar
- POST `/api/auth/login` — Iniciar sesión. (Usado por frontend) — Estado: Verificar
- POST `/api/auth/refresh` — Refrescar token. (Usado por frontend) — Estado: Verificar
- POST `/api/auth/logout` — Cerrar sesión. (Usado por frontend) — Estado: Verificar
- GET `/api/auth/me` — Obtener usuario actual. (Usado por frontend) — Estado: Verificar
- POST `/api/auth/forgot-password` — Enviar enlace reset. (Usado por frontend) — Estado: Verificar
- POST `/api/auth/reset-password` — Resetear contraseña. (Usado por frontend) — Estado: Verificar

---

## Home (página principal)

- GET `/api/home/content` — Contenido principal (hero, footer, secciones). (Especificado en frontend README) — Estado: Pendiente si no implementado
- GET `/api/home/features` — Lista de features para home. — Estado: Pendiente si no implementado
- GET `/api/home/featured-services` — Servicios/Profesionales destacados. — Estado: Pendiente si no implementado

---

## Anuncios / Ads

- GET `/api/ads/active` — Obtener anuncios activos (público). (Documentado) — Estado: Verificar
- GET `/api/ads` o `/ads` — (ads.api.ts usa `/ads`) — frontend espera poder leer anuncio(s). Asegurar ruta y prefijo base. — Estado: Verificar
- GET `/api/providers/me/ads` — Obtener anuncios del proveedor (privado). — Estado: Verificar
- POST `/api/providers/me/ads` — Crear anuncio (privado). — Estado: Verificar
- PUT `/api/ads/:id` — Actualizar anuncio. — Estado: Verificar
- DELETE `/api/ads/:id` — Eliminar anuncio. — Estado: Verificar

---

## Insumos / Supplies (frontend uses mocks; endpoints expected)

- GET `/api/supplies` — Listar tiendas de insumos. (Frontend: `supply.api.ts`) — Estado: Pendiente / Usar mocks
- GET `/api/supplies/:id` — Detalle tienda de insumos. — Estado: Pendiente / Usar mocks
- GET `/api/supplies/:id/reviews` — Reseñas tienda. — Estado: Pendiente / Usar mocks
- POST `/api/supplies/:id/reviews` — Crear reseña. — Estado: Pendiente / Usar mocks

---

## Farmacias

- GET `/api/pharmacies/profile` — Perfil de la cadena/farmacia (privado). (Usado en frontend) — Estado: Verificar
- PUT `/api/pharmacies/profile` — Actualizar perfil. — Estado: Verificar
- GET `/api/pharmacies/branches` — Listar sucursales de farmacia. — Estado: Verificar
- POST `/api/pharmacies/branches` — Crear sucursal. — Estado: Verificar
- PUT `/api/pharmacies/branches/:id` — Actualizar sucursal. — Estado: Verificar
- DELETE `/api/pharmacies/branches/:id` — Eliminar sucursal. — Estado: Verificar
- GET `/api/pharmacies/reviews` — Obtener reseñas de farmacias. — Estado: Verificar

---

## Usuarios / Pacientes / Proveedores / Branches (documentados)

Nota: la siguiente lista principal está documentada en `BACKEND_ENDPOINTS.md`. Repite aquí los endpoints críticos que el frontend consume directamente; marca como "Implementado" cuando tu backend responda según el contrato.

- GET `/api/users/:id` — Obtener usuario por ID. — Estado: Verificar
- PUT `/api/users/:id` — Actualizar usuario. — Estado: Verificar

- GET `/api/patients/me` — Perfil paciente actual. — Estado: Verificar
- POST `/api/patients` — Crear perfil paciente. — Estado: Verificar
- PUT `/api/patients/me` — Actualizar perfil paciente. — Estado: Verificar
- GET `/api/patients/:id/appointments` — Citas de paciente. — Estado: Verificar
- GET `/api/patients/:id/medical-history` — Historial médico. — Estado: Verificar
- GET `/api/patients/:id/favorites` — Favoritos. — Estado: Verificar

- GET `/api/providers/me` — Perfil proveedor actual. — Estado: Verificar
- POST `/api/providers` — Crear perfil proveedor. — Estado: Verificar
- PUT `/api/providers/me` — Actualizar perfil proveedor. — Estado: Verificar
- GET `/api/providers/:id` — Obtener proveedor público. — Estado: Verificar
- GET `/api/providers` — Listar proveedores (filtro/search). — Estado: Verificar
- GET `/api/providers/me/dashboard` — Dashboard proveedor (privado). — Estado: Verificar

- GET `/api/providers/me/branches` — Obtener sucursales del proveedor. — Estado: Verificar
- POST `/api/providers/me/branches` — Crear sucursal. — Estado: Verificar
- GET `/api/branches/:id` — Obtener sucursal por ID (público). — Estado: Verificar
- PUT `/api/branches/:id` — Actualizar sucursal. — Estado: Verificar
- DELETE `/api/branches/:id` — Eliminar sucursal. — Estado: Verificar
- GET `/api/branches` — Listar sucursales (público, filtros proximidad). — Estado: Verificar

---

## Citas / Appointments

- GET `/api/appointments` — Obtener citas (filtrado por rol). — Estado: Verificar
- POST `/api/appointments` — Crear cita. — Estado: Verificar
- GET `/api/appointments/:id` — Obtener cita por ID. — Estado: Verificar
- PUT `/api/appointments/:id` — Actualizar cita. — Estado: Verificar
- PUT `/api/appointments/:id/status` — Actualizar estado. — Estado: Verificar
- DELETE `/api/appointments/:id` — Cancelar cita. — Estado: Verificar

---

## Pagos / Payouts

- GET `/api/payments` — Obtener pagos. — Estado: Verificar
- POST `/api/payments` — Crear pago (intento). — Estado: Verificar
- PUT `/api/payments/:id/status` — Actualizar estado de pago. — Estado: Verificar
- GET `/api/providers/me/payouts` — Payouts del proveedor. — Estado: Verificar
- POST `/api/providers/me/payouts/request` — Solicitar payout. — Estado: Verificar

---

## Reseñas

- GET `/api/reviews` — Obtener reseñas (filtros). — Estado: Verificar
- POST `/api/reviews` — Crear reseña (citas). — Estado: Verificar
- PUT `/api/reviews/:id` — Actualizar reseña. — Estado: Verificar
- DELETE `/api/reviews/:id` — Eliminar reseña. — Estado: Verificar

---

## Historial Médico

- GET `/api/medical-history` — Obtener historial (filtros). — Estado: Verificar
- POST `/api/medical-history` — Crear entrada. — Estado: Verificar
- PUT `/api/medical-history/:id` — Actualizar entrada. — Estado: Verificar
- DELETE `/api/medical-history/:id` — Eliminar entrada. — Estado: Verificar

---

## Catálogo

- GET `/api/providers/me/catalog` — Catálogo proveedor. — Estado: Verificar
- POST `/api/providers/me/catalog` — Crear item catálogo. — Estado: Verificar
- GET `/api/branches/:id/catalog` — Catálogo sucursal. — Estado: Verificar
- PUT `/api/catalog/:id` — Actualizar item catálogo. — Estado: Verificar
- DELETE `/api/catalog/:id` — Eliminar item catálogo. — Estado: Verificar

---

## Horarios / Schedules

- GET `/api/branches/:id/schedules` — Horarios de sucursal. — Estado: Verificar
- POST `/api/branches/:id/schedules` — Crear horario. — Estado: Verificar
- PUT `/api/schedules/:id` — Actualizar horario. — Estado: Verificar
- DELETE `/api/schedules/:id` — Eliminar horario. — Estado: Verificar

---

## Mensajería Clínica - Médico Asociado (endpoints reportados en `PENDING_ENDPOINTS.md`)

- GET `/api/doctors/clinic-info` — Info básica de la clínica asociada. — Estado: Pendiente
- GET `/api/doctors/clinic/profile` — Perfil profesional del médico asociado. — Estado: Pendiente
- PUT `/api/doctors/clinic/profile` — Actualizar perfil. — Estado: Pendiente

- GET `/api/doctors/clinic/reception/messages` — Mensajes con recepción. — Estado: Pendiente
- POST `/api/doctors/clinic/reception/messages` — Enviar mensaje a recepción. — Estado: Pendiente
- PATCH `/api/doctors/clinic/reception/messages/read` — Marcar como leídos. — Estado: Pendiente

- GET `/api/doctors/clinic/date-blocks` — Solicitudes bloqueo de fechas. — Estado: Pendiente
- POST `/api/doctors/clinic/date-blocks/request` — Solicitar bloqueo de fechas. — Estado: Pendiente

- GET `/api/doctors/clinic/appointments` — Citas del médico asociado. — Estado: Pendiente
- PATCH `/api/doctors/clinic/appointments/:appointmentId/status` — Actualizar estado de cita. — Estado: Pendiente

---

## Mensajería Clínica (recepción) - Panel de Clínica

- GET `/api/clinics/reception/messages` — Obtener mensajes recepción↔médico. — Estado: Pendiente
- POST `/api/clinics/reception/messages` — Enviar mensaje desde recepción. — Estado: Pendiente
- PATCH `/api/clinics/reception/messages/read` — Marcar mensajes como leídos. — Estado: Pendiente

---

## Notas finales y pasos recomendados

- 1) Usa este archivo como checklist: marca cada endpoint como "OK" cuando tu backend responda según el contrato (método, path, request/response).
- 2) Revisa diferencias de prefijo: algunos archivos frontend usan rutas sin prefijo `/api` (p.ej. `ads.api.ts` usa `/ads`). Normaliza el `baseURL` de `httpClient` o ajusta rutas en backend para compatibilidad.
- 3) Los endpoints listados en `PENDING_ENDPOINTS.md` deben ser prioridad — se usan en paneles clínicos y de médicos asociados.
- 4) Si quieres, puedo ejecutar peticiones de verificación (smoke tests) contra tu backend para marcar automáticamente los endpoints implementados.

---

Archivo generado automáticamente para revisión rápida.
