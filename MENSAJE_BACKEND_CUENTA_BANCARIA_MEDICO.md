# 📋 Backend: Cuenta Bancaria del Médico Asociado a Clínica

Hola equipo! 👋

Hemos agregado una funcionalidad para que los médicos asociados a clínicas puedan registrar sus datos bancarios. La clínica necesita estos datos para saber dónde depositar los pagos del médico.

---

## 🎯 Endpoints Nuevos Requeridos

### 1. GET /api/doctors/bank-account

**Descripción:** Obtener los datos bancarios del médico autenticado.

**Request:**
```http
GET http://localhost:3000/api/doctors/bank-account
Authorization: Bearer {token_del_medico}
```

**Response Exitoso (200):**
```json
{
  "success": true,
  "data": {
    "bankName": "Banco Pichincha",
    "accountNumber": "2100123456",
    "accountType": "checking",
    "accountHolder": "Dr. Juan Pérez",
    "identificationNumber": "1234567890"
  }
}
```

**Response Sin Datos (404 o 200 con data: null):**
```json
{
  "success": true,
  "data": null
}
```

---

### 2. PUT /api/doctors/bank-account

**Descripción:** Crear o actualizar los datos bancarios del médico autenticado.

**Request:**
```http
PUT http://localhost:3000/api/doctors/bank-account
Authorization: Bearer {token_del_medico}
Content-Type: application/json

{
  "bankName": "Banco Pichincha",
  "accountNumber": "2100123456",
  "accountType": "checking",
  "accountHolder": "Dr. Juan Pérez",
  "identificationNumber": "1234567890"
}
```

**Response Exitoso (200):**
```json
{
  "success": true,
  "data": {
    "bankName": "Banco Pichincha",
    "accountNumber": "2100123456",
    "accountType": "checking",
    "accountHolder": "Dr. Juan Pérez",
    "identificationNumber": "1234567890"
  }
}
```

---

## 📊 Estructura de Datos

### Campos del Request/Response

| Campo | Tipo | Requerido | Descripción | Validación |
|-------|------|-----------|-------------|------------|
| `bankName` | string | Sí | Nombre del banco | Texto libre |
| `accountNumber` | string | Sí | Número de cuenta | Mínimo 10 dígitos, solo números |
| `accountType` | string | Sí | Tipo de cuenta | Solo "checking" o "savings" |
| `accountHolder` | string | Sí | Titular de la cuenta | Texto libre |
| `identificationNumber` | string | Opcional | Cédula o RUC | 10-13 dígitos, solo números |

### Valores Válidos para accountType
- `"checking"` = Cuenta Corriente
- `"savings"` = Cuenta de Ahorros

---

## 🗄️ Estructura en Base de Datos

### Opción 1: Columnas en tabla de médicos
```sql
ALTER TABLE doctors 
ADD COLUMN bank_name VARCHAR(100),
ADD COLUMN account_number VARCHAR(50),
ADD COLUMN account_type VARCHAR(20),
ADD COLUMN account_holder VARCHAR(200),
ADD COLUMN identification_number VARCHAR(13);
```

### Opción 2: Tabla separada (recomendado)
```sql
CREATE TABLE doctor_bank_accounts (
  id SERIAL PRIMARY KEY,
  doctor_id INTEGER REFERENCES doctors(id) UNIQUE,
  bank_name VARCHAR(100) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('checking', 'savings')),
  account_holder VARCHAR(200) NOT NULL,
  identification_number VARCHAR(13),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## ✅ Validaciones del Backend

### bankName
- Requerido
- Máximo 100 caracteres

### accountNumber
- Requerido
- Mínimo 10 caracteres
- Solo números (sin guiones ni espacios)
- Máximo 50 caracteres

### accountType
- Requerido
- Solo valores: "checking" o "savings"

### accountHolder
- Requerido
- Máximo 200 caracteres

### identificationNumber
- Opcional
- Si se envía: 10-13 dígitos
- Solo números

---

## 🔐 Seguridad

1. **Autenticación:** Solo el médico autenticado puede ver/editar sus propios datos
2. **Autorización:** Verificar que el token pertenece a un médico
3. **Validación:** Validar todos los campos antes de guardar
4. **Encriptación:** Considerar encriptar el número de cuenta en la base de datos

---

## 🧪 Testing

### Médico de Prueba:
```
Email: dr.juan.perez@clinicacentral.com
Password: doctor123
```

### Flujo de Prueba:

1. **Login como médico:**
```http
POST http://localhost:3000/api/auth/login
{
  "email": "dr.juan.perez@clinicacentral.com",
  "password": "doctor123"
}
```

2. **Obtener datos bancarios (primera vez - debe retornar null o 404):**
```http
GET http://localhost:3000/api/doctors/bank-account
Authorization: Bearer {token}
```

3. **Crear datos bancarios:**
```http
PUT http://localhost:3000/api/doctors/bank-account
Authorization: Bearer {token}
{
  "bankName": "Banco Pichincha",
  "accountNumber": "2100123456",
  "accountType": "checking",
  "accountHolder": "Dr. Juan Pérez",
  "identificationNumber": "1234567890"
}
```

4. **Obtener datos bancarios (debe retornar los datos guardados):**
```http
GET http://localhost:3000/api/doctors/bank-account
Authorization: Bearer {token}
```

5. **Actualizar datos bancarios:**
```http
PUT http://localhost:3000/api/doctors/bank-account
Authorization: Bearer {token}
{
  "bankName": "Banco del Pacífico",
  "accountNumber": "9876543210",
  "accountType": "savings",
  "accountHolder": "Dr. Juan Pérez",
  "identificationNumber": "1234567890"
}
```

---

## 🚨 Casos Especiales

### Médico NO asociado a clínica
- Los endpoints deben funcionar igual
- Todos los médicos pueden tener cuenta bancaria (no solo los de clínica)

### Médico sin datos bancarios
- GET debe retornar `null` o `404` (preferible `200` con `data: null`)
- PUT crea los datos por primera vez

### Actualización de datos
- PUT actualiza los datos existentes
- No es necesario un endpoint DELETE (el médico siempre debe tener datos)

---

## 📝 Ejemplo de Implementación (Pseudocódigo)

### GET /api/doctors/bank-account
```javascript
async getBankAccount(req, res) {
  const doctorId = req.user.id; // Del token JWT
  
  const bankAccount = await db.query(
    'SELECT * FROM doctor_bank_accounts WHERE doctor_id = $1',
    [doctorId]
  );
  
  if (!bankAccount) {
    return res.json({ success: true, data: null });
  }
  
  return res.json({
    success: true,
    data: {
      bankName: bankAccount.bank_name,
      accountNumber: bankAccount.account_number,
      accountType: bankAccount.account_type,
      accountHolder: bankAccount.account_holder,
      identificationNumber: bankAccount.identification_number
    }
  });
}
```

### PUT /api/doctors/bank-account
```javascript
async updateBankAccount(req, res) {
  const doctorId = req.user.id; // Del token JWT
  const { bankName, accountNumber, accountType, accountHolder, identificationNumber } = req.body;
  
  // Validaciones
  if (!bankName || !accountNumber || !accountType || !accountHolder) {
    return res.status(400).json({ success: false, error: 'Campos requeridos faltantes' });
  }
  
  if (!['checking', 'savings'].includes(accountType)) {
    return res.status(400).json({ success: false, error: 'Tipo de cuenta inválido' });
  }
  
  // Upsert (crear o actualizar)
  const bankAccount = await db.query(`
    INSERT INTO doctor_bank_accounts (doctor_id, bank_name, account_number, account_type, account_holder, identification_number)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (doctor_id) 
    DO UPDATE SET 
      bank_name = $2,
      account_number = $3,
      account_type = $4,
      account_holder = $5,
      identification_number = $6,
      updated_at = NOW()
    RETURNING *
  `, [doctorId, bankName, accountNumber, accountType, accountHolder, identificationNumber]);
  
  return res.json({
    success: true,
    data: {
      bankName: bankAccount.bank_name,
      accountNumber: bankAccount.account_number,
      accountType: bankAccount.account_type,
      accountHolder: bankAccount.account_holder,
      identificationNumber: bankAccount.identification_number
    }
  });
}
```

---

## 🔗 Relación con Otros Endpoints

### Para la Clínica (futuro):
La clínica necesitará un endpoint para ver los datos bancarios de sus médicos:

```http
GET /api/clinics/doctors/{doctorId}/bank-account
```

Esto permitirá que la clínica vea dónde depositar los pagos de cada médico.

---

## 📌 Resumen

**¿Qué hacer?**
1. Crear tabla `doctor_bank_accounts` (o agregar columnas a `doctors`)
2. Implementar `GET /api/doctors/bank-account`
3. Implementar `PUT /api/doctors/bank-account`
4. Validar todos los campos
5. Asegurar que solo el médico autenticado puede ver/editar sus datos

**¿Quién puede usar estos endpoints?**
- Cualquier médico autenticado (asociado o no a clínica)

**¿Es obligatorio?**
- No, el médico puede no tener datos bancarios
- GET debe retornar `null` si no hay datos

---

## 💬 ¿Dudas?

Si tienen preguntas sobre:
- La estructura de datos
- Las validaciones
- Casos especiales
- Seguridad

¡Avisen! 🚀

---

**Fecha:** 2026-02-06  
**Prioridad:** Media  
**Endpoints Nuevos:** 
- GET /api/doctors/bank-account
- PUT /api/doctors/bank-account
