# 🐛 PROBLEMA: Backend No Encuentra la Ambulancia del Usuario

## Fecha: 10 de febrero de 2026

---

## 🎯 PROBLEMA ACTUAL

**Síntoma**: Al iniciar sesión con una ambulancia recién registrada y aprobada, el endpoint `GET /api/ambulances/profile` devuelve error:

```
Error: Error al obtener ambulancia
```

---

## 🔍 EVIDENCIA DE LOS LOGS

### ✅ Login Funciona Correctamente

```
[LOGIN] Respuesta completa del backend: { user: {...}, token: "..." }
[LOGIN] User recibido: { userId: "...", email: "...", role: "provider", tipo: "ambulance" }
[LOGIN] Token recibido: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
✅ Login Exitoso: { role: "provider", tipo: "ambulance", userId: "...", email: "..." }
```

### ✅ Sesión Verificada

```
[STORE] Sesión revocada en el servidor
[USE CASE] Logout completado
[LOGIN] Respuesta completa del backend: { Object }
[LOGIN] User recibido: { Object }
Login Exitoso: { Object }
```

### ❌ Error al Obtener Perfil

```
[AMBULANCE] Obteniendo perfil de ambulancia desde el backend...
❌ Error loading ambulance profile: Error: Error al obtener ambulancia
```

---

## 🔍 ANÁLISIS DEL PROBLEMA

### Flujo Actual

1. ✅ Usuario se registra como ambulancia
2. ✅ Admin aprueba la solicitud
3. ✅ Usuario inicia sesión → Token JWT generado correctamente
4. ✅ Frontend guarda el token
5. ✅ Frontend hace request a `GET /api/ambulances/profile` con Bearer token
6. ❌ **Backend devuelve error**: "Error al obtener ambulancia"

### Posibles Causas

#### 1. Usuario No Tiene Provider Asociado

El usuario se creó en la tabla `users`, pero no se creó el registro correspondiente en la tabla `providers`.

**Verificar en la BD**:
```sql
-- Buscar el usuario por email
SELECT * FROM users WHERE email = 'email-de-la-ambulancia@ejemplo.com';

-- Verificar si tiene provider asociado
SELECT * FROM providers WHERE user_id = 'USER_ID_AQUI';
```

**Resultado esperado**: Debe existir un registro en `providers` con:
- `user_id` = ID del usuario
- `category_id` = ID de la categoría "Ambulancia"
- `verification_status` = 'verified' (si fue aprobado)

#### 2. Provider No Está en la Tabla Específica

El provider existe, pero no hay registro en la tabla `ambulances`.

**Verificar en la BD**:
```sql
-- Buscar el provider
SELECT * FROM providers WHERE user_id = 'USER_ID_AQUI';

-- Verificar si existe en ambulances
SELECT * FROM ambulances WHERE provider_id = 'PROVIDER_ID_AQUI';
```

**Resultado esperado**: Debe existir un registro en `ambulances` con:
- `provider_id` = ID del provider
- Datos de la ambulancia (nombre comercial, teléfono, etc.)

#### 3. Endpoint Busca en la Tabla Incorrecta

El endpoint `GET /api/ambulances/profile` puede estar buscando directamente en `ambulances` por `user_id`, cuando debería:
1. Buscar el `provider` por `user_id`
2. Luego buscar en `ambulances` por `provider_id`

---

## 📝 VERIFICACIÓN NECESARIA EN EL BACKEND

### Endpoint: `GET /api/ambulances/profile`

```javascript
// 1. Obtener user_id del token JWT
const userId = req.user.id; // Del middleware de autenticación

console.log('🔍 [AMBULANCE PROFILE] User ID del token:', userId);

// 2. Buscar el provider del usuario
const provider = await Provider.findOne({
  where: { user_id: userId }
});

console.log('🔍 [AMBULANCE PROFILE] Provider encontrado:', provider);

if (!provider) {
  return res.status(404).json({
    success: false,
    message: 'No se encontró un proveedor asociado a este usuario'
  });
}

// 3. Buscar la ambulancia del provider
const ambulance = await Ambulance.findOne({
  where: { provider_id: provider.id },
  include: [/* relaciones necesarias */]
});

console.log('🔍 [AMBULANCE PROFILE] Ambulancia encontrada:', ambulance);

if (!ambulance) {
  return res.status(404).json({
    success: false,
    message: 'No se encontró una ambulancia asociada a este proveedor'
  });
}

// 4. Devolver el perfil
return res.json({
  success: true,
  data: ambulance
});
```

---

## 🔧 SOLUCIÓN ESPERADA

### Opción 1: Crear Provider y Ambulancia al Aprobar

Cuando el admin aprueba una solicitud de ambulancia, el backend debe:

1. Crear el registro en `providers`:
```sql
INSERT INTO providers (id, user_id, category_id, commercial_name, verification_status)
VALUES (uuid(), 'USER_ID', 'AMBULANCE_CATEGORY_ID', 'Nombre Comercial', 'verified');
```

2. Crear el registro en `ambulances`:
```sql
INSERT INTO ambulances (id, provider_id, emergency_phone, whatsapp, ...)
VALUES (uuid(), 'PROVIDER_ID', '0999999999', '0999999999', ...);
```

### Opción 2: Crear Provider y Ambulancia al Registrar

Cuando el usuario se registra como ambulancia, el backend debe:

1. Crear el usuario en `users`
2. Crear el provider en `providers` (con `verification_status = 'pending'`)
3. Crear la ambulancia en `ambulances`
4. Cuando el admin aprueba, solo cambiar `verification_status` a 'verified'

---

## 🧪 CÓMO VERIFICAR

### 1. Revisar la Base de Datos

```sql
-- Email de la ambulancia que registraste
SET @email = 'tu-ambulancia@ejemplo.com';

-- 1. Buscar el usuario
SELECT id, email, role FROM users WHERE email = @email;

-- 2. Buscar el provider (usar el user_id del paso anterior)
SELECT * FROM providers WHERE user_id = 'USER_ID_AQUI';

-- 3. Buscar la ambulancia (usar el provider_id del paso anterior)
SELECT * FROM ambulances WHERE provider_id = 'PROVIDER_ID_AQUI';
```

### 2. Agregar Logs en el Endpoint

Agregar logs en cada paso del endpoint `GET /api/ambulances/profile` para ver dónde falla:

```javascript
console.log('1. User ID del token:', userId);
console.log('2. Provider encontrado:', provider);
console.log('3. Ambulancia encontrada:', ambulance);
```

---

## 📊 RESULTADO ESPERADO

Después de la corrección, los logs deberían mostrar:

```
🔍 [AMBULANCE] Obteniendo perfil de ambulancia desde el backend...
🔍 [AMBULANCE] Perfil recibido: {
  id: "...",
  commercialName: "Mi Ambulancia",
  emergencyPhone: "0999999999",
  whatsapp: "0999999999",
  ...
}
```

Y el dashboard debería mostrar los datos correctos de la ambulancia del usuario.

---

## 🚨 URGENCIA

🔴 **CRÍTICO** - Los usuarios no pueden usar la aplicación después de registrarse.

---

**Nota**: El frontend está funcionando correctamente. El token se genera, guarda y envía correctamente. El problema está 100% en el backend, específicamente en el endpoint `GET /api/ambulances/profile` o en la creación de los registros al aprobar la solicitud.
