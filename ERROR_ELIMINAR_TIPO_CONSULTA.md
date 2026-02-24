# 🐛 Error al Eliminar Tipo de Consulta

**Fecha:** 23 de febrero de 2026  
**Severidad:** 🔴 ALTA  
**Estado:** ⏳ PENDIENTE BACKEND

---

## 📋 Descripción del Error

Al intentar eliminar un tipo de consulta desde el frontend, el backend retorna un error 500.

---

## 🔍 Detalles del Error

### Request del Frontend:
```http
DELETE /api/doctors/consultation-prices/8085-3eb8bf3f2c4f1
Authorization: Bearer {token}
```

### Response del Backend:
```
Status: 500 Internal Server Error
```

### Error en Consola:
```
Failed to load resource: the server responded with a status of 500
Error al eliminar: Error: ID de tipo de consulta no proporcionado
```

---

## ✅ Lo Que Está Bien (Frontend)

El frontend está enviando la petición correctamente:

```typescript
// API Function
export const deleteConsultationPriceAPI = async (id: string): Promise<void> => {
  await httpClient.delete(`/doctors/consultation-prices/${id}`);
};

// Component Usage
const handleDelete = async (id: string, consultationType: string) => {
  if (!window.confirm(`¿Estás seguro de eliminar "${consultationType}"?`)) {
    return;
  }

  try {
    await deleteConsultationPrice(id);
    setSnackbar({
      open: true,
      message: "Tipo de consulta eliminado correctamente",
      severity: "success",
    });
  } catch (error) {
    console.error("Error al eliminar:", error);
    setSnackbar({
      open: true,
      message: "Error al eliminar. Intenta nuevamente.",
      severity: "error",
    });
  }
};
```

---

## 🔧 Lo Que Debe Revisar el Backend

### 1. Verificar que el endpoint DELETE esté implementado:

```typescript
// Debe existir esta ruta
router.delete('/doctors/consultation-prices/:id', authenticateToken, deleteConsultationPrice);
```

### 2. Verificar que el parámetro :id se esté leyendo correctamente:

```typescript
const deleteConsultationPrice = async (req, res) => {
  try {
    const { id } = req.params; // ← Verificar que esto funcione
    const doctorId = req.user.providerId;
    
    console.log('ID recibido:', id); // ← Agregar log para debug
    console.log('Doctor ID:', doctorId);
    
    // Verificar que el tipo de consulta pertenezca al médico
    const consultationPrice = await db.query(
      'SELECT * FROM doctor_specialty_prices WHERE id = $1 AND doctor_id = $2',
      [id, doctorId]
    );
    
    if (consultationPrice.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tipo de consulta no encontrado'
      });
    }
    
    // Eliminar
    await db.query(
      'DELETE FROM doctor_specialty_prices WHERE id = $1',
      [id]
    );
    
    return res.json({
      success: true,
      message: 'Tipo de consulta eliminado correctamente'
    });
    
  } catch (error) {
    console.error('Error al eliminar tipo de consulta:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar tipo de consulta'
    });
  }
};
```

### 3. Verificar permisos:

- ✅ El usuario debe estar autenticado
- ✅ El tipo de consulta debe pertenecer al médico que lo intenta eliminar
- ✅ El ID debe ser válido (UUID)

---

## 🧪 Cómo Probar

### Con Postman/Insomnia:

```http
DELETE http://localhost:3000/api/doctors/consultation-prices/8085-3eb8bf3f2c4f1
Authorization: Bearer {token_del_medico}
```

**Respuesta Esperada (200):**
```json
{
  "success": true,
  "message": "Tipo de consulta eliminado correctamente"
}
```

**Respuesta Error (404):**
```json
{
  "success": false,
  "message": "Tipo de consulta no encontrado"
}
```

---

## 📊 Casos de Prueba

1. **Eliminar tipo propio:**
   - ✅ Debe eliminar correctamente
   - ✅ Debe retornar 200

2. **Eliminar tipo de otro médico:**
   - ❌ Debe retornar 404 o 403
   - ❌ No debe eliminar

3. **Eliminar con ID inválido:**
   - ❌ Debe retornar 404
   - ❌ No debe causar error 500

4. **Eliminar sin autenticación:**
   - ❌ Debe retornar 401

---

## 🔍 Logs Recomendados

Agregar estos logs en el backend para debug:

```typescript
console.log('=== DELETE CONSULTATION PRICE ===');
console.log('ID recibido:', req.params.id);
console.log('Doctor ID:', req.user.providerId);
console.log('Headers:', req.headers);
```

---

## ✅ Checklist Backend

- [ ] Endpoint DELETE existe y está registrado
- [ ] Parámetro :id se lee correctamente
- [ ] Validación de pertenencia (doctor_id)
- [ ] Manejo de errores correcto
- [ ] No retorna 500 en casos normales
- [ ] Logs para debugging
- [ ] Probado con Postman

---

## 📞 Siguiente Paso

**Backend:** Revisar el endpoint DELETE y corregir el error 500.

Una vez corregido, avisar a frontend para probar nuevamente.

---

**Frontend está listo y esperando** ✅
