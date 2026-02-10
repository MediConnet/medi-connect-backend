# ✅ RESPUESTA - Problema de Ambulancia

**Fecha:** 10 de Febrero, 2026

---

## 📋 PROBLEMA REPORTADO

El endpoint `GET /api/ambulances/profile` devuelve error "Error al obtener ambulancia" después de que un usuario se registra como ambulancia y el admin la aprueba.

---

## 🔍 DIAGNÓSTICO

He revisado el código y encontré que:

1. ✅ El endpoint de login está correcto (ya lo arreglamos antes)
2. ✅ La función `createProviderProfile` SÍ crea el `provider` y el `provider_branches`
3. ❓ El problema puede estar en:
   - El provider no se está creando correctamente al registrar
   - El provider_branches no se está creando
   - El provider existe pero no tiene branches activas

---

## ✅ SOLUCIÓN IMPLEMENTADA

He agregado **logs detallados** al endpoint `GET /api/ambulances/profile` para diagnosticar exactamente dónde falla:

### Logs agregados:

```typescript
console.log('🔍 [AMBULANCE PROFILE] 1. User ID del token:', authContext.user.id);
console.log('🔍 [AMBULANCE PROFILE] 2. User role:', authContext.user.role);
console.log('🔍 [AMBULANCE PROFILE] 3. Provider encontrado:', provider ? {...} : null);
console.log('🔍 [AMBULANCE PROFILE] 4. Main branch:', mainBranch ? {...} : null);
```

### Validaciones agregadas:

1. ✅ Verifica que el provider exista
2. ✅ Verifica que el provider tenga branches activas
3. ✅ Muestra información detallada del provider y branch
4. ✅ Muestra el stack trace completo si hay error

---

## 🧪 CÓMO PROBAR

### 1. Reiniciar el servidor
```bash
npm run dev
```

### 2. Hacer login con la ambulancia
```bash
POST /api/auth/login
{
  "email": "tu-ambulancia@ejemplo.com",
  "password": "tu-password"
}
```

### 3. Obtener el perfil
```bash
GET /api/ambulances/profile
Authorization: Bearer {token}
```

### 4. Revisar los logs del servidor

Deberías ver algo como:

**Si funciona:**
```
🔍 [AMBULANCE PROFILE] 1. User ID del token: abc-123-def
🔍 [AMBULANCE PROFILE] 2. User role: provider
🔍 [AMBULANCE PROFILE] 3. Provider encontrado: {
  id: "provider-id",
  commercial_name: "Mi Ambulancia",
  verification_status: "APPROVED",
  category: "ambulance",
  branches_count: 1
}
🔍 [AMBULANCE PROFILE] 4. Main branch: {
  id: "branch-id",
  name: "Mi Ambulancia",
  is_main: true,
  is_active: true
}
✅ [AMBULANCE PROFILE] Perfil obtenido exitosamente
```

**Si falla (provider no existe):**
```
🔍 [AMBULANCE PROFILE] 1. User ID del token: abc-123-def
🔍 [AMBULANCE PROFILE] 2. User role: provider
🔍 [AMBULANCE PROFILE] 3. Provider encontrado: null
❌ [AMBULANCE PROFILE] No se encontró provider para user_id: abc-123-def
```

**Si falla (no tiene branches):**
```
🔍 [AMBULANCE PROFILE] 1. User ID del token: abc-123-def
🔍 [AMBULANCE PROFILE] 2. User role: provider
🔍 [AMBULANCE PROFILE] 3. Provider encontrado: {
  id: "provider-id",
  commercial_name: "Mi Ambulancia",
  verification_status: "APPROVED",
  category: "ambulance",
  branches_count: 0  ← ❌ PROBLEMA AQUÍ
}
❌ [AMBULANCE PROFILE] Provider no tiene branches activas
```

---

## 🔧 POSIBLES SOLUCIONES SEGÚN LOS LOGS

### Caso 1: Provider no existe
**Logs mostrarán:** `Provider encontrado: null`

**Solución:** Verificar en la base de datos:
```sql
SELECT * FROM users WHERE email = 'tu-ambulancia@ejemplo.com';
SELECT * FROM providers WHERE user_id = 'USER_ID_AQUI';
```

Si no existe el provider, el problema está en el registro. Necesitamos verificar que `createProviderProfile` se esté llamando correctamente.

### Caso 2: Provider existe pero no tiene branches
**Logs mostrarán:** `branches_count: 0`

**Solución:** Verificar en la base de datos:
```sql
SELECT * FROM provider_branches WHERE provider_id = 'PROVIDER_ID_AQUI';
```

Si no existen branches, el problema está en `createProviderProfile` al crear el branch.

### Caso 3: Branch existe pero no está activo
**Logs mostrarán:** `branches_count: 0` (porque filtra por `is_active: true`)

**Solución:** Activar el branch:
```sql
UPDATE provider_branches 
SET is_active = true 
WHERE provider_id = 'PROVIDER_ID_AQUI';
```

---

## 📝 PRÓXIMOS PASOS

1. **Probar con la ambulancia registrada**
2. **Revisar los logs del servidor** para ver exactamente dónde falla
3. **Enviarme los logs** para que pueda diagnosticar el problema exacto
4. **Verificar la base de datos** con las queries SQL de arriba

---

## 🎯 INFORMACIÓN QUE NECESITO

Para ayudarte mejor, necesito que me envíes:

1. **Los logs del servidor** cuando haces `GET /api/ambulances/profile`
2. **El resultado de estas queries SQL:**
```sql
-- Reemplaza el email con el de tu ambulancia
SELECT id, email, role FROM users WHERE email = 'tu-ambulancia@ejemplo.com';

-- Reemplaza USER_ID con el id del paso anterior
SELECT id, commercial_name, verification_status, category_id 
FROM providers WHERE user_id = 'USER_ID_AQUI';

-- Reemplaza PROVIDER_ID con el id del paso anterior
SELECT id, name, is_main, is_active, phone_contact 
FROM provider_branches WHERE provider_id = 'PROVIDER_ID_AQUI';
```

Con esa información podré decirte exactamente qué está fallando y cómo arreglarlo.

---

## ✅ ARCHIVOS MODIFICADOS

- `src/ambulances/ambulances.controller.ts` - Agregados logs detallados

---

**Backend Team**  
**10 de Febrero, 2026**
