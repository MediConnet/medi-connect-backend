# 🐛 Error en Registro - Campo Email Faltante

## ❌ Problema Detectado

El endpoint de registro está fallando porque el campo `email` no está llegando al backend.

---

## 📊 Error del Backend (Logs de Render):

```
[REGISTER] Error al registrar usuario: [
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "undefined",
    "path": ["email"],
    "message": "Required"
  }
]
```

**Traducción:** El backend espera recibir `email` como string, pero está recibiendo `undefined` (no está llegando).

---

## 🔍 Endpoint Afectado:

```
POST /api/auth/register
```

---

## 🎯 Causa Probable:

El formulario de registro no está enviando el campo `email` en el body de la petición, o lo está enviando con un nombre diferente.

---

## ✅ Solución para el Frontend:

### 1. Verificar que el campo email se esté enviando

Revisa el código donde haces el POST al registro:

```typescript
// ❌ MAL - Si el email no está en el objeto
const data = {
  password: "...",
  // email falta aquí
};

// ✅ BIEN - El email debe estar en el objeto
const data = {
  email: formData.email, // ← Asegúrate de que esto esté
  password: "...",
  // ... otros campos
};
```

### 2. Agregar console.log para debug

Antes de enviar la petición, agrega:

```typescript
console.log('📤 Datos que se envían al registro:', data);

// Luego el POST
await httpClient.post('/auth/register', data);
```

### 3. Verificar el formulario

Asegúrate de que el input del email tenga el name correcto:

```tsx
// ❌ MAL
<input name="correo" ... />

// ✅ BIEN
<input name="email" ... />
```

---

## 🧪 Cómo Verificar:

### Paso 1: Abre la consola del navegador
```
F12 → Console
```

### Paso 2: Intenta registrarte

### Paso 3: Revisa el console.log
Deberías ver algo como:
```javascript
📤 Datos que se envían al registro: {
  email: "usuario@ejemplo.com",  // ← Debe estar aquí
  password: "...",
  // ... otros campos
}
```

### Paso 4: Si el email NO aparece
Entonces el problema está en cómo están capturando el valor del input.

---

## 📋 Checklist de Verificación:

- [ ] El input tiene `name="email"` o el campo correcto
- [ ] El valor del email se está capturando en el estado/formulario
- [ ] El email se está incluyendo en el objeto que se envía al backend
- [ ] El console.log muestra el email en el objeto

---

## 🔧 Ejemplo de Código Correcto:

```typescript
// Formulario
const [formData, setFormData] = useState({
  email: '',
  password: '',
  // ... otros campos
});

// Handler del submit
const handleSubmit = async (e) => {
  e.preventDefault();
  
  // Debug: Ver qué se está enviando
  console.log('📤 Datos del registro:', formData);
  
  // Verificar que email existe
  if (!formData.email) {
    console.error('❌ Email está vacío!');
    return;
  }
  
  try {
    await httpClient.post('/auth/register', formData);
  } catch (error) {
    console.error('Error:', error);
  }
};
```

---

## ⚠️ Nota Importante:

Este error **NO tiene relación con el email de bienvenida** que implementé en el backend.

- ✅ El email de bienvenida funciona en `/api/admin/requests/{id}/approve`
- ❌ Este error es en `/api/auth/register` (endpoint diferente)

Son dos cosas completamente separadas.

---

## 📞 Si Necesitan Ayuda:

Envíenme:
1. El console.log del objeto que están enviando
2. El código del formulario de registro
3. El código donde hacen el POST

Con eso puedo ayudarles a encontrar el problema exacto.

---

## ✅ Una Vez Arreglado:

Cuando corrijan el campo `email`, el registro funcionará y:
1. El usuario se registrará correctamente
2. Quedará como "pendiente de aprobación"
3. Cuando el admin lo apruebe, recibirá el email de bienvenida automáticamente

---

Saludos,
Backend Team
