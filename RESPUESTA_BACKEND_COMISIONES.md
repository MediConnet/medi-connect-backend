# ✅ Endpoints de Configuración de Comisiones Implementados

## 📋 Resumen

He implementado los 2 endpoints que necesitas para guardar y obtener la configuración de comisiones del sistema.

---

## 🎯 Endpoints Implementados

### 1. GET /api/admin/settings
**Propósito:** Obtener la configuración actual de comisiones y settings del sistema

**Headers:**
```
Authorization: Bearer {admin_token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "commissionDoctor": 15,
    "commissionClinic": 10,
    "commissionLaboratory": 12,
    "commissionPharmacy": 8,
    "commissionSupplies": 10,
    "commissionAmbulance": 15,
    "notifyNewRequests": true,
    "notifyEmailSummary": true,
    "autoApproveServices": false,
    "maintenanceMode": false,
    "onlyAdminCanPublishAds": true,
    "requireAdApproval": true,
    "maxAdsPerProvider": 1,
    "adApprovalRequired": true,
    "serviceApprovalRequired": true,
    "allowServiceSelfActivation": false,
    "allowAdSelfPublishing": false
  }
}
```

**Notas:**
- Si no existe configuración, se crea automáticamente con valores por defecto
- Solo accesible para usuarios con rol `admin`

---

### 2. PUT /api/admin/settings
**Propósito:** Actualizar la configuración del sistema

**Headers:**
```
Authorization: Bearer {admin_token}
Content-Type: application/json
```

**Request Body (todos los campos son opcionales):**
```json
{
  "commissionDoctor": 18,
  "commissionClinic": 12,
  "commissionLaboratory": 14,
  "commissionPharmacy": 9,
  "commissionSupplies": 11,
  "commissionAmbulance": 16,
  "notifyNewRequests": true,
  "notifyEmailSummary": false,
  "autoApproveServices": false,
  "maintenanceMode": false,
  "onlyAdminCanPublishAds": true,
  "requireAdApproval": true,
  "maxAdsPerProvider": 2,
  "adApprovalRequired": true,
  "serviceApprovalRequired": true,
  "allowServiceSelfActivation": false,
  "allowAdSelfPublishing": false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Configuración actualizada correctamente",
  "data": {
    "commissionDoctor": 18,
    "commissionClinic": 12,
    // ... todos los settings actualizados
  }
}
```

**Validaciones:**
- Las comisiones deben estar entre 0 y 100
- `maxAdsPerProvider` debe ser un entero positivo
- Solo accesible para usuarios con rol `admin`

**Notas:**
- Puedes enviar solo los campos que quieres actualizar (actualización parcial)
- Los campos no enviados mantienen su valor actual

---

## 🗄️ Base de Datos

### Tabla Creada: `admin_settings`

```sql
CREATE TABLE "admin_settings" (
  "id" INTEGER PRIMARY KEY DEFAULT 1,
  "commission_doctor" DECIMAL(5,2) DEFAULT 15.00,
  "commission_clinic" DECIMAL(5,2) DEFAULT 10.00,
  "commission_laboratory" DECIMAL(5,2) DEFAULT 12.00,
  "commission_pharmacy" DECIMAL(5,2) DEFAULT 8.00,
  "commission_supplies" DECIMAL(5,2) DEFAULT 10.00,
  "commission_ambulance" DECIMAL(5,2) DEFAULT 15.00,
  "notify_new_requests" BOOLEAN DEFAULT TRUE,
  "notify_email_summary" BOOLEAN DEFAULT TRUE,
  "auto_approve_services" BOOLEAN DEFAULT FALSE,
  "maintenance_mode" BOOLEAN DEFAULT FALSE,
  "only_admin_can_publish_ads" BOOLEAN DEFAULT TRUE,
  "require_ad_approval" BOOLEAN DEFAULT TRUE,
  "max_ads_per_provider" INTEGER DEFAULT 1,
  "ad_approval_required" BOOLEAN DEFAULT TRUE,
  "service_approval_required" BOOLEAN DEFAULT TRUE,
  "allow_service_self_activation" BOOLEAN DEFAULT FALSE,
  "allow_ad_self_publishing" BOOLEAN DEFAULT FALSE,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_settings_id_check" CHECK ("id" = 1)
);
```

**Características:**
- Solo puede haber UN registro (id = 1) que contiene toda la configuración global
- Se crea automáticamente con valores por defecto al hacer el primer GET
- El constraint asegura que no se puedan crear múltiples registros

---

## 📁 Archivos Creados/Modificados

### Nuevos Archivos:
1. `src/admin/settings.controller.ts` - Controlador con la lógica de los endpoints
2. `prisma/migrations/20260313_add_admin_settings/migration.sql` - Migración SQL
3. `test/test-admin-settings.ts` - Tests para verificar funcionamiento

### Archivos Modificados:
1. `src/admin/handler.ts` - Agregadas rutas para GET y PUT /api/admin/settings
2. `prisma/schema.prisma` - Agregado modelo `admin_settings`

---

## 🧪 Testing

He creado un archivo de prueba en `test/test-admin-settings.ts` que puedes ejecutar con:

```bash
npx ts-node test/test-admin-settings.ts
```

**Nota:** Necesitas reemplazar el token de admin en el archivo de test con uno válido.

Los tests verifican:
- ✅ GET inicial (crea valores por defecto)
- ✅ UPDATE completo
- ✅ GET después de actualizar
- ✅ UPDATE parcial (solo algunos campos)
- ✅ Verificación de persistencia de datos

---

## 🎨 Ejemplo de Uso desde el Frontend

### Obtener configuración:
```typescript
const response = await fetch('https://api.docalink.com/api/admin/settings', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const { data } = await response.json();
console.log('Comisión Doctor:', data.commissionDoctor);
```

### Actualizar configuración:
```typescript
const response = await fetch('https://api.docalink.com/api/admin/settings', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    commissionDoctor: 18,
    commissionClinic: 12,
    maintenanceMode: false,
  }),
});

const { data, message } = await response.json();
console.log(message); // "Configuración actualizada correctamente"
```

---

## ✅ Próximos Pasos para el Frontend

Ahora puedes:

1. ✅ Crear el archivo API en el frontend (`dashboard.api.ts`)
2. ✅ Crear el use case para guardar settings
3. ✅ Actualizar el hook `useAdminSettings` para usar el backend real
4. ✅ Conectar el botón "Guardar" al backend
5. ✅ Remover los mocks de `settings.mock.ts`

---

## 🔒 Seguridad

- ✅ Solo usuarios con rol `admin` pueden acceder a estos endpoints
- ✅ Validación de datos con Zod
- ✅ Constraint en BD para evitar múltiples registros
- ✅ Logs detallados para debugging

---

## 📊 Valores por Defecto

Si no existe configuración, se crean estos valores:

| Campo | Valor por Defecto |
|-------|-------------------|
| Commission Doctor | 15% |
| Commission Clinic | 10% |
| Commission Laboratory | 12% |
| Commission Pharmacy | 8% |
| Commission Supplies | 10% |
| Commission Ambulance | 15% |
| Notify New Requests | true |
| Notify Email Summary | true |
| Auto Approve Services | false |
| Maintenance Mode | false |
| Only Admin Can Publish Ads | true |
| Require Ad Approval | true |
| Max Ads Per Provider | 1 |
| Ad Approval Required | true |
| Service Approval Required | true |
| Allow Service Self Activation | false |
| Allow Ad Self Publishing | false |

---

¿Necesitas ayuda con la integración en el frontend o alguna modificación en los endpoints?
