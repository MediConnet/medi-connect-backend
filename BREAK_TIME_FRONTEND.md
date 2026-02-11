# Break time (almuerzo) en horarios del **médico independiente** (providers)

## Contexto
El **médico independiente** usa esta relación:

- `providers` (doctor)
- `provider_branches` (perfil/sucursal principal `is_main=true`)
- `provider_schedules` (horario por día)
  - `start_time`, `end_time`
  - **`break_start`, `break_end`** (almuerzo / no disponible)

El backend:

- **Ya usa** `break_start/break_end` para calcular disponibilidad en `GET /api/doctors/availability`.
- Ahora también **guarda y devuelve** el almuerzo desde el perfil del doctor.

## Endpoints
### 1) GET `GET /api/doctors/profile`
Auth: `Authorization: Bearer <token>`

Respuesta incluye `schedules` (array lunes→domingo) y cada item trae:

- `day`: `"monday" | ... | "sunday"`
- `enabled`: boolean
- `startTime`: `"HH:mm" | null`
- `endTime`: `"HH:mm" | null`
- **`breakStart`**: `"HH:mm" | null`
- **`breakEnd`**: `"HH:mm" | null`

### 2) PUT `PUT /api/doctors/profile`
Auth: `Authorization: Bearer <token>`

Body (solo lo relevante a horarios):

```json
{
  "workSchedule": [
    {
      "day": "monday",
      "enabled": true,
      "startTime": "08:00",
      "endTime": "18:00",
      "breakStart": "13:00",
      "breakEnd": "14:00"
    },
    {
      "day": "tuesday",
      "enabled": false,
      "startTime": null,
      "endTime": null,
      "breakStart": null,
      "breakEnd": null
    }
  ]
}
```

## Reglas/validación (importante)
- Formato de horas: **`HH:mm`** (24h).
- Si `enabled=true`: `startTime` y `endTime` son **obligatorios** (no null).
- `breakStart` y `breakEnd`:
  - Se envían **ambos** o **ninguno** (los dos `null`).
  - Si no hay almuerzo, mandar `breakStart:null` y `breakEnd:null`.

## UI/UX recomendado (frontend)
- Mostrar selector “Almuerzo / break time” por día (solo cuando `enabled=true`).
- Permitir “Sin almuerzo” (setear ambos a `null`).
- Validar en UI:
  - `breakStart < breakEnd`
  - `startTime < endTime`
  - `breakStart/breakEnd` dentro del rango laboral (opcional pero recomendado).

