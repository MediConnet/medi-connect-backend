# 📋 Especificación Técnica: Sistema de Notificaciones para Panel de Administración

## 🎯 Resumen

Se implementó un sistema de notificaciones en tiempo real en el panel de administración que muestra alertas cuando hay:
- **Nuevos usuarios/proveedores pendientes de aprobación**
- **Nuevos anuncios pendientes de aprobación**

Las notificaciones aparecen en el Header del dashboard con un badge que muestra el conteo total de pendientes.

---

## 🔌 Endpoints Requeridos

El frontend ya está consumiendo estos endpoints. Solo necesitamos asegurarnos de que funcionen correctamente:

### 1. **GET `/api/admin/requests`**
**Propósito:** Obtener todas las solicitudes de proveedores/usuarios

**Respuesta esperada:**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "providerName": "string",
      "email": "string",
      "avatarUrl": "string (opcional)",
      "serviceType": "doctor" | "pharmacy" | "laboratory" | "ambulance" | "supplies",
      "submissionDate": "YYYY-MM-DD",
      "documentsCount": number,
      "status": "PENDING" | "APPROVED" | "REJECTED",
      "rejectionReason": "string (opcional)",
      "phone": "string",
      "whatsapp": "string",
      "city": "string",
      "address": "string",
      "description": "string",
      "documents": [
        {
          "id": "string",
          "name": "string",
          "type": "pdf" | "image",
          "url": "string"
        }
      ]
    }
  ]
}
```

**⚠️ IMPORTANTE:** 
- El campo `status` debe incluir solicitudes con estado `"PENDING"` para que aparezcan en las notificaciones
- El campo `submissionDate` debe estar en formato ISO (YYYY-MM-DD) o compatible con `new Date()`

---

### 2. **GET `/api/admin/ad-requests`**
**Propósito:** Obtener todas las solicitudes de anuncios promocionales

**Respuesta esperada:**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "providerId": "string",
      "providerName": "string",
      "providerEmail": "string",
      "serviceType": "doctor" | "pharmacy" | "laboratory" | "ambulance" | "supplies",
      "submissionDate": "YYYY-MM-DD",
      "status": "PENDING" | "APPROVED" | "REJECTED",
      "rejectionReason": "string (opcional)",
      "approvedAt": "YYYY-MM-DD (opcional)",
      "rejectedAt": "YYYY-MM-DD (opcional)",
      "hasActiveAd": boolean,
      "adContent": {
        "label": "string",
        "discount": "string",
        "description": "string",
        "buttonText": "string",
        "imageUrl": "string (opcional)",
        "startDate": "YYYY-MM-DD",
        "endDate": "YYYY-MM-DD (opcional)",
        "title": "string (opcional, deprecated)"
      }
    }
  ]
}
```

**⚠️ IMPORTANTE:**
- El campo `status` debe incluir solicitudes con estado `"PENDING"` para que aparezcan en las notificaciones
- El campo `submissionDate` debe estar en formato ISO (YYYY-MM-DD) o compatible con `new Date()`

---

## 🔄 Comportamiento del Frontend

### Cómo funciona el sistema de notificaciones:

1. **Polling automático:**
   - El frontend consulta ambos endpoints cada 5 minutos (configurado en `staleTime`)
   - También se actualiza cuando el admin navega entre páginas

2. **Filtrado de notificaciones:**
   - Solo se muestran solicitudes con `status: "PENDING"`
   - Se ordenan por fecha (más recientes primero)

3. **Badge de notificaciones:**
   - Muestra el conteo total: `(usuarios pendientes) + (anuncios pendientes)`
   - Ejemplo: Si hay 3 usuarios y 2 anuncios pendientes, el badge muestra "5"

4. **Dropdown de notificaciones:**
   - Muestra dos secciones separadas:
     - **Usuarios Pendientes** (icono de persona, color ámbar)
     - **Anuncios Pendientes** (icono de campaña, color azul)
   - Cada notificación es clickeable y redirige a la página correspondiente

---

## ✅ Checklist para Backend

- [ ] Verificar que `GET /api/admin/requests` devuelve solicitudes con `status: "PENDING"`
- [ ] Verificar que `GET /api/admin/ad-requests` devuelve solicitudes con `status: "PENDING"`
- [ ] Asegurar que las fechas (`submissionDate`) están en formato ISO o compatible
- [ ] Verificar que los endpoints requieren autenticación de admin
- [ ] Confirmar que los endpoints devuelven el formato de respuesta esperado (`{ success: boolean, data: [] }`)

---

## 🚀 Mejoras Futuras (Opcional)

Si quieren mejorar la experiencia, podrían implementar:

1. **WebSockets o Server-Sent Events (SSE):**
   - Notificaciones en tiempo real sin polling
   - El frontend ya está preparado para recibir actualizaciones

2. **Endpoint de conteo optimizado:**
   - `GET /api/admin/notifications/count`
   - Devuelve solo el conteo sin los datos completos
   - Útil para reducir el payload en polling frecuente

3. **Filtro de fecha:**
   - Permitir filtrar notificaciones por fecha de creación
   - Útil para mostrar solo notificaciones "nuevas" (ej: últimas 24 horas)

---

## 📝 Notas Técnicas

- **Cache:** El frontend usa React Query con `staleTime: 5 minutos`
- **Actualización:** Las notificaciones se refrescan automáticamente al:
  - Cargar cualquier página del admin
  - Aprobar/rechazar una solicitud
  - Navegar entre páginas del dashboard

- **Formato de fecha:** El frontend acepta cualquier formato que `new Date()` pueda parsear, pero se recomienda ISO 8601 (YYYY-MM-DD)

---

## 🐛 Troubleshooting

Si las notificaciones no aparecen:

1. Verificar que los endpoints devuelven datos con `status: "PENDING"`
2. Verificar que el formato de respuesta es correcto (`{ success: true, data: [...] }`)
3. Verificar que las fechas están en formato válido
4. Revisar la consola del navegador para errores de red
5. Verificar que el usuario tiene permisos de admin

---

## 📞 Contacto

Si tienen preguntas sobre la implementación del frontend o necesitan ajustar algo, pueden contactar al equipo de frontend.

**Fecha de implementación:** $(date)
**Versión:** 1.0.0
