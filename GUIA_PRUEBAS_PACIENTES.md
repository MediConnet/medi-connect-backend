# 🧪 Guía de Pruebas - Módulo de Pacientes

Esta guía te muestra cómo probar todos los endpoints del módulo de pacientes usando **Insomnia** (o Postman).

---

## 📋 Requisitos Previos

1. **Servidor backend corriendo**: `npm run dev`
2. **Base de datos conectada**: Verificar que Prisma esté conectado
3. **Usuario de prueba**: Tener un usuario con rol `patient` o crear uno

---

## 🔑 Paso 1: Obtener Token de Autenticación

### 1.1. Login como Paciente

**Método**: `POST`  
**URL**: `http://localhost:3000/api/auth/login`  
**Headers**:
```
Content-Type: application/json
```

**Body (JSON)**:
```json
{
  "email": "paciente@medicones.com",
  "password": "paciente123"
}
```

**Respuesta esperada**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGc...",
    "accessToken": "eyJhbGc...",
    "user": {
      "id": "uuid",
      "email": "paciente@medicones.com",
      "role": "patient"
    }
  }
}
```

**⚠️ IMPORTANTE**: Copia el `token` o `accessToken` de la respuesta. Lo necesitarás para los siguientes requests.

---

## 👤 Paso 2: Perfil de Paciente

### 2.1. Obtener Perfil

**Método**: `GET`  
**URL**: `http://localhost:3000/api/patients/profile`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer <TU_TOKEN_AQUI>
```

**Respuesta esperada**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "paciente@medicones.com",
    "profile_picture_url": null,
    "full_name": null,
    "phone": null,
    "identification": null,
    "birth_date": null,
    "address": null,
    "is_patient_created": false
  }
}
```

**Notas**:
- Si `is_patient_created: false`, significa que el paciente aún no tiene datos completos
- Puedes actualizar el perfil para crear el registro completo

---

### 2.2. Actualizar Perfil

**Método**: `PUT`  
**URL**: `http://localhost:3000/api/patients/profile`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer <TU_TOKEN_AQUI>
```

**Body (JSON)**:
```json
{
  "full_name": "Juan Pérez",
  "phone": "+593 99 123 4567",
  "identification": "1234567890",
  "birth_date": "1990-05-15",
  "address": "Av. Amazonas N25-123, Quito",
  "profile_picture_url": "https://example.com/foto.jpg"
}
```

**Respuesta esperada**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "paciente@medicones.com",
    "profile_picture_url": "https://example.com/foto.jpg",
    "full_name": "Juan Pérez",
    "phone": "+593 99 123 4567",
    "identification": "1234567890",
    "birth_date": "1990-05-15",
    "address": "Av. Amazonas N25-123, Quito",
    "is_patient_created": true
  }
}
```

**Validaciones**:
- `full_name`: Mínimo 1 carácter
- `birth_date`: Formato `YYYY-MM-DD`
- `profile_picture_url`: Debe ser una URL válida o string vacío

---

## 📅 Paso 3: Citas del Paciente

### 3.1. Listar Citas

**Método**: `GET`  
**URL**: `http://localhost:3000/api/patients/appointments`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer <TU_TOKEN_AQUI>
```

**Query Parameters (opcionales)**:
- `status`: Filtrar por estado (`CONFIRMED`, `CANCELLED`, `COMPLETED`)
- `limit`: Número de resultados (default: 50)
- `offset`: Offset para paginación (default: 0)

**Ejemplo con filtros**:
```
http://localhost:3000/api/patients/appointments?status=CONFIRMED&limit=10
```

**Respuesta esperada**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "scheduledFor": "2026-01-20T10:00:00.000Z",
      "status": "CONFIRMED",
      "reason": "Consulta general",
      "isPaid": false,
      "provider": {
        "id": "uuid",
        "name": "Dr. Test Pérez",
        "logoUrl": null,
        "category": "Médico"
      },
      "branch": {
        "id": "uuid",
        "name": "Consultorio Principal",
        "address": "Av. Amazonas 123",
        "phone": "+593 99 123 4567"
      }
    }
  ]
}
```

---

### 3.2. Obtener Detalle de Cita

**Método**: `GET`  
**URL**: `http://localhost:3000/api/patients/appointments/<APPOINTMENT_ID>`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer <TU_TOKEN_AQUI>
```

**Ejemplo**:
```
http://localhost:3000/api/patients/appointments/123e4567-e89b-12d3-a456-426614174000
```

**Respuesta esperada**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "scheduledFor": "2026-01-20T10:00:00.000Z",
    "status": "CONFIRMED",
    "reason": "Consulta general",
    "isPaid": false,
    "provider": {
      "id": "uuid",
      "name": "Dr. Test Pérez",
      "logoUrl": null,
      "description": "Cardiólogo con experiencia",
      "category": "Médico"
    },
    "branch": {
      "id": "uuid",
      "name": "Consultorio Principal",
      "address": "Av. Amazonas 123",
      "phone": "+593 99 123 4567",
      "email": "contacto@doctor.com"
    }
  }
}
```

---

### 3.3. Cancelar Cita

**Método**: `DELETE`  
**URL**: `http://localhost:3000/api/patients/appointments/<APPOINTMENT_ID>`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer <TU_TOKEN_AQUI>
```

**Ejemplo**:
```
http://localhost:3000/api/patients/appointments/123e4567-e89b-12d3-a456-426614174000
```

**Respuesta esperada**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "CANCELLED",
    "message": "Appointment cancelled successfully"
  }
}
```

**Notas**:
- Solo puedes cancelar tus propias citas
- No se pueden cancelar citas pasadas
- El estado se cambia automáticamente a `CANCELLED`

---

## 🏥 Paso 4: Historial Médico

### 4.1. Listar Historial Médico

**Método**: `GET`  
**URL**: `http://localhost:3000/api/patients/medical-history`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer <TU_TOKEN_AQUI>
```

**Query Parameters (opcionales)**:
- `limit`: Número de resultados (default: 50)
- `offset`: Offset para paginación (default: 0)

**Respuesta esperada**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "date": "2026-01-15T10:00:00.000Z",
      "diagnosis": "Hipertensión arterial",
      "treatment": "Medicación diaria",
      "indications": "Dieta baja en sal",
      "observations": "Control en 30 días",
      "doctorName": "Dr. Test Pérez",
      "specialty": "Cardiología",
      "provider": {
        "id": "uuid",
        "name": "Dr. Test Pérez",
        "logoUrl": null,
        "category": "Médico"
      },
      "createdAt": "2026-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### 4.2. Obtener Detalle de Registro

**Método**: `GET`  
**URL**: `http://localhost:3000/api/patients/medical-history/<RECORD_ID>`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer <TU_TOKEN_AQUI>
```

**Respuesta esperada**: Similar a la lista, pero con un solo objeto.

---

## ⭐ Paso 5: Favoritos

### 5.1. Listar Favoritos

**Método**: `GET`  
**URL**: `http://localhost:3000/api/patients/favorites`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer <TU_TOKEN_AQUI>
```

**Respuesta esperada**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "branch": {
        "id": "uuid",
        "name": "Consultorio Principal",
        "address": "Av. Amazonas 123",
        "phone": "+593 99 123 4567",
        "provider": {
          "id": "uuid",
          "name": "Dr. Test Pérez",
          "logoUrl": null,
          "category": "Médico"
        },
        "city": "Quito"
      },
      "createdAt": "2026-01-15T10:00:00.000Z"
    }
  ]
}
```

---

### 5.2. Agregar a Favoritos

**Método**: `POST`  
**URL**: `http://localhost:3000/api/patients/favorites`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer <TU_TOKEN_AQUI>
```

**Body (JSON)**:
```json
{
  "branchId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Respuesta esperada**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "branchId": "123e4567-e89b-12d3-a456-426614174000",
    "message": "Favorite added successfully"
  }
}
```

**Notas**:
- El `branchId` debe ser un UUID válido de una sucursal existente
- No puedes agregar la misma sucursal dos veces (retorna 409)

---

### 5.3. Eliminar de Favoritos

**Método**: `DELETE`  
**URL**: `http://localhost:3000/api/patients/favorites/<FAVORITE_ID>`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer <TU_TOKEN_AQUI>
```

**Respuesta esperada**:
```json
{
  "success": true,
  "data": {
    "message": "Favorite removed successfully"
  }
}
```

---

## 🔔 Paso 6: Notificaciones

### 6.1. Listar Notificaciones

**Método**: `GET`  
**URL**: `http://localhost:3000/api/patients/notifications`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer <TU_TOKEN_AQUI>
```

**Query Parameters (opcionales)**:
- `unread`: `true` para solo no leídas
- `limit`: Número de resultados (default: 50)
- `offset`: Offset para paginación (default: 0)

**Ejemplo**:
```
http://localhost:3000/api/patients/notifications?unread=true
```

**Respuesta esperada**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "REMINDER",
      "title": "Recordatorio de cita",
      "body": "Tienes una cita mañana a las 10:00 AM",
      "isRead": false,
      "data": null,
      "createdAt": "2026-01-19T10:00:00.000Z"
    }
  ]
}
```

---

### 6.2. Contador de No Leídas

**Método**: `GET`  
**URL**: `http://localhost:3000/api/patients/notifications/unread`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer <TU_TOKEN_AQUI>
```

**Respuesta esperada**:
```json
{
  "success": true,
  "data": {
    "count": 3
  }
}
```

---

### 6.3. Marcar como Leída

**Método**: `PUT`  
**URL**: `http://localhost:3000/api/patients/notifications/<NOTIFICATION_ID>/read`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer <TU_TOKEN_AQUI>
```

**Respuesta esperada**:
```json
{
  "success": true,
  "data": {
    "message": "Notification marked as read"
  }
}
```

---

### 6.4. Marcar Todas como Leídas

**Método**: `PUT`  
**URL**: `http://localhost:3000/api/patients/notifications/read-all`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer <TU_TOKEN_AQUI>
```

**Respuesta esperada**:
```json
{
  "success": true,
  "data": {
    "count": 5,
    "message": "All notifications marked as read"
  }
}
```

---

## 🐛 Errores Comunes

### 401 Unauthorized
**Causa**: Token inválido o expirado  
**Solución**: Hacer login nuevamente y obtener un nuevo token

### 403 Forbidden
**Causa**: Intentando acceder a datos de otro paciente  
**Solución**: Verificar que estás usando el token correcto

### 404 Not Found
**Causa**: ID inválido o recurso no existe  
**Solución**: Verificar que el ID sea correcto y que el recurso exista

### 400 Bad Request
**Causa**: Datos inválidos en el body  
**Solución**: Verificar el formato del JSON y los campos requeridos

---

## 📝 Notas Importantes

1. **Todos los endpoints requieren autenticación** (excepto login)
2. **El token expira en 1 hora** (en desarrollo local)
3. **Los pacientes solo pueden ver/modificar sus propios datos**
4. **Las fechas deben estar en formato ISO** (`YYYY-MM-DD` para birth_date)
5. **Los UUIDs deben ser válidos** (formato: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

---

## ✅ Checklist de Pruebas

- [ ] Login como paciente
- [ ] Obtener perfil (debe retornar datos básicos si no existe)
- [ ] Actualizar perfil (debe crear registro completo)
- [ ] Obtener perfil nuevamente (debe mostrar datos actualizados)
- [ ] Listar citas (puede estar vacío si no hay citas)
- [ ] Obtener detalle de cita (si existe alguna)
- [ ] Cancelar cita (si existe alguna)
- [ ] Listar historial médico (puede estar vacío)
- [ ] Listar favoritos (puede estar vacío)
- [ ] Agregar favorito (necesitas un branchId válido)
- [ ] Eliminar favorito
- [ ] Listar notificaciones
- [ ] Obtener contador de no leídas
- [ ] Marcar notificación como leída
- [ ] Marcar todas como leídas

---

**¡Listo para probar!** 🚀

Si encuentras algún error, revisa los logs del servidor (`npm run dev`) para ver detalles del problema.
