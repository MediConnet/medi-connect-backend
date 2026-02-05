# 📋 Plan de Implementación: Sistema de Pagos

## 🎯 Objetivo

Implementar el sistema de pagos completo usando **las tablas existentes** (`payments`, `payouts`) y agregando **solo 2 tablas nuevas** mínimas.

---

## 📊 Análisis de Tablas Existentes

### ✅ Tabla `payments` (Ya existe)

```prisma
model payments {
  id                       String        @id @db.Uuid
  appointment_id           String?       @db.Uuid
  payout_id                String?       @db.Uuid  // ← Relaciona con payouts
  stripe_payment_intent_id String?       @db.VarChar(255)
  amount_total             Decimal?      @db.Decimal  // ← Monto total
  platform_fee             Decimal?      @db.Decimal  // ← Comisión (15%)
  provider_amount          Decimal?      @db.Decimal  // ← Monto neto
  status                   String?       @db.VarChar(255)  // ← pending/paid
  created_at               DateTime?     @default(now()) @db.Timestamp(6)
}
```

**Uso:**
- Representa pagos de pacientes por citas
- Ya tiene los campos necesarios: `amount_total`, `platform_fee`, `provider_amount`
- El campo `status` puede ser: `pending`, `paid`

**Campos a agregar:**
```prisma
payment_method    String?  @db.VarChar(50)  // 'card' o 'cash'
payment_source    String?  @db.VarChar(50)  // 'admin' o 'clinic'
clinic_id         String?  @db.Uuid         // Si source='clinic'
paid_at           DateTime? @db.Timestamp(6) // Fecha de pago
```

---

### ✅ Tabla `payouts` (Ya existe)

```prisma
model payouts {
  id               String     @id @db.Uuid
  provider_id      String?    @db.Uuid  // ← Médico o clínica
  total_amount     Decimal?   @db.Decimal  // ← Total a pagar
  currency         String?    @default("USD") @db.VarChar(3)
  status           String?    @db.VarChar(255)  // ← pending/paid
  reference_number String?    @db.VarChar(255)
  period_start     DateTime?  @db.Timestamp(6)
  period_end       DateTime?  @db.Timestamp(6)
  created_at       DateTime?  @default(now()) @db.Timestamp(6)
}
```

**Uso:**
- Representa pagos del admin a médicos/clínicas
- Agrupa múltiples `payments` en un solo pago
- Ya tiene `provider_id` para relacionar con médico/clínica

**Campos a agregar:**
```prisma
payout_type      String?  @db.VarChar(50)  // 'doctor' o 'clinic'
paid_at          DateTime? @db.Timestamp(6) // Fecha de pago
```

---

## 🆕 Tablas Nuevas (Solo 2)

### 1. `clinic_payment_distributions`

Representa la distribución de un pago de clínica entre sus médicos.

```prisma
model clinic_payment_distributions {
  id              String    @id @db.Uuid
  payout_id       String    @db.Uuid  // Pago de admin a clínica
  doctor_id       String    @db.Uuid  // Médico que recibe
  amount          Decimal   @db.Decimal(10, 2)
  percentage      Decimal?  @db.Decimal(5, 2)  // % del total
  status          String    @db.VarChar(50)  // 'pending' o 'paid'
  paid_at         DateTime? @db.Timestamp(6)
  created_at      DateTime  @default(now()) @db.Timestamp(6)
  updated_at      DateTime  @default(now()) @db.Timestamp(6)
  
  payouts         payouts   @relation(fields: [payout_id], references: [id])
  clinic_doctors  clinic_doctors @relation(fields: [doctor_id], references: [id])
}
```

**Propósito:**
- Registra cómo la clínica distribuye el pago entre sus médicos
- Relaciona un `payout` (pago a clínica) con múltiples médicos

---

### 2. `doctor_bank_accounts` (Opcional)

Almacena información bancaria de los médicos.

```prisma
model doctor_bank_accounts {
  id              String    @id @db.Uuid
  doctor_id       String    @db.Uuid @unique
  bank_name       String    @db.VarChar(255)
  account_number  String    @db.VarChar(255)
  account_type    String    @db.VarChar(50)  // 'checking' o 'savings'
  account_holder  String    @db.VarChar(255)
  created_at      DateTime  @default(now()) @db.Timestamp(6)
  updated_at      DateTime  @default(now()) @db.Timestamp(6)
  
  clinic_doctors  clinic_doctors @relation(fields: [doctor_id], references: [id])
}
```

**Propósito:**
- Almacena datos bancarios de médicos para transferencias
- Opcional: Puede manejarse en el frontend si no quieres guardar datos sensibles

---

## 🔄 Mapeo de Entidades Frontend → Backend

### Payment (Médico Independiente)

**Frontend:**
```typescript
{
  id: string;
  appointmentId: string;
  amount: number;
  commission: number;
  netAmount: number;
  status: "pending" | "paid";
  source: "admin" | "clinic";
}
```

**Backend (tabla `payments`):**
```typescript
{
  id: uuid;
  appointment_id: uuid;
  amount_total: decimal;      // = amount
  platform_fee: decimal;      // = commission
  provider_amount: decimal;   // = netAmount
  status: string;             // = status
  payment_source: string;     // = source
  paid_at: timestamp;         // cuando status = 'paid'
}
```

---

### ClinicPayment (Pago Admin → Clínica)

**Frontend:**
```typescript
{
  id: string;
  clinicId: string;
  totalAmount: number;
  appCommission: number;
  netAmount: number;
  status: "pending" | "paid";
  appointments: [...];
}
```

**Backend (tabla `payouts`):**
```typescript
{
  id: uuid;
  provider_id: uuid;          // = clinicId (clínica es un provider)
  total_amount: decimal;      // = netAmount
  status: string;             // = status
  payout_type: 'clinic';      // Identifica que es pago a clínica
  paid_at: timestamp;         // cuando status = 'paid'
  
  // Los appointments se obtienen de payments.payout_id
}
```

---

### ClinicToDoctorPayment (Pago Clínica → Médico)

**Frontend:**
```typescript
{
  id: string;
  clinicId: string;
  doctorId: string;
  amount: number;
  status: "pending" | "paid";
  clinicPaymentId: string;
}
```

**Backend (tabla `clinic_payment_distributions`):**
```typescript
{
  id: uuid;
  payout_id: uuid;            // = clinicPaymentId
  doctor_id: uuid;            // = doctorId
  amount: decimal;            // = amount
  status: string;             // = status
  paid_at: timestamp;         // cuando status = 'paid'
}
```

---

## 📝 Modificaciones al Schema

### Actualizar `payments`

```prisma
model payments {
  id                       String        @id @db.Uuid
  appointment_id           String?       @db.Uuid
  payout_id                String?       @db.Uuid
  stripe_payment_intent_id String?       @db.VarChar(255)
  amount_total             Decimal?      @db.Decimal
  platform_fee             Decimal?      @db.Decimal
  provider_amount          Decimal?      @db.Decimal
  status                   String?       @db.VarChar(255)
  created_at               DateTime?     @default(now()) @db.Timestamp(6)
  
  // ⭐ NUEVOS CAMPOS
  payment_method           String?       @db.VarChar(50)   // 'card' o 'cash'
  payment_source           String?       @db.VarChar(50)   // 'admin' o 'clinic'
  clinic_id                String?       @db.Uuid          // Si source='clinic'
  paid_at                  DateTime?     @db.Timestamp(6)  // Fecha de pago
  
  appointments             appointments? @relation(fields: [appointment_id], references: [id])
  payouts                  payouts?      @relation(fields: [payout_id], references: [id])
  clinics                  clinics?      @relation(fields: [clinic_id], references: [id])
}
```

---

### Actualizar `payouts`

```prisma
model payouts {
  id               String     @id @db.Uuid
  provider_id      String?    @db.Uuid
  total_amount     Decimal?   @db.Decimal
  currency         String?    @default("USD") @db.VarChar(3)
  status           String?    @db.VarChar(255)
  reference_number String?    @db.VarChar(255)
  period_start     DateTime?  @db.Timestamp(6)
  period_end       DateTime?  @db.Timestamp(6)
  created_at       DateTime?  @default(now()) @db.Timestamp(6)
  
  // ⭐ NUEVOS CAMPOS
  payout_type      String?    @db.VarChar(50)   // 'doctor' o 'clinic'
  paid_at          DateTime?  @db.Timestamp(6)  // Fecha de pago
  
  payments         payments[]
  providers        providers? @relation(fields: [provider_id], references: [id])
  clinic_payment_distributions clinic_payment_distributions[]
}
```

---

### Agregar `clinic_payment_distributions`

```prisma
model clinic_payment_distributions {
  id              String         @id @db.Uuid
  payout_id       String         @db.Uuid
  doctor_id       String         @db.Uuid
  amount          Decimal        @db.Decimal(10, 2)
  percentage      Decimal?       @db.Decimal(5, 2)
  status          String         @db.VarChar(50)
  paid_at         DateTime?      @db.Timestamp(6)
  created_at      DateTime       @default(now()) @db.Timestamp(6)
  updated_at      DateTime       @default(now()) @db.Timestamp(6)
  
  payouts         payouts        @relation(fields: [payout_id], references: [id], onDelete: Cascade)
  clinic_doctors  clinic_doctors @relation(fields: [doctor_id], references: [id], onDelete: Cascade)
  
  @@index([payout_id])
  @@index([doctor_id])
  @@index([status])
}
```

---

### Agregar `doctor_bank_accounts` (Opcional)

```prisma
model doctor_bank_accounts {
  id              String         @id @db.Uuid
  doctor_id       String         @db.Uuid @unique
  bank_name       String         @db.VarChar(255)
  account_number  String         @db.VarChar(255)
  account_type    String         @db.VarChar(50)
  account_holder  String         @db.VarChar(255)
  created_at      DateTime       @default(now()) @db.Timestamp(6)
  updated_at      DateTime       @default(now()) @db.Timestamp(6)
  
  clinic_doctors  clinic_doctors @relation(fields: [doctor_id], references: [id], onDelete: Cascade)
  
  @@index([doctor_id])
}
```

---

## 🔄 Flujos de Datos

### Flujo 1: Pago a Médico Independiente

```
1. Paciente paga cita → Crear registro en `payments`:
   - appointment_id: ID de la cita
   - amount_total: $100
   - platform_fee: $15
   - provider_amount: $85
   - status: 'pending'
   - payment_method: 'card'
   - payment_source: 'admin'

2. Admin agrupa pagos → Crear registro en `payouts`:
   - provider_id: ID del médico
   - total_amount: Suma de provider_amount
   - status: 'pending'
   - payout_type: 'doctor'
   
3. Admin marca como pagado → Actualizar `payouts`:
   - status: 'paid'
   - paid_at: NOW()
   
4. Actualizar payments relacionados:
   - status: 'paid'
   - paid_at: NOW()
```

---

### Flujo 2: Pago a Clínica

```
1. Paciente paga cita en clínica → Crear registro en `payments`:
   - appointment_id: ID de la cita
   - amount_total: $500
   - platform_fee: $75
   - provider_amount: $425
   - status: 'pending'
   - payment_method: 'card'
   - payment_source: 'admin'
   - clinic_id: ID de la clínica

2. Admin agrupa pagos de clínica → Crear registro en `payouts`:
   - provider_id: ID de la clínica
   - total_amount: Suma de provider_amount
   - status: 'pending'
   - payout_type: 'clinic'

3. Admin marca como pagado → Actualizar `payouts`:
   - status: 'paid'
   - paid_at: NOW()

4. Clínica distribuye entre médicos → Crear registros en `clinic_payment_distributions`:
   - payout_id: ID del payout de la clínica
   - doctor_id: ID del médico
   - amount: $250
   - status: 'pending'

5. Clínica paga a médico → Actualizar `clinic_payment_distributions`:
   - status: 'paid'
   - paid_at: NOW()
```

---

## ✅ Ventajas de Esta Solución

1. **Reutiliza tablas existentes**: `payments` y `payouts`
2. **Solo 2 tablas nuevas**: `clinic_payment_distributions` y `doctor_bank_accounts` (opcional)
3. **Mantiene integridad referencial**: Usa foreign keys existentes
4. **Escalable**: Puede manejar múltiples clínicas y médicos
5. **Auditable**: Registra fechas de creación y pago

---

## 📋 Próximos Pasos

1. ✅ Crear migración para agregar campos a `payments` y `payouts`
2. ✅ Crear migración para `clinic_payment_distributions`
3. ✅ Crear migración para `doctor_bank_accounts` (opcional)
4. ✅ Implementar endpoints del admin
5. ✅ Implementar endpoints de clínica
6. ✅ Implementar endpoints de médico
7. ✅ Probar flujos completos

---

¿Te parece bien este plan? Puedo proceder a crear las migraciones y los endpoints. 🚀
