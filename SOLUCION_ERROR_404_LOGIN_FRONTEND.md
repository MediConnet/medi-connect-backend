# ✅ Solución: Error 404 en Login - Instrucciones para Frontend

**Fecha:** 2026-02-18  
**Estado:** Backend funcionando correctamente ✅  
**Problema:** Frontend recibe 404 pero el backend responde 200

---

## 📋 Diagnóstico

### ✅ Backend Verificado

Los logs del backend confirman que:
- ✅ El endpoint `POST /api/auth/login` **SÍ existe y funciona**
- ✅ El backend está recibiendo las peticiones correctamente
- ✅ El backend responde con **Status: 200** (éxito)
- ✅ El servidor está corriendo en `http://localhost:3000`

**Logs del backend:**
```
✅ [REQUEST] POST /api/auth/login - Completado en 1029ms - Status: 200
```

**Conclusión:** El problema **NO está en el backend**, está en la configuración del frontend.

---

## 🔍 Problema Identificado

El frontend está intentando llamar al endpoint pero probablemente:
1. ❌ Está usando una URL incorrecta
2. ❌ No tiene configurada correctamente la variable de entorno
3. ❌ Hay un proxy o configuración que modifica la URL

---

## ✅ Solución: Configuración del Frontend

### Paso 1: Verificar/Crear Archivo `.env`

**Ubicación:** En la raíz del proyecto frontend (mismo nivel que `package.json`)

**Crear o editar el archivo `.env`:**
```env
VITE_API_URL=http://localhost:3000/api
```

**⚠️ IMPORTANTE:**
- El archivo debe llamarse exactamente `.env` (con el punto al inicio)
- Debe estar en la raíz del proyecto
- No debe tener espacios alrededor del `=`

---

### Paso 2: Verificar que el Código Use la Variable de Entorno

**En el código del frontend (ej: `auth.api.ts` o similar):**

```typescript
// ✅ CORRECTO
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Luego usar:
const response = await httpClient.post('/auth/login', credentials);
// Esto construirá: http://localhost:3000/api/auth/login ✅
```

**❌ INCORRECTO:**
```typescript
// NO hacer esto:
const response = await httpClient.post('http://localhost:3000/api/auth/login', credentials);
// O esto:
const response = await httpClient.post('/api/auth/login', credentials);
// (si la baseURL no incluye /api)
```

---

### Paso 3: Reiniciar el Servidor del Frontend

**⚠️ CRÍTICO:** Después de crear o modificar el archivo `.env`:

1. **Detener el servidor del frontend** (Ctrl+C en la terminal)
2. **Reiniciar el servidor:**
   ```bash
   npm run dev
   # o
   npm start
   ```

**Razón:** Las variables de entorno de Vite solo se cargan al iniciar el servidor.

---

### Paso 4: Verificar en el Navegador

1. **Abrir Developer Tools** (F12)
2. **Ir a la pestaña Network**
3. **Intentar hacer login**
4. **Buscar la petición** a `/auth/login` o `/api/auth/login`
5. **Verificar:**
   - **Request URL:** Debe ser `http://localhost:3000/api/auth/login`
   - **Status Code:** Debe ser `200` (no 404)
   - **Response:** Debe contener `{ success: true, data: {...} }`

---

## 🔧 Configuración Detallada

### Opción A: BaseURL con `/api` (Recomendado)

**`.env`:**
```env
VITE_API_URL=http://localhost:3000/api
```

**Código:**
```typescript
const API_URL = import.meta.env.VITE_API_URL; // http://localhost:3000/api
const response = await httpClient.post('/auth/login', credentials);
// Resultado: http://localhost:3000/api/auth/login ✅
```

---

### Opción B: BaseURL sin `/api`

**`.env`:**
```env
VITE_API_URL=http://localhost:3000
```

**Código:**
```typescript
const API_URL = import.meta.env.VITE_API_URL; // http://localhost:3000
const response = await httpClient.post('/api/auth/login', credentials);
// Resultado: http://localhost:3000/api/auth/login ✅
```

**⚠️ Nota:** Esta opción requiere que el código use `/api/auth/login` en lugar de `/auth/login`.

---

## 🧪 Verificación Rápida

### 1. Verificar que el Backend Está Corriendo

**En la terminal del backend, deberías ver:**
```
🚀 MediConnect Backend - Production Server
📡 Server running on port 3000
   - POST   /api/auth/login
```

**Si no ves esto:** El backend no está corriendo. Ejecuta `npm run dev` en el backend.

---

### 2. Probar el Endpoint Directamente

**Desde otra terminal (o Postman):**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@medicones.com","password":"admin123"}'
```

**Si esto funciona:** El backend está bien ✅  
**Si esto NO funciona:** Hay un problema en el backend

---

### 3. Verificar la Configuración del Frontend

**En la consola del navegador (F12 → Console):**
```javascript
// Ejecutar esto para ver qué URL está usando:
console.log(import.meta.env.VITE_API_URL);
```

**Debería mostrar:** `http://localhost:3000/api`

**Si muestra `undefined`:** El `.env` no está configurado o el servidor no se reinició.

---

## 🐛 Troubleshooting

### Problema: Sigue dando 404 después de configurar `.env`

**Soluciones:**

1. **Verificar que el archivo `.env` existe:**
   ```bash
   # En la raíz del proyecto frontend
   ls -la .env
   # o en Windows:
   dir .env
   ```

2. **Verificar el contenido del `.env`:**
   ```bash
   cat .env
   # Debe mostrar: VITE_API_URL=http://localhost:3000/api
   ```

3. **Verificar que el servidor se reinició:**
   - Detener completamente (Ctrl+C)
   - Esperar unos segundos
   - Reiniciar con `npm run dev`

4. **Verificar en Network tab:**
   - ¿Qué URL exacta está intentando el frontend?
   - ¿Es `http://localhost:3000/api/auth/login`?
   - Si no, hay un problema en cómo se construye la URL

---

### Problema: La variable de entorno es `undefined`

**Causas posibles:**

1. **El archivo no se llama `.env`** (debe tener el punto al inicio)
2. **El archivo está en la ubicación incorrecta** (debe estar en la raíz)
3. **La variable no empieza con `VITE_`** (Vite solo expone variables que empiezan con `VITE_`)
4. **El servidor no se reinició** después de crear/modificar el archivo

**Solución:**
```env
# ✅ CORRECTO
VITE_API_URL=http://localhost:3000/api

# ❌ INCORRECTO (sin VITE_)
API_URL=http://localhost:3000/api
```

---

### Problema: CORS Error

**Si ves un error de CORS:**

El backend ya tiene CORS configurado, pero verifica que:
- El origen del frontend esté permitido
- No haya un proxy que interfiera

**Solución temporal:** El backend permite todos los orígenes en desarrollo (`*`), así que esto no debería ser un problema.

---

## 📝 Checklist Final

Antes de reportar que sigue sin funcionar, verifica:

- [ ] Archivo `.env` existe en la raíz del proyecto frontend
- [ ] El archivo contiene: `VITE_API_URL=http://localhost:3000/api`
- [ ] El servidor del frontend fue reiniciado después de crear/modificar `.env`
- [ ] El backend está corriendo en `http://localhost:3000`
- [ ] En Network tab, la URL es `http://localhost:3000/api/auth/login`
- [ ] El código usa `import.meta.env.VITE_API_URL` para construir URLs
- [ ] No hay un proxy en `vite.config.ts` que modifique las rutas

---

## 📞 Información del Backend

### Endpoint Confirmado

**URL:** `http://localhost:3000/api/auth/login`  
**Método:** `POST`  
**Status:** ✅ Funcionando (200 OK)

### Request Esperado

```json
{
  "email": "admin@medicones.com",
  "password": "admin123"
}
```

### Response Retornada

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "email": "admin@medicones.com",
      "role": "admin"
    },
    "token": "jwt-token..."
  }
}
```

---

## 🚀 Resumen

**El backend está funcionando correctamente.** El problema es de configuración del frontend.

**Solución en 3 pasos:**

1. ✅ Crear `.env` con `VITE_API_URL=http://localhost:3000/api`
2. ✅ Reiniciar el servidor del frontend
3. ✅ Verificar en Network tab que la URL sea correcta

**Si después de esto sigue dando 404:**
- Revisar cómo se construye la URL en el código del frontend
- Verificar si hay un proxy o configuración que modifique las rutas
- Revisar los logs del backend para confirmar que la petición llega

---

**Última actualización:** 2026-02-18  
**Versión:** 1.0.0
