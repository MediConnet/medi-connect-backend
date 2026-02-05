# 💰 Flujo Completo de Pagos - Guía de Datos

## 📊 Resumen de Tablas Involucradas

1. **`payments`** - Registro de cada pago de paciente
2. **`payouts`** - Agrupación de pagos para transferir
3. **`clinic_payment_distributions`** - Distribución de pagos de clínica a médicos

---

## 🔄 FLUJO 1: Médico Independiente (Admin → Médico)

### PASO 1: Paciente Paga la Cita

**Cuándo**: Paciente completa el pago de su cita (con tarjeta o efectivo)

**Tabla**: `payments`

```sql
INSERT INTO payments (
  id,
  appointment_id,
  amount_total,
  platform_fee,
  provider_amount,
  status,
  payment_method,
  payment_source,
  stripe_payment_intent_id,
  created_at,
  payout_id,
  clinic_id,
  paid_at
) VALUES (
  gen_random_uuid(),
  'apt-001',              -- ID de la cita
  100.00,                 -- Monto total cobrado
  15.00,                  -- 15% comisión (solo si es tarjeta)
  85.00,                  -- 85% para médico
  'pending',              -- Estado inicial
  'card',                 -- 'card' o 'cash'
  'admin',                -- Médico independiente
  'pi_1234567890',        -- ID de Stripe (null si es cash)
  NOW(),
  NULL,                   -- Se llena después (opcional)
  NULL,                   -- No aplica para médico independiente
  NULL                    -- Se llena cuando admin paga
);
```

**Código TypeScript**:
```typescript
// En tu controlador de appointments cuando el paciente paga
async function registerPayment(appointmentId: string, amount: number, paymentMethod: 'card' | 'cash', stripePaymentIntentId?: string) {
  const prisma = getPrismaClient();
  
  // Obtener información de la cita
  const appointment = await prisma.appointments.findUnique({
    where: { id: appointmentId },
    include: {
      providers: {
        include: { users: true }
      }
    }
  });
  
  // Verificar si el médico está asociado a una clínica
  const clinicDoctor = await prisma.clinic_doctors.findFirst({
    where: { 
      user_id: appointment.providers.user_id,
      is_active: true 
    }
  });
  
  // Calcular comisión (solo para pagos con tarjeta)
  const platformFee = paymentMethod === 'card' ? amount * 0.15 : 0;
  const providerAmount = amount - platformFee;
  
  // Crear registro de pago
  const payment = await prisma.payments.create({
    data: {
      id: randomUUID(),
      appointment_id: appointmentId,
      amount_total: amount,
      platform_fee: platformFee,
      provider_amount: providerAmount,
      status: 'pending',
      payment_method: paymentMethod,
      payment_source: clinicDoctor ? 'clinic' : 'admin',
      clinic_id: clinicDoctor?.clinic_id || null,
      stripe_payment_intent_id: stripePaymentIntentId || null,
      created_at: new Date(),
    }
  });
  
  console.log('✅ Pago registrado:', payment.id);
  return payment;
}
```

---

### PASO 2: Admin Agrupa Pagos (OPCIONAL)

**Cuándo**: Admin decide agrupar varios pagos para hacer una sola transferencia

**Tabla**: `payouts`

```sql
INSERT INTO payouts (
  id,
  provider_id,
  total_amount,
  currency,
  status,
  reference_number,
  period_start,
  period_end,
  created_at,
  payout_type,
  paid_at
) VALUES (
  gen_random_uuid(),
  'provider-001',         -- ID del médico
  170.00,                 -- Suma de provider_amount de varios pagos
  'USD',
  'pending',
  'PAYOUT-2026-02-001',   -- Número de referencia
  '2026-02-01',           -- Inicio del período
  '2026-02-05',           -- Fin del período
  NOW(),
  'doctor',               -- Tipo de payout
  NULL                    -- Se llena cuando se paga
);

-- Actualizar los payments para referenciar este payout
UPDATE payments 
SET payout_id = 'payout-id-generado'
WHERE id IN ('pay-001', 'pay-002', 'pay-003');
```

**Código TypeScript**:
```typescript
async function createPayout(providerId: string, paymentIds: string[]) {
  const prisma = getPrismaClient();
  
  // Obtener los pagos
  const payments = await prisma.payments.findMany({
    where: { id: { in: paymentIds } }
  });
  
  // Calcular total
  const totalAmount = payments.reduce((sum, p) => sum + Number(p.provider_amount || 0), 0);
  
  // Crear payout
  const payout = await prisma.payouts.create({
    data: {
      id: randomUUID(),
      provider_id: providerId,
      total_amount: totalAmount,
      currency: 'USD',
      status: 'pending',
      reference_number: `PAYOUT-${new Date().getFullYear()}-${Date.now()}`,
      period_start: new Date(payments[0].created_at),
      period_end: new Date(),
      payout_type: 'doctor',
      created_at: new Date(),
    }
  });
  
  // Actualizar payments
  await prisma.payments.updateMany({
    where: { id: { in: paymentIds } },
    data: { payout_id: payout.id }
  });
  
  console.log('✅ Payout creado:', payout.id);
  return payout;
}
```

---

### PASO 3: Admin Marca Como Pagado

**Cuándo**: Admin realiza la transferencia bancaria al médico

**Tabla**: `payments` (actualizar)

```sql
-- Actualizar los pagos como pagados
UPDATE payments 
SET paid_at = NOW()
WHERE id IN ('pay-001', 'pay-002', 'pay-003');

-- Si se usó payout, también actualizarlo
UPDATE payouts 
SET paid_at = NOW(), status = 'paid'
WHERE id = 'payout-id';
```

**Código TypeScript** (ya implementado en `src/admin/payments.controller.ts`):
```typescript
// POST /api/admin/payments/doctors/:doctorId/mark-paid
async function markDoctorPaymentsAsPaid(doctorId: string, paymentIds: string[]) {
  const prisma = getPrismaClient();
  
  // Actualizar pagos
  await prisma.payments.updateMany({
    where: { id: { in: paymentIds } },
    data: { paid_at: new Date() }
  });
  
  console.log(`✅ ${paymentIds.length} pagos marcados como pagados`);
}
```

---

## 🔄 FLUJO 2: Médico Asociado a Clínica (Admin → Clínica → Médico)

### PASO 1: Paciente Paga la Cita en Clínica

**Cuándo**: Paciente completa el pago de su cita en una clínica

**Tabla**: `payments`

```sql
INSERT INTO payments (
  id,
  appointment_id,
  amount_total,
  platform_fee,
  provider_amount,
  status,
  payment_method,
  payment_source,
  clinic_id,
  stripe_payment_intent_id,
  created_at,
  payout_id,
  paid_at
) VALUES (
  gen_random_uuid(),
  'apt-002',              -- ID de la cita
  500.00,                 -- Monto total cobrado
  75.00,                  -- 15% comisión
  425.00,                 -- 85% para clínica
  'pending',
  'card',
  'clinic',               -- Pago va a clínica
  'clinic-001',           -- ID de la clínica
  'pi_0987654321',
  NOW(),
  NULL,
  NULL
);
```

**Código TypeScript**: (mismo que FLUJO 1 - PASO 1, detecta automáticamente si es clínica)

---

### PASO 2: Admin Agrupa Pagos de la Clínica

**Cuándo**: Admin agrupa todos los pagos de una clínica para transferir

**Tabla**: `payouts`

```sql
INSERT INTO payouts (
  id,
  provider_id,
  total_amount,
  currency,
  status,
  reference_number,
  period_start,
  period_end,
  created_at,
  payout_type,
  paid_at
) VALUES (
  gen_random_uuid(),
  'clinic-001',           -- ID de la clínica (va en provider_id)
  850.00,                 -- Suma de provider_amount de pagos de clínica
  'USD',
  'pending',
  'CLINIC-PAYOUT-2026-02-001',
  '2026-02-01',
  '2026-02-05',
  NOW(),
  'clinic',               -- Tipo de payout para clínica
  NULL
);

-- Actualizar los payments
UPDATE payments 
SET payout_id = 'payout-id-generado'
WHERE clinic_id = 'clinic-001' AND paid_at IS NULL;
```

**Código TypeScript**:
```typescript
async function createClinicPayout(clinicId: string) {
  const prisma = getPrismaClient();
  
  // Obtener pagos pendientes de la clínica
  const payments = await prisma.payments.findMany({
    where: {
      clinic_id: clinicId,
      payment_source: 'clinic',
      payout_id: null,
    }
  });
  
  // Calcular total
  const totalAmount = payments.reduce((sum, p) => sum + Number(p.provider_amount || 0), 0);
  
  // Crear payout
  const payout = await prisma.payouts.create({
    data: {
      id: randomUUID(),
      provider_id: clinicId,  // Para clínicas, usamos clinic_id aquí
      total_amount: totalAmount,
      currency: 'USD',
      status: 'pending',
      reference_number: `CLINIC-PAYOUT-${Date.now()}`,
      period_start: new Date(payments[0].created_at),
      period_end: new Date(),
      payout_type: 'clinic',
      created_at: new Date(),
    }
  });
  
  // Actualizar payments
  await prisma.payments.updateMany({
    where: { id: { in: payments.map(p => p.id) } },
    data: { payout_id: payout.id }
  });
  
  console.log('✅ Payout de clínica creado:', payout.id);
  return payout;
}
```

---

### PASO 3: Admin Paga a la Clínica

**Cuándo**: Admin realiza la transferencia bancaria a la clínica

**Tabla**: `payouts` (actualizar)

```sql
-- Marcar el payout como pagado
UPDATE payouts 
SET paid_at = NOW(), status = 'paid'
WHERE id = 'payout-id';
```

**Código TypeScript** (ya implementado en `src/admin/payments.controller.ts`):
```typescript
// POST /api/admin/payments/clinics/:clinicPaymentId/mark-paid
async function markClinicPaymentAsPaid(payoutId: string) {
  const prisma = getPrismaClient();
  
  await prisma.payouts.update({
    where: { id: payoutId },
    data: { 
      paid_at: new Date(),
      status: 'paid'
    }
  });
  
  console.log('✅ Pago a clínica marcado como pagado');
}
```

---

### PASO 4: Clínica Distribuye el Pago Entre Médicos

**Cuándo**: Clínica decide cómo distribuir el dinero recibido entre sus médicos

**Tabla**: `clinic_payment_distributions`

```sql
-- Crear distribución para cada médico
INSERT INTO clinic_payment_distributions (
  id,
  payout_id,
  doctor_id,
  amount,
  percentage,
  status,
  created_at,
  updated_at,
  paid_at
) VALUES 
(
  gen_random_uuid(),
  'payout-id',            -- ID del payout de la clínica
  'clinic-doctor-001',    -- ID del registro en clinic_doctors
  500.00,                 -- Monto asignado al médico
  58.82,                  -- Porcentaje del total (500/850 * 100)
  'pending',
  NOW(),
  NOW(),
  NULL
),
(
  gen_random_uuid(),
  'payout-id',
  'clinic-doctor-002',
  350.00,
  41.18,
  'pending',
  NOW(),
  NOW(),
  NULL
);
```

**Código TypeScript** (ya implementado en `src/clinics/payments.controller.ts`):
```typescript
// POST /api/clinics/payments/:id/distribute
async function distributePayment(payoutId: string, distribution: Array<{doctorId: string, amount: number}>) {
  const prisma = getPrismaClient();
  
  // Obtener payout
  const payout = await prisma.payouts.findUnique({
    where: { id: payoutId }
  });
  
  const netAmount = Number(payout.total_amount || 0);
  
  // Validar que no exceda el monto
  const totalDistribution = distribution.reduce((sum, d) => sum + d.amount, 0);
  if (totalDistribution > netAmount) {
    throw new Error('La suma de distribuciones excede el monto neto');
  }
  
  // Crear distribuciones
  for (const dist of distribution) {
    await prisma.clinic_payment_distributions.create({
      data: {
        id: randomUUID(),
        payout_id: payoutId,
        doctor_id: dist.doctorId,
        amount: dist.amount,
        percentage: (dist.amount / netAmount) * 100,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date(),
      }
    });
  }
  
  console.log(`✅ Pago distribuido entre ${distribution.length} médicos`);
}
```

---

### PASO 5: Clínica Paga a un Médico

**Cuándo**: Clínica realiza la transferencia bancaria a un médico específico

**Tabla**: `clinic_payment_distributions` (actualizar)

```sql
-- Marcar distribución como pagada
UPDATE clinic_payment_distributions 
SET paid_at = NOW(), status = 'paid'
WHERE id = 'distribution-id';
```

**Código TypeScript** (ya implementado en `src/clinics/payments.controller.ts`):
```typescript
// POST /api/clinics/doctors/:doctorId/pay
async function payDoctor(distributionId: string) {
  const prisma = getPrismaClient();
  
  await prisma.clinic_payment_distributions.update({
    where: { id: distributionId },
    data: {
      status: 'paid',
      paid_at: new Date(),
      updated_at: new Date(),
    }
  });
  
  console.log('✅ Pago a médico marcado como pagado');
}
```

---

## 📊 Resumen de Estados

### Tabla `payments`
- **`paid_at = NULL`**: Pago pendiente (admin no ha pagado)
- **`paid_at != NULL`**: Pago completado (admin ya pagó)

### Tabla `payouts`
- **`status = 'pending'`**: Transferencia pendiente
- **`status = 'paid'`**: Transferencia completada
- **`paid_at != NULL`**: Fecha de pago

### Tabla `clinic_payment_distributions`
- **`status = 'pending'`**: Clínica no ha pagado al médico
- **`status = 'paid'`**: Clínica ya pagó al médico
- **`paid_at != NULL`**: Fecha de pago

---

## 🔍 Consultas Útiles

### Ver pagos pendientes de un médico independiente:
```sql
SELECT 
  p.id,
  p.amount_total,
  p.provider_amount,
  p.payment_method,
  p.created_at,
  a.scheduled_for,
  u.email as patient_email
FROM payments p
JOIN appointments a ON p.appointment_id = a.id
JOIN patients pat ON a.patient_id = pat.id
JOIN users u ON pat.user_id = u.id
WHERE p.payment_source = 'admin'
  AND p.paid_at IS NULL
  AND a.provider_id = 'doctor-id';
```

### Ver pagos pendientes de una clínica:
```sql
SELECT 
  po.id as payout_id,
  po.total_amount,
  po.created_at,
  COUNT(p.id) as num_payments
FROM payouts po
JOIN payments p ON p.payout_id = po.id
WHERE po.provider_id = 'clinic-id'
  AND po.payout_type = 'clinic'
  AND po.paid_at IS NULL
GROUP BY po.id;
```

### Ver distribuciones pendientes de una clínica:
```sql
SELECT 
  cpd.id,
  cd.name as doctor_name,
  cpd.amount,
  cpd.percentage,
  cpd.status,
  cpd.created_at
FROM clinic_payment_distributions cpd
JOIN clinic_doctors cd ON cpd.doctor_id = cd.id
WHERE cpd.payout_id = 'payout-id'
  AND cpd.status = 'pending';
```

---

## ✅ Checklist de Implementación

### Cuando Paciente Paga:
- [ ] Crear registro en `payments`
- [ ] Calcular `platform_fee` (15% si es tarjeta)
- [ ] Calcular `provider_amount`
- [ ] Determinar `payment_source` (admin o clinic)
- [ ] Llenar `clinic_id` si aplica

### Cuando Admin Paga a Médico:
- [ ] Actualizar `paid_at` en `payments`
- [ ] Opcionalmente crear `payout` para agrupar

### Cuando Admin Paga a Clínica:
- [ ] Crear `payout` con `payout_type='clinic'`
- [ ] Actualizar `paid_at` en `payout`

### Cuando Clínica Distribuye:
- [ ] Crear registros en `clinic_payment_distributions`
- [ ] Validar que suma no exceda `total_amount`
- [ ] Calcular `percentage` de cada médico

### Cuando Clínica Paga a Médico:
- [ ] Actualizar `paid_at` en `clinic_payment_distributions`
- [ ] Cambiar `status` a 'paid'

---

¡Todo el flujo de datos documentado! 🎉
