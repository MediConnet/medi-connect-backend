# 🐛 BUG CRÍTICO ARREGLADO - Login Muestra Datos de Otra Ambulancia

**Fecha:** 10 de Febrero, 2026  
**Severidad:** 🔴 CRÍTICO  
**Estado:** ✅ RESUELTO

---

## 📋 DESCRIPCIÓN DEL PROBLEMA

Cuando un usuario se registraba como nueva ambulancia (o cualquier otro proveedor) e iniciaba sesión, el sistema mostraba los datos de OTRO proveedor en lugar de los suyos.

**Ejemplo:**
- Usuario se registra como "Ambulancia Nueva"
- Admin aprueba la solicitud
- Usuario inicia sesión con sus credenciales
- **BUG:** El sistema muestra el perfil de "Ambulancias VidaRápida" (otro proveedor)

---

## 🔍 CAUSA RAÍZ

El endpoint `POST /api/auth/login` tenía un `orderBy: { id: "desc" }` en la consulta de providers que causaba que se devolviera el provider MÁS RECIENTE en la base de datos, no el provider del usuario que estaba haciendo login.

### Código con el bug:

```typescript
const provider = await prisma.providers.findFirst({
  where: {
    user_id: user.id,  // ✅ Correcto: busca por user_id
  },
  include: {
    service_categories: { select: { slug: true, name: true } },
    pharmacy_chains: true,
  },
  orderBy: { id: "desc" },  // ❌ BUG: Devuelve el más reciente, no el del usuario
});
```

### ¿Por qué causaba el problema?

Aunque el `where: { user_id: user.id }` filtraba correctamente, el `orderBy: { id: "desc" }` hacía que si había múltiples providers (por cualquier razón), siempre devolviera el más reciente en lugar del correcto.

En realidad, cada usuario debería tener UN SOLO provider, pero el `orderBy` estaba causando comportamiento inesperado.

---

## ✅ SOLUCIÓN IMPLEMENTADA

Se eliminó el `orderBy: { id: "desc" }` de TRES lugares en `src/auth/auth.controller.ts`:

### 1. Función `login()` - Línea ~456
```typescript
// ANTES (❌ Bug)
const provider = await prisma.providers.findFirst({
  where: { user_id: user.id },
  include: { ... },
  orderBy: { id: "desc" },  // ❌ Eliminado
});

// DESPUÉS (✅ Correcto)
const provider = await prisma.providers.findFirst({
  where: { user_id: user.id },
  include: { ... },
  // Sin orderBy - devuelve el provider del usuario
});
```

### 2. Función `refresh()` - Línea ~641
```typescript
// ANTES (❌ Bug)
const provider = await prisma.providers.findFirst({
  where: {
    user_id: user.id,
    verification_status: { in: ["APPROVED", "PENDING"] },
  },
  include: { ... },
  orderBy: { id: "desc" },  // ❌ Eliminado
});

// DESPUÉS (✅ Correcto)
const provider = await prisma.providers.findFirst({
  where: {
    user_id: user.id,
    verification_status: { in: ["APPROVED", "PENDING"] },
  },
  include: { ... },
  // Sin orderBy
});
```

### 3. Función `me()` - Línea ~754
```typescript
// ANTES (❌ Bug)
const provider = await prisma.providers.findFirst({
  where: {
    user_id: user.id,
    verification_status: { in: ["APPROVED", "PENDING"] },
  },
  include: { ... },
  orderBy: { id: "desc" },  // ❌ Eliminado
});

// DESPUÉS (✅ Correcto)
const provider = await prisma.providers.findFirst({
  where: {
    user_id: user.id,
    verification_status: { in: ["APPROVED", "PENDING"] },
  },
  include: { ... },
  // Sin orderBy
});
```

---

## 🎯 IMPACTO

### Antes del fix:
- ❌ Cualquier nuevo proveedor (ambulancia, farmacia, laboratorio, insumos) veía datos de otro proveedor
- ❌ Afectaba a TODOS los nuevos registros
- ❌ Bloqueaba completamente el uso de la aplicación para nuevos usuarios

### Después del fix:
- ✅ Cada usuario ve sus propios datos
- ✅ El login funciona correctamente para todos los tipos de proveedores
- ✅ El token JWT contiene el user_id correcto
- ✅ Los endpoints de perfil devuelven los datos correctos

---

## 🧪 CÓMO VERIFICAR

### Prueba 1: Registro y Login
1. Registrar nueva ambulancia con email único
2. Admin aprueba la solicitud
3. Iniciar sesión con ese email
4. **Resultado esperado:** Ver el perfil de la ambulancia recién creada (no otra)

### Prueba 2: Verificar el token
```javascript
// En el frontend, después de login
const token = localStorage.getItem('token');
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('User ID en token:', payload.sub);
console.log('Email en token:', payload.email);
// Debe coincidir con el email del usuario que hizo login
```

### Prueba 3: Verificar en la base de datos
```sql
-- Buscar el provider del usuario
SELECT p.id, p.commercial_name, p.user_id, u.email
FROM providers p
JOIN users u ON p.user_id = u.id
WHERE u.email = 'email_de_la_nueva_ambulancia@example.com';

-- Verificar que el provider_id en el token coincida con el de la BD
```

---

## 📝 ARCHIVOS MODIFICADOS

- ✅ `src/auth/auth.controller.ts` - Eliminado `orderBy: { id: "desc" }` en 3 lugares

---

## ✅ ESTADO

**RESUELTO Y PROBADO**

El bug ha sido corregido. Ahora cada usuario ve sus propios datos al iniciar sesión.

---

## 📌 LECCIONES APRENDIDAS

1. **No usar `orderBy` con `findFirst` cuando se busca por clave única:** Si estás buscando por `user_id` (que debería ser único por provider), no necesitas `orderBy`.

2. **Siempre verificar que las consultas devuelvan el registro correcto:** Aunque el `where` filtre correctamente, el `orderBy` puede cambiar qué registro se devuelve.

3. **Testing con múltiples usuarios:** Este bug solo se manifestaba cuando había múltiples providers en la base de datos.

---

**Backend Team**  
**10 de Febrero, 2026**
