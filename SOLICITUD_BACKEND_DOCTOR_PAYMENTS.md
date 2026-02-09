# 🔴 SOLICITUD URGENTE: Endpoints de Pagos para Médicos

**Para:** Equipo Backend  
**De:** Frontend Team  
**Fecha:** 9 de Febrero, 2026  
**Prioridad:** 🔴 CRÍTICA

---

## 📋 RESUMEN

El frontend ya está **100% listo** para consumir los endpoints de pagos de médicos, pero necesitamos que el backend los implemente.

**Estado Actual:**
- ✅ Frontend: API creada y componentes actualizados
- ❌ Backend: Endpoints NO EXISTEN

---

## 🎯 ENDPOINTS REQUERIDOS

### 1. GET /api/doctors/payments

**Descripción:**  
Retorna todos los pagos del médico autenticado (pendientes y pagados).

**Autenticación:**  
Bearer Token (JWT del médico)

**Request:**
```http
GET /api/doctors/payments
Authorization: Bearer <token>
```

**Response Exitoso (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "payment-001",
      "appointmentId": "apt-001",
      "patientName": "María García",
      "date": "2026-02-05",
      "amount": 50.00,
      "commission": 7.50,
      "netAmount": 42.50,
      "status": "pending",
      "paymentMethod": "card",
      "createdAt": "2026-02-05T10:00:00Z",
      "source": "admin",
      "clinicId": null,
      "clinicName": null
    },
    {
      "id": "payment-002",
      "appointmentId": "apt-002",
      "patientName": "Juan López",
      "date": "2026-02-06",
      "amount": 60.00,
      "commission": 9.00,
      "netAmount": 51.00,
      "status": "paid",
      "paymentMethod": "card",
      "createdAt": "2026-02-06T14:00:00Z",
      "source": "clinic",
      "clinicId": "clinic-001",
      "clinicName": "Clínica San Francisco"
    }
  ]
}
```

**Campos Explicados:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | ID único del pago |
| `appointmentId` | string | ID de la cita asociada |
| `patientName` | string | Nombre del paciente |
| `date` | string | Fecha de la cita (YYYY-MM-DD) |
| `amount` | number | Monto total cobrado al paciente |
| `commission` | number | Comisión de la app (15%) |
| `netAmount` | number | Monto neto para el médico (amount - commission) |
| `status` | string | "pending" o "paid" |
| `paymentMethod` | string | "card" o "cash" |
| `createdAt` | string | Fecha de creación (ISO 8601) |
| `source` | string | "admin" (médico independiente) o "clinic" (médico de clínica) |
| `clinicId` | string\|null | ID de la clínica (si source = "clinic") |
| `clinicName` | string\|null | Nombre de la clínica (si source = "clinic") |

**Lógica de Negocio:**

1. **Médico Independiente (source = "admin"):**
   - Pagos de citas donde el médico NO está asociado a una clínica
   - El admin de la plataforma debe pagar al médico
   - `clinicId` y `clinicName` son `null`

2. **Médico de Clínica (source = "clinic"):**
   - Pagos de citas donde el médico SÍ está asociado a una clínica
   - La clínica debe pagar al médico
   - `clinicId` y `clinicName` tienen valores

3. **Cálculo de Comisión:**
   ```
   commission = amount * 0.15  (15%)
   netAmount = amount - commission
   ```

4. **Estados:**
   - `pending`: El pago aún no se ha realizado (transferencia bancaria pendiente)
   - `paid`: El pago ya fue realizado (admin/clínica marcó como pagado)

**Filtros Opcionales (Query Params):**
```http
GET /api/doctors/payments?status=pending
GET /api/doctors/payments?status=paid
GET /api/doctors/payments?source=admin
GET /api/doctors/payments?source=clinic
```

**Errores:**
```json
// 401 - No autenticado
{
  "success": false,
  "message": "Token inválido o expirado"
}

// 403 - No es médico
{
  "success": false,
  "message": "Solo médicos pueden acceder a esta ruta"
}

// 500 - Error del servidor
{
  "success": false,
  "message": "Error al obtener pagos"
}
```

---

### 2. GET /api/doctors/payments/:id

**Descripción:**  
Retorna el detalle de un pago específico del médico autenticado.

**Autenticación:**  
Bearer Token (JWT del médico)

**Request:**
```http
GET /api/doctors/payments/payment-001
Authorization: Bearer <token>
```

**Response Exitoso (200):**
```json
{
  "success": true,
  "data": {
    "id": "payment-001",
    "appointmentId": "apt-001",
    "patientName": "María García",
    "date": "2026-02-05",
    "amount": 50.00,
    "commission": 7.50,
    "netAmount": 42.50,
    "status": "pending",
    "paymentMethod": "card",
    "createdAt": "2026-02-05T10:00:00Z",
    "source": "admin",
    "clinicId": null,
    "clinicName": null,
    "appointment": {
      "id": "apt-001",
      "reason": "Consulta general",
      "scheduledFor": "2026-02-05T10:00:00Z"
    }
  }
}
```

**Errores:**
```json
// 404 - Pago no encontrado
{
  "success": false,
  "message": "Pago no encontrado"
}

// 403 - Pago no pertenece al médico
{
  "success": false,
  "message": "No tienes permiso para ver este pago"
}
```

---

## 🗄️ MODELO DE BASE DE DATOS SUGERIDO

### Tabla: `doctor_payments`

```sql
CREATE TABLE doctor_payments (
  id VARCHAR(36) PRIMARY KEY,
  doctor_id VARCHAR(36) NOT NULL,
  appointment_id VARCHAR(36) NOT NULL,
  patient_name VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  commission DECIMAL(10, 2) NOT NULL,
  net_amount DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'paid') DEFAULT 'pending',
  payment_method ENUM('card', 'cash') NOT NULL,
  source ENUM('admin', 'clinic') NOT NULL,
  clinic_id VARCHAR(36) NULL,
  clinic_name VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (doctor_id) REFERENCES users(id),
  FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  FOREIGN KEY (clinic_id) REFERENCES clinics(id),
  
  INDEX idx_doctor_id (doctor_id),
  INDEX idx_status (status),
  INDEX idx_source (source),
  INDEX idx_date (date)
);
```

---

## 🔄 FLUJO DE DATOS

### Escenario 1: Médico Independiente

```
1. Paciente paga cita con tarjeta → $50
2. Sistema registra pago:
   - amount: $50
   - commission: $7.50 (15%)
   - netAmount: $42.50
   - source: "admin"
   - status: "pending"
3. Admin ve en su panel: "Debe pagar $42.50 a Dr. Juan"
4. Admin hace transferencia bancaria EXTERNA
5. Admin marca como "paid" → status = "paid"
6. Doctor ve en su panel: "Pago recibido: $42.50"
```

### Escenario 2: Médico de Clínica

```
1. Paciente paga cita con tarjeta → $50
2. Sistema registra pago:
   - amount: $50
   - commission: $7.50 (15%)
   - netAmount: $42.50
   - source: "clinic"
   - clinicId: "clinic-001"
   - status: "pending"
3. Admin paga a la clínica (no al médico directamente)
4. Clínica distribuye el pago entre sus médicos
5. Clínica hace transferencia bancaria EXTERNA al médico
6. Clínica marca como "paid" → status = "paid"
7. Doctor ve en su panel: "Pago recibido: $42.50 de Clínica San Francisco"
```

---

## 🧪 CASOS DE PRUEBA

### Test 1: Médico sin pagos
```http
GET /api/doctors/payments
Authorization: Bearer <token_doctor_nuevo>

Response:
{
  "success": true,
  "data": []
}
```

### Test 2: Médico con pagos mixtos
```http
GET /api/doctors/payments
Authorization: Bearer <token_doctor_con_pagos>

Response:
{
  "success": true,
  "data": [
    { "source": "admin", "status": "pending", ... },
    { "source": "clinic", "status": "paid", ... }
  ]
}
```

### Test 3: Filtro por estado
```http
GET /api/doctors/payments?status=pending

Response:
{
  "success": true,
  "data": [
    { "status": "pending", ... }
  ]
}
```

### Test 4: Pago no encontrado
```http
GET /api/doctors/payments/invalid-id

Response: 404
{
  "success": false,
  "message": "Pago no encontrado"
}
```

---

## 📊 INTEGRACIÓN CON ENDPOINTS EXISTENTES

Estos endpoints deben integrarse con:

1. **Admin Payments:**
   - `GET /api/admin/payments/doctors` - Ya existe ✅
   - Cuando admin marca como "paid", actualizar `doctor_payments.status = 'paid'`

2. **Clinic Payments:**
   - `POST /api/clinics/doctors/:doctorId/pay` - Ya existe ✅
   - Cuando clínica paga, actualizar `doctor_payments.status = 'paid'`

3. **Appointments:**
   - Cuando se completa una cita con pago de tarjeta, crear registro en `doctor_payments`

---

## 🚀 PRIORIDAD Y TIMELINE

**Prioridad:** 🔴 CRÍTICA  
**Razón:** El frontend ya está listo y esperando estos endpoints  
**Impacto:** Sin estos endpoints, los médicos no pueden ver sus pagos

**Timeline Sugerido:**
- **Día 1:** Crear modelo y migración de BD
- **Día 2:** Implementar `GET /api/doctors/payments`
- **Día 3:** Implementar `GET /api/doctors/payments/:id`
- **Día 4:** Testing y ajustes
- **Día 5:** Deploy a producción

---

## 📞 CONTACTO

Si tienen dudas sobre la estructura de datos o necesitan más detalles, contactar al equipo de frontend.

**Frontend está listo y esperando** 🚀

---

**Generado:** 9 de Febrero, 2026  
**Autor:** Frontend Team  
**Estado:** ⏳ ESPERANDO IMPLEMENTACIÓN BACKEND
