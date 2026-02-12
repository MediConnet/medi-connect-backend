# 🔐 Endpoint de Reset Password - Especificación para Backend

## 📋 Resumen
El frontend ya tiene implementada la página de restablecimiento de contraseña (`/reset-password`). Ahora necesitamos que el backend implemente el endpoint correspondiente.

---

## 🎯 Endpoint Requerido

### **POST /api/auth/reset-password**

Este endpoint recibe el token de recuperación y la nueva contraseña, valida el token y actualiza la contraseña del usuario.

---

## 📥 Request

### Headers
```
Content-Type: application/json
```

### Body
```json
{
  "token": "abc123def456ghi789...",
  "newPassword": "nuevaContraseña123"
}
```

### Campos:
- **token** (string, requerido): Token único generado en el endpoint `/forgot-password`
- **newPassword** (string, requerido): Nueva contraseña del usuario (mínimo 6 caracteres)

---

## 📤 Response

### Success (200 OK)
```json
{
  "success": true,
  "data": {
    "message": "Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña."
  }
}
```

### Error - Token Inválido o Expirado (400 Bad Request)
```json
{
  "success": false,
  "message": "Token inválido o expirado. Por favor solicita un nuevo enlace de recuperación."
}
```

### Error - Contraseña Muy Corta (400 Bad Request)
```json
{
  "success": false,
  "message": "La contraseña debe tener al menos 6 caracteres"
}

### Error - Usuario No Encontrado (404 Not Found)
```json
{
  "success": false,
  "message": "Usuario no encontrado"
}
```

### Error - Servidor (500 Internal Server Error)
```json
{
  "success": false,
  "message": "Error al restablecer contraseña. Por favor intenta nuevamente."
}
```

---

## 🔒 Validaciones Requeridas

### 1. **Validar que el token existe**
```javascript
const hashedToken = crypto
  .createHash('sha256')
  .update(token)
  .digest('hex');

const resetRequest = await PasswordReset.findOne({
  where: {
    token: hashedToken,
    used: false,
    expiresAt: { $gt: new Date() }
  }
});

if (!resetRequest) {
  return res.status(400).json({
    success: false,
    message: "Token inválido o expirado. Por favor solicita un nuevo enlace de recuperación."
  });
}
```

### 2. **Validar longitud de contraseña**
```javascript
if (!newPassword || newPassword.length < 6) {
  return res.status(400).json({
    success: false,
    message: "La contraseña debe tener al menos 6 caracteres"
  });
}
```

### 3. **Verificar que el usuario existe**
```javascript
const user = await User.findByPk(resetRequest.userId);

if (!user) {
  return res.status(404).json({
    success: false,
    message: "Usuario no encontrado"
  });
}
```

### 4. **Hashear la nueva contraseña**
```javascript
const bcrypt = require('bcrypt');
const hashedPassword = await bcrypt.hash(newPassword, 10);
```

### 5. **Actualizar contraseña del usuario**
```javascript
user.password = hashedPassword;
await user.save();
```

### 6. **Marcar token como usado**
```javascript
resetRequest.used = true;
resetRequest.usedAt = new Date();
await resetRequest.save();
```

---

## 💻 Código de Ejemplo (Node.js/Express)

```javascript
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcrypt');

// Importar modelos
const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');

/**
 * POST /api/auth/reset-password
 * Restablecer contraseña con token
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    // 1. Validar datos
    if (!token || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Token y nueva contraseña son requeridos' 
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'La contraseña debe tener al menos 6 caracteres' 
      });
    }
    
    // 2. Hashear el token recibido para comparar
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    // 3. Buscar token en base de datos
    const resetRequest = await PasswordReset.findOne({
      where: {
        token: hashedToken,
        used: false,
        expiresAt: { $gt: new Date() } // No expirado
      }
    });
    
    if (!resetRequest) {
      console.log('⚠️ Token inválido o expirado');
      return res.status(400).json({ 
        success: false, 
        message: 'Token inválido o expirado. Por favor solicita un nuevo enlace de recuperación.' 
      });
    }
    
    // 4. Buscar usuario
    const user = await User.findByPk(resetRequest.userId);
    
    if (!user) {
      console.log('⚠️ Usuario no encontrado para token válido');
      return res.status(404).json({ 
        success: false, 
        message: 'Usuario no encontrado' 
      });
    }
    
    // 5. Hashear nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // 6. Actualizar contraseña del usuario
    user.password = hashedPassword;
    await user.save();
    
    // 7. Marcar token como usado
    resetRequest.used = true;
    resetRequest.usedAt = new Date();
    await resetRequest.save();
    
    // 8. (Opcional) Invalidar todas las sesiones activas del usuario
    // await Session.destroy({ where: { userId: user.id } });
    
    console.log(`✅ Contraseña actualizada exitosamente para: ${user.email}`);
    
    res.json({ 
      success: true, 
      data: {
        message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña.' 
      }
    });
    
  } catch (error) {
    console.error('❌ Error en /reset-password:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al restablecer contraseña. Por favor intenta nuevamente.' 
    });
  }
});

module.exports = router;
```

---

## 🗄️ Tabla Requerida

### **password_resets**

Esta tabla debe existir y tener los siguientes campos:

```sql
CREATE TABLE password_resets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_expires_at (expires_at)
);
```

---

## 🔄 Flujo Completo

```
1. Usuario hace clic en enlace del email
   ↓
2. Llega a: https://docalink.com/reset-password?token=ABC123
   ↓
3. Frontend muestra formulario
   ↓
4. Usuario ingresa nueva contraseña
   ↓
5. Frontend envía: POST /api/auth/reset-password
   Body: { token: "ABC123", newPassword: "nuevaContraseña" }
   ↓
6. Backend recibe petición
   ↓
7. Backend hashea el token con SHA-256
   ↓
8. Backend busca en tabla password_resets:
   - token = hash del token
   - used = false
   - expiresAt > ahora
   ↓
9. Si no existe → Error 400 "Token inválido o expirado"
   ↓
10. Si existe → Buscar usuario por userId
    ↓
11. Si no existe usuario → Error 404 "Usuario no encontrado"
    ↓
12. Si existe → Hashear nueva contraseña con bcrypt
    ↓
13. Actualizar user.password con hash
    ↓
14. Marcar token como usado (used = true, usedAt = now)
    ↓
15. Responder: 200 OK con mensaje de éxito
    ↓
16. Frontend muestra mensaje de éxito
    ↓
17. Usuario puede ir al login
    ↓
18. Usuario inicia sesión con nueva contraseña
    ↓
19. ✅ Acceso restaurado
```

---

## 🧪 Cómo Probar

### 1. **Generar un token de prueba**
```bash
# Primero solicitar recuperación
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@ejemplo.com"}'
```

### 2. **Obtener el token del email o de la BD**
```sql
SELECT token FROM password_resets 
WHERE email = 'usuario@ejemplo.com' 
AND used = false 
ORDER BY created_at DESC 
LIMIT 1;
```

### 3. **Probar el endpoint de reset**
```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token":"abc123def456...",
    "newPassword":"nuevaContraseña123"
  }'
```

### 4. **Verificar respuesta exitosa**
```json
{
  "success": true,
  "data": {
    "message": "Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña."
  }
}
```

### 5. **Intentar usar el mismo token de nuevo**
```bash
# Debe fallar porque el token ya fue usado
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token":"abc123def456...",
    "newPassword":"otraContraseña456"
  }'
```

### 6. **Verificar respuesta de error**
```json
{
  "success": false,
  "message": "Token inválido o expirado. Por favor solicita un nuevo enlace de recuperación."
}
```

---

## ⚠️ Casos de Error a Manejar

### 1. **Token no proporcionado**
```json
{
  "success": false,
  "message": "Token y nueva contraseña son requeridos"
}
```

### 2. **Contraseña muy corta**
```json
{
  "success": false,
  "message": "La contraseña debe tener al menos 6 caracteres"
}
```

### 3. **Token inválido**
```json
{
  "success": false,
  "message": "Token inválido o expirado. Por favor solicita un nuevo enlace de recuperación."
}
```

### 4. **Token expirado (más de 1 hora)**
```json
{
  "success": false,
  "message": "Token inválido o expirado. Por favor solicita un nuevo enlace de recuperación."
}
```

### 5. **Token ya usado**
```json
{
  "success": false,
  "message": "Token inválido o expirado. Por favor solicita un nuevo enlace de recuperación."
}
```

### 6. **Usuario no encontrado**
```json
{
  "success": false,
  "message": "Usuario no encontrado"
}
```

---

## 🔐 Consideraciones de Seguridad

### ✅ Implementadas:

1. **Token hasheado en BD**: El token se guarda con SHA-256
2. **Contraseña hasheada**: Se usa bcrypt con 10 rondas
3. **Expiración**: Token válido por 1 hora
4. **Un solo uso**: Token se marca como usado
5. **Validación de longitud**: Mínimo 6 caracteres

### 🔒 Recomendaciones Adicionales:

1. **Invalidar sesiones activas**: Cerrar todas las sesiones del usuario al cambiar contraseña
2. **Logs de auditoría**: Registrar cambios de contraseña
3. **Rate limiting**: Limitar intentos de reset
4. **Notificación por email**: Enviar email confirmando el cambio
5. **HTTPS**: Usar siempre en producción

---

## 📊 Logs Recomendados

```javascript
// Éxito
console.log(`✅ Contraseña actualizada para: ${user.email}`);

// Token inválido
console.log(`⚠️ Intento con token inválido: ${token.substring(0, 10)}...`);

// Token expirado
console.log(`⚠️ Token expirado para: ${resetRequest.email}`);

// Usuario no encontrado
console.log(`⚠️ Usuario no encontrado para token válido: ${resetRequest.userId}`);

// Error general
console.error(`❌ Error en reset-password:`, error);
```

---

## ✅ Checklist de Implementación

- [ ] Crear endpoint `POST /api/auth/reset-password`
- [ ] Validar que token y newPassword estén presentes
- [ ] Validar longitud mínima de contraseña (6 caracteres)
- [ ] Hashear token recibido con SHA-256
- [ ] Buscar token en tabla `password_resets`
- [ ] Verificar que token no esté usado (`used = false`)
- [ ] Verificar que token no haya expirado (`expiresAt > now`)
- [ ] Buscar usuario por `userId`
- [ ] Hashear nueva contraseña con bcrypt
- [ ] Actualizar contraseña del usuario
- [ ] Marcar token como usado
- [ ] Retornar respuesta exitosa
- [ ] Manejar todos los casos de error
- [ ] Agregar logs apropiados
- [ ] Probar con Postman/curl
- [ ] Probar desde el frontend

---

## 🆘 Soporte

Si tienes dudas:

1. Verifica que la tabla `password_resets` exista
2. Verifica que el token se esté hasheando correctamente
3. Verifica que bcrypt esté instalado: `npm install bcrypt`
4. Revisa los logs del servidor
5. Prueba con Postman antes de probar desde el frontend

---

**Fecha:** 12 de Febrero, 2026  
**Proyecto:** DOCALINK - Endpoint Reset Password  
**Estado:** ⏳ Pendiente de Implementación en Backend  
**Frontend:** ✅ Completado y Listo
