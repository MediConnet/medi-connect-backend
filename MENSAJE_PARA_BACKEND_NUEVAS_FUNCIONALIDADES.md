# 📋 Nuevas Funcionalidades Implementadas en Frontend - Clínicas

Hola equipo de backend! 👋

Hemos implementado varias funcionalidades nuevas en el panel de clínicas. Aquí está todo lo que necesitan saber para dar soporte desde el backend.

---

## 🏥 1. Precios por Especialidad (NUEVO)

### Descripción
Las clínicas ahora pueden establecer precios de consulta por especialidad. Esto permite que cada especialidad (Cardiología, Pediatría, etc.) tenga su propio precio base.

### Endpoint Actual
```
PUT /api/clinics/profile
```

### Campo Nuevo en ClinicProfile
```typescript
{
  id: string,
  name: string,
  specialties: string[], // Ya existe
  consultationPrices: [  // ⭐ NUEVO CAMPO
    {
      specialty: string,      // Ej: "Cardiología"
      price: number,          // Ej: 60.00
      isActive: boolean       // true/false
    }
  ],
  // ... otros campos existentes
}
```

### Ejemplo de Request
```json
PUT /api/clinics/profile
{
  "id": "clinic-123",
  "name": "Clínica Central",
  "specialties": ["Cardiología", "Pediatría", "Medicina General"],
  "consultationPrices": [
    {
      "specialty": "Cardiología",
      "price": 60.00,
      "isActive": true
    },
    {
      "specialty": "Pediatría",
      "price": 45.00,
      "isActive": true
    },
    {
      "specialty": "Medicina General",
      "price": 35.00,
      "isActive": true
    }
  ]
}
```

### ¿Qué Necesitamos del Backend?

1. **Agregar campo `consultationPrices` a la tabla de clínicas**
   - Puede ser una columna JSON o una tabla relacionada
   - Debe guardarse y devolverse en GET/PUT `/api/clinics/profile`

2. **Validaciones:**
   - `price` debe ser >= 0
   - `specialty` debe existir en el array `specialties`
   - `isActive` es booleano

3. **Comportamiento:**
   - Cuando se actualiza el perfil, guardar el array completo de `consultationPrices`
   - Al obtener el perfil, devolver el array de precios
   - Si no existe, devolver array vacío `[]`

---

## 🏦 2. Datos Bancarios de la Clínica (NUEVO)

### Descripción
Las clínicas pueden registrar su cuenta bancaria para recibir pagos del admin.

### Endpoint Actual
```
PUT /api/clinics/profile
```

### Campo Nuevo en ClinicProfile
```typescript
{
  id: string,
  name: string,
  bankAccount: {  // ⭐ NUEVO CAMPO
    bankName: string,           // Ej: "Banco Pichincha"
    accountNumber: string,      // Ej: "2100123456"
    accountType: "checking" | "savings",  // "checking" o "savings"
    accountHolder: string,      // Ej: "Clínica Central S.A."
    identificationNumber: string  // RUC o cédula (10-13 dígitos)
  },
  // ... otros campos
}
```

### Ejemplo de Request
```json
PUT /api/clinics/profile
{
  "id": "clinic-123",
  "name": "Clínica Central",
  "bankAccount": {
    "bankName": "Banco Pichincha",
    "accountNumber": "2100123456",
    "accountType": "checking",
    "accountHolder": "Clínica Central S.A.",
    "identificationNumber": "1792345678001"
  }
}
```

### ¿Qué Necesitamos del Backend?

1. **Agregar campo `bankAccount` a la tabla de clínicas**
   - Puede ser columnas separadas o JSON
   - Debe guardarse y devolverse en GET/PUT `/api/clinics/profile`

2. **Validaciones:**
   - `accountNumber`: mínimo 10 dígitos
   - `identificationNumber`: 10-13 dígitos (RUC o cédula)
   - `accountType`: solo "checking" o "savings"
   - Todos los campos son requeridos si se envía `bankAccount`

3. **Seguridad:**
   - Estos datos son sensibles, asegurar que solo la clínica y admin puedan verlos

---

## 📅 3. Agenda Centralizada y Recepción (MOCKS ACTUALIZADOS)

### Descripción
Hemos actualizado los mocks con datos realistas para:
- Agenda centralizada de citas
- Mensajes entre recepción y médicos

### Endpoints Esperados (cuando estén listos)

#### Agenda Centralizada
```
GET /api/clinics/appointments
```

**Response esperado:**
```json
{
  "success": true,
  "data": [
    {
      "id": "apt-1",
      "patientName": "Juan Pérez",
      "patientPhone": "0991234567",
      "patientEmail": "juan@email.com",
      "doctorId": "doc-1",
      "doctorName": "Dr. Juan Pérez",
      "specialty": "Cardiología",
      "date": "2026-02-06",
      "time": "09:00",
      "reason": "Control de presión arterial",
      "status": "scheduled" | "confirmed" | "attended" | "cancelled",
      "receptionStatus": "pending" | "arrived" | "attended"
    }
  ]
}
```

#### Mensajes de Recepción
```
GET /api/clinics/reception-messages
POST /api/clinics/reception-messages
```

**Response esperado:**
```json
{
  "success": true,
  "data": [
    {
      "id": "msg-1",
      "from": "reception" | "doctor",
      "fromName": "Recepción" | "Dr. Juan Pérez",
      "to": "doctor" | "reception",
      "toName": "Dr. Juan Pérez" | "Recepción",
      "message": "El paciente Juan Pérez llegó para su cita de las 9:00",
      "timestamp": "2026-02-06T08:55:00Z",
      "isRead": false
    }
  ]
}
```

---

## 👨‍⚕️ 4. Gestión de Médicos - Cambios

### Descripción
**ELIMINAMOS** el campo de precio individual por médico de la tabla de gestión. Ahora los precios se manejan por especialidad.

### Cambios en el Frontend
- ❌ Ya NO mostramos columna "Precio Consulta" en la tabla de médicos
- ✅ Los precios se configuran por especialidad en "Precios por Consulta"

### ¿Afecta al Backend?
**NO**, el backend puede seguir teniendo el campo `consultationFee` en la tabla de médicos si lo necesitan para:
- Precios personalizados por médico (override del precio de especialidad)
- Reportes y estadísticas

Simplemente ya no lo mostramos en la UI de gestión de médicos.

---

## 📊 Resumen de Campos Nuevos en Base de Datos

### Tabla: `clinics`

```sql
-- Opción 1: Columnas JSON
ALTER TABLE clinics 
ADD COLUMN consultation_prices JSON,
ADD COLUMN bank_account JSON;

-- Opción 2: Tabla relacionada para precios
CREATE TABLE clinic_consultation_prices (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER REFERENCES clinics(id),
  specialty VARCHAR(100),
  price DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Opción 3: Columnas separadas para banco
ALTER TABLE clinics
ADD COLUMN bank_name VARCHAR(100),
ADD COLUMN bank_account_number VARCHAR(50),
ADD COLUMN bank_account_type VARCHAR(20),
ADD COLUMN bank_account_holder VARCHAR(200),
ADD COLUMN bank_identification_number VARCHAR(13);
```

---

## 🔄 Endpoints que Necesitamos Actualizar

### ✅ Ya Funcionan (con fallback a mocks)
1. `GET /api/clinics/profile` - Obtener perfil de clínica
2. `PUT /api/clinics/profile` - Actualizar perfil de clínica

### ⏳ Pendientes (actualmente usando mocks)
1. `GET /api/clinics/appointments` - Agenda centralizada
2. `GET /api/clinics/reception-messages` - Mensajes de recepción
3. `POST /api/clinics/reception-messages` - Enviar mensaje
4. `PUT /api/clinics/appointments/:id/status` - Actualizar estado de cita

---

## 🧪 Testing

### Datos de Prueba Sugeridos

**Clínica de Prueba:**
```json
{
  "id": "clinic-test-1",
  "name": "Clínica Central Test",
  "specialties": ["Cardiología", "Pediatría", "Medicina General"],
  "consultationPrices": [
    { "specialty": "Cardiología", "price": 60.00, "isActive": true },
    { "specialty": "Pediatría", "price": 45.00, "isActive": true },
    { "specialty": "Medicina General", "price": 35.00, "isActive": true }
  ],
  "bankAccount": {
    "bankName": "Banco Pichincha",
    "accountNumber": "2100123456",
    "accountType": "checking",
    "accountHolder": "Clínica Central S.A.",
    "identificationNumber": "1792345678001"
  }
}
```

---

## 📝 Notas Importantes

1. **Fallback Automático:** El frontend tiene fallback a localStorage si el backend falla, así que la funcionalidad siempre funciona durante desarrollo.

2. **Logs en Consola:** Hemos agregado logs detallados con emojis (🔄, ✅, ❌, 💾) para facilitar el debugging.

3. **Compatibilidad:** Todos los campos nuevos son opcionales, no rompen funcionalidad existente.

4. **Validaciones:** El frontend valida los datos antes de enviar, pero el backend debe validar también por seguridad.

---

## ❓ Preguntas Frecuentes

**P: ¿Qué pasa si una clínica no tiene precios configurados?**
R: El frontend muestra array vacío `[]` y permite configurarlos.

**P: ¿Los precios por especialidad reemplazan los precios por médico?**
R: No, son complementarios. El precio por especialidad es el "default", pero pueden tener precios individuales por médico si lo necesitan.

**P: ¿Qué formato de fecha/hora usan?**
R: ISO 8601 (ej: "2026-02-06T09:00:00Z")

**P: ¿Necesitan migración de datos?**
R: No, todos los campos nuevos son opcionales y tienen valores por defecto.

---

## 📞 Contacto

Si tienen dudas o necesitan más detalles sobre alguna funcionalidad, avisen! 

**Archivos de referencia en el repo:**
- `PRECIOS_CONSULTA_ESPECIALIDAD_COMPLETADO.md`
- `DATOS_BANCARIOS_CLINICA.md`
- `MOCKS_AGENDA_RECEPCION_CLINICA.md`
- `CAMBIOS_PRECIOS_CONSULTA_FINAL.md`

---

**Fecha:** 2026-02-06  
**Estado:** ✅ Frontend completado, esperando soporte de backend  
**Prioridad:** Media (funciona con mocks mientras tanto)
