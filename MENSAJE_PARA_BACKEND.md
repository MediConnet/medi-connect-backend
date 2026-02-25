# 📨 Mensaje para el Equipo de Backend

## 🎯 Resumen

El frontend está listo y esperando que el endpoint de invitación de médicos funcione correctamente.

---

## ✅ Lo Que Hice en el Frontend

Actualicé el código para llamar al endpoint:

```
POST /api/clinics/doctors/invitation
```

---

## 🔧 Lo Que Necesito del Backend

### Endpoint Requerido:

```http
POST /api/clinics/doctors/invitation
```

### Headers:
```http
Authorization: Bearer <token_de_la_clinica>
Content-Type: application/json
```

### Body:
```json
{
  "email": "doctor@example.com"
}
```

### Response Esperada:
```json
{
  "success": true,
  "data": {
    "invitationLink": "/clinic/invite/abc123def456...",
    "expiresAt": "2024-12-31T23:59:59.000Z"
  }
}
```

**Notas sobre la respuesta:**
- `invitationLink` puede ser:
  - Ruta relativa: `/clinic/invite/token123` ✅ (preferido)
  - URL completa: `http://localhost:5173/clinic/invite/token123` ✅ (también funciona)
  - Solo el token: `token123` ✅ (el frontend lo maneja)
- `expiresAt` debe ser un ISO string con la fecha de expiración

---

## 🔍 Verificaciones Necesarias

### 1. ¿Existe el endpoint?

Busca en tu código backend:

```javascript
// ¿Tienes algo así?
router.post('/doctors/invitation', authenticateClinic, inviteDoctorController);
```

Si NO existe, créalo o dime qué endpoint SÍ existe para que actualice el frontend.

### 2. ¿Requiere autenticación?

El endpoint DEBE:
- ✅ Verificar que el token sea válido
- ✅ Verificar que el usuario sea una clínica (role: 'clinic')
- ✅ Obtener el `clinicId` del token

### 3. ¿Qué hace el endpoint?

El endpoint debe:

1. ✅ Validar que el email sea válido
2. ✅ Generar un token único de invitación
3. ✅ Guardar la invitación en la BD con:
   - `clinicId` (de quien invita)
   - `email` (del médico invitado)
   - `token` (único)
   - `expiresAt` (fecha de expiración, ej: 7 días)
   - `status: 'pending'`
4. ✅ Retornar el link de invitación

**Opcional:** Enviar email automáticamente al médico (si tienes SES/SendGrid configurado)

---

## 📊 Ejemplo de Implementación Backend

```javascript
// routes/clinics.js
router.post('/doctors/invitation', authenticateToken, async (req, res) => {
  try {
    const { email } = req.body;
    const clinicId = req.user.id; // Del token JWT
    
    // Validar email
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email inválido'
      });
    }
    
    // Generar token único
    const token = crypto.randomBytes(32).toString('hex');
    
    // Calcular fecha de expiración (7 días)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    // Guardar invitación en BD
    await db.invitations.create({
      clinicId,
      email,
      token,
      expiresAt,
      status: 'pending'
    });
    
    // Construir link de invitación
    const invitationLink = `/clinic/invite/${token}`;
    
    // OPCIONAL: Enviar email
    // await sendInvitationEmail(email, invitationLink);
    
    // Retornar respuesta
    res.json({
      success: true,
      data: {
        invitationLink,
        expiresAt: expiresAt.toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error al crear invitación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear invitación'
    });
  }
});
```

---

## 🧪 Cómo Probar

### 1. Prueba con Postman/Thunder Client:

```http
POST http://localhost:3000/api/clinics/doctors/invitation
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "email": "test@example.com"
}
```

**Respuesta esperada:**
```json
{
  "success": true,
  "data": {
    "invitationLink": "/clinic/invite/abc123...",
    "expiresAt": "2024-12-31T23:59:59.000Z"
  }
}
```

### 2. Verifica en la BD:

Debe haber un registro en la tabla `invitations`:
```sql
SELECT * FROM invitations WHERE email = 'test@example.com';
```

### 3. Prueba desde el frontend:

1. Inicia sesión como clínica
2. Ve a "Gestión de Médicos"
3. Haz clic en "Invitar por Email"
4. Ingresa: `test@example.com`
5. Haz clic en "Generar y Abrir Correo"
6. Verifica en DevTools (F12 → Network) que el request sea 200 OK

---

## ❓ Preguntas Frecuentes

### ¿Debo enviar el email automáticamente?

**Opción A:** Enviar email automáticamente
- Ventaja: Flujo más rápido para el usuario
- Desventaja: Requiere configurar SES/SendGrid

**Opción B:** Solo generar el link
- Ventaja: No requiere configuración de email
- Desventaja: La clínica debe copiar y enviar el link manualmente

**Recomendación:** Empieza con Opción B (solo generar link) y luego agrega el envío automático.

### ¿Qué pasa si el email ya fue invitado?

Tienes 2 opciones:

**Opción A:** Retornar error
```javascript
const existingInvitation = await db.invitations.findOne({ 
  email, 
  status: 'pending' 
});

if (existingInvitation) {
  return res.status(400).json({
    success: false,
    message: 'Este email ya tiene una invitación pendiente'
  });
}
```

**Opción B:** Invalidar la anterior y crear una nueva
```javascript
// Invalidar invitaciones anteriores
await db.invitations.updateMany(
  { email, status: 'pending' },
  { status: 'cancelled' }
);

// Crear nueva invitación
// ...
```

### ¿Qué pasa si el médico ya está registrado?

```javascript
const existingDoctor = await db.users.findOne({ 
  email, 
  role: 'doctor' 
});

if (existingDoctor) {
  return res.status(400).json({
    success: false,
    message: 'Este email ya está registrado como médico'
  });
}
```

---

## 🚨 Errores Comunes

### Error 404 - Ruta no encontrada
```
POST /api/clinics/doctors/invitation → 404
```

**Causa:** El endpoint no está registrado en el router

**Solución:** Verifica que tengas:
```javascript
router.post('/doctors/invitation', ...)
```

Y que el router esté montado:
```javascript
app.use('/api/clinics', clinicsRouter);
```

### Error 401 - No autorizado
```
POST /api/clinics/doctors/invitation → 401
```

**Causa:** El token no es válido o no se está enviando

**Solución:** Verifica que el middleware de autenticación esté funcionando:
```javascript
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Token no proporcionado' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido' });
  }
};
```

### Error 500 - Error del servidor
```
POST /api/clinics/doctors/invitation → 500
```

**Causa:** Error en el código del controlador

**Solución:** Revisa los logs del servidor para ver el error exacto.

---

## ✅ Checklist para el Backend

- [ ] Endpoint `POST /api/clinics/doctors/invitation` creado
- [ ] Middleware de autenticación agregado
- [ ] Validación de email implementada
- [ ] Generación de token único implementada
- [ ] Guardado en BD implementado
- [ ] Respuesta con formato correcto
- [ ] Manejo de errores implementado
- [ ] Probado con Postman/Thunder Client
- [ ] Verificado que retorna 200 OK
- [ ] Verificado que guarda en BD correctamente

---

## 📞 Siguiente Paso

Una vez que tengas el endpoint listo:

1. ✅ Pruébalo con Postman
2. ✅ Verifica que retorne 200 OK
3. ✅ Avísame para probar desde el frontend
4. ✅ Si hay algún error, comparte los logs

Si el endpoint tiene un nombre diferente o requiere datos adicionales, avísame para actualizar el frontend.

---

## 🎯 Resumen Ultra Corto

**Necesito que el backend tenga:**

```
POST /api/clinics/doctors/invitation
Body: { email: "doctor@example.com" }
Response: { success: true, data: { invitationLink: "/clinic/invite/token", expiresAt: "..." } }
```

**Eso es todo.** El frontend ya está listo para usarlo.
