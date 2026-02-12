# 🔐 Implementación de Recuperación de Contraseña - Backend

## 📋 Resumen
Necesitamos implementar el sistema de recuperación de contraseña para **TODOS** los usuarios de DOCALINK (clínicas, doctores, farmacias, laboratorios, ambulancias, insumos, pacientes y administradores).

---

## 1️⃣ Instalar Dependencias

```bash
npm install resend bcrypt
```

**Paquetes:**
- `resend`: Servicio de envío de emails (recomendado)
- `bcrypt`: Para hashear contraseñas

---

## 2️⃣ Configurar Variables de Entorno

Agregar al archivo `.env`:

```env
# Servicio de Email (Resend)
RESEND_API_KEY=re_TU_API_KEY_AQUI
RESEND_FROM_EMAIL=noreply@docalink.com

# URL del Frontend (para enlaces en emails)
FRONTEND_URL=http://localhost:5173

# En producción:
# FRONTEND_URL=https://docalink.com
```

**⚠️ IMPORTANTE:** 
- Reemplaza `re_TU_API_KEY_AQUI` con tu API Key real de Resend
- NUNCA subas este archivo `.env` a GitHub
- Agrega `.env` a tu `.gitignore`

### Obtener API Key de Resend:
1. Crear cuenta en: https://resend.com (gratis)
2. Ir a "API Keys"
3. Crear nueva key
4. Copiar el código (ej: `re_123abc456def`)

---

## 3️⃣ Crear Tabla en Base de Datos

### SQL (MySQL/PostgreSQL):

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
  INDEX idx_email (email),
  INDEX idx_expires_at (expires_at)
);
```

### Prisma Schema:

```prisma
model PasswordReset {
  id        Int       @id @default(autoincrement())
  userId    Int       @map("user_id")
  email     String
  token     String    @unique
  expiresAt DateTime  @map("expires_at")
  used      Boolean   @default(false)
  usedAt    DateTime? @map("used_at")
  createdAt DateTime  @default(now()) @map("created_at")
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([token])
  @@index([email])
  @@index([expiresAt])
  @@map("password_resets")
}
```

---

## 4️⃣ Crear Servicio de Email

**Archivo:** `src/services/email.service.js`

```javascript
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Envía email de recuperación de contraseña
 * @param {string} userEmail - Email del usuario
 * @param {string} userName - Nombre del usuario
 * @param {string} resetToken - Token de recuperación (SIN hashear)
 */
async function sendPasswordResetEmail(userEmail, userName, resetToken) {
  try {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: userEmail,
      subject: 'Recuperación de Contraseña - DOCALINK',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1f2937;">🔐 Recuperación de Contraseña</h1>
          </div>
          
          <p>Hola <strong>${userName || 'Usuario'}</strong>,</p>
          
          <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>DOCALINK</strong>.</p>
          
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;">
              ⚠️ <strong>Importante:</strong> Si no solicitaste este cambio, ignora este email. 
              Tu contraseña permanecerá sin cambios.
            </p>
          </div>
          
          <p>Para restablecer tu contraseña, haz clic en el siguiente botón:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="display: inline-block; 
                      background: #14b8a6; 
                      color: white; 
                      padding: 15px 40px; 
                      text-decoration: none; 
                      border-radius: 8px;
                      font-weight: bold;
                      font-size: 16px;">
              Restablecer Contraseña
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            ⏰ <strong>Este enlace expira en 1 hora</strong> por seguridad.
          </p>
          
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 13px; color: #6b7280;">
              Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
              <a href="${resetLink}" style="color: #14b8a6; word-break: break-all;">
                ${resetLink}
              </a>
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            <strong>DOCALINK</strong> - Conecta tu salud<br>
            Este es un email automático, por favor no respondas.
          </p>
        </body>
        </html>
      `
    });

    if (error) {
      console.error('❌ Error enviando email:', error);
      throw new Error('Error al enviar email de recuperación');
    }

    console.log('✅ Email de recuperación enviado a:', userEmail);
    return data;
    
  } catch (error) {
    console.error('❌ Error en sendPasswordResetEmail:', error);
    throw error;
  }
}

module.exports = {
  sendPasswordResetEmail
};
```

---

## 5️⃣ Crear Endpoints

**Archivo:** `src/routes/auth.routes.js`

```javascript
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { sendPasswordResetEmail } = require('../services/email.service');

// Importar modelos (ajusta según tu ORM: Sequelize, Prisma, TypeORM, etc.)
const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');

/**
 * POST /api/auth/forgot-password
 * Solicitar recuperación de contraseña
 * 
 * Body: { email: string }
 * Response: { success: boolean, message: string }
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    // 1. Validar email
    if (!email || !email.includes('@')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email inválido' 
      });
    }
    
    // 2. Buscar usuario en la base de datos
    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    
    // 3. IMPORTANTE: Siempre responder lo mismo (seguridad)
    // No revelar si el email existe o no
    const standardResponse = { 
      success: true, 
      message: 'Si el email está registrado, recibirás un enlace de recuperación en los próximos minutos.' 
    };
    
    // Si el usuario no existe, responder igual pero no hacer nada más
    if (!user) {
      console.log(`⚠️ Intento de recuperación con email no registrado: ${email}`);
      return res.json(standardResponse);
    }
    
    // 4. Verificar límite de intentos (máximo 3 por hora)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAttempts = await PasswordReset.count({
      where: {
        email: email.toLowerCase(),
        createdAt: { $gte: oneHourAgo }
      }
    });
    
    if (recentAttempts >= 3) {
      console.log(`⚠️ Límite de intentos excedido para: ${email}`);
      return res.status(429).json({ 
        success: false, 
        message: 'Demasiados intentos. Por favor intenta en 1 hora.' 
      });
    }
    
    // 5. Generar token único y seguro
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // 6. Hashear el token antes de guardarlo (seguridad)
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    
    // 7. Guardar en base de datos
    await PasswordReset.create({
      userId: user.id,
      email: user.email.toLowerCase(),
      token: hashedToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
      used: false
    });
    
    // 8. Enviar email (con token SIN hashear)
    await sendPasswordResetEmail(
      user.email, 
      user.name || user.firstName || 'Usuario', 
      resetToken
    );
    
    console.log(`✅ Email de recuperación enviado a: ${user.email}`);
    
    // 9. Responder
    res.json(standardResponse);
    
  } catch (error) {
    console.error('❌ Error en /forgot-password:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al procesar solicitud. Por favor intenta nuevamente.' 
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Restablecer contraseña con token
 * 
 * Body: { token: string, newPassword: string }
 * Response: { success: boolean, message: string }
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
      message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña.' 
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

## 6️⃣ Registrar Rutas

En tu archivo principal (`server.js`, `app.js` o `index.js`):

```javascript
const authRoutes = require('./routes/auth.routes');

// Registrar rutas de autenticación
app.use('/api/auth', authRoutes);
```

---

## 7️⃣ Tarea de Limpieza (Opcional pero Recomendado)

Crear un cron job para limpiar tokens expirados:

**Archivo:** `src/jobs/cleanup.job.js`

```javascript
const PasswordReset = require('../models/PasswordReset');

/**
 * Elimina tokens expirados de la base de datos
 * Ejecutar cada 24 horas
 */
async function cleanupExpiredTokens() {
  try {
    const result = await PasswordReset.destroy({
      where: {
        expiresAt: { $lt: new Date() }
      }
    });
    
    console.log(`🧹 Limpieza: ${result} tokens expirados eliminados`);
  } catch (error) {
    console.error('❌ Error en limpieza de tokens:', error);
  }
}

// Ejecutar cada 24 horas
setInterval(cleanupExpiredTokens, 24 * 60 * 60 * 1000);

module.exports = { cleanupExpiredTokens };
```

---

## 📊 Estructura de Datos

### Tabla `users` (ya existe):
```javascript
{
  id: 1,
  email: "usuario@ejemplo.com",
  password: "hash_bcrypt...",
  name: "Juan Pérez",
  role: "PROVIDER", // o "DOCTOR", "PATIENT", "ADMIN"
  tipo: "clinic" // o "pharmacy", "lab", "ambulance", etc.
}
```

### Tabla `password_resets` (nueva):
```javascript
{
  id: 1,
  userId: 1,
  email: "usuario@ejemplo.com",
  token: "hash_sha256_del_token...",
  expiresAt: "2026-02-12 15:30:00",
  used: false,
  usedAt: null,
  createdAt: "2026-02-12 14:30:00"
}
```

---

## 🔒 Consideraciones de Seguridad

### ✅ Implementadas:

1. **Token hasheado en BD**: El token se guarda hasheado con SHA-256
2. **Respuesta estándar**: Siempre se responde lo mismo, no se revela si el email existe
3. **Expiración corta**: 1 hora de validez
4. **Un solo uso**: El token se marca como usado después de cambiar la contraseña
5. **Límite de intentos**: Máximo 3 intentos por hora por email
6. **Contraseña hasheada**: Se usa bcrypt con salt de 10 rondas

### 🔐 Recomendaciones Adicionales:

- Usar HTTPS en producción
- Implementar rate limiting global
- Agregar logs de auditoría
- Considerar 2FA para cuentas sensibles
- Invalidar sesiones activas al cambiar contraseña

---

## 🧪 Pruebas

### Probar endpoint de solicitud:

```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@ejemplo.com"}'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Si el email está registrado, recibirás un enlace de recuperación en los próximos minutos."
}
```

### Probar endpoint de reset:

```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token":"abc123def456...",
    "newPassword":"nuevaContraseña123"
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña."
}
```

---

## 📝 Checklist de Implementación

- [ ] Instalar dependencias (`resend`, `bcrypt`)
- [ ] Configurar variables de entorno
- [ ] Crear cuenta en Resend y obtener API Key
- [ ] Crear tabla `password_resets` en BD
- [ ] Crear servicio de email (`email.service.js`)
- [ ] Crear endpoints (`auth.routes.js`)
- [ ] Registrar rutas en servidor principal
- [ ] Probar endpoint `/forgot-password`
- [ ] Verificar que llegue el email
- [ ] Probar endpoint `/reset-password`
- [ ] Verificar que se actualice la contraseña
- [ ] Implementar limpieza de tokens (opcional)
- [ ] Agregar logs de auditoría (opcional)

---

## 🆘 Soporte

Si tienes dudas o problemas:

1. Verifica que las variables de entorno estén correctas
2. Revisa los logs del servidor
3. Verifica que Resend esté configurado correctamente
4. Asegúrate de que la tabla `password_resets` exista
5. Verifica que el modelo `User` tenga el campo `email`

---

## 📚 Recursos

- Documentación de Resend: https://resend.com/docs
- Documentación de bcrypt: https://www.npmjs.com/package/bcrypt
- Buenas prácticas de seguridad: https://owasp.org/www-project-top-ten/

---

**Fecha:** 12 de Febrero, 2026  
**Proyecto:** DOCALINK - Sistema de Recuperación de Contraseña  
**Versión:** 1.0
