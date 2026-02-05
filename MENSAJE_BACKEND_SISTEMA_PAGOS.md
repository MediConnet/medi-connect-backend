# 📨 Mensaje para Backend: Sistema de Pagos Completo

## 🎯 Resumen Ejecutivo

Hemos implementado en el frontend un **sistema completo de gestión de pagos** que maneja dos flujos:

1. **Admin → Médico Independiente** (Flujo directo)
2. **Admin → Clínica → Médicos Asociados** (Flujo con distribución)

El frontend está **100% funcional con mocks** y listo para conectarse al backend. Este documento detalla todos los endpoints necesarios.

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    ADMINISTRADOR                             │
│  - Recibe pagos con tarjeta de pacientes                   │
│  - Cobra comisión del 15%                                   │
│  - Paga a médicos independientes y clínicas                │
└─────────────────────────────────────────────────────────────┘
                    │                    │
                    │                    │
        ┌───────────┘                    └───────────┐
        │                                            │
        ▼                                            ▼
┌──────────────────┐                    ┌──────────────────────┐
│ MÉDICO           │                    │ CLÍNICA              │
│ INDEPENDIENTE    │                    │ - Recibe pago neto   │
│ - Recibe pago    │                    │ - Distribuye a       │
│   directo del    │                    │   médicos asociados  │
│   admin          │                    └──────────────────────┘
│ - 85% del total  │                                │
└──────────────────┘                                │
                                                    ▼
                                        ┌──────────────────────┐
                                        │ MÉDICO ASOCIADO      │
                                        │ - Recibe pago de     │
                                        │   la clínica         │
                                        │ - Monto según        │
                                        │   distribución       │
                                        └──────────────────────┘
```

---

## 📊 Entidades Implementadas en Frontend

### 1. Payment (Médico Independiente)

**Ubicación**: `src/features/doctor-panel/domain/Payment.entity.ts`

```typescript
export interface Payment {
  id: string;
  appointmentId: string;
  patientName: string;
  date: string;
  amount: number;           // Monto total cobrado
  commission: number;       // Comisión de la app (15%)
  netAmount: number;        // Total neto del médico (amount - commission)
  status: "pending" | "paid";
  paymentMethod: "card" | "cash";
  createdAt: string;
  
  // NUEVO: Fuente del pago
  source: "admin" | "clinic";  // 'admin' = independiente, 'clinic' = asociado
  clinicId?: string;           // ID de la clínica (si source = 'clinic')
  clinicName?: string;         // Nombre de la clínica (si source = 'clinic')
}
```

**Cambio importante**: Se agregó el campo `source` para diferenciar pagos directos del admin vs pagos de clínicas.

---

### 2. ClinicPayment (Pago Admin → Clínica)

**Ubicación**: `src/features/clinic-panel/domain/clinic-payment.entity.ts`

```typescript
export interface ClinicPayment {
  id: string;
  clinicId: string;
  clinicName: string;
  totalAmount: number;        // Total de citas pagadas con tarjeta
  appCommission: number;      // Comisión de la app (15%)
  netAmount: number;          // Total neto para la clínica
  status: "pending" | "paid";
  paymentDate: string | null;
  createdAt: string;
  
  // Detalle de citas incluidas
  appointments: {
    id: string;
    doctorId: string;
    doctorName: string;
    patientName: string;
    amount: number;
    date: string;
  }[];
  
  // Información de distribución
  isDistributed: boolean;
  distributedAmount: number;  // Monto ya distribuido a médicos
  remainingAmount: number;    // Monto sin distribuir
}
```

---

### 3. ClinicToDoctorPayment (Pago Clínica → Médico)

**Ubicación**: `src/features/clinic-panel/domain/clinic-to-doctor-payment.entity.ts`

```typescript
export interface ClinicToDoctorPayment {
  id: string;
  clinicId: string;
  clinicName: string;
  doctorId: string;
  doctorName: string;
  amount: number;             // Monto asignado al médico
  status: "pending" | "paid";
  paymentDate: string | null;
  createdAt: string;
  
  // Referencia al pago de admin a clínica
  clinicPaymentId: string;
  
  // Información bancaria del médico (opcional)
  doctorBankAccount?: {
    bankName: string;
    accountNumber: string;
    accountType: "checking" | "savings";
    accountHolder: string;
  };
}
```

---

### 4. PaymentDistribution (Distribución de Pagos)

**Ubicación**: `src/features/clinic-panel/domain/payment-distribution.entity.ts`

```typescript
export interface PaymentDistribution {
  clinicPaymentId: string;
  totalReceived: number;      // Total recibido del admin
  distributions: DoctorDistribution[];
  totalDistributed: number;   // Suma de todas las distribuciones
  remaining: number;          // Monto no distribuido
  createdAt: string;
  updatedAt: string;
}

export interface DoctorDistribution {
  doctorId: string;
  doctorName: string;
  amount: number;
  percentage: number;         // % del total recibido
  status: "pending" | "paid";
  paymentId?: string;         // ID del ClinicToDoctorPayment cuando se paga
}
```

---

## 🔌 Endpoints Necesarios

### 📍 Panel de Administrador

#### 1. Obtener pagos pendientes a médicos independientes
```http
GET /api/admin/payments/doctors
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "pay-001",
      "appointmentId": "apt-001",
      "patientName": "Dr. Juan Pérez",
      "date": "2026-01-15T10:00:00Z",
      "amount": 100,
      "commission": 15,
      "netAmount": 85,
      "status": "pending",
      "paymentMethod": "card",
      "createdAt": "2026-01-15T10:00:00Z",
      "source": "admin"
    }
  ]
}
```

#### 2. Obtener pagos pendientes a clínicas
```http
GET /api/admin/payments/clinics
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "cp-001",
      "clinicId": "clinic-001",
      "clinicName": "Clínica San Francisco",
      "totalAmount": 1000,
      "appCommission": 150,
      "netAmount": 850,
      "status": "pending",
      "paymentDate": null,
      "createdAt": "2026-01-25T08:00:00Z",
      "appointments": [
        {
          "id": "apt-001",
          "doctorId": "doc-001",
          "doctorName": "Dr. Juan Pérez",
          "patientName": "María González",
          "amount": 500,
          "date": "2026-01-20T09:00:00Z"
        }
      ],
      "isDistributed": false,
      "distributedAmount": 0,
      "remainingAmount": 850
    }
  ]
}
```

#### 3. Marcar pago a médico como pagado
```http
POST /api/admin/payments/doctors/:doctorId/mark-paid
```

**Request Body**:
```json
{
  "paymentIds": ["pay-001", "pay-002"]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Pagos marcados como pagados",
  "data": {
    "paidCount": 2,
    "totalAmount": 170
  }
}
```

#### 4. Marcar pago a clínica como pagado
```http
POST /api/admin/payments/clinics/:clinicPaymentId/mark-paid
```

**Response**:
```json
{
  "success": true,
  "message": "Pago a clínica marcado como pagado",
  "data": {
    "id": "cp-001",
    "status": "paid",
    "paymentDate": "2026-02-05T10:00:00Z"
  }
}
```

#### 5. Obtener historial de pagos realizados
```http
GET /api/admin/payments/history
```

**Response**:
```json
{
  "success": true,
  "data": {
    "doctorPayments": [
      {
        "id": "pay-001",
        "patientName": "Dr. Juan Pérez",
        "amount": 85,
        "paymentDate": "2026-01-28T10:00:00Z",
        "status": "paid"
      }
    ],
    "clinicPayments": [
      {
        "id": "cp-001",
        "clinicName": "Clínica San Francisco",
        "netAmount": 850,
        "paymentDate": "2026-01-29T10:00:00Z",
        "status": "paid"
      }
    ]
  }
}
```

---

### 📍 Panel de Clínica

#### 6. Obtener pagos recibidos del administrador
```http
GET /api/clinics/payments
```

**Headers**: `Authorization: Bearer {token}`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "cp-001",
      "clinicId": "clinic-001",
      "clinicName": "Clínica San Francisco",
      "totalAmount": 1000,
      "appCommission": 150,
      "netAmount": 850,
      "status": "paid",
      "paymentDate": "2026-01-28T10:00:00Z",
      "createdAt": "2026-01-25T08:00:00Z",
      "appointments": [
        {
          "id": "apt-001",
          "doctorId": "doc-001",
          "doctorName": "Dr. Juan Pérez",
          "patientName": "María González",
          "amount": 500,
          "date": "2026-01-20T09:00:00Z"
        }
      ],
      "isDistributed": true,
      "distributedAmount": 850,
      "remainingAmount": 0
    }
  ]
}
```

#### 7. Obtener detalle de un pago
```http
GET /api/clinics/payments/:id
```

**Response**: Igual que el objeto individual del endpoint anterior.

#### 8. Distribuir pago entre médicos
```http
POST /api/clinics/payments/:id/distribute
```

**Request Body**:
```json
{
  "distribution": [
    {
      "doctorId": "doc-001",
      "amount": 500
    },
    {
      "doctorId": "doc-002",
      "amount": 350
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "clinicPaymentId": "cp-001",
    "totalReceived": 850,
    "distributions": [
      {
        "doctorId": "doc-001",
        "doctorName": "Dr. Juan Pérez",
        "amount": 500,
        "percentage": 58.82,
        "status": "pending"
      },
      {
        "doctorId": "doc-002",
        "doctorName": "Dra. Ana López",
        "amount": 350,
        "percentage": 41.18,
        "status": "pending"
      }
    ],
    "totalDistributed": 850,
    "remaining": 0,
    "createdAt": "2026-02-05T10:00:00Z",
    "updatedAt": "2026-02-05T10:00:00Z"
  }
}
```

#### 9. Obtener pagos a médicos de la clínica
```http
GET /api/clinics/doctors/payments
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "cdp-001",
      "clinicId": "clinic-001",
      "clinicName": "Clínica San Francisco",
      "doctorId": "doc-001",
      "doctorName": "Dr. Juan Pérez",
      "amount": 500,
      "status": "pending",
      "paymentDate": null,
      "createdAt": "2026-01-28T10:00:00Z",
      "clinicPaymentId": "cp-001",
      "doctorBankAccount": {
        "bankName": "Banco Pichincha",
        "accountNumber": "2100123456789",
        "accountType": "checking",
        "accountHolder": "Juan Pérez"
      }
    }
  ]
}
```

#### 10. Pagar a un médico específico
```http
POST /api/clinics/doctors/:doctorId/pay
```

**Request Body**:
```json
{
  "paymentId": "cdp-001"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "cdp-001",
    "status": "paid",
    "paymentDate": "2026-02-05T10:00:00Z"
  }
}
```

#### 11. Obtener distribución de un pago
```http
GET /api/clinics/payments/:id/distribution
```

**Response**: Igual que la respuesta del endpoint de distribución (#8).

---

### 📍 Panel de Médico

#### 12. Obtener pagos del médico
```http
GET /api/doctors/payments
```

**Headers**: `Authorization: Bearer {token}`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "pay-001",
      "appointmentId": "apt-001",
      "patientName": "María González",
      "date": "2026-01-15T10:00:00Z",
      "amount": 100,
      "commission": 15,
      "netAmount": 85,
      "status": "paid",
      "paymentMethod": "card",
      "createdAt": "2026-01-15T10:00:00Z",
      "source": "admin"
    },
    {
      "id": "pay-002",
      "appointmentId": "apt-002",
      "patientName": "Carlos Ramírez",
      "date": "2026-01-20T14:00:00Z",
      "amount": 500,
      "commission": 0,
      "netAmount": 500,
      "status": "pending",
      "paymentMethod": "card",
      "createdAt": "2026-01-20T14:00:00Z",
      "source": "clinic",
      "clinicId": "clinic-001",
      "clinicName": "Clínica San Francisco"
    }
  ]
}
```

**Nota importante**: 
- Si `source = "admin"`: El médico es independiente y recibe pago directo del admin
- Si `source = "clinic"`: El médico está asociado a una clínica y recibe pago de ella

---

## 🔄 Flujos de Negocio

### Flujo 1: Pago a Médico Independiente

```
1. Paciente paga cita con tarjeta ($100)
2. Sistema registra pago:
   - amount: $100
   - commission: $15 (15%)
   - netAmount: $85
   - status: "pending"
   - source: "admin"
3. Admin ve el pago pendiente en su panel
4. Admin realiza transferencia bancaria externa
5. Admin marca el pago como "paid"
6. Médico ve el pago como "paid" en su panel
```

### Flujo 2: Pago a Médico Asociado a Clínica

```
1. Paciente paga cita en clínica con tarjeta ($500)
2. Sistema registra pago para la clínica:
   - totalAmount: $500
   - appCommission: $75 (15%)
   - netAmount: $425
   - status: "pending"
3. Admin ve el pago pendiente a la clínica
4. Admin realiza transferencia a la clínica ($425)
5. Admin marca el pago como "paid"
6. Clínica ve el pago recibido
7. Clínica distribuye el pago entre médicos:
   - Dr. Juan: $250
   - Dra. Ana: $175
8. Sistema crea ClinicToDoctorPayment para cada médico
9. Clínica realiza transferencias a médicos
10. Clínica marca cada pago como "paid"
11. Médicos ven sus pagos con source: "clinic"
```

---

## 📝 Reglas de Negocio

### Comisiones
- **Comisión de la app**: 15% sobre el monto total
- **Pagos con tarjeta**: Sujetos a comisión
- **Pagos en efectivo**: Sin comisión (no pasan por el sistema de pagos)

### Estados de Pago
- **pending**: Pago registrado pero no transferido
- **paid**: Transferencia realizada y confirmada

### Distribución de Pagos en Clínicas
- La clínica decide cómo distribuir el monto neto entre sus médicos
- La suma de distribuciones debe ser ≤ netAmount recibido
- Cada médico puede tener múltiples pagos pendientes

### Fuente de Pagos (source)
- **admin**: Médico independiente recibe pago directo del administrador
- **clinic**: Médico asociado recibe pago de la clínica

---

## 🎨 Pantallas Implementadas en Frontend

### 1. Admin - Pagos a Médicos
- ✅ Lista de médicos con pagos pendientes
- ✅ Resumen de totales (cobrado, comisiones, neto)
- ✅ Filtros por estado y médico
- ✅ Modal de detalle con datos bancarios
- ✅ Botón "Marcar como Pagado"

### 2. Admin - Pagos a Clínicas
- ✅ Lista de clínicas con pagos pendientes
- ✅ Resumen de totales
- ✅ Modal de detalle con citas incluidas
- ✅ Botón "Marcar como Pagado"

### 3. Admin - Historial
- ✅ Vista combinada de pagos a médicos y clínicas
- ✅ Diferenciación visual por tipo
- ✅ Solo muestra pagos completados

### 4. Clínica - Pagos Recibidos
- ✅ Lista de pagos del administrador
- ✅ Resumen de totales (recibido, pendiente, pagado)
- ✅ Botón "Distribuir" para asignar a médicos

### 5. Clínica - Pagos a Médicos
- ✅ Lista de médicos con pagos pendientes
- ✅ Datos bancarios de cada médico
- ✅ Botón "Pagar" individual

### 6. Médico - Mis Pagos
- ✅ Lista de todos los pagos (admin + clínica)
- ✅ Banner diferenciador si es médico asociado
- ✅ Filtros por estado y fuente

---

## 🔐 Autenticación y Autorización

### Headers Requeridos
```http
Authorization: Bearer {jwt_token}
```

### Permisos por Rol

**ADMIN**:
- Ver todos los pagos pendientes
- Marcar pagos como pagados
- Ver historial completo

**CLINIC**:
- Ver solo sus propios pagos
- Distribuir pagos entre sus médicos
- Pagar a sus médicos

**DOCTOR**:
- Ver solo sus propios pagos
- Ver datos bancarios propios

---

## 📦 Datos de Ejemplo (Mocks)

### Pago a Médico Independiente
```json
{
  "id": "pay-001",
  "appointmentId": "apt-001",
  "patientName": "Dr. Juan Pérez",
  "date": "2026-01-15T10:00:00Z",
  "amount": 100,
  "commission": 15,
  "netAmount": 85,
  "status": "pending",
  "paymentMethod": "card",
  "createdAt": "2026-01-15T10:00:00Z",
  "source": "admin"
}
```

### Pago a Clínica
```json
{
  "id": "cp-001",
  "clinicId": "clinic-001",
  "clinicName": "Clínica San Francisco",
  "totalAmount": 1000,
  "appCommission": 150,
  "netAmount": 850,
  "status": "pending",
  "paymentDate": null,
  "createdAt": "2026-01-25T08:00:00Z",
  "appointments": [
    {
      "id": "apt-001",
      "doctorId": "doc-001",
      "doctorName": "Dr. Juan Pérez",
      "patientName": "María González",
      "amount": 500,
      "date": "2026-01-20T09:00:00Z"
    },
    {
      "id": "apt-002",
      "doctorId": "doc-002",
      "doctorName": "Dra. Ana López",
      "patientName": "Carlos Ramírez",
      "amount": 500,
      "date": "2026-01-22T14:00:00Z"
    }
  ],
  "isDistributed": false,
  "distributedAmount": 0,
  "remainingAmount": 850
}
```

### Pago de Clínica a Médico
```json
{
  "id": "cdp-001",
  "clinicId": "clinic-001",
  "clinicName": "Clínica San Francisco",
  "doctorId": "doc-001",
  "doctorName": "Dr. Juan Pérez",
  "amount": 500,
  "status": "pending",
  "paymentDate": null,
  "createdAt": "2026-01-28T10:00:00Z",
  "clinicPaymentId": "cp-001",
  "doctorBankAccount": {
    "bankName": "Banco Pichincha",
    "accountNumber": "2100123456789",
    "accountType": "checking",
    "accountHolder": "Juan Pérez"
  }
}
```

---

## ✅ Checklist de Implementación Backend

### Endpoints Admin
- [ ] GET /api/admin/payments/doctors
- [ ] GET /api/admin/payments/clinics
- [ ] POST /api/admin/payments/doctors/:doctorId/mark-paid
- [ ] POST /api/admin/payments/clinics/:clinicPaymentId/mark-paid
- [ ] GET /api/admin/payments/history

### Endpoints Clínica
- [ ] GET /api/clinics/payments
- [ ] GET /api/clinics/payments/:id
- [ ] POST /api/clinics/payments/:id/distribute
- [ ] GET /api/clinics/doctors/payments
- [ ] POST /api/clinics/doctors/:doctorId/pay
- [ ] GET /api/clinics/payments/:id/distribution

### Endpoints Médico
- [ ] GET /api/doctors/payments (modificar para incluir campo `source`)

### Base de Datos
- [ ] Tabla/Colección: clinic_payments
- [ ] Tabla/Colección: clinic_to_doctor_payments
- [ ] Tabla/Colección: payment_distributions
- [ ] Modificar tabla payments: agregar campos `source`, `clinicId`, `clinicName`

### Lógica de Negocio
- [ ] Calcular comisión del 15% automáticamente
- [ ] Validar que distribución no exceda netAmount
- [ ] Actualizar estado de pagos
- [ ] Registrar fechas de pago
- [ ] Validar permisos por rol

---

## 🚀 Próximos Pasos

1. **Backend**: Implementar los 12 endpoints listados
2. **Frontend**: Descomentar las llamadas a API en los use cases
3. **Testing**: Probar flujos completos end-to-end
4. **Documentación**: Actualizar Swagger/Postman con los nuevos endpoints

---

## 📞 Contacto

Si tienes dudas sobre la implementación o necesitas más detalles sobre algún endpoint, por favor contacta al equipo de frontend.

**Fecha**: 5 de febrero de 2026  
**Estado Frontend**: ✅ 100% Implementado con Mocks  
**Estado Backend**: ⏳ Pendiente de Implementación

---

## 📎 Archivos de Referencia

### Entidades
- `src/features/doctor-panel/domain/Payment.entity.ts`
- `src/features/clinic-panel/domain/clinic-payment.entity.ts`
- `src/features/clinic-panel/domain/clinic-to-doctor-payment.entity.ts`
- `src/features/clinic-panel/domain/payment-distribution.entity.ts`

### APIs (Interfaces)
- `src/features/clinic-panel/infrastructure/clinic-payments.api.ts`

### Mocks (Datos de Ejemplo)
- `src/features/clinic-panel/infrastructure/clinic-payments.mock.ts`
- `src/features/doctor-panel/infrastructure/payments.mock.ts`

### Componentes UI
- `src/features/admin-dashboard/presentation/pages/PaymentsPage.tsx`
- `src/features/clinic-panel/presentation/components/ClinicPaymentsSection.tsx`
- `src/features/doctor-panel/presentation/components/PaymentsSection.tsx`

---

**¡Gracias por tu colaboración! 🙌**
