# 📊 Problema: Comisiones No se Guardan

## 🐛 Problema Detectado

Cuando edito las comisiones y hago clic en "Guardar", los cambios NO se persisten en la base de datos. Al refrescar la página, vuelven a los valores anteriores.

## 🔍 Causa del Problema

El frontend actualmente usa **datos mock** (falsos) en lugar de llamar al backend real.

**Archivo:** `src/features/admin-dashboard/infrastructure/settings.mock.ts`

```typescript
export const MOCK_ADMIN_SETTINGS: AdminSettings = {
  commissionDoctor: 15,
  commissionClinic: 10,
  commissionLaboratory: 12,
  commissionPharmacy: 8,
  commissionSupplies: 10,
  commissionAmbulance: 15,
  // ... otros settings
};
```

El botón "Guardar" en el frontend NO está conectado al backend (tiene un `// TODO: Implementar guardado en backend`).

---

## ✅ Solución Necesaria

Necesito que el backend implemente estos 2 endpoints:

### 1. GET /api/admin/settings
**Propósito:** Obtener la configuración actual de comisiones

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
**Propósito:** Guardar/actualizar la configuración de comisiones

**Request Body:**
```json
{
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
```

**Response:**
```json
{
  "success": true,
  "message": "Configuración actualizada correctamente",
  "data": {
    "commissionDoctor": 15,
    "commissionClinic": 10,
    // ... todos los settings actualizados
  }
}
```

---

## 📋 Detalles de Implementación

### Tabla en la Base de Datos

Necesitas una tabla `admin_settings` con estos campos:

```sql
CREATE TABLE admin_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  commission_doctor DECIMAL(5,2) DEFAULT 15.00,
  commission_clinic DECIMAL(5,2) DEFAULT 10.00,
  commission_laboratory DECIMAL(5,2) DEFAULT 12.00,
  commission_pharmacy DECIMAL(5,2) DEFAULT 8.00,
  commission_supplies DECIMAL(5,2) DEFAULT 10.00,
  commission_ambulance DECIMAL(5,2) DEFAULT 15.00,
  notify_new_requests BOOLEAN DEFAULT TRUE,
  notify_email_summary BOOLEAN DEFAULT TRUE,
  auto_approve_services BOOLEAN DEFAULT FALSE,
  maintenance_mode BOOLEAN DEFAULT FALSE,
  only_admin_can_publish_ads BOOLEAN DEFAULT TRUE,
  require_ad_approval BOOLEAN DEFAULT TRUE,
  max_ads_per_provider INT DEFAULT 1,
  ad_approval_required BOOLEAN DEFAULT TRUE,
  service_approval_required BOOLEAN DEFAULT TRUE,
  allow_service_self_activation BOOLEAN DEFAULT FALSE,
  allow_ad_self_publishing BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar valores por defecto
INSERT INTO admin_settings (id) VALUES (1);
```

**Nota:** Solo debe haber UN registro en esta tabla (id = 1), que contiene toda la configuración global.

### Endpoints del Backend

```javascript
// GET /api/admin/settings
router.get('/admin/settings', authenticateToken, isAdmin, async (req, res) => {
  try {
    const settings = await db.query('SELECT * FROM admin_settings WHERE id = 1');
    
    if (!settings || settings.length === 0) {
      // Si no existe, crear con valores por defecto
      await db.query('INSERT INTO admin_settings (id) VALUES (1)');
      const newSettings = await db.query('SELECT * FROM admin_settings WHERE id = 1');
      return res.json({ success: true, data: newSettings[0] });
    }
    
    res.json({ success: true, data: settings[0] });
  } catch (error) {
    console.error('Error al obtener settings:', error);
    res.status(500).json({ success: false, message: 'Error al obtener configuración' });
  }
});

// PUT /api/admin/settings
router.put('/admin/settings', authenticateToken, isAdmin, async (req, res) => {
  try {
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
      adApprovalRequired,
      serviceApprovalRequired,
      allowServiceSelfActivation,
      allowAdSelfPublishing
    } = req.body;
    
    // Validar que las comisiones sean números válidos
    if (commissionDoctor < 0 || commissionDoctor > 100) {
      return res.status(400).json({ 
        success: false, 
        message: 'La comisión debe estar entre 0 y 100' 
      });
    }
    
    // Actualizar en la BD
    await db.query(`
      UPDATE admin_settings 
      SET 
        commission_doctor = ?,
        commission_clinic = ?,
        commission_laboratory = ?,
        commission_pharmacy = ?,
        commission_supplies = ?,
        commission_ambulance = ?,
        notify_new_requests = ?,
        notify_email_summary = ?,
        auto_approve_services = ?,
        maintenance_mode = ?,
        only_admin_can_publish_ads = ?,
        require_ad_approval = ?,
        max_ads_per_provider = ?,
        ad_approval_required = ?,
        service_approval_required = ?,
        allow_service_self_activation = ?,
        allow_ad_self_publishing = ?
      WHERE id = 1
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
      adApprovalRequired,
      serviceApprovalRequired,
      allowServiceSelfActivation,
      allowAdSelfPublishing
    ]);
    
    // Obtener los settings actualizados
    const updatedSettings = await db.query('SELECT * FROM admin_settings WHERE id = 1');
    
    res.json({ 
      success: true, 
      message: 'Configuración actualizada correctamente',
      data: updatedSettings[0]
    });
  } catch (error) {
    console.error('Error al actualizar settings:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar configuración' });
  }
});
```

---

## 🎯 Una Vez que Implementes los Endpoints

Avísame y yo:
1. Creo el archivo API en el frontend (`dashboard.api.ts`)
2. Creo el use case para guardar settings
3. Actualizo el hook `useAdminSettings` para usar el backend real
4. Conecto el botón "Guardar" al backend
5. Remuevo los mocks

---

## 📊 Resumen

**Problema:** Frontend usa datos mock, no guarda en BD
**Solución:** Backend debe implementar 2 endpoints (GET y PUT)
**Resultado:** Las comisiones se guardarán correctamente y persistirán al refrescar

---

¿Alguna duda sobre la implementación?
