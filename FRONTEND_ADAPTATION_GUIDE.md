# 📘 Guía de Adaptación del Frontend al Backend

Este documento contiene **TODA** la información que el frontend necesita conocer sobre el backend de MediConnect: cómo funciona, qué retorna, cómo manejar respuestas, y cómo adaptarse a la estructura del backend.

---

## 📑 Índice

1. [Estructura de Respuestas](#1-estructura-de-respuestas)
2. [Autenticación y Tokens](#2-autenticación-y-tokens)
3. [Endpoints Disponibles](#3-endpoints-disponibles)
4. [Estructuras de Datos](#4-estructuras-de-datos)
5. [Manejo de Errores](#5-manejo-de-errores)
6. [Redirección Después del Login](#6-redirección-después-del-login)
7. [Valores Normalizados](#7-valores-normalizados)
8. [Consideraciones Importantes](#8-consideraciones-importantes)
9. [Endpoints Específicos](#9-endpoints-específicos)
10. [Registro de Proveedores](#10-registro-de-proveedores)
11. [Resumen de Puntos Críticos](#11-resumen-de-puntos-críticos)
12. [Ejemplo Completo de Integración](#12-ejemplo-completo-de-integración)

---

## 1. Estructura de Respuestas

### 1.1. Formato Estándar

**TODAS** las respuestas del backend siguen este formato:

```typescript
// Respuesta exitosa
{
  success: true;
  data: T;  // Datos específicos del endpoint
}

// Respuesta de error
{
  success: false;
  message: string;  // Mensaje descriptivo del error
  errors?: any[];   // Array opcional de errores detallados
}
```

### 1.2. Códigos HTTP

| Código | Significado | Estructura de Respuesta |
|--------|-------------|------------------------|
| `200` | Éxito | `{ success: true, data: ... }` |
| `201` | Creado | `{ success: true, data: ... }` |
| `400` | Error de validación | `{ success: false, message: "..." }` |
| `401` | No autorizado | `{ success: false, message: "Unauthorized" }` |
| `403` | Acceso denegado | `{ success: false, message: "Forbidden" }` |
| `404` | No encontrado | `{ success: false, message: "Not found" }` |
| `500` | Error interno | `{ success: false, message: "Internal server error" }` |

### 1.3. Validación de Respuestas

**⚠️ CRÍTICO**: El frontend DEBE validar `success` antes de procesar `data`:

```typescript
const response = await axios.post('/api/auth/login', { email, password });

if (response.data.success) {
  // ✅ Procesar datos
  const { user, token } = response.data.data;
} else {
  // ❌ Mostrar error
  console.error(response.data.message);
}
```

---

## 2. Autenticación y Tokens

### 2.1. Estructura del Login

**Endpoint**: `POST /api/auth/login`

**Request:**
```json
{
  "email": "doctor@medicones.com",
  "password": "doctor123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "idToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 3600,
    "user": {
      "id": "uuid-del-usuario",
      "userId": "uuid-del-usuario",
      "email": "doctor@medicones.com",
      "role": "provider",
      "serviceType": "doctor",
      "tipo": "doctor",
      "name": "Dr. Juan Pérez",
      "profilePictureUrl": null,
      "provider": {
        "id": "uuid-del-provider",
        "commercialName": "Dr. Juan Pérez",
        "logoUrl": null
      }
    }
  }
}
```

### 2.2. Campos del Usuario

**⚠️ CRÍTICO**: El backend retorna **AMBOS** campos:
- `serviceType`: Para lógica de redirección y UI
- `tipo`: Para los guards de rutas (DoctorRoute, LaboratoryRoute, etc.)

**Ambos tienen el mismo valor** normalizado a minúsculas.

### 2.3. Almacenamiento del Token

El backend retorna múltiples campos de token. El frontend debe:

1. **Priorizar `accessToken`** (recomendado)
2. **Guardar también `token`** para compatibilidad
3. **Usar el mismo valor** para ambos en desarrollo local

```typescript
// Después del login exitoso
const { accessToken, token, user } = response.data.data;

// Guardar en localStorage (priorizar accessToken)
localStorage.setItem('accessToken', accessToken || token);
localStorage.setItem('token', token || accessToken);
localStorage.setItem('auth-token', token || accessToken); // Compatibilidad

// Guardar usuario
localStorage.setItem('user', JSON.stringify(user));
```

### 2.4. Envío del Token

**TODAS** las peticiones autenticadas deben incluir:

```
Authorization: Bearer <token>
```

El frontend debe leer el token en este orden:
1. `localStorage.getItem('accessToken')`
2. `localStorage.getItem('auth-token')`
3. `localStorage.getItem('token')`

### 2.5. Endpoint `/api/auth/me`

**Endpoint**: `GET /api/auth/me`

**Headers**: `Authorization: Bearer <token>`

**Response**: Misma estructura que el login, incluyendo `serviceType` y `tipo` si es provider.

---

## 3. Endpoints Disponibles

### 3.1. Autenticación

| Método | Endpoint | Descripción | Requiere Auth |
|--------|----------|-------------|---------------|
| `POST` | `/api/auth/register` | Registrar nuevo usuario | ❌ |
| `POST` | `/api/auth/login` | Iniciar sesión | ❌ |
| `GET` | `/api/auth/me` | Obtener usuario actual | ✅ |

### 3.2. Doctores

| Método | Endpoint | Descripción | Requiere Auth | Requiere Role |
|--------|----------|-------------|---------------|---------------|
| `GET` | `/api/doctors/profile` | Obtener perfil del doctor | ✅ | `provider` |
| `GET` | `/api/doctors/dashboard` | Obtener dashboard del doctor | ✅ | `provider` |
| `GET` | `/api/doctors/appointments` | Obtener citas del doctor | ✅ | `provider` |

### 3.3. Administración

| Método | Endpoint | Descripción | Requiere Auth | Requiere Role |
|--------|----------|-------------|---------------|---------------|
| `GET` | `/api/admin/dashboard/stats` | Estadísticas del dashboard | ✅ | `admin` |
| `GET` | `/api/admin/requests` | Solicitudes de proveedores | ✅ | `admin` |
| `GET` | `/api/admin/ad-requests` | Solicitudes de anuncios | ✅ | `admin` |
| `GET` | `/api/admin/provider-requests` | Solicitudes de proveedores (alternativo) | ✅ | `admin` |
| `GET` | `/api/admin/activity` | Historial de actividad | ✅ | `admin` |
| `GET` | `/api/admin/history` | Historial de solicitudes | ✅ | `admin` |
| `GET` | `/api/admin/rejected-services` | Servicios rechazados | ✅ | `admin` |
| `PUT` | `/api/admin/requests/:id/approve` | Aprobar solicitud | ✅ | `admin` |
| `PUT` | `/api/admin/requests/:id/reject` | Rechazar solicitud | ✅ | `admin` |
| `PUT` | `/api/admin/ad-requests/:id/approve` | Aprobar anuncio | ✅ | `admin` |
| `PUT` | `/api/admin/ad-requests/:id/reject` | Rechazar anuncio | ✅ | `admin` |

### 3.4. Proveedores

| Método | Endpoint | Descripción | Requiere Auth |
|--------|----------|-------------|---------------|
| `POST` | `/api/providers/register` | Registrar nuevo proveedor | ❌ |

### 3.5. Insumos Médicos

| Método | Endpoint | Descripción | Requiere Auth |
|--------|----------|-------------|---------------|
| `GET` | `/api/supplies/stores` | Lista de tiendas de insumos | ❌ |

---

## 4. Estructuras de Datos

### 4.1. User (Usuario)

```typescript
interface User {
  id: string;                    // UUID
  userId: string;                // UUID (mismo que id)
  email: string;
  role: "admin" | "provider" | "patient";  // ⚠️ Siempre minúsculas
  serviceType?: "doctor" | "pharmacy" | "laboratory" | "ambulance" | "supplies";  // ⚠️ Siempre minúsculas
  tipo?: "doctor" | "pharmacy" | "laboratory" | "ambulance" | "supplies";  // ⚠️ CRÍTICO: Para guards
  name?: string;                 // Nombre del provider
  profilePictureUrl?: string | null;
  provider?: {
    id: string;
    commercialName: string;
    logoUrl?: string | null;
  };
}
```

**⚠️ IMPORTANTE**:
- `role` siempre está en **minúsculas**
- `serviceType` y `tipo` siempre están en **minúsculas**
- `tipo` es **obligatorio** para providers (los guards lo verifican)
- `serviceType` y `tipo` tienen el **mismo valor**

### 4.2. Dashboard Stats (Admin)

```typescript
interface DashboardStats {
  totalServices: {
    value: number;
    trend: string;  // Ej: "+12%"
  };
  usersInApp: {
    value: number;
    trend: string;
  };
  monthlyContacts: number;
  totalCities: number;
  requestStatus: {
    pending: number;
    approved: number;
    rejected: number;
  };
  servicesByType: {
    doctors: number;
    pharmacies: number;
    laboratories: number;
    ambulances: number;
    supplies: number;
  };
  recentActivity: Array<{
    id: string;
    type: "info" | "success" | "warning" | "error";
    message: string;
    timestamp: string;
  }>;
}
```

**⚠️ CRÍTICO**: 
- Todos los campos numéricos tienen valores por defecto (0)
- `recentActivity` es siempre un array (puede estar vacío `[]`)

### 4.3. Provider Request (Solicitud de Proveedor)

```typescript
interface ProviderRequest {
  id: string;
  providerName: string;
  email: string;
  avatarUrl?: string;
  serviceType: "doctor" | "pharmacy" | "laboratory" | "ambulance" | "supplies";
  submissionDate: string;  // Formato "YYYY-MM-DD"
  documentsCount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
  phone: string;
  whatsapp: string;
  city: string;
  address: string;
  description: string;
  documents: Array<{
    id: string;
    name: string;
    type: "pdf" | "image";
    url: string;
  }>;
}
```

**⚠️ IMPORTANTE**:
- El endpoint `/api/admin/requests` retorna un **array directo** `[]`, no un objeto con `requests`
- El frontend debe usar `.filter()` directamente sobre el array

---

## 5. Manejo de Errores

### 5.1. Errores de Autenticación

**Código HTTP**: `401 Unauthorized`

**Comportamiento del Frontend**:
1. Limpiar todos los tokens de `localStorage`
2. Cerrar sesión en el store (Zustand)
3. **NO redirigir automáticamente** (el guard lo hará si es necesario)

```typescript
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Limpiar tokens
      localStorage.removeItem('accessToken');
      localStorage.removeItem('auth-token');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Cerrar sesión en store
      authStore.getState().logout();
      
      // NO redirigir aquí, dejar que los guards lo manejen
    }
    return Promise.reject(error);
  }
);
```

### 5.2. Errores de Validación

**Código HTTP**: `400 Bad Request`

**Estructura**:
```json
{
  "success": false,
  "message": "Error descriptivo",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### 5.3. Errores de Red

**Código**: `ERR_NETWORK` o `ERR_CONNECTION_REFUSED`

**Causa**: El servidor backend no está corriendo o no es accesible.

**Solución**: Verificar que el backend esté corriendo en `http://localhost:3000`

---

## 6. Redirección Después del Login

### 6.1. Tabla de Redirección

El frontend debe redirigir según estos valores:

| `role` | `serviceType` / `tipo` | Ruta de Redirección |
|--------|------------------------|---------------------|
| `"admin"` | - | `/admin/dashboard` |
| `"provider"` | `"doctor"` | `/doctor/dashboard` |
| `"provider"` | `"pharmacy"` | `/provider/pharmacy/dashboard` |
| `"provider"` | `"laboratory"` o `"lab"` | `/laboratory/dashboard?tab=profile` |
| `"provider"` | `"ambulance"` | `/provider/ambulance/dashboard` |
| `"provider"` | `"supplies"` | `/supply/dashboard?tab=profile` |
| `"patient"` | - | `/patients/dashboard` |
| Cualquier otro | - | `/` (HOME) |

### 6.2. Código de Ejemplo

```typescript
async function handleLogin(email: string, password: string) {
  try {
    const response = await axios.post('http://localhost:3000/api/auth/login', {
      email,
      password,
    });
    
    if (response.data.success) {
      const { token, accessToken, user } = response.data.data;
      
      // 1. Guardar token (priorizar accessToken)
      localStorage.setItem('accessToken', accessToken || token);
      localStorage.setItem('token', token || accessToken);
      localStorage.setItem('auth-token', token || accessToken);
      
      // 2. Guardar usuario
      localStorage.setItem('user', JSON.stringify(user));
      
      // 3. Actualizar store
      authStore.getState().setUser(user);
      authStore.getState().setToken(accessToken || token);
      
      // 4. Redirigir según role y tipo
      const role = user.role?.toLowerCase();
      const tipo = user.tipo?.toLowerCase() || user.serviceType?.toLowerCase();
      
      let redirectPath = '/';
      
      if (role === 'admin') {
        redirectPath = '/admin/dashboard';
      } else if (role === 'provider' && tipo) {
        const routes: Record<string, string> = {
          'doctor': '/doctor/dashboard',
          'pharmacy': '/provider/pharmacy/dashboard',
          'laboratory': '/laboratory/dashboard?tab=profile',
          'lab': '/laboratory/dashboard?tab=profile',  // También acepta "lab"
          'ambulance': '/provider/ambulance/dashboard',
          'supplies': '/supply/dashboard?tab=profile',
        };
        redirectPath = routes[tipo] || '/provider/dashboard';
      } else if (role === 'patient') {
        redirectPath = '/patients/dashboard';
      }
      
      console.log('🚀 Redirigiendo a:', redirectPath);
      navigate(redirectPath, { replace: true });
    } else {
      // Mostrar error
      console.error('Error en login:', response.data.message);
    }
  } catch (error: any) {
    console.error('Error en login:', error.message);
  }
}
```

### 6.3. Verificación de Guards

Los guards del frontend deben verificar:

```typescript
// DoctorRoute
const isDoctorType = user?.tipo === "doctor";

// LaboratoryRoute
const isLabType = user?.tipo === "lab" || user?.tipo === "laboratory";

// SupplyRoute
const isSupplyType = user?.tipo === "supplies";
```

**⚠️ CRÍTICO**: Los guards verifican `user?.tipo`, NO `user?.serviceType`.

---

## 7. Valores Normalizados

### 7.1. Roles

El backend **SIEMPRE** retorna roles en minúsculas:
- `"admin"`
- `"provider"`
- `"patient"`

### 7.2. ServiceTypes

El backend **SIEMPRE** retorna serviceTypes en minúsculas:
- `"doctor"`
- `"pharmacy"`
- `"laboratory"` (también acepta `"lab"` en guards)
- `"ambulance"`
- `"supplies"`

### 7.3. Estados

El backend retorna estados en mayúsculas para solicitudes:
- `"PENDING"`
- `"APPROVED"`
- `"REJECTED"`

---

## 8. Consideraciones Importantes

### 8.1. Validación de Respuestas

**SIEMPRE** validar `success` antes de procesar:

```typescript
if (response.data.success) {
  // ✅ Procesar datos
  const data = response.data.data;
} else {
  // ❌ Mostrar error
  showError(response.data.message);
}
```

### 8.2. Arrays Vacíos

El backend retorna arrays vacíos `[]` en lugar de `null` o `undefined`:

```typescript
// ✅ Correcto
const requests = response.data.data; // Array directo
requests.filter(...);

// ❌ Incorrecto (no hacer esto)
const requests = response.data.data.requests; // No existe esta propiedad
```

### 8.3. Valores por Defecto

El backend siempre retorna valores por defecto:
- Arrays: `[]`
- Números: `0`
- Strings: `""`
- Objetos: `{}`

### 8.4. Campos Opcionales

Si un campo es opcional y no existe, el backend puede retornar:
- `null`
- `undefined`
- Valor por defecto

El frontend debe manejar estos casos:

```typescript
const name = user.name || 'Sin nombre';
const avatarUrl = user.profilePictureUrl || '/default-avatar.png';
```

### 8.5. Formato de Fechas

- **Con hora**: ISO 8601 `"2024-12-20T10:00:00Z"`
- **Sin hora**: `"2024-12-20"`

### 8.6. Formato de Horas

Formato 24 horas: `"09:00"`, `"18:00"`

---

## 9. Endpoints Específicos

### 9.1. Login

**Endpoint**: `POST /api/auth/login`

**Request**:
```json
{
  "email": "doctor@medicones.com",
  "password": "doctor123"
}
```

**Response Exitosa**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "userId": "uuid",
      "email": "doctor@medicones.com",
      "role": "provider",
      "serviceType": "doctor",
      "tipo": "doctor",
      "name": "Dr. Juan Pérez"
    }
  }
}
```

### 9.2. Dashboard de Admin

**Endpoint**: `GET /api/admin/dashboard/stats`

**Headers**: `Authorization: Bearer <token>`

**Response**:
```json
{
  "success": true,
  "data": {
    "totalServices": { "value": 150, "trend": "+0%" },
    "usersInApp": { "value": 5000, "trend": "+0%" },
    "monthlyContacts": 1250,
    "totalCities": 25,
    "requestStatus": {
      "pending": 15,
      "approved": 120,
      "rejected": 5
    },
    "servicesByType": {
      "doctors": 50,
      "pharmacies": 40,
      "laboratories": 30,
      "ambulances": 20,
      "supplies": 10
    },
    "recentActivity": []
  }
}
```

### 9.3. Solicitudes de Proveedores

**Endpoint**: `GET /api/admin/requests`

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `status`: `"PENDING"` | `"APPROVED"` | `"REJECTED"` (opcional)
- `limit`: número (opcional, default: 50)
- `offset`: número (opcional, default: 0)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "providerName": "Dr. Juan Pérez",
      "email": "doctor@medicones.com",
      "serviceType": "doctor",
      "status": "PENDING",
      "submissionDate": "2024-12-20",
      "documentsCount": 0,
      "phone": "",
      "whatsapp": "",
      "city": "Quito",
      "address": "",
      "description": ""
    }
  ]
}
```

**⚠️ CRÍTICO**: Retorna un **array directo**, no un objeto con `requests`.

### 9.4. Aprobar/Rechazar Solicitud

**Endpoint**: `PUT /api/admin/requests/:id/approve` o `/api/admin/requests/:id/reject`

**Headers**: `Authorization: Bearer <token>`

**Request (solo para reject)**:
```json
{
  "reason": "Documentación incompleta"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "success": true
  }
}
```

### 9.5. Dashboard de Doctor

**Endpoint**: `GET /api/doctors/dashboard?userId={userId}`

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `userId`: UUID (opcional, si no se envía usa el usuario autenticado)

**Response**:
```json
{
  "success": true,
  "data": {
    "totalAppointments": 150,
    "pendingAppointments": 5,
    "completedAppointments": 120,
    "totalRevenue": 7500.00,
    "averageRating": 4.8,
    "totalReviews": 45,
    "upcomingAppointments": [...],
    "provider": {
      "id": "uuid",
      "commercial_name": "Dr. Juan Pérez",
      "branches": [...]
    }
  }
}
```

---

## 10. Registro de Proveedores

### 10.1. Endpoint

**Endpoint**: `POST /api/providers/register`

**Headers**: `Content-Type: application/json`

**Request**:
```json
{
  "name": "Dr. Juan Pérez",
  "email": "doctor@medicones.com",
  "password": "SecurePass123!",
  "phone": "+593 99 123 4567",
  "whatsapp": "+593 99 999 9999",
  "serviceName": "Dr. Juan Pérez",
  "type": "doctor",
  "city": "Quito",
  "address": "Av. Principal 123",
  "description": "Especialista en cardiología",
  "price": "150",
  "chainId": null,
  "latitude": -0.1807,
  "longitude": -78.4678,
  "openingHours": "Lun-Vie: 9:00-17:00",
  "is24h": false,
  "hasDelivery": false,
  "logoUrl": "https://example.com/logo.jpg",
  "documents": [
    {
      "name": "Licencia Médica",
      "type": "license",
      "url": "https://example.com/documents/license.pdf"
    },
    {
      "name": "Certificado de Especialidad",
      "type": "certificate",
      "url": "https://example.com/documents/certificate.pdf"
    },
    {
      "name": "Título Profesional",
      "type": "degree",
      "url": "https://example.com/documents/degree.pdf"
    }
  ]
}
```

**Campos Requeridos**:
- `name`: Nombre del contacto
- `email`: Email del proveedor
- `password`: Contraseña (mínimo 8 caracteres)
- `serviceName`: Nombre comercial del servicio
- `type`: Tipo de servicio (`"doctor"`, `"pharmacy"`, `"laboratory"`, `"ambulance"`, `"supplies"`)
- `city`: Ciudad donde se encuentra el servicio

**Campos Opcionales**:
- `phone`: Teléfono de contacto
- `whatsapp`: WhatsApp de contacto
- `address`: Dirección física
- `description`: Descripción del servicio
- `price`: Precio (como string)
- `chainId`: ID de cadena (para farmacias en cadena)
- `latitude`: Latitud para geolocalización
- `longitude`: Longitud para geolocalización
- `openingHours`: Horarios de apertura (texto libre, ej: "Lun-Vie: 9:00-17:00")
- `is24h`: Si el servicio es 24 horas (boolean)
- `hasDelivery`: Si tiene servicio de delivery (boolean)
- `logoUrl`: URL del logo del servicio
- `documents`: Array de documentos PDF (opcional)
  - Cada documento debe tener:
    - `name`: Nombre del documento (ej: "Licencia Médica")
    - `type`: Tipo de documento - `"license"` (Licencias), `"certificate"` (Certificados), o `"degree"` (Títulos Profesionales)
    - `url`: URL del documento PDF (debe ser una URL válida donde el frontend haya subido el archivo)

**Response**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Solicitud de registro enviada exitosamente",
    "providerId": "uuid-del-provider",
    "documentsReceived": 3,
    "documents": [
      {
        "id": 1,
        "name": "Licencia Médica",
        "type": "license",
        "url": "https://example.com/documents/license.pdf"
      },
      {
        "id": 2,
        "name": "Certificado de Especialidad",
        "type": "certificate",
        "url": "https://example.com/documents/certificate.pdf"
      },
      {
        "id": 3,
        "name": "Título Profesional",
        "type": "degree",
        "url": "https://example.com/documents/degree.pdf"
      }
    ]
  }
}
```

**⚠️ IMPORTANTE**:
- El provider se crea con estado `PENDING`
- Aparecerá en `/api/admin/requests` para aprobación
- El usuario se crea con `is_active: false` hasta aprobación
- **La contraseña es requerida** y se usa para crear la cuenta del usuario
- **Después de la aprobación**, el usuario puede iniciar sesión con su email y contraseña
- **Siempre se crea una sucursal principal**, incluso si no se proporciona dirección
- Si el usuario ya existe pero tiene un provider rechazado, se actualiza a `PENDING`
- La ciudad y categoría de servicio se crean automáticamente si no existen
- **Documentos PDF**: El frontend debe subir los archivos PDF primero a un servicio de almacenamiento (S3, Cloudinary, etc.) y luego enviar las URLs en el array `documents`
- Los tipos de documentos aceptados son: `"license"` (Licencias), `"certificate"` (Certificados), `"degree"` (Títulos Profesionales)

---

## 11. Resumen de Puntos Críticos

### ⚠️ CRÍTICO - Debe Implementarse Correctamente

1. **Validar `success`**: Siempre verificar `response.data.success` antes de procesar
2. **Campo `tipo`**: Los guards verifican `user?.tipo`, no solo `user?.serviceType`
3. **Token**: Priorizar `accessToken`, guardar también `token` y `auth-token`
4. **Arrays directos**: `/api/admin/requests` retorna array directo `[]`, no objeto
5. **Valores normalizados**: Todos los roles y serviceTypes están en minúsculas
6. **Redirección**: Usar `tipo` o `serviceType` para determinar la ruta
7. **Errores 401**: Limpiar tokens pero NO redirigir automáticamente

### ✅ Recomendaciones

1. Usar interceptors de Axios para manejar tokens automáticamente
2. Validar estructura de respuestas antes de procesar
3. Manejar valores `null` y `undefined` con valores por defecto
4. Loggear respuestas en desarrollo para debugging
5. Implementar retry logic para errores de red

---

## 12. Ejemplo Completo de Integración

```typescript
// 1. Configurar Axios
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// 2. Interceptor de Request (agregar token)
apiClient.interceptors.request.use((config) => {
  const token = 
    localStorage.getItem('accessToken') || 
    localStorage.getItem('auth-token') || 
    localStorage.getItem('token');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
});

// 3. Interceptor de Response (manejar errores)
apiClient.interceptors.response.use(
  (response) => {
    // Validar estructura
    if (response.data && typeof response.data.success === 'boolean') {
      return response;
    }
    throw new Error('Invalid response structure');
  },
  (error) => {
    if (error.response?.status === 401) {
      // Limpiar tokens
      localStorage.removeItem('accessToken');
      localStorage.removeItem('auth-token');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Cerrar sesión en store
      authStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

// 4. Función de Login
async function login(email: string, password: string) {
  try {
    const response = await apiClient.post('/auth/login', { email, password });
    
    if (response.data.success) {
      const { accessToken, token, user } = response.data.data;
      
      // Guardar tokens
      localStorage.setItem('accessToken', accessToken || token);
      localStorage.setItem('token', token || accessToken);
      localStorage.setItem('user', JSON.stringify(user));
      
      // Actualizar store
      authStore.getState().setUser(user);
      authStore.getState().setToken(accessToken || token);
      
      // Redirigir
      const redirectPath = getRedirectPath(user.role, user.tipo || user.serviceType);
      navigate(redirectPath, { replace: true });
      
      return { success: true };
    } else {
      return { success: false, message: response.data.message };
    }
  } catch (error: any) {
    return { 
      success: false, 
      message: error.response?.data?.message || error.message 
    };
  }
}

// 5. Función de Redirección
function getRedirectPath(role: string, tipo?: string): string {
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'provider' && tipo) {
    const routes: Record<string, string> = {
      'doctor': '/doctor/dashboard',
      'pharmacy': '/provider/pharmacy/dashboard',
      'laboratory': '/laboratory/dashboard?tab=profile',
      'lab': '/laboratory/dashboard?tab=profile',
      'ambulance': '/provider/ambulance/dashboard',
      'supplies': '/supply/dashboard?tab=profile',
    };
    return routes[tipo] || '/provider/dashboard';
  }
  if (role === 'patient') return '/patients/dashboard';
  return '/';
}
```

---

## 13. Credenciales de Prueba

El backend tiene estas credenciales pre-configuradas (creadas con el seed):

| Rol | Email | Password | ServiceType |
|-----|-------|----------|-------------|
| Admin | `admin@medicones.com` | `admin123` | - |
| Doctor | `doctor@medicones.com` | `doctor123` | `doctor` |
| Farmacia | `farmacia@medicones.com` | `farmacia123` | `pharmacy` |
| Laboratorio | `lab@medicones.com` | `lab123` | `laboratory` |
| Ambulancia | `ambulancia@medicones.com` | `ambulancia123` | `ambulance` |
| Insumos | `insumos@medicones.com` | `insumos123` | `supplies` |

---

## 14. Contacto y Soporte

Si el frontend necesita aclaraciones sobre algún endpoint, estructura de datos, o comportamiento del backend, puede referirse a este documento o contactar al equipo de backend.

**Última actualización**: Enero 2026

---

## 📝 Notas Finales

Este documento contiene **TODA** la información que el frontend necesita conocer sobre el backend. Si algo no está documentado aquí, es porque aún no está implementado en el backend o es un caso edge que requiere consulta directa con el equipo de backend.

**Versión del Documento**: 1.0
**Fecha de Creación**: Enero 2026
**Mantenido por**: Equipo de Backend MediConnect
