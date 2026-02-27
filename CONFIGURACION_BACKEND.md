# 🔧 Configuración Requerida para el Backend

## 📍 URL del Backend

El frontend está configurado para conectarse a:
```
https://medi-connect-backend-1-2c8b.onrender.com/api
```

**Importante:** Todas las rutas del backend deben estar bajo el prefijo `/api`

---

## 🌐 Configuración de CORS

El backend debe permitir requests desde los siguientes orígenes:

### Producción:
- `https://tu-dominio-vercel.vercel.app` (URL de Vercel)
- Tu dominio personalizado (si lo tienes configurado)

### Desarrollo:
- `http://localhost:5173` (puerto por defecto de Vite)

### Headers Permitidos:
- `Authorization`
- `Content-Type`
- `Accept`

### Métodos HTTP Permitidos:
- `GET`
- `POST`
- `PUT`
- `DELETE`
- `PATCH`
- `OPTIONS`

### Ejemplo de Configuración CORS (Express.js):
```javascript
const cors = require('cors');

const corsOptions = {
  origin: [
    'http://localhost:5173', // Desarrollo
    'https://tu-dominio-vercel.vercel.app', // Producción
    // Agrega aquí tu dominio personalizado si lo tienes
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
};

app.use(cors(corsOptions));
```

---

## 📤 Headers que Envía el Frontend

El frontend envía automáticamente estos headers en cada request:

### Headers Siempre Presentes:
```
Content-Type: application/json
```

### Headers en Requests Autenticados:
```
Authorization: Bearer <token_jwt>
```

El token se obtiene del store de autenticación y se envía automáticamente en todos los requests que requieren autenticación.

---

## 📥 Formato de Respuesta Esperado

### Respuesta Exitosa:
```json
{
  "success": true,
  "data": {
    // ... datos de la respuesta
  }
}
```

### Respuesta con Error:
```json
{
  "success": false,
  "message": "Mensaje de error descriptivo",
  "errors": {
    // ... detalles adicionales del error (opcional)
  }
}
```

### Códigos de Estado HTTP:
- `200` - Éxito
- `201` - Creado exitosamente
- `400` - Error de validación
- `401` - No autenticado (token inválido o expirado)
- `403` - No autorizado (sin permisos)
- `404` - No encontrado
- `500` - Error del servidor

---

## 🔐 Autenticación

### Verificación del Token:
El backend debe:
1. Extraer el token del header `Authorization: Bearer <token>`
2. Verificar que el token sea válido
3. Decodificar el token para obtener información del usuario
4. Agregar la información del usuario a `req.user` (o similar)

### Manejo de Token Expirado:
Si el token es inválido o expirado, retornar:
```json
{
  "success": false,
  "message": "Token inválido o expirado"
}
```
Con código de estado `401`.

El frontend automáticamente cerrará la sesión cuando reciba un `401`.

---

## ⏱️ Timeout

El frontend tiene configurado un timeout de **30 segundos** para los requests.

Si una operación toma más tiempo, el backend debería:
- Retornar un `202 Accepted` si la operación es asíncrona
- O implementar un sistema de polling/websockets para operaciones largas

---

## 📋 Endpoints Importantes

### Health Check:
```
GET /api/health
```
El frontend puede hacer requests a este endpoint para verificar que el backend esté disponible.

**Respuesta esperada:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### Autenticación:
```
POST /api/auth/login
POST /api/auth/register
POST /api/auth/logout
GET /api/auth/me
```

### Invitaciones de Clínica:
```
POST /api/clinics/doctors/invitation
```
Ver detalles en `MENSAJE_PARA_BACKEND.md`

---

## 🧪 Cómo Probar la Conexión

### 1. Verificar que el Backend esté Accesible:
```bash
curl https://medi-connect-backend-1-2c8b.onrender.com/api/health
```

### 2. Verificar CORS:
Abre la consola del navegador (F12) y ejecuta:
```javascript
fetch('https://medi-connect-backend-1-2c8b.onrender.com/api/health')
  .then(res => res.json())
  .then(console.log)
  .catch(console.error);
```

Si ves un error de CORS, el backend no está configurado correctamente.

### 3. Probar Autenticación:
```bash
curl -X POST https://medi-connect-backend-1-2c8b.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

---

## ✅ Checklist para el Backend

- [ ] CORS configurado para permitir requests desde el frontend
- [ ] Todas las rutas bajo el prefijo `/api`
- [ ] Middleware de autenticación funcionando correctamente
- [ ] Formato de respuesta: `{ success: true, data: {...} }`
- [ ] Manejo de errores con formato: `{ success: false, message: "..." }`
- [ ] Códigos de estado HTTP correctos (401 para token inválido, etc.)
- [ ] Endpoint `/api/health` implementado
- [ ] Backend accesible en `https://medi-connect-backend-1-2c8b.onrender.com`
- [ ] Probado con Postman/Thunder Client
- [ ] Probado desde el navegador (verificar CORS)

---

## 🚨 Problemas Comunes

### Error de CORS:
**Síntoma:** `Access to fetch at '...' from origin '...' has been blocked by CORS policy`

**Solución:** Verificar que el backend tenga configurado CORS correctamente con el origen del frontend.

### Error 404:
**Síntoma:** `404 Not Found` en todas las rutas

**Solución:** Verificar que las rutas estén bajo el prefijo `/api` y que el servidor esté escuchando correctamente.

### Error 401 en todos los requests:
**Síntoma:** Todos los requests retornan `401 Unauthorized`

**Solución:** Verificar que el middleware de autenticación esté funcionando y que el token se esté decodificando correctamente.

---

## 📞 Contacto

Si hay algún problema o necesitas ajustar algo en el frontend, avísame y lo actualizo.
