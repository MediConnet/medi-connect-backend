# 🗑️ Endpoint de Eliminación de Usuarios - Especificación para Backend

## 📋 Resumen
El frontend tiene implementado un botón de "Eliminar" en la página de Administración de Usuarios. Este botón permite eliminar permanentemente usuarios de la base de datos.

---

## 🎯 Endpoint Requerido

### **DELETE /api/users/:userId**

Este endpoint elimina permanentemente un usuario y todos sus datos relacionados de la base de datos.

---

## 🔐 Autenticación

### Headers Requeridos
```
Authorization: Bearer {token_del_admin}
Content-Type: application/json
```

**Importante:** Solo usuarios con rol `ADMIN` pueden eliminar usuarios.

---

## 📥 Request

### URL Parameters
- **userId** (string, requerido): ID del usuario a eliminar

### Ejemplo
```
DELETE /api/users/123
```

---

## 📤 Response

### Success (200 OK)
```json
{
  "success": true,
  "message": "Usuario eliminado correctamente"
}
```

### Error - No Autorizado (401 Unauthorized)
```json
{
  "success": false,
  "message": "No autorizado. Solo administradores pueden eliminar usuarios."
}
```

### Error - Usuario No Encontrado (404 Not Found)
```json
{
  "success": false,
  "message": "Usuario no encontrado"
}
```

### Error - No Se Puede Eliminar (400 Bad Request)
```json
{
  "success": false,
  "message": "No puedes eliminar tu propia cuenta de administrador"
}
```

### Error - Servidor (500 Internal Server Error)
```json
{
  "success": false,
  "message": "Error al eliminar usuario"
}
```

---

## 🔒 Validaciones Requeridas

### 1. **Verificar que el usuario que hace la petición es ADMIN**
```javascript
const requestingUser = req.user; // Del token JWT

if (requestingUser.role !== 'ADMIN') {
  return res.status(401).json({
    success: false,
    message: 'No autorizado. Solo administradores pueden eliminar usuarios.'
  });
}
```

### 2. **Verificar que el usuario a eliminar existe**
```javascript
const userToDelete = await User.findByPk(userId);

if (!userToDelete) {
  return res.status(404).json({
    success: false,
    message: 'Usuario no encontrado'
  });
}
```

### 3. **Evitar que un admin se elimine a sí mismo**
```javascript
if (requestingUser.id === userId) {
  return res.status(400).json({
    success: false,
    message: 'No puedes eliminar tu propia cuenta de administrador'
  });
}
```

### 4. **Eliminar datos relacionados (CASCADE)**
```javascript
// Opción 1: Usar CASCADE en la base de datos (recomendado)
// Las foreign keys deben tener ON DELETE CASCADE

// Opción 2: Eliminar manualmente
await Provider.destroy({ where: { userId } });
await Clinic.destroy({ where: { userId } });
await Appointment.destroy({ where: { userId } });
await Review.destroy({ where: { userId } });
// ... otros datos relacionados
```

---

## 💻 Código de Ejemplo (Node.js/Express)

```javascript
const express = require('express');
const router = express.Router();

// Middleware de autenticación
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Importar modelos
const User = require('../models/User');
const Provider = require('../models/Provider');
const Clinic = require('../models/Clinic');

/**
 * DELETE /api/users/:userId
 * Eliminar usuario permanentemente
 * 
 * Requiere: Token de administrador
 */
router.delete('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUser = req.user; // Del middleware de autenticación
    
    // 1. Verificar que no se esté eliminando a sí mismo
    if (requestingUser.id === parseInt(userId)) {
      return res.status(400).json({
        success: false,
        message: 'No puedes eliminar tu propia cuenta de administrador'
      });
    }
    
    // 2. Buscar usuario a eliminar
    const userToDelete = await User.findByPk(userId, {
      include: [
        { model: Provider, as: 'provider' },
        { model: Clinic, as: 'clinic' }
      ]
    });
    
    if (!userToDelete) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // 3. Log de auditoría (recomendado)
    console.log(`🗑️ Admin ${requestingUser.email} eliminando usuario ${userToDelete.email} (ID: ${userId})`);
    
    // 4. Eliminar usuario (CASCADE eliminará datos relacionados)
    await userToDelete.destroy();
    
    console.log(`✅ Usuario ${userToDelete.email} eliminado exitosamente`);
    
    res.json({
      success: true,
      message: 'Usuario eliminado correctamente'
    });
    
  } catch (error) {
    console.error('❌ Error al eliminar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar usuario'
    });
  }
});

module.exports = router;
```

---

## 🗄️ Configuración de Base de Datos

### **Opción 1: CASCADE en Foreign Keys (Recomendado)**

```sql
-- Tabla providers
ALTER TABLE providers
ADD CONSTRAINT fk_provider_user
FOREIGN KEY (user_id) REFERENCES users(id)
ON DELETE CASCADE;

-- Tabla clinics
ALTER TABLE clinics
ADD CONSTRAINT fk_clinic_user
FOREIGN KEY (user_id) REFERENCES users(id)
ON DELETE CASCADE;

-- Tabla appointments
ALTER TABLE appointments
ADD CONSTRAINT fk_appointment_user
FOREIGN KEY (user_id) REFERENCES users(id)
ON DELETE CASCADE;

-- Tabla reviews
ALTER TABLE reviews
ADD CONSTRAINT fk_review_user
FOREIGN KEY (user_id) REFERENCES users(id)
ON DELETE CASCADE;

-- Tabla sessions
ALTER TABLE sessions
ADD CONSTRAINT fk_session_user
FOREIGN KEY (user_id) REFERENCES users(id)
ON DELETE CASCADE;

-- Tabla password_resets
ALTER TABLE password_resets
ADD CONSTRAINT fk_password_reset_user
FOREIGN KEY (user_id) REFERENCES users(id)
ON DELETE CASCADE;
```

### **Opción 2: Eliminación Manual (Si no tienes CASCADE)**

```javascript
router.delete('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { userId } = req.params;
    
    // Eliminar en orden (de dependientes a principales)
    await Review.destroy({ where: { userId }, transaction });
    await Appointment.destroy({ where: { userId }, transaction });
    await Session.destroy({ where: { userId }, transaction });
    await PasswordReset.destroy({ where: { userId }, transaction });
    await Provider.destroy({ where: { userId }, transaction });
    await Clinic.destroy({ where: { userId }, transaction });
    await User.destroy({ where: { id: userId }, transaction });
    
    await transaction.commit();
    
    res.json({
      success: true,
      message: 'Usuario eliminado correctamente'
    });
    
  } catch (error) {
    await transaction.rollback();
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar usuario'
    });
  }
});
```

---

## 🔄 Flujo Completo

```
1. Admin hace clic en botón "Eliminar" en la tabla de usuarios
   ↓
2. Frontend muestra modal de confirmación
   ↓
3. Modal muestra datos del usuario a eliminar
   ↓
4. Admin confirma la eliminación
   ↓
5. Frontend envía: DELETE /api/users/123
   Headers: { Authorization: "Bearer token_admin" }
   ↓
6. Backend recibe petición
   ↓
7. Backend verifica token JWT
   ↓
8. Backend verifica que el usuario es ADMIN
   ↓
9. Backend verifica que no se está eliminando a sí mismo
   ↓
10. Backend busca usuario por ID
    ↓
11. Si no existe → Error 404 "Usuario no encontrado"
    ↓
12. Si existe → Eliminar usuario de la BD
    ↓
13. CASCADE elimina automáticamente:
    - Provider asociado
    - Clinic asociada
    - Appointments
    - Reviews
    - Sessions
    - Password resets
    ↓
14. Backend responde: 200 OK
    ↓
15. Frontend elimina usuario de la lista visual
    ↓
16. Frontend cierra modal
    ↓
17. ✅ Usuario eliminado permanentemente
```

---

## 🧪 Cómo Probar

### 1. **Obtener token de administrador**
```bash
# Login como admin
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"admin@docalink.com",
    "password":"admin123"
  }'

# Copiar el token de la respuesta
```

### 2. **Listar usuarios para obtener un ID**
```bash
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer {token_admin}"
```

### 3. **Eliminar un usuario**
```bash
curl -X DELETE http://localhost:3000/api/users/123 \
  -H "Authorization: Bearer {token_admin}"
```

### 4. **Verificar respuesta exitosa**
```json
{
  "success": true,
  "message": "Usuario eliminado correctamente"
}
```

### 5. **Verificar que el usuario ya no existe**
```bash
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer {token_admin}"

# El usuario con ID 123 ya no debe aparecer en la lista
```

### 6. **Intentar eliminar usuario inexistente**
```bash
curl -X DELETE http://localhost:3000/api/users/99999 \
  -H "Authorization: Bearer {token_admin}"
```

### 7. **Verificar respuesta de error**
```json
{
  "success": false,
  "message": "Usuario no encontrado"
}
```

---

## ⚠️ Casos de Error a Manejar

### 1. **Sin token de autenticación**
```json
{
  "success": false,
  "message": "Token no proporcionado"
}
```

### 2. **Token inválido o expirado**
```json
{
  "success": false,
  "message": "Token inválido o expirado"
}
```

### 3. **Usuario no es administrador**
```json
{
  "success": false,
  "message": "No autorizado. Solo administradores pueden eliminar usuarios."
}
```

### 4. **Intentar eliminarse a sí mismo**
```json
{
  "success": false,
  "message": "No puedes eliminar tu propia cuenta de administrador"
}
```

### 5. **Usuario no encontrado**
```json
{
  "success": false,
  "message": "Usuario no encontrado"
}
```

### 6. **Error de base de datos**
```json
{
  "success": false,
  "message": "Error al eliminar usuario"
}
```

---

## 🔐 Consideraciones de Seguridad

### ✅ Implementadas:

1. **Autenticación requerida**: Solo usuarios autenticados
2. **Autorización**: Solo administradores
3. **Protección contra auto-eliminación**: Admin no puede eliminarse a sí mismo
4. **Validación de existencia**: Verificar que el usuario existe
5. **Logs de auditoría**: Registrar quién eliminó a quién

### 🔒 Recomendaciones Adicionales:

1. **Soft Delete**: En lugar de eliminar, marcar como `deleted: true`
2. **Backup antes de eliminar**: Guardar copia en tabla de auditoría
3. **Confirmación por email**: Enviar email al admin confirmando la eliminación
4. **Rate limiting**: Limitar número de eliminaciones por hora
5. **Registro de auditoría**: Tabla separada con historial de eliminaciones

---

## 📊 Tabla de Auditoría (Opcional pero Recomendado)

```sql
CREATE TABLE user_deletions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  deleted_user_id INT NOT NULL,
  deleted_user_email VARCHAR(255) NOT NULL,
  deleted_user_role VARCHAR(50) NOT NULL,
  deleted_by_admin_id INT NOT NULL,
  deleted_by_admin_email VARCHAR(255) NOT NULL,
  deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reason VARCHAR(500),
  
  INDEX idx_deleted_user (deleted_user_id),
  INDEX idx_deleted_by (deleted_by_admin_id),
  INDEX idx_deleted_at (deleted_at)
);
```

### Uso en el código:
```javascript
// Antes de eliminar, guardar en auditoría
await UserDeletion.create({
  deletedUserId: userToDelete.id,
  deletedUserEmail: userToDelete.email,
  deletedUserRole: userToDelete.role,
  deletedByAdminId: requestingUser.id,
  deletedByAdminEmail: requestingUser.email,
  reason: req.body.reason || 'No especificado'
});

// Luego eliminar
await userToDelete.destroy();
```

---

## 📝 Logs Recomendados

```javascript
// Inicio de eliminación
console.log(`🗑️ Solicitud de eliminación de usuario ${userId} por admin ${requestingUser.email}`);

// Usuario no encontrado
console.log(`⚠️ Intento de eliminar usuario inexistente: ${userId}`);

// Auto-eliminación bloqueada
console.log(`⚠️ Admin ${requestingUser.email} intentó eliminarse a sí mismo`);

// Eliminación exitosa
console.log(`✅ Usuario ${userToDelete.email} (ID: ${userId}) eliminado por ${requestingUser.email}`);

// Error
console.error(`❌ Error al eliminar usuario ${userId}:`, error);
```

---

## 🔄 Alternativa: Soft Delete (Recomendado)

En lugar de eliminar permanentemente, marcar como eliminado:

```javascript
// Agregar campo a la tabla users
ALTER TABLE users ADD COLUMN deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN deleted_at DATETIME NULL;
ALTER TABLE users ADD COLUMN deleted_by INT NULL;

// Endpoint de "eliminación"
router.delete('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUser = req.user;
    
    const userToDelete = await User.findByPk(userId);
    
    if (!userToDelete) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Marcar como eliminado en lugar de eliminar
    userToDelete.deleted = true;
    userToDelete.deletedAt = new Date();
    userToDelete.deletedBy = requestingUser.id;
    await userToDelete.save();
    
    console.log(`✅ Usuario ${userToDelete.email} marcado como eliminado`);
    
    res.json({
      success: true,
      message: 'Usuario eliminado correctamente'
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar usuario'
    });
  }
});

// Modificar consultas para excluir eliminados
const users = await User.findAll({
  where: { deleted: false }
});
```

---

## ✅ Checklist de Implementación

- [ ] Crear endpoint `DELETE /api/users/:userId`
- [ ] Agregar middleware de autenticación
- [ ] Agregar middleware de autorización (solo admin)
- [ ] Validar que el usuario existe
- [ ] Validar que no se elimine a sí mismo
- [ ] Configurar CASCADE en foreign keys (o eliminar manualmente)
- [ ] Eliminar usuario de la base de datos
- [ ] Agregar logs de auditoría
- [ ] Manejar todos los casos de error
- [ ] Probar con Postman/curl
- [ ] Probar desde el frontend
- [ ] (Opcional) Implementar tabla de auditoría
- [ ] (Opcional) Implementar soft delete

---

## 🆘 Soporte

Si tienes dudas:

1. Verifica que el middleware de autenticación funcione
2. Verifica que el middleware de autorización (requireAdmin) funcione
3. Verifica que las foreign keys tengan CASCADE configurado
4. Revisa los logs del servidor
5. Prueba con Postman antes de probar desde el frontend

---

**Fecha:** 12 de Febrero, 2026  
**Proyecto:** DOCALINK - Endpoint Delete User  
**Estado:** ⏳ Pendiente de Implementación en Backend  
**Frontend:** ✅ Completado y Listo
