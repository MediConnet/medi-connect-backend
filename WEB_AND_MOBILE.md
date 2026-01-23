# 📱🌐 Compatibilidad Web y Mobile App - MediConnect Backend

## ✅ Arquitectura Compatible con Web y Mobile

Este backend está diseñado para funcionar perfectamente tanto desde una **aplicación web** como desde una **aplicación móvil** (iOS/Android).

## 🔧 Características Implementadas

### 1. CORS Multi-Origen

**Configuración flexible** para soportar múltiples clientes:

```yaml
# CloudFormation - Soporta web y mobile
AllowOrigins:
  - https://tu-web-app.com      # Web app
  - https://www.tu-web-app.com   # Web app (www)
  - *                            # Mobile apps (no usan CORS pero necesario para dev)
```

**Variables de entorno**:
- `CORS_ORIGIN`: Origen único (dev)
- `CORS_ORIGINS`: Múltiples orígenes separados por coma (producción)

### 2. Headers CORS Completos

```typescript
'Access-Control-Allow-Origin': origin
'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With,Accept'
'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS'
'Access-Control-Allow-Credentials': 'true'
'Access-Control-Max-Age': '86400'
```

### 3. Preflight OPTIONS Support

Manejo automático de requests OPTIONS (necesario para web apps):

```typescript
if (method === 'OPTIONS') {
  return optionsResponse(event);
}
```

### 4. Autenticación JWT Universal

**Funciona igual en web y mobile**:
- Tokens JWT de Cognito
- Header `Authorization: Bearer <token>`
- Validación en API Gateway + Lambda

### 5. Respuestas JSON Estándar

Formato consistente para ambos clientes:

```json
{
  "success": true,
  "data": { ... }
}
```

```json
{
  "success": false,
  "message": "Error message",
  "errors": [ ... ]
}
```

## 📱 Diferencias Web vs Mobile

### Web App
- ✅ **Requiere CORS**: Configurado con orígenes específicos
- ✅ **Requiere OPTIONS**: Preflight requests manejados
- ✅ **Security Headers**: X-Frame-Options, X-XSS-Protection, etc.
- ✅ **Cookies**: Soporte con `Access-Control-Allow-Credentials`

### Mobile App (iOS/Android)
- ✅ **No requiere CORS**: Las apps móviles no tienen restricciones CORS
- ✅ **Mismo JWT**: Autenticación idéntica
- ✅ **Mismo API**: Endpoints REST estándar
- ✅ **Headers ignorados**: Security headers no afectan apps móviles

## 🚀 Configuración por Ambiente

### Desarrollo
```bash
# .env
CORS_ORIGIN=*
# O múltiples orígenes
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Producción
```bash
# .env o CloudFormation Parameters
WebOrigin=https://tu-web-app.com
MobileAppOrigin=*  # Apps móviles no necesitan CORS específico
```

## 📋 Ejemplos de Uso

### Web App (React/Next.js/Vue)

```typescript
// Login
const response = await fetch('https://api.mediconnect.com/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // Para cookies si las usas
  body: JSON.stringify({ email, password }),
});

const data = await response.json();
// { success: true, data: { accessToken, refreshToken, ... } }
```

### Mobile App (React Native)

```typescript
// Login - Mismo endpoint, sin preocuparse por CORS
const response = await fetch('https://api.mediconnect.com/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email, password }),
});

const data = await response.json();
// { success: true, data: { accessToken, refreshToken, ... } }
```

### Autenticación (Ambos)

```typescript
// Usar token en requests protegidos
const response = await fetch('https://api.mediconnect.com/api/auth/me', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
});
```

## 🔐 Autenticación JWT

### Flujo Universal (Web y Mobile)

1. **Login/Register**: Obtener tokens de Cognito
2. **Almacenar Token**: 
   - Web: localStorage o httpOnly cookies
   - Mobile: AsyncStorage (React Native) o Keychain (iOS/Android nativo)
3. **Usar Token**: Header `Authorization: Bearer <token>`
4. **Refresh**: Renovar token cuando expire

### Ejemplo de Refresh Token

```typescript
// Funciona igual en web y mobile
const refreshResponse = await fetch('https://api.mediconnect.com/api/auth/refresh', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ refreshToken }),
});
```

## 📊 Endpoints Disponibles

Todos los endpoints funcionan igual desde web y mobile:

### Auth
- `POST /api/auth/register` - Registro
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Usuario actual (requiere JWT)
- `POST /api/auth/change-password` - Cambiar contraseña (requiere JWT)

### Doctors
- `GET /api/doctors/profile` - Perfil (requiere JWT + rol DOCTOR)
- `PUT /api/doctors/profile` - Actualizar perfil (requiere JWT + rol DOCTOR)
- `GET /api/doctors/appointments` - Citas (requiere JWT + rol DOCTOR)

### Admin
- `GET /api/admin/dashboard/stats` - Estadísticas (requiere JWT + rol ADMIN)
- `GET /api/admin/requests` - Solicitudes (requiere JWT + rol ADMIN)

### Supplies (Público)
- `GET /api/supplies/stores` - Tiendas
- `GET /api/supplies/stores/{id}` - Tienda específica
- `GET /api/supplies/products` - Productos

## 🛠️ Testing

### Web (Browser DevTools)
```javascript
// Test CORS
fetch('https://api.mediconnect.com/api/supplies/stores', {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' }
})
.then(r => r.json())
.then(console.log);
```

### Mobile (React Native)
```javascript
// Mismo código, sin preocuparse por CORS
fetch('https://api.mediconnect.com/api/supplies/stores', {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' }
})
.then(r => r.json())
.then(console.log);
```

## ✅ Checklist de Compatibilidad

- [x] CORS configurado para múltiples orígenes
- [x] OPTIONS requests manejados
- [x] JWT authentication funciona en ambos
- [x] Respuestas JSON estándar
- [x] Headers compatibles
- [x] Sin diferencias en endpoints
- [x] Mismo formato de errores
- [x] Refresh token funciona igual

## 📝 Notas Importantes

1. **Apps móviles no tienen CORS**: Las restricciones CORS son solo del navegador
2. **Mismo backend**: Un solo backend sirve a ambos clientes
3. **JWT universal**: Cognito tokens funcionan en web y mobile
4. **Rate limiting**: Considerar diferentes límites si es necesario
5. **Analytics**: Puedes diferenciar clientes con headers personalizados

## 🔄 Próximos Pasos

1. Configurar `CORS_ORIGINS` en producción con tus dominios web
2. Implementar refresh token automático en ambos clientes
3. Agregar headers personalizados si necesitas identificar el cliente:
   ```typescript
   'X-Client-Type': 'web' | 'mobile'
   'X-Client-Version': '1.0.0'
   ```
