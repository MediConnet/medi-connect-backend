# ALL_ENDPOINTS_CHECKLIST

Resumen: Estado base detectado buscando rutas en el código.

- Estado: `Implementado` = ruta encontrada exactamente o equivalente en handlers.
- Estado: `Parcial` = existe una ruta similar o equivalente pero con distinto path (p.ej. `/api/patients/profile` vs `/api/patients/me`) o implementada dentro de módulo específico.
- Estado: `Falta` = no se encontró la ruta ni una equivalente clara en el código.

---

## Autenticación

- POST /api/auth/register — Implementado
- POST /api/auth/login — Implementado
- POST /api/auth/refresh — Implementado
- POST /api/auth/logout — Implementado
- GET /api/auth/me — Implementado
- POST /api/auth/forgot-password — Implementado
- POST /api/auth/reset-password — Implementado

## Home

- GET /api/home/content — Implementado
- GET /api/home/features — Implementado
- GET /api/home/featured-services — Implementado

## Anuncios / Ads

- GET /api/ads/active — Falta
- GET /api/ads (o /ads) — Implementado (handler `/api/ads` exists for GET/POST; frontend may use `/ads` without `/api`)
- GET /api/providers/me/ads — Falta
- POST /api/providers/me/ads — Falta
- PUT /api/ads/:id — Falta
- DELETE /api/ads/:id — Falta

## Insumos / Supplies

- GET /api/supplies — Implementado
- GET /api/supplies/:id — Implementado
- GET /api/supplies/:id/reviews — Implementado
- POST /api/supplies/:id/reviews — Implementado

## Farmacias

- GET /api/pharmacies/profile — Implementado
- PUT /api/pharmacies/profile — Implementado
- GET /api/pharmacies/branches — Falta
- POST /api/pharmacies/branches — Falta
- PUT /api/pharmacies/branches/:id — Falta
- DELETE /api/pharmacies/branches/:id — Falta
- GET /api/pharmacies/reviews — Implementado

## Usuarios / Pacientes / Proveedores / Branches

- GET /api/users/:id — Falta
- PUT /api/users/:id — Falta

- GET /api/patients/me — Falta (hay `/api/patients/profile` en su lugar)
- POST /api/patients — Falta
- PUT /api/patients/me — Falta (hay `/api/patients/profile` PUT)
- GET /api/patients/:id/appointments — Parcial (existen `/api/patients/appointments` y `/api/patients/appointments/:id` para el paciente autenticado)
- GET /api/patients/:id/medical-history — Parcial (existe `/api/patients/medical-history` y `/api/patients/medical-history/:id`)
- GET /api/patients/:id/favorites — Parcial (existe `/api/patients/favorites` endpoints para usuario autenticado)

- GET /api/providers/me — Falta
- POST /api/providers — Parcial (hay `/api/providers/register` proxy desde auth -> admin handler)
- PUT /api/providers/me — Falta
- GET /api/providers/:id — Falta
- GET /api/providers — Falta
- GET /api/providers/me/dashboard — Falta

- GET /api/providers/me/branches — Falta
- POST /api/providers/me/branches — Falta
- GET /api/branches/:id — Falta
- PUT /api/branches/:id — Falta
- DELETE /api/branches/:id — Falta
- GET /api/branches — Falta

## Citas / Appointments

- GET /api/appointments — Falta (la app maneja citas por módulos: pacientes/doctors)
- POST /api/appointments — Falta
- GET /api/appointments/:id — Falta
- PUT /api/appointments/:id — Falta
- PUT /api/appointments/:id/status — Falta
- DELETE /api/appointments/:id — Falta

## Pagos / Payouts

- GET /api/payments — Parcial (hay pagos en módulos como `/api/pharmacies/payments`)
- POST /api/payments — Falta
- PUT /api/payments/:id/status — Falta
- GET /api/providers/me/payouts — Falta
- POST /api/providers/me/payouts/request — Falta

## Reseñas

- GET /api/reviews — Falta (hay reseñas por módulo: `/api/pharmacies/reviews`, `/api/supplies/:id/reviews`)
- POST /api/reviews — Falta
- PUT /api/reviews/:id — Falta
- DELETE /api/reviews/:id — Falta

## Historial Médico

- GET /api/medical-history — Falta (existe en `patients` como `/api/patients/medical-history`)
- POST /api/medical-history — Falta
- PUT /api/medical-history/:id — Falta
- DELETE /api/medical-history/:id — Falta

## Catálogo

- GET /api/providers/me/catalog — Falta
- POST /api/providers/me/catalog — Falta
- GET /api/branches/:id/catalog — Falta
- PUT /api/catalog/:id — Falta
- DELETE /api/catalog/:id — Falta

## Horarios / Schedules

- GET /api/branches/:id/schedules — Falta
- POST /api/branches/:id/schedules — Falta
- PUT /api/schedules/:id — Falta
- DELETE /api/schedules/:id — Falta

## Mensajería Clínica - Médico Asociado

- GET /api/doctors/clinic-info — Implementado
- GET /api/doctors/clinic/profile — Implementado
- PUT /api/doctors/clinic/profile — Implementado

- GET /api/doctors/clinic/reception/messages — Falta (hay controladores de `clinics/reception-messages` para la recepción)
- POST /api/doctors/clinic/reception/messages — Falta
- PATCH /api/doctors/clinic/reception/messages/read — Falta

- GET /api/doctors/clinic/date-blocks — Falta
- POST /api/doctors/clinic/date-blocks/request — Falta

- GET /api/doctors/clinic/appointments — Falta
- PATCH /api/doctors/clinic/appointments/:appointmentId/status — Falta

## Mensajería Clínica (recepción) - Panel de Clínica

- GET /api/clinics/reception/messages — Implementado
- POST /api/clinics/reception/messages — Implementado
- PATCH /api/clinics/reception/messages/read — Implementado

---

Notas rápidas:
- Muchas rutas se implementan dentro de módulos (p.ej. `patients`, `pharmacies`, `supplies`, `clinics`, `doctors`, `ads`, `auth`). El diseño actual usa paths por módulo en handlers.
- Varios endpoints globales que `ALL_ENDPOINTS.md` lista (p.ej. `/api/providers/me`, `/api/branches`) no están como rutas globales; probablemente están reorganizados o faltan.
- Puedo generar una versión CSV o actualizar este archivo con enlaces a los handlers concretos si quieres pruebas automáticas (smoke tests).

---

Archivo generado automáticamente por revisión de código.
