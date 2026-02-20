# ⚠️ Problema: Datos Faltantes en Solicitudes de Proveedores

**Fecha:** 20 de febrero de 2026  
**Para:** Equipo Backend  
**Prioridad:** ALTA

---

## 🐛 Problema Identificado

En el panel de administración, al ver el detalle de una solicitud de proveedor, los siguientes campos aparecen vacíos:

- ❌ **Teléfono** (vacío)
- ❌ **WhatsApp** (vacío)
- ❌ **Dirección** (vacía)

Pero otros campos sí se muestran correctamente:
- ✅ Email
- ✅ Ciudad
- ✅ Descripción

---

## 📸 Evidencia

En el modal "Detalle de Solicitud" se ve:

```
Email: fybeca@gmail.com ✅
Teléfono: [vacío] ❌
WhatsApp: [vacío] ❌
Ciudad: Sin ciudad ✅ (pero debería mostrar la ciudad)
Dirección: [vacío] ❌
```

---

## 🔍 Análisis Técnico

### Endpoint Afectado:
```
GET /api/admin/requests
```

### Respuesta Actual (Incompleta):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-123",
      "providerName": "Santo Lucio",
      "email": "fybeca@gmail.com",
      "serviceType": "pharmacy",
      "phone": null,        // ❌ Falta
      "whatsapp": null,     // ❌ Falta
      "address": null,      // ❌ Falta
      "city": "Sin ciudad", // ⚠️ Debería ser el nombre real
      "description": "...",
      "status": "pending",
      "documents": []
    }
  ]
}
```

### Respuesta Esperada (Completa):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-123",
      "providerName": "Santo Lucio",
      "email": "fybeca@gmail.com",
      "serviceType": "pharmacy",
      "phone": "0999999999",     // ✅ Debe venir
      "whatsapp": "0999999999",  // ✅ Debe venir
      "address": "Av. Principal 123", // ✅ Debe venir
      "city": "Quito",           // ✅ Nombre de la ciudad
      "description": "...",
      "status": "pending",
      "documents": []
    }
  ]
}
```

---

## 🗄️ Origen de los Datos

Estos datos se guardan cuando el usuario se registra en el formulario de registro:

### Tabla: `users`
- `phone` - Teléfono del usuario
- `whatsapp` - WhatsApp del usuario

### Tabla: `providers`
- `address` - Dirección del servicio
- `city_id` - ID de la ciudad (FK a tabla `cities`)

### Tabla: `cities`
- `id` - UUID de la ciudad
- `name` - Nombre de la ciudad (ej: "Quito", "Guayaquil")

---

## 🔧 Solución Requerida

### En el endpoint `GET /api/admin/requests`:

```typescript
// Pseudocódigo de lo que debe hacer el backend
const requests = await db.query(`
  SELECT 
    pr.id,
    pr.status,
    pr.rejection_reason,
    pr.created_at as submission_date,
    u.email,
    u.phone,           -- ✅ Agregar
    u.whatsapp,        -- ✅ Agregar
    p.commercial_name as provider_name,
    p.service_type,
    p.address,         -- ✅ Agregar
    p.description,
    p.logo_url as avatar_url,
    c.name as city     -- ✅ JOIN con cities para obtener el nombre
  FROM provider_requests pr
  JOIN users u ON pr.user_id = u.id
  JOIN providers p ON pr.provider_id = p.id
  LEFT JOIN cities c ON p.city_id = c.id  -- ✅ Agregar JOIN
  WHERE pr.status = 'PENDING'
  ORDER BY pr.created_at DESC
`);
```

---

## 📋 Campos Requeridos en la Respuesta

| Campo | Tipo | Origen | Requerido | Actual |
|-------|------|--------|-----------|--------|
| `id` | string | provider_requests.id | ✅ | ✅ |
| `providerName` | string | providers.commercial_name | ✅ | ✅ |
| `email` | string | users.email | ✅ | ✅ |
| `phone` | string | users.phone | ✅ | ❌ |
| `whatsapp` | string | users.whatsapp | ✅ | ❌ |
| `address` | string | providers.address | ✅ | ❌ |
| `city` | string | cities.name | ✅ | ⚠️ |
| `description` | string | providers.description | ✅ | ✅ |
| `serviceType` | string | providers.service_type | ✅ | ✅ |
| `status` | string | provider_requests.status | ✅ | ✅ |
| `submissionDate` | string | provider_requests.created_at | ✅ | ✅ |
| `avatarUrl` | string | providers.logo_url | ❌ | ✅ |
| `documents` | array | provider_documents | ❌ | ✅ |

---

## 🎯 Casos de Prueba

### Caso 1: Solicitud con todos los datos
```json
{
  "id": "uuid-123",
  "providerName": "Farmacia San Juan",
  "email": "contacto@sanjuan.com",
  "phone": "0999123456",
  "whatsapp": "0999123456",
  "address": "Av. 6 de Diciembre N34-123",
  "city": "Quito",
  "description": "Farmacia con 20 años de experiencia",
  "serviceType": "pharmacy",
  "status": "pending"
}
```

### Caso 2: Solicitud con datos opcionales vacíos
```json
{
  "id": "uuid-456",
  "providerName": "Dr. Juan Pérez",
  "email": "juan@example.com",
  "phone": "0991234567",
  "whatsapp": null,  // ⚠️ Puede ser null si no proporcionó
  "address": "Consultorio 101, Edificio Médico",
  "city": "Cuenca",
  "description": "Médico general con 10 años de experiencia",
  "serviceType": "doctor",
  "status": "pending"
}
```

---

## ⚠️ Notas Importantes

### 1. Campo `city`:
Actualmente retorna `"Sin ciudad"` cuando debería retornar el nombre real de la ciudad desde la tabla `cities`.

**Problema:**
```sql
-- Incorrecto (probablemente lo que hace ahora)
SELECT p.city_id as city  -- Retorna UUID, no el nombre
```

**Solución:**
```sql
-- Correcto
SELECT c.name as city  -- Retorna el nombre de la ciudad
FROM providers p
LEFT JOIN cities c ON p.city_id = c.id
```

### 2. Campos opcionales:
- `whatsapp` puede ser `null` si el usuario no lo proporcionó
- `avatarUrl` puede ser `null` si no subió logo
- `documents` puede ser array vacío `[]`

### 3. Validación en el registro:
Asegurarse de que estos campos se guarden correctamente cuando el usuario se registra:
- `users.phone` ✅
- `users.whatsapp` ✅
- `providers.address` ✅
- `providers.city_id` ✅

---

## 🚀 Prioridad

**ALTA** - Los administradores necesitan esta información para:
1. Contactar a los proveedores
2. Verificar la ubicación del servicio
3. Validar la información antes de aprobar

---

## ✅ Checklist de Corrección

- [ ] Agregar `users.phone` a la query
- [ ] Agregar `users.whatsapp` a la query
- [ ] Agregar `providers.address` a la query
- [ ] Hacer JOIN con `cities` para obtener el nombre
- [ ] Probar endpoint con Postman/Insomnia
- [ ] Verificar que los datos se muestren en el frontend
- [ ] Confirmar con el equipo frontend

---

## 📞 Contacto

Si necesitan más información o tienen dudas sobre la estructura esperada, contactar al equipo frontend.

---

**Por favor corregir este problema lo antes posible.** Los administradores no pueden aprobar solicitudes sin esta información. 🙏
