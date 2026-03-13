# 🚨 URGENTE: Backend debe crear endpoints de Settings

## Problema

El backend **NO tiene implementados** los endpoints para guardar y obtener la configuración de comisiones.

Por eso cuando guardas las comisiones, no se persisten en la base de datos.

## ✅ Endpoints que el Backend DEBE Implementar

### 1. GET /api/admin/settings

**Descripción:** Obtener la configuración actual de comisiones

**Request:**
```
GET /api/admin/settings
Authorization: Bearer {token}
```

**Response:**
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

### 2. PUT /api/admin/settings

**Descripción:** Guardar la configuración de comisiones en la base de datos

**Request:**
```
PUT /api/admin/settings
Authorization: Bearer {token}
Content-Type: application/json

{
  "commissionDoctor": 20,
  "commissionClinic": 15,
  "commissionLaboratory": 12,
  "commissionPharmacy": 10,
  "commissionSupplies": 10,
  "commissionAmbulance": 12,
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
```

**Response:**
```json
{
  "success": true,
  "data": {
    "commissionDoctor": 20,
    "commissionClinic": 15,
    "commissionLaboratory": 12,
    "commissionPharmacy": 10,
    "commissionSupplies": 10,
    "commissionAmbulance": 12,
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

## 📋 Estructura de la Tabla en la Base de Datos

El backend debe crear una tabla `admin_settings` con esta estructura:

```sql
CREATE TABLE admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Comisiones (porcentajes)
  commission_doctor DECIMAL(5,2) DEFAULT 15.00,
  commission_clinic DECIMAL(5,2) DEFAULT 10.00,
  commission_laboratory DECIMAL(5,2) DEFAULT 12.00,
  commission_pharmacy DECIMAL(5,2) DEFAULT 8.00,
  commission_supplies DECIMAL(5,2) DEFAULT 10.00,
  commission_ambulance DECIMAL(5,2) DEFAULT 15.00,
  
  -- Configuraciones booleanas
  notify_new_requests BOOLEAN DEFAULT true,
  notify_email_summary BOOLEAN DEFAULT true,
  auto_approve_services BOOLEAN DEFAULT false,
  maintenance_mode BOOLEAN DEFAULT false,
  only_admin_can_publish_ads BOOLEAN DEFAULT true,
  require_ad_approval BOOLEAN DEFAULT true,
  allow_service_self_activation BOOLEAN DEFAULT false,
  allow_ad_self_publishing BOOLEAN DEFAULT false,
  
  -- Configuraciones numéricas
  max_ads_per_provider INTEGER DEFAULT 1,
  
  -- Metadatos
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insertar configuración por defecto
INSERT INTO admin_settings (id) VALUES ('00000000-0000-0000-0000-000000000001');
```

## 🎯 Lógica del Backend

### GET /api/admin/settings
```typescript
// Pseudocódigo
async function getAdminSettings(req, res) {
  // 1. Verificar que el usuario es admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  
  // 2. Obtener settings de la BD (siempre hay un solo registro)
  const settings = await db.query(
    'SELECT * FROM admin_settings WHERE id = $1',
    ['00000000-0000-0000-0000-000000000001']
  );
  
  // 3. Convertir snake_case a camelCase
  const data = {
    commissionDoctor: settings.commission_doctor,
    commissionClinic: settings.commission_clinic,
    commissionLaboratory: settings.commission_laboratory,
    commissionPharmacy: settings.commission_pharmacy,
    commissionSupplies: settings.commission_supplies,
    commissionAmbulance: settings.commission_ambulance,
    notifyNewRequests: settings.notify_new_requests,
    notifyEmailSummary: settings.notify_email_summary,
    autoApproveServices: settings.auto_approve_services,
    maintenanceMode: settings.maintenance_mode,
    onlyAdminCanPublishAds: settings.only_admin_can_publish_ads,
    requireAdApproval: settings.require_ad_approval,
    maxAdsPerProvider: settings.max_ads_per_provider,
    adApprovalRequired: settings.require_ad_approval,
    serviceApprovalRequired: settings.auto_approve_services === false,
    allowServiceSelfActivation: settings.allow_service_self_activation,
    allowAdSelfPublishing: settings.allow_ad_self_publishing
  };
  
  return res.json({ success: true, data });
}
```

### PUT /api/admin/settings
```typescript
// Pseudocódigo
async function updateAdminSettings(req, res) {
  // 1. Verificar que el usuario es admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  
  // 2. Extraer datos del body
  const {
    commissionDoctor,
    commissionClinic,
    commissionLaboratory,
    commissionPharmacy,
    commissionSupplies,
    commissionAmbulance,
    notifyNewRequests,
    notifyEmailSummary,
    autoApproveServices,
    maintenanceMode,
    onlyAdminCanPublishAds,
    requireAdApproval,
    maxAdsPerProvider,
    allowServiceSelfActivation,
    allowAdSelfPublishing
  } = req.body;
  
  // 3. Actualizar en la BD
  await db.query(`
    UPDATE admin_settings 
    SET 
      commission_doctor = $1,
      commission_clinic = $2,
      commission_laboratory = $3,
      commission_pharmacy = $4,
      commission_supplies = $5,
      commission_ambulance = $6,
      notify_new_requests = $7,
      notify_email_summary = $8,
      auto_approve_services = $9,
      maintenance_mode = $10,
      only_admin_can_publish_ads = $11,
      require_ad_approval = $12,
      max_ads_per_provider = $13,
      allow_service_self_activation = $14,
      allow_ad_self_publishing = $15,
      updated_at = NOW()
    WHERE id = $16
  `, [
    commissionDoctor,
    commissionClinic,
    commissionLaboratory,
    commissionPharmacy,
    commissionSupplies,
    commissionAmbulance,
    notifyNewRequests,
    notifyEmailSummary,
    autoApproveServices,
    maintenanceMode,
    onlyAdminCanPublishAds,
    requireAdApproval,
    maxAdsPerProvider,
    allowServiceSelfActivation,
    allowAdSelfPublishing,
    '00000000-0000-0000-0000-000000000001'
  ]);
  
  // 4. Retornar los datos actualizados
  const updated = await getAdminSettings(req, res);
  return res.json({ success: true, data: updated });
}
```

## ✅ Verificación

Una vez implementado, prueba con:

```bash
# GET
curl -X GET https://api.docalink.com/api/admin/settings \
  -H "Authorization: Bearer {token}"

# PUT
curl -X PUT https://api.docalink.com/api/admin/settings \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "commissionDoctor": 20,
    "commissionClinic": 15,
    "commissionLaboratory": 12,
    "commissionPharmacy": 10,
    "commissionSupplies": 10,
    "commissionAmbulance": 12
  }'
```

---

**Frontend:** ✅ Ya está listo y esperando estos endpoints
**Backend:** ❌ Debe implementar estos 2 endpoints
