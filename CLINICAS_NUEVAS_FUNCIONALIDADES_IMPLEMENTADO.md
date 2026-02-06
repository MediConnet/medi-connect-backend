# ✅ Nuevas Funcionalidades de Clínicas - Implementado

**Fecha**: 6 de febrero de 2026  
**Estado**: ✅ Completado

---

## 📋 Resumen

Se implementaron dos nuevas funcionalidades para el perfil de clínicas:

1. **Precios por Especialidad** (`consultationPrices`)
2. **Datos Bancarios** (`bankAccount`)

---

## 🗄️ Cambios en la Base de Datos

### Migración Aplicada

**Archivo**: `prisma/migrations/20260206_add_clinic_prices_and_bank/migration.sql`

```sql
-- Add consultation_prices column (JSON array)
ALTER TABLE clinics 
ADD COLUMN consultation_prices JSON DEFAULT '[]'::json;

-- Add bank_account column (JSON object)
ALTER TABLE clinics 
ADD COLUMN bank_account JSON DEFAULT NULL;
```

### Schema de Prisma Actualizado

```prisma
model clinics {
  // ... campos existentes ...
  consultation_prices  Json?  @default("[]")
  bank_account         Json?
  // ... relaciones ...
}
```

---

## 🔧 Cambios en el Código

### 1. Validators (`src/shared/validators.ts`)

Se agregaron dos nuevos schemas:

```typescript
// Schema para precios por especialidad
const consultationPriceSchema = z.object({
  specialty: z.string().min(1, 'Specialty is required'),
  price: z.number().min(0, 'Price must be >= 0'),
  isActive: z.boolean(),
});

// Schema para datos bancarios
const bankAccountSchema = z.object({
  bankName: z.string().min(1, 'Bank name is required'),
  accountNumber: z.string().min(10, 'Account number must be at least 10 digits'),
  accountType: z.enum(['checking', 'savings']),
  accountHolder: z.string().min(1, 'Account holder is required'),
  identificationNumber: z.string().min(10).max(13),
});
```

Y se actualizó el schema de actualización de perfil:

```typescript
export const updateClinicProfileSchema = z.object({
  // ... campos existentes ...
  consultationPrices: z.array(consultationPriceSchema).optional(),
  bankAccount: bankAccountSchema.optional().nullable(),
});
```

### 2. Profile Controller (`src/clinics/profile.controller.ts`)

#### GET /api/clinics/profile

Ahora devuelve los nuevos campos:

```typescript
{
  // ... campos existentes ...
  consultationPrices: clinic.consultation_prices || [],
  bankAccount: clinic.bank_account || null,
}
```

#### PUT /api/clinics/profile

Acepta y guarda los nuevos campos:

```typescript
// Validación de precios por especialidad
if (body.consultationPrices !== undefined) {
  // Valida que las especialidades existan en el array de specialties
  if (body.specialties) {
    const validSpecialties = body.specialties;
    const invalidPrices = body.consultationPrices.filter(
      (price: any) => !validSpecialties.includes(price.specialty)
    );
    if (invalidPrices.length > 0) {
      throw new Error(`Invalid specialties in consultationPrices`);
    }
  }
  clinicUpdateData.consultation_prices = body.consultationPrices;
}

// Datos bancarios
if (body.bankAccount !== undefined) {
  clinicUpdateData.bank_account = body.bankAccount;
}
```

---

## 📡 Endpoints Actualizados

### GET /api/clinics/profile

**Respuesta actualizada**:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Clínica Central",
    "logoUrl": "https://...",
    "specialties": ["Cardiología", "Pediatría"],
    "address": "Av. Principal 123",
    "phone": "0999999999",
    "whatsapp": "0999999999",
    "generalSchedule": { ... },
    "description": "...",
    "isActive": true,
    
    // ✨ NUEVOS CAMPOS
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
      }
    ],
    "bankAccount": {
      "bankName": "Banco Pichincha",
      "accountNumber": "2100123456",
      "accountType": "checking",
      "accountHolder": "Clínica Central S.A.",
      "identificationNumber": "1792345678001"
    },
    
    "createdAt": "2026-02-06T...",
    "updatedAt": "2026-02-06T..."
  }
}
```

### PUT /api/clinics/profile

**Request Body** (campos opcionales):

```json
{
  "name": "Clínica Central",
  "specialties": ["Cardiología", "Pediatría"],
  
  // ✨ NUEVOS CAMPOS
  "consultationPrices": [
    {
      "specialty": "Cardiología",
      "price": 60.00,
      "isActive": true
    }
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

## ✅ Validaciones Implementadas

### Consultation Prices

- ✅ `price` debe ser >= 0
- ✅ `specialty` debe existir en el array `specialties`
- ✅ `isActive` debe ser booleano

### Bank Account

- ✅ `accountNumber` mínimo 10 dígitos
- ✅ `identificationNumber` entre 10-13 dígitos (RUC o cédula)
- ✅ `accountType` solo acepta "checking" o "savings"
- ✅ Todos los campos son requeridos si se envía `bankAccount`

---

## 🔒 Seguridad

### Datos Bancarios

- ✅ Solo visible para la clínica propietaria (autenticación requerida)
- ✅ Admin puede ver los datos bancarios (para procesar pagos)
- ✅ Otros usuarios NO pueden ver datos bancarios de otras clínicas

---

## 🧪 Testing

### Test Manual

```bash
# 1. Login como clínica
POST /api/auth/login
{
  "email": "clinic@medicones.com",
  "password": "clinic123"
}

# 2. Obtener perfil actual
GET /api/clinics/profile
Authorization: Bearer {token}

# 3. Actualizar con nuevos campos
PUT /api/clinics/profile
Authorization: Bearer {token}
{
  "consultationPrices": [
    {
      "specialty": "Cardiología",
      "price": 60.00,
      "isActive": true
    }
  ],
  "bankAccount": {
    "bankName": "Banco Pichincha",
    "accountNumber": "2100123456",
    "accountType": "checking",
    "accountHolder": "Clínica Central S.A.",
    "identificationNumber": "1792345678001"
  }
}

# 4. Verificar que se guardó
GET /api/clinics/profile
Authorization: Bearer {token}
```

---

## 📊 Estructura de Datos

### consultationPrices (JSON Array)

```json
[
  {
    "specialty": "string",    // Nombre de la especialidad
    "price": number,          // Precio >= 0
    "isActive": boolean       // Si está activo o no
  }
]
```

**Ejemplo**:
```json
[
  { "specialty": "Cardiología", "price": 60.00, "isActive": true },
  { "specialty": "Pediatría", "price": 45.00, "isActive": true },
  { "specialty": "Dermatología", "price": 50.00, "isActive": false }
]
```

### bankAccount (JSON Object)

```json
{
  "bankName": "string",              // Nombre del banco
  "accountNumber": "string",         // Número de cuenta (min 10 dígitos)
  "accountType": "checking|savings", // Tipo de cuenta
  "accountHolder": "string",         // Titular de la cuenta
  "identificationNumber": "string"   // RUC o cédula (10-13 dígitos)
}
```

**Ejemplo**:
```json
{
  "bankName": "Banco Pichincha",
  "accountNumber": "2100123456",
  "accountType": "checking",
  "accountHolder": "Clínica Central S.A.",
  "identificationNumber": "1792345678001"
}
```

---

## 🚀 Estado de Implementación

| Funcionalidad | Estado | Notas |
|--------------|--------|-------|
| Migración BD | ✅ Completado | Columnas JSON agregadas |
| Schema Prisma | ✅ Completado | Tipos Json? agregados |
| Validators | ✅ Completado | Schemas de validación creados |
| GET Profile | ✅ Completado | Devuelve nuevos campos |
| PUT Profile | ✅ Completado | Acepta y valida nuevos campos |
| Validación Especialidades | ✅ Completado | Verifica que specialty exista |
| Seguridad | ✅ Completado | Solo clínica y admin pueden ver |

---

## 📝 Notas Importantes

1. **Campos Opcionales**: Ambos campos son opcionales. Si no se envían, se mantienen los valores actuales.

2. **Compatibilidad**: Los cambios son retrocompatibles. Clínicas existentes tendrán:
   - `consultationPrices`: `[]` (array vacío)
   - `bankAccount`: `null`

3. **Validación de Especialidades**: Al actualizar `consultationPrices`, el sistema verifica que cada especialidad exista en el array `specialties` de la clínica.

4. **Datos Sensibles**: Los datos bancarios son sensibles y solo deben ser visibles para:
   - La clínica propietaria
   - Administradores del sistema

---

## 🔄 Próximos Pasos (Pendientes)

### Agenda y Recepción (Usando mocks en frontend)

Cuando estén listos, implementar:

1. **GET /api/clinics/appointments**
   - Lista de citas con: paciente, médico, fecha, hora, estado, receptionStatus

2. **GET /api/clinics/reception-messages**
   - Mensajes entre recepción y médicos

3. **POST /api/clinics/reception-messages**
   - Crear nuevo mensaje

---

## ✅ Checklist de Verificación

- [x] Migración de BD ejecutada
- [x] Schema de Prisma actualizado
- [x] Cliente de Prisma regenerado
- [x] Validators actualizados
- [x] GET /api/clinics/profile devuelve nuevos campos
- [x] PUT /api/clinics/profile acepta nuevos campos
- [x] Validación de precios por especialidad
- [x] Validación de datos bancarios
- [x] Documentación creada

---

**Implementado por**: Backend Team  
**Fecha**: 6 de febrero de 2026  
**Versión**: 1.0.0
