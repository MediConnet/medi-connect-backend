# ❓ Pregunta Urgente para el Frontend

## 🚨 Problema Actual

El backend está recibiendo `email` y `password` como `undefined` en el registro.

---

## 🔍 Lo que Necesito Saber:

### Pregunta 1: ¿Qué nombres de campo usan en el FormData?

Cuando construyen el FormData, ¿usan exactamente estos nombres?

```typescript
formData.append('email', ...);      // ← ¿Es "email" o "correo" o "userEmail"?
formData.append('password', ...);   // ← ¿Es "password" o "contrasena" o "pass"?
```

**Por favor confirmen los nombres EXACTOS que usan.**

---

### Pregunta 2: ¿Pueden agregar este console.log?

En `register-professional.usecase.ts`, justo después de crear el FormData:

```typescript
// Después de crear formData
console.log('🔍 [FRONTEND] Verificando FormData:');
for (let [key, value] of formData.entries()) {
  if (key === 'email' || key === 'password') {
    console.log(`  ✅ ${key}:`, value);
  } else {
    console.log(`  ${key}:`, typeof value === 'string' ? value.substring(0, 20) : value);
  }
}

// Verificar específicamente email y password
console.log('📧 [FRONTEND] Email en FormData:', formData.get('email'));
console.log('🔑 [FRONTEND] Password en FormData:', formData.get('password') ? '***' : 'undefined');
```

Luego intenten registrarse y envíenme el output del console.log.

---

### Pregunta 3: ¿El email y password están en cleanData?

Antes de crear el FormData, agreguen:

```typescript
console.log('🔍 [FRONTEND] cleanData antes de FormData:', {
  email: cleanData.email,
  password: cleanData.password ? '***' : undefined,
  hasEmail: !!cleanData.email,
  hasPassword: !!cleanData.password,
});
```

---

## 🎯 Lo que Estoy Buscando:

Necesito confirmar si:

1. ✅ El email y password ESTÁN en `cleanData`
2. ✅ Se AGREGAN al FormData con los nombres correctos
3. ✅ El FormData los CONTIENE antes de enviarse

---

## 💡 Mi Sospecha:

Creo que el problema es uno de estos:

### Opción A: Los campos no se agregan al FormData
```typescript
// Si cleanData.email es undefined, este código NO lo agrega:
Object.entries(cleanData).forEach(([key, value]) => {
  if (value === undefined || value === null) return; // ← Aquí se salta
  formData.append(key, String(value));
});
```

### Opción B: Se usan nombres diferentes
```typescript
// Frontend usa:
formData.append('correo', email);  // ❌

// Backend espera:
f["email"]  // ← undefined porque busca "email", no "correo"
```

---

## 📋 Resumen de lo que Necesito:

1. ✅ Los nombres EXACTOS de los campos en FormData
2. ✅ El console.log del FormData completo
3. ✅ Confirmar que email/password están en cleanData

Con esa información puedo arreglar el problema de inmediato.

---

## ⏰ Es Urgente

El registro está bloqueado hasta que identifiquemos esto. Por favor envíenme esa información lo antes posible.

---

Gracias!
Backend Team
