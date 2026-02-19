# 🐛 Corrección: Endpoint de Eliminación de Usuarios

## 📋 Problema Identificado

Al eliminar un usuario desde el panel de administración, el usuario desaparece de la interfaz pero **no se elimina de la base de datos**. Al refrescar la página, el usuario vuelve a aparecer.

### Causa Raíz

El frontend está llamando al endpoint **incorrecto**:

- ❌ **Endpoint actual (incorrecto):** `DELETE /api/users/{id}`
- ✅ **Endpoint correcto:** `DELETE /api/admin/users/{id}`

El backend retorna **404 Not Found** porque la ruta `/api/users/{id}` no existe.

---

## ✅ Solución

### 1. Corregir la URL del Endpoint

**Cambiar de:**
```typescript
// ❌ INCORRECTO
const response = await fetch(`/api/users/${userId}`, {
  method: 'DELETE',
  // ...
});
```

**A:**
```typescript
// ✅ CORRECTO
const response = await fetch(`/api/admin/users/${userId}`, {
  method: 'DELETE',
  // ...
});
```

### 2. Verificar Autenticación

El header `Authorization` debe contener un token válido (no `null`):

```typescript
headers: {
  'Authorization': `Bearer ${token}`, // Asegúrate de tener el token real
  'Content-Type': 'application/json'
}
```

---

## 📝 Endpoint Correcto

### **DELETE `/api/admin/users/:id`**

**Descripción:** Elimina un usuario permanentemente de la base de datos.

**Autenticación:** Requerida (rol: `admin`)

**Request:**
```http
DELETE /api/admin/users/{userId}
Authorization: Bearer {token}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Usuario eliminado correctamente"
  }
}
```

**Errores Posibles:**

- **400 Bad Request:** Intentar eliminarse a sí mismo
- **401 Unauthorized:** Token inválido o ausente
- **403 Forbidden:** Usuario no tiene permisos de admin
- **404 Not Found:** Usuario no encontrado
- **500 Internal Server Error:** Error al eliminar (puede ser por foreign keys)

---

## 🔍 Validaciones del Backend

El backend realiza las siguientes validaciones:

1. ✅ Verifica que el usuario tenga rol `admin`
2. ✅ Verifica que no se esté eliminando a sí mismo
3. ✅ Verifica que el usuario exista
4. ✅ Elimina el usuario y todos sus datos relacionados (CASCADE)
5. ✅ Verifica que la eliminación fue exitosa

---

## 🧪 Cómo Verificar

1. Abre las **Developer Tools** del navegador (F12)
2. Ve a la pestaña **Network**
3. Filtra por **Fetch/XHR**
4. Intenta eliminar un usuario
5. Verifica que la petición sea:
   - **URL:** `http://localhost:5174/api/admin/users/{userId}`
   - **Method:** `DELETE`
   - **Status:** `200 OK` (no 404)
   - **Authorization:** `Bearer {token}` (no `Bearer null`)

---

## 📞 Notas Adicionales

- El endpoint elimina **permanentemente** el usuario y todos sus datos relacionados
- La eliminación es **irreversible**
- Si hay errores de foreign key, el backend retornará un error 500 con un mensaje descriptivo
- El usuario debe tener rol `admin` para poder eliminar usuarios

---

**Fecha:** 2026-02-18  
**Versión:** 1.0.0
