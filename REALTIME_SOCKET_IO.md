## Realtime (Socket.IO) – MediConnect Backend

### Endpoint
- **Base URL**: el mismo host del backend (Render/Producción).
- **Path**: `SOCKET_IO_PATH` (por defecto `"/socket.io"`).

Ejemplos:
- `https://api.tu-dominio.com/socket.io` (Socket.IO sobre HTTPS)

### Autenticación
Se requiere JWT al conectar. El servidor acepta el token en cualquiera de estas formas (en este orden):

1. **Socket.IO handshake auth** (recomendado):

```js
io(BASE_URL, { auth: { token: JWT } })
```

2. **Query string**:

```js
io(BASE_URL, { query: { token: JWT } })
```

3. **Authorization header**:

```js
io(BASE_URL, { extraHeaders: { Authorization: `Bearer ${JWT}` } })
```

Si no hay token o no es válido, la conexión se rechaza.

### Rooms / Canales
Al autenticarse, cada socket se une automáticamente a:
- `user:{userId}`
- `provider:{providerId}` (si el usuario tiene registro en `providers` — aplica a doctor/farmacia/lab/insumos/ambulancia)
- `clinic:{clinicId}` (si el usuario es dueño de una clínica)
- `patient:{patientId}` (si el usuario es paciente)

### Eventos emitidos

#### `appointment:created`
**Cuándo**: cuando un paciente crea una cita.

**Destinatario**: room del usuario del doctor (`user:{doctorUserId}`).

**Payload**:
```json
{
  "appointmentId": "string",
  "patientName": "string",
  "date": "YYYY-MM-DD",
  "time": "HH:mm",
  "reason": "string|null",
  "status": "string"
}
```

#### `appointment:updated`
**Cuándo**: cuando doctor o clínica actualiza el estado.

**Destinatarios**:
- doctor (si se resuelve),
- paciente (si se resuelve),
- y el usuario autenticado que ejecutó la acción (panel clínica).

**Payload**:
```json
{
  "appointmentId": "string",
  "status": "string"
}
```

#### `review:new`
**Cuándo**: cuando se crea una reseña para una sucursal.

**Destinatario**: owner del provider asociado a la sucursal (`user:{providerUserId}`).

**Payload**:
```json
{
  "reviewId": "string",
  "rating": 1,
  "comment": "string|null",
  "userName": "string",
  "entityType": "branch",
  "branchId": "string"
}
```

#### `order:updated`
**Cuándo**: cuando farmacia actualiza estado de pedido.

**Destinatarios**:
- usuario del provider (panel),
- usuario del paciente (si se resuelve).

**Payload**:
```json
{
  "orderId": "string",
  "status": "string"
}
```

#### `notification:new`
**Cuándo**: cuando se crea una notificación en BD para clínica o paciente.

**Destinatarios**:
- clínica: room `clinic:{clinicId}`
- paciente: room `patient:{patientId}`

**Payload**:
```json
{
  "scope": "clinic|patient",
  "clinicId": "string (si scope=clinic)",
  "patientId": "string (si scope=patient)",
  "notification": {
    "id": "string",
    "type": "string",
    "title": "string",
    "body": "string",
    "is_read": false,
    "data": {},
    "created_at": "2026-01-01T00:00:00.000Z"
  }
}
```

### Notas importantes
- No hay historial/replay: solo eventos en tiempo real.
- Reconexión: Socket.IO reconecta automáticamente; al reconectar se revalida el JWT y se reasigna `user:{userId}`.

