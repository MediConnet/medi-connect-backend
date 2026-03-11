# 🔍 Respuesta Backend: Debug del Campo Email

## ✅ Confirmación

Gracias por la verificación. El código del frontend está correcto.

---

## 🔍 Análisis del Backend

He revisado el código del backend y el parsing está implementado correctamente:

### Código del Backend (auth.controller.ts - Línea 386-440):

```typescript
if (isMultipart) {
  const parsed = await parseMultipartBody({...});
  const f = parsed.fields;
  
  body = registerSchema.parse({
    email: f["email"],  // ✅ Se extrae el email de FormData
    password: f["password"],
    // ... resto de campos
  });
}
```

### Schema de Validación (validators.ts - Línea 15):

```typescript
export const registerSchema = z.object({
  email: z.string().email(),  // ✅ Email es requerido y debe ser válido
  password: z.string().min(6),
  // ... resto de campos
});
```

---

## 🐛 Posible Causa del Error

El error dice que `email` está llegando como `undefined`. Esto puede pasar si:

### 1. El campo se envía con un nombre diferente

En FormData, el nombre del campo debe ser **exactamente** `"email"`.

**Verificación necesaria:**

Cuando construyen el FormData en el frontend, asegúrense de que sea:

```typescript
// ✅ CORRECTO
formData.append('email', values.email);

// ❌ INCORRECTO
formData.append('Email', values.email);  // Mayúscula
formData.append('correo', values.email); // Nombre diferente
formData.append('userEmail', values.email); // Nombre diferente
```

### 2. El valor del email está vacío o null

```typescript
// ❌ Esto causaría el error
formData.append('email', undefined);
formData.append('email', null);
formData.append('email', '');
```

---

## 🧪 Prueba de Debug

### Para el Frontend:

Agrega este código justo antes de enviar el FormData:

```typescript
// En register-professional.usecase.ts, después de crear el FormData

console.log('🔍 [DEBUG] Verificando FormData:');

// Mostrar todos los campos
for (let [key, value] of formData.entries()) {
  console.log(`  ${key}:`, value);
}

// Verificar específicamente el email
const emailValue = formData.get('email');
console.log('📧 [DEBUG] Email en FormData:', emailValue);
console.log('📧 [DEBUG] Tipo de email:', typeof emailValue);
console.log('📧 [DEBUG] Email es undefined?', emailValue === undefined);
console.log('📧 [DEBUG] Email es null?', emailValue === null);
console.log('📧 [DEBUG] Email es string vacío?', emailValue === '');
```

---

## 🔧 Solución Temporal

Mientras investigamos, pueden agregar una validación extra en el frontend:

```typescript
// Antes de crear el FormData
if (!cleanData.email || cleanData.email === '') {
  throw new Error('Email es requerido y no puede estar vacío');
}

console.log('✅ Email validado:', cleanData.email);

// Luego crear el FormData
const formData = new FormData();
formData.append('email', cleanData.email);
```

---

## 📊 Casos a Probar

### Caso 1: Registro de Farmacia (sin archivos)
```
1. Ir a /register?tipo=pharmacy
2. Llenar formulario con email válido
3. NO subir archivos
4. Enviar
5. Ver console.log del FormData
```

### Caso 2: Registro de Médico (con archivos)
```
1. Ir a /register?tipo=doctor
2. Llenar formulario con email válido
3. Subir archivos (licencias, etc.)
4. Enviar
5. Ver console.log del FormData
```

---

## 🎯 Siguiente Paso

Por favor:

1. ✅ Agrega los console.log que sugerí
2. ✅ Intenta registrarte
3. ✅ Copia y pega aquí el output completo del console.log
4. ✅ Especialmente el que dice: `📧 [DEBUG] Email en FormData:`

Con esa información podré ver exactamente qué está pasando.

---

## 💡 Hipótesis

Mi hipótesis es que el problema está en esta parte del código del frontend:

```typescript
Object.entries(cleanData).forEach(([key, value]) => {
  if (value === undefined || value === null) return; // ← Aquí
  
  if (Array.isArray(value)) {
    value.forEach((item) => {
      formData.append(key, String(item));
    });
    return;
  }
  
  formData.append(key, String(value));
});
```

Si `cleanData.email` es `undefined` o `null`, **no se agrega al FormData**.

**Verificación:** Agrega un console.log antes del forEach:

```typescript
console.log('🔍 [DEBUG] cleanData completo:', cleanData);
console.log('🔍 [DEBUG] cleanData.email:', cleanData.email);

Object.entries(cleanData).forEach(([key, value]) => {
  if (key === 'email') {
    console.log('📧 [DEBUG] Procesando email:', value);
  }
  
  if (value === undefined || value === null) {
    if (key === 'email') {
      console.error('❌ [DEBUG] Email es undefined/null, NO se agregará al FormData');
    }
    return;
  }
  
  // ... resto del código
});
```

---

## ✅ Resumen

1. El backend está bien configurado
2. El schema de validación es correcto
3. El problema parece estar en cómo se construye el FormData
4. Necesitamos ver los logs del FormData para confirmar

Esperando los logs del debug para continuar.

---

Saludos,
Backend Team
