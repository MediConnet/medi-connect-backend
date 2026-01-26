# 📚 Guía Completa del Frontend para el Backend

Este documento contiene **TODA** la información que el backend necesita conocer sobre el frontend de MediConnect: rutas, endpoints, estructuras de datos, flujos de usuario, guards, y más.

---

## 📑 Índice

1. [Arquitectura General](#1-arquitectura-general)
2. [Rutas del Frontend](#2-rutas-del-frontend)
3. [Guards y Protección de Rutas](#3-guards-y-protección-de-rutas)
4. [Autenticación y Tokens](#4-autenticación-y-tokens)
5. [Flujos de Usuario](#5-flujos-de-usuario)
6. [Endpoints Esperados](#6-endpoints-esperados)
7. [Estructuras de Datos](#7-estructuras-de-datos)
8. [Códigos de Error](#8-códigos-de-error)
9. [Consideraciones Importantes](#9-consideraciones-importantes)

---

## 1. Arquitectura General

### 1.1. Stack Tecnológico
- **Framework**: React 19
- **Router**: React Router v6
- **HTTP Client**: Axios
- **Estado Global**: Zustand (auth store)
- **UI Library**: Material-UI (MUI)
- **Build Tool**: Vite

### 1.2. Estructura de Carpetas
```
src/
├── app/                    # Configuración global
│   ├── router/            # Rutas y guards
│   ├── store/             # Stores (auth)
│   └── config/            # Constantes y env
├── features/              # Features por dominio
│   ├── auth/              # Autenticación
│   ├── doctor-panel/      # Panel de doctores
│   ├── pharmacy-panel/    # Panel de farmacias
│   ├── laboratory-panel/  # Panel de laboratorios
│   ├── ambulance-panel/    # Panel de ambulancias
│   ├── supplies-panel/    # Panel de insumos
│   ├── admin-dashboard/   # Panel de administración
│   └── home/              # Página principal
└── shared/                 # Código compartido
    ├── lib/               # Utilidades (http.ts)
    └── components/        # Componentes reutilizables
```

### 1.3. Formato de Respuestas del Backend

**TODAS** las respuestas deben seguir este formato:

```typescript
{
  success: boolean;
  data: T;           // Datos específicos
  message?: string;  // Mensaje opcional (errores/confirmaciones)
}
```

**Ejemplo de Éxito:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Dr. Juan Pérez"
  }
}
```

**Ejemplo de Error:**
```json
{
  "success": false,
  "message": "Error descriptivo del problema"
}
```

---

## 2. Rutas del Frontend

### 2.1. Rutas Públicas (Sin Autenticación)

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/login` | `LoginPage` | Página de inicio de sesión |
| `/register` | `RegisterPage` | Página de registro |
| `/forgot-password` | `ForgotPasswordPage` | Recuperar contraseña |
| `/home` | `HomePage` | Página principal |
| `/services` | `ServicesCatalogPage` | Catálogo de servicios |
| `/supplies` | `SuppliesListPage` | Lista de tiendas de insumos |
| `/supplies/:id` | `SupplyStoreDetailPage` | Detalle de tienda de insumos |

### 2.2. Rutas de Administrador

**Base Path**: `/admin`

| Ruta | Componente | Requiere Auth | Requiere Role |
|------|-----------|---------------|---------------|
| `/admin/dashboard` | `AdminDashboardPage` | ✅ | `admin` |
| `/admin/requests` | `RequestsPage` | ✅ | `admin` |
| `/admin/ad-requests` | `AdRequestsPage` | ✅ | `admin` |
| `/admin/history` | `HistoryPage` | ✅ | `admin` |
| `/admin/payments` | `PaymentsPage` | ✅ | `admin` |
| `/admin/commissions` | `CommissionsPage` | ✅ | `admin` |
| `/admin/users` | `UsersPage` | ✅ | `admin` |
| `/admin/services` | `ServicesDashboardPage` | ✅ | `admin` |
| `/admin/activity` | `ActivityPage` | ✅ | `admin` |
| `/admin/pharmacy-chains` | `PharmacyChainsPage` | ✅ | `admin` |
| `/admin/settings` | `SettingsPage` | ✅ | `admin` |

**⚠️ IMPORTANTE**: Las rutas de admin NO tienen guard específico en el router, pero el backend debe validar que el usuario tenga `role: "admin"`.

### 2.3. Rutas de Doctor

**Base Path**: `/doctor`

| Ruta | Componente | Requiere Auth | Requiere Role | Requiere Tipo |
|------|-----------|---------------|---------------|---------------|
| `/doctor/dashboard` | `DoctorDashboardPage` | ✅ | `provider` | `doctor` |

**Guard**: `DoctorRoute` - Verifica:
- `isAuthenticated === true`
- `user.role === "provider"` (o `"patient"` o `"profesional"` legacy)
- `user.tipo === "doctor"`

### 2.4. Rutas de Laboratorio

**Base Path**: `/laboratory`

| Ruta | Componente | Requiere Auth | Requiere Role | Requiere Tipo |
|------|-----------|---------------|---------------|---------------|
| `/laboratory/dashboard` | `LaboratoryDashboardPage` | ✅ | `provider` | `lab` o `laboratory` |

**Guard**: `LaboratoryRoute` - Verifica:
- `isAuthenticated === true`
- `user.role === "provider"` (o `"patient"` o `"profesional"` legacy)
- `user.tipo === "lab"` **O** `user.tipo === "laboratory"` ⚠️

### 2.5. Rutas de Insumos Médicos

**Base Path**: `/supply`

| Ruta | Componente | Requiere Auth | Requiere Role | Requiere Tipo |
|------|-----------|---------------|---------------|---------------|
| `/supply/dashboard` | `SupplyDashboardPage` | ✅ | `provider` | `supplies` |

**Guard**: `SupplyRoute` - Verifica:
- `isAuthenticated === true`
- `user.role === "provider"` (o `"patient"` o `"profesional"` legacy)
- `user.tipo === "supplies"`

### 2.6. Rutas de Proveedores (Anidadas)

**Base Path**: `/provider`

#### 2.6.1. Panel de Ambulancia

| Ruta | Componente | Requiere Auth | Requiere Role | Requiere Tipo |
|------|-----------|---------------|---------------|---------------|
| `/provider/ambulance/dashboard` | `AmbulanceDashboardPage` | ✅ | `provider` | `ambulance` |
| `/provider/ambulance/ads` | `AmbulanceAdsPage` | ✅ | `provider` | `ambulance` |
| `/provider/ambulance/reviews` | `AmbulanceReviewsPage` | ✅ | `provider` | `ambulance` |
| `/provider/ambulance/settings` | `AmbulanceSettingsPage` | ✅ | `provider` | `ambulance` |

#### 2.6.2. Panel de Farmacia

| Ruta | Componente | Requiere Auth | Requiere Role | Requiere Tipo |
|------|-----------|---------------|---------------|---------------|
| `/provider/pharmacy/dashboard` | `PharmacyDashboardPage` | ✅ | `provider` | `pharmacy` |
| `/provider/pharmacy/branches` | `PharmacyBranchesPage` | ✅ | `provider` | `pharmacy` |
| `/provider/pharmacy/ads` | `PharmacyAdsPage` | ✅ | `provider` | `pharmacy` |
| `/provider/pharmacy/reviews` | `PharmacyReviewsPage` | ✅ | `provider` | `pharmacy` |
| `/provider/pharmacy/settings` | `PharmacySettingsPage` | ✅ | `provider` | `pharmacy` |

**⚠️ NOTA**: Las rutas de `/provider/*` NO tienen guards específicos en el router, pero el backend debe validar el `role` y `serviceType`.

### 2.7. Rutas de Fallback

| Ruta | Comportamiento |
|------|---------------|
| `/` | Redirige a `/home` |
| `*` (cualquier otra ruta) | Redirige a `/home` |

---

## 3. Guards y Protección de Rutas

### 3.1. Guards Implementados

#### 3.1.1. `DoctorRoute`
**Ubicación**: `src/app/router/DoctorRoute.tsx`

**Lógica de Validación:**
```typescript
// 1. Verifica autenticación
if (!isAuthenticated) {
  return <Navigate to="/login" />;
}

// 2. Verifica role
const hasValidRole = 
  user?.role === "provider" || 
  user?.role === "patient" || 
  user?.role === "profesional"; // Legacy

// 3. Verifica tipo
const isDoctorType = user?.tipo === "doctor";

// 4. Si no cumple, redirige a /home
if (!user || !hasValidRole || !isDoctorType) {
  return <Navigate to="/home" />;
}
```

#### 3.1.2. `LaboratoryRoute`
**Ubicación**: `src/app/router/LaboratoryRoute.tsx`

**Lógica de Validación:**
```typescript
// 1. Verifica autenticación
if (!isAuthenticated) {
  return <Navigate to="/login" />;
}

// 2. Verifica role
const hasValidRole = 
  user?.role === "provider" || 
  user?.role === "patient" || 
  user?.role === "profesional"; // Legacy

// 3. Verifica tipo (ACEPTA AMBOS)
const isLabType = 
  user?.tipo === "lab" || 
  user?.tipo === "laboratory"; // ⚠️ IMPORTANTE

// 4. Si no cumple, redirige a /home
if (!user || !hasValidRole || !isLabType) {
  return <Navigate to="/home" />;
}
```

#### 3.1.3. `SupplyRoute`
**Ubicación**: `src/app/router/SupplyRoute.tsx`

**Lógica de Validación:**
```typescript
// Similar a DoctorRoute pero verifica:
const isSupplyType = user?.tipo === "supplies";
```

### 3.2. Roles y Tipos Aceptados

#### Roles Válidos:
- `"provider"` - Proveedor de servicios (doctores, farmacias, etc.)
- `"admin"` - Administrador
- `"patient"` - Paciente
- `"profesional"` - Legacy (se acepta pero se recomienda usar `"provider"`)

#### Tipos de Servicio (solo si `role === "provider"`):
- `"doctor"` - Médico
- `"pharmacy"` - Farmacia
- `"lab"` o `"laboratory"` - Laboratorio ⚠️ (ambos son válidos)
- `"ambulance"` - Ambulancia
- `"supplies"` - Insumos Médicos

---

## 4. Autenticación y Tokens

### 4.1. Estructura del Token JWT

El frontend espera un **JWT (JSON Web Token)** que debe incluirse en todas las peticiones autenticadas:

```
Authorization: Bearer <token>
```

### 4.2. Almacenamiento del Token

El frontend guarda el token en `localStorage` bajo estas claves (en orden de prioridad):

1. `accessToken` (prioridad - recomendado por el backend)
2. `auth-token`
3. `token`

**Código del Frontend:**
```typescript
// Al guardar (después del login)
localStorage.setItem('accessToken', token);
localStorage.setItem('auth-token', token);
localStorage.setItem('token', token);

// Al leer (en el interceptor HTTP)
const token = 
  localStorage.getItem('accessToken') || 
  localStorage.getItem('auth-token') || 
  localStorage.getItem('token');
```

### 4.3. Interceptor HTTP

El frontend usa Axios con interceptors:

**Request Interceptor:**
```typescript
httpClient.interceptors.request.use((config) => {
  const token = 
    authStore.getState().token || 
    localStorage.getItem('accessToken') || 
    localStorage.getItem('auth-token') || 
    localStorage.getItem('token');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

**Response Interceptor:**
```typescript
httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Limpiar tokens
      localStorage.removeItem('accessToken');
      localStorage.removeItem('auth-token');
      localStorage.removeItem('token');
      // Cerrar sesión
      authStore.logout();
    }
    return Promise.reject(error);
  }
);
```

### 4.4. Manejo de Errores de Autenticación

| Código HTTP | Comportamiento del Frontend |
|-------------|----------------------------|
| `401 Unauthorized` | Limpia tokens, cierra sesión, NO redirige automáticamente |
| `403 Forbidden` | Muestra mensaje "Acceso denegado" |

---

## 5. Flujos de Usuario

### 5.1. Flujo de Login

```
1. Usuario ingresa email y password
2. Frontend envía POST /api/auth/login
3. Backend retorna:
   {
     success: true,
     data: {
       user: { userId, email, name, role, serviceType },
       token: "jwt-token",
       accessToken: "jwt-token" (opcional)
     }
   }
4. Frontend guarda:
   - Token en localStorage (accessToken, auth-token, token)
   - Usuario en authStore y localStorage
5. Frontend redirige según role y serviceType:
   - role: "admin" → /admin/dashboard
   - role: "provider" + serviceType: "doctor" → /doctor/dashboard
   - role: "provider" + serviceType: "pharmacy" → /provider/pharmacy/dashboard
   - role: "provider" + serviceType: "laboratory" → /laboratory/dashboard
   - role: "provider" + serviceType: "ambulance" → /provider/ambulance/dashboard
   - role: "provider" + serviceType: "supplies" → /supply/dashboard
   - role: "patient" → /patients/dashboard
   - Otro → /home
```

### 5.2. Flujo de Redirección Después del Login

**Tabla de Redirección:**

| `role` | `serviceType` | Ruta de Redirección |
|--------|---------------|---------------------|
| `"admin"` | - | `/admin/dashboard` |
| `"provider"` | `"doctor"` | `/doctor/dashboard` |
| `"provider"` | `"pharmacy"` | `/provider/pharmacy/dashboard` |
| `"provider"` | `"laboratory"` o `"lab"` | `/laboratory/dashboard?tab=profile` |
| `"provider"` | `"ambulance"` | `/provider/ambulance/dashboard` |
| `"provider"` | `"supplies"` | `/supply/dashboard?tab=profile` |
| `"patient"` | - | `/patients/dashboard` |
| Cualquier otro | - | `/` (HOME) |

**⚠️ IMPORTANTE:**
- `role` debe estar en **minúsculas**: `"provider"`, `"admin"`, `"patient"`
- `serviceType` debe estar en **minúsculas**: `"doctor"`, `"pharmacy"`, `"laboratory"`, `"lab"`, `"ambulance"`, `"supplies"`
- El frontend normaliza ambos valores a minúsculas antes de usarlos

### 5.3. Flujo de Acceso a Rutas Protegidas

```
1. Usuario intenta acceder a ruta protegida (ej: /doctor/dashboard)
2. Guard verifica:
   a. ¿Está autenticado? (isAuthenticated === true)
      - NO → Redirige a /login
   b. ¿Tiene el role correcto?
      - NO → Redirige a /home
   c. ¿Tiene el tipo correcto?
      - NO → Redirige a /home
3. Si pasa todas las validaciones → Muestra el componente
```

---

## 6. Endpoints Esperados

### 6.1. Autenticación

#### 6.1.1. Login
- **Endpoint**: `POST /api/auth/login`
- **Headers**: `Content-Type: application/json`
- **Request:**
```json
{
  "email": "doctor@medicones.com",
  "password": "password123"
}
```
- **Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "uuid-del-usuario",
      "email": "doctor@medicones.com",
      "name": "Dr. Juan Pérez",
      "role": "provider",
      "serviceType": "doctor"
    },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**⚠️ CRÍTICO**: El backend DEBE retornar:
- `user.role` en minúsculas: `"provider"`, `"admin"`, `"patient"`
- `user.serviceType` en minúsculas: `"doctor"`, `"pharmacy"`, `"laboratory"`, `"lab"`, `"ambulance"`, `"supplies"`
- `token` o `accessToken` (el frontend prioriza `accessToken`)

#### 6.1.2. Registro
- **Endpoint**: `POST /api/auth/register`
- **Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "Nombre Completo",
  "role": "PROVIDER" | "ADMIN" | "PATIENT",
  "serviceType": "doctor" | "pharmacy" | "laboratory" | "ambulance" | "supplies"
}
```
- **Response:**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "cognitoUserId": "cognito-uuid",
    "email": "user@example.com",
    "name": "Nombre Completo",
    "message": "Usuario registrado exitosamente"
  }
}
```

#### 6.1.3. Obtener Usuario Actual
- **Endpoint**: `GET /api/auth/me`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: Misma estructura que el login

#### 6.1.4. Refrescar Token
- **Endpoint**: `POST /api/auth/refresh`
- **Request:**
```json
{
  "refreshToken": "refresh-token"
}
```
- **Response:**
```json
{
  "success": true,
  "data": {
    "token": "nuevo-jwt-token",
    "refreshToken": "nuevo-refresh-token"
  }
}
```

#### 6.1.5. Olvidé mi Contraseña
- **Endpoint**: `POST /api/auth/forgot-password`
- **Request:**
```json
{
  "email": "user@example.com"
}
```
- **Response:**
```json
{
  "success": true,
  "data": {
    "message": "Se ha enviado un enlace de restablecimiento a tu correo"
  }
}
```

#### 6.1.6. Resetear Contraseña
- **Endpoint**: `POST /api/auth/reset-password`
- **Request:**
```json
{
  "token": "reset-token",
  "newPassword": "nueva-password"
}
```
- **Response:**
```json
{
  "success": true,
  "data": {
    "message": "Contraseña restablecida exitosamente"
  }
}
```

### 6.2. Doctores

#### 6.2.1. Obtener Dashboard
- **Endpoint**: `GET /api/doctors/dashboard?userId={userId}`
- **Headers**: `Authorization: Bearer <token>`
- **Response:**
```json
{
  "success": true,
  "data": {
    "visits": 150,
    "contacts": 89,
    "reviews": 45,
    "rating": 4.8,
    "doctor": {
      "name": "Dr. Juan Pérez",
      "specialty": "Cardiología",
      "email": "doctor@medicones.com",
      "whatsapp": "+51987654321",
      "address": "Av. Principal 123, Lima",
      "price": 150.00,
      "description": "Cardiólogo con 15 años de experiencia",
      "experience": 15,
      "workSchedule": [
        {
          "day": "monday",
          "enabled": true,
          "startTime": "09:00",
          "endTime": "18:00",
          "timeSlots": [
            { "startTime": "09:00", "endTime": "10:00", "available": true }
          ],
          "blockedHours": []
        }
      ],
      "isActive": true,
      "profileStatus": "published",
      "paymentMethods": "both",
      "consultationDuration": 30,
      "blockedDates": ["2024-12-25", "2025-01-01"],
      "bankAccount": {
        "bankName": "Banco de Crédito",
        "accountNumber": "1234567890",
        "accountType": "checking",
        "accountHolder": "Dr. Juan Pérez"
      }
    }
  }
}
```

#### 6.2.2. Obtener Perfil
- **Endpoint**: `GET /api/doctors/profile`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: Misma estructura que `doctor` en el dashboard

#### 6.2.3. Actualizar Perfil
- **Endpoint**: `PUT /api/doctors/profile`
- **Headers**: `Authorization: Bearer <token>`
- **Request**: Cualquier campo del perfil (parcial)
- **Response**: Perfil completo actualizado

#### 6.2.4. Obtener Citas
- **Endpoint**: `GET /api/doctors/appointments`
- **Headers**: `Authorization: Bearer <token>`
- **Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "appointment-uuid",
      "patientName": "María González",
      "patientEmail": "maria@example.com",
      "patientPhone": "+51987654321",
      "date": "2024-12-20",
      "time": "10:00",
      "reason": "Consulta general",
      "notes": "Primera consulta",
      "status": "pending" | "paid" | "completed" | "cancelled" | "no-show",
      "paymentMethod": "card" | "cash",
      "price": 150.00
    }
  ]
}
```

**Estados de Cita:**
- `"pending"`: Programada, pendiente
- `"paid"`: Pagada, pendiente de atención
- `"completed"`: Atendida (puede crear diagnóstico)
- `"cancelled"`: Cancelada
- `"no-show"`: Paciente no se presentó

#### 6.2.5. Actualizar Estado de Cita
- **Endpoint**: `PUT /api/doctors/appointments/{appointmentId}/status`
- **Headers**: `Authorization: Bearer <token>`
- **Request:**
```json
{
  "status": "completed"
}
```
- **Response:**
```json
{
  "success": true,
  "data": {
    "id": "appointment-uuid",
    "status": "completed"
  }
}
```

#### 6.2.6. Crear Diagnóstico
- **Endpoint**: `POST /api/doctors/appointments/{appointmentId}/diagnosis`
- **Headers**: `Authorization: Bearer <token>`
- **Request:**
```json
{
  "diagnosis": "Hipertensión arterial",
  "treatment": "Medicación y dieta",
  "indications": "Tomar medicamento cada 8 horas",
  "observations": "Seguimiento en 1 mes"
}
```
- **Response:**
```json
{
  "success": true,
  "data": {
    "id": "diagnosis-uuid",
    "appointmentId": "appointment-uuid",
    "diagnosis": "Hipertensión arterial",
    "treatment": "Medicación y dieta",
    "indications": "Tomar medicamento cada 8 horas",
    "observations": "Seguimiento en 1 mes",
    "createdAt": "2024-12-20T10:30:00Z"
  }
}
```

#### 6.2.7. Obtener Pagos
- **Endpoint**: `GET /api/doctors/payments`
- **Headers**: `Authorization: Bearer <token>`
- **Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "payment-uuid",
      "appointmentId": "appointment-uuid",
      "patientName": "María González",
      "date": "2024-12-20",
      "amount": 150.00,
      "commission": 22.50,
      "netAmount": 127.50,
      "status": "pending" | "paid",
      "paymentMethod": "card" | "cash",
      "createdAt": "2024-12-20T10:00:00Z"
    }
  ]
}
```

**⚠️ IMPORTANTE**: 
- El backend debe filtrar los pagos para mostrar solo los del doctor autenticado
- El campo `patientName` debe ser el nombre del **paciente**, NO del doctor

#### 6.2.8. Obtener Horario
- **Endpoint**: `GET /api/doctors/schedule`
- **Headers**: `Authorization: Bearer <token>`
- **Response:**
```json
{
  "success": true,
  "data": [
    {
      "day": "monday",
      "enabled": true,
      "startTime": "09:00",
      "endTime": "18:00",
      "timeSlots": [
        { "startTime": "09:00", "endTime": "10:00", "available": true }
      ],
      "blockedHours": []
    }
  ]
}
```

#### 6.2.9. Actualizar Horario
- **Endpoint**: `PUT /api/doctors/schedule`
- **Headers**: `Authorization: Bearer <token>`
- **Request:**
```json
{
  "schedule": [
    {
      "day": "monday",
      "enabled": true,
      "startTime": "09:00",
      "endTime": "18:00",
      "timeSlots": [...],
      "blockedHours": []
    }
  ]
}
```
- **Response**: Misma estructura que GET

### 6.3. Farmacias

#### 6.3.1. Obtener Perfil
- **Endpoint**: `GET /api/pharmacies/profile`
- **Headers**: `Authorization: Bearer <token>`
- **Response:**
```json
{
  "success": true,
  "data": {
    "id": "pharmacy-uuid",
    "commercialName": "Farmacia Central",
    "logoUrl": "https://example.com/logo.png",
    "ruc": "20123456789",
    "description": "Farmacia con más de 20 años de experiencia",
    "websiteUrl": "https://farmaciacentral.com",
    "address": "Av. Principal 456, Lima",
    "status": "draft" | "published" | "suspended",
    "whatsapp": "+51987654321",
    "chainId": "chain-uuid",
    "location": {
      "latitude": -12.0464,
      "longitude": -77.0428,
      "address": "Av. Principal 456, Lima"
    },
    "schedule": [
      {
        "day": "monday",
        "isOpen": true,
        "startTime": "08:00",
        "endTime": "22:00"
      }
    ],
    "stats": {
      "profileViews": 1250,
      "contactClicks": 89,
      "totalReviews": 45,
      "averageRating": 4.7
    },
    "isActive": true
  }
}
```

#### 6.3.2. Actualizar Perfil
- **Endpoint**: `PUT /api/pharmacies/profile`
- **Headers**: `Authorization: Bearer <token>`
- **Request**: Cualquier campo del perfil (parcial)
- **Response**: Perfil completo actualizado

#### 6.3.3. Obtener Sucursales
- **Endpoint**: `GET /api/pharmacies/branches`
- **Headers**: `Authorization: Bearer <token>`
- **Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "branch-uuid",
      "name": "Sucursal Centro",
      "address": "Av. Principal 456",
      "openingHours": "Lun-Dom: 08:00 - 22:00",
      "phone": "+51987654321",
      "whatsapp": "+51987654321",
      "hasHomeDelivery": true,
      "isActive": true
    }
  ]
}
```

#### 6.3.4. Crear Sucursal
- **Endpoint**: `POST /api/pharmacies/branches`
- **Headers**: `Authorization: Bearer <token>`
- **Request**: Todos los campos excepto `id`
- **Response**: Sucursal creada

#### 6.3.5. Actualizar Sucursal
- **Endpoint**: `PUT /api/pharmacies/branches/{id}`
- **Headers**: `Authorization: Bearer <token>`
- **Request**: Campos a actualizar (parcial)
- **Response**: Sucursal actualizada

#### 6.3.6. Eliminar Sucursal
- **Endpoint**: `DELETE /api/pharmacies/branches/{id}`
- **Headers**: `Authorization: Bearer <token>`
- **Response:**
```json
{
  "success": true,
  "message": "Sucursal eliminada exitosamente"
}
```

#### 6.3.7. Obtener Reseñas
- **Endpoint**: `GET /api/pharmacies/reviews`
- **Headers**: `Authorization: Bearer <token>`
- **Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "review-uuid",
      "patientName": "María González",
      "rating": 5,
      "comment": "Excelente atención",
      "createdAt": "2024-12-20T10:00:00Z"
    }
  ]
}
```

### 6.4. Administración

#### 6.4.1. Obtener Estadísticas del Dashboard
- **Endpoint**: `GET /api/admin/dashboard/stats`
- **Headers**: `Authorization: Bearer <token>` (solo admin)
- **Response:**
```json
{
  "success": true,
  "data": {
    "totalServices": {
      "value": 150,
      "trend": "+12%"
    },
    "usersInApp": {
      "value": 5000,
      "trend": "+8%"
    },
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
    "recentActivity": [
      {
        "id": "activity-uuid",
        "type": "info" | "success" | "warning" | "error",
        "message": "Nuevo servicio registrado",
        "timestamp": "2024-12-20T10:00:00Z"
      }
    ]
  }
}
```

**⚠️ CRÍTICO**: 
- Todos los campos numéricos deben tener valores por defecto (0) si no hay datos
- `recentActivity` debe ser un array (puede estar vacío `[]`)
- Si algún campo está `undefined` o `null`, el frontend mostrará un error

#### 6.4.2. Obtener Solicitudes de Proveedores
- **Endpoint**: `GET /api/admin/requests`
- **Headers**: `Authorization: Bearer <token>` (solo admin)
- **Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "request-uuid",
      "providerName": "Dr. Juan Pérez",
      "email": "doctor@medicones.com",
      "avatarUrl": "https://example.com/avatar.png",
      "serviceType": "doctor" | "pharmacy" | "laboratory" | "ambulance" | "supplies",
      "submissionDate": "2024-12-20T10:00:00Z",
      "documentsCount": 3,
      "status": "pending" | "approved" | "rejected",
      "rejectionReason": "Motivo de rechazo",
      "phone": "+51987654321",
      "whatsapp": "+51987654321",
      "city": "Lima",
      "address": "Av. Principal 123",
      "description": "Descripción del servicio",
      "documents": [
        {
          "id": "doc-uuid",
          "name": "Cédula Profesional.pdf",
          "type": "pdf" | "image",
          "url": "https://example.com/document.pdf"
        }
      ]
    }
  ]
}
```

#### 6.4.3. Aprobar Solicitud de Proveedor
- **Endpoint**: `PUT /api/admin/requests/{id}/approve`
- **Headers**: `Authorization: Bearer <token>` (solo admin)
- **Response:**
```json
{
  "success": true,
  "message": "Solicitud aprobada exitosamente"
}
```

#### 6.4.4. Rechazar Solicitud de Proveedor
- **Endpoint**: `PUT /api/admin/requests/{id}/reject`
- **Headers**: `Authorization: Bearer <token>` (solo admin)
- **Request:**
```json
{
  "reason": "Documentación incompleta"
}
```
- **Response:**
```json
{
  "success": true,
  "message": "Solicitud rechazada exitosamente"
}
```

#### 6.4.5. Obtener Solicitudes de Anuncios
- **Endpoint**: `GET /api/admin/ad-requests`
- **Headers**: `Authorization: Bearer <token>` (solo admin)
- **Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ad-request-uuid",
      "providerId": "provider-uuid",
      "providerName": "Dr. Juan Pérez",
      "providerEmail": "doctor@medicones.com",
      "serviceType": "doctor" | "pharmacy" | "laboratory" | "ambulance" | "supplies",
      "submissionDate": "2024-12-20T10:00:00Z",
      "status": "pending" | "approved" | "rejected",
      "rejectionReason": "Motivo de rechazo",
      "approvedAt": "2024-12-20T11:00:00Z",
      "rejectedAt": "2024-12-20T11:00:00Z",
      "hasActiveAd": false,
      "adContent": {
        "label": "PRIMERA CITA",
        "discount": "20% OFF",
        "description": "En tu primera consulta general con profesionales verificados.",
        "buttonText": "Canjear Ahora",
        "imageUrl": "https://example.com/banner.jpg",
        "startDate": "2024-12-20T00:00:00Z",
        "endDate": "2025-01-20T23:59:59Z"
      }
    }
  ]
}
```

#### 6.4.6. Aprobar Solicitud de Anuncio
- **Endpoint**: `PUT /api/admin/ad-requests/{id}/approve`
- **Headers**: `Authorization: Bearer <token>` (solo admin)
- **Response:**
```json
{
  "success": true,
  "message": "Anuncio aprobado exitosamente"
}
```

#### 6.4.7. Rechazar Solicitud de Anuncio
- **Endpoint**: `PUT /api/admin/ad-requests/{id}/reject`
- **Headers**: `Authorization: Bearer <token>` (solo admin)
- **Request:**
```json
{
  "reason": "Contenido no apropiado"
}
```
- **Response:**
```json
{
  "success": true,
  "message": "Anuncio rechazado exitosamente"
}
```

#### 6.4.8. Obtener Historial de Actividad
- **Endpoint**: `GET /api/admin/activity`
- **Headers**: `Authorization: Bearer <token>` (solo admin)
- **Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "activity-uuid",
      "title": "Nuevo servicio registrado",
      "actor": "Dr. Juan Pérez",
      "date": "2024-12-20T10:00:00Z",
      "type": "REGISTRATION" | "APPROVAL" | "REJECTION" | "ANNOUNCEMENT" | "UPDATE"
    }
  ]
}
```

### 6.5. Home (Página Principal)

#### 6.5.1. Obtener Contenido Principal
- **Endpoint**: `GET /api/home/content`
- **Headers**: No requiere autenticación
- **Response:**
```json
{
  "success": true,
  "data": {
    "hero": {
      "title": "Tu Salud es Nuestra Prioridad",
      "subtitle": "Encuentra médicos, farmacias, laboratorios y servicios de salud cerca de ti",
      "ctaText": "Explora Nuestros Servicios",
      "ctaLink": "/services"
    },
    "features": {
      "title": "¿Por Qué Elegirnos?",
      "subtitle": "La mejor plataforma para conectar con servicios de salud"
    },
    "featuredServices": {
      "title": "Profesionales Premium",
      "subtitle": "Servicios verificados con la mejor calidad y atención",
      "rotationInterval": 5
    },
    "joinSection": {
      "title": "Únete a Medify",
      "subtitle": "La plataforma que conecta a pacientes y profesionales de la salud",
      "ctaText": "¡Regístrate ahora!",
      "ctaLink": "/register"
    },
    "footer": {
      "copyright": "Conectando salud y bienestar | Medify © 2025",
      "links": [
        { "label": "Política de privacidad", "url": "/privacy" },
        { "label": "Términos y condiciones", "url": "/terms" }
      ]
    }
  }
}
```

#### 6.5.2. Obtener Características
- **Endpoint**: `GET /api/home/features`
- **Headers**: No requiere autenticación
- **Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "feature-uuid",
      "icon": "LocationOn",
      "title": "Encuentra servicios cercanos",
      "description": "Localiza médicos, farmacias y laboratorios en tu zona",
      "order": 1
    }
  ]
}
```

#### 6.5.3. Obtener Servicios Destacados
- **Endpoint**: `GET /api/home/featured-services`
- **Headers**: No requiere autenticación
- **Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "service-uuid",
      "name": "Dr. Juan Pérez",
      "description": "Cardiólogo con 15 años de experiencia",
      "imageUrl": "https://example.com/image.jpg",
      "rating": 4.8,
      "totalReviews": 120,
      "category": "doctor",
      "location": {
        "address": "Av. Principal 123",
        "city": "Lima"
      },
      "isPremium": true,
      "order": 1
    }
  ]
}
```

### 6.6. Insumos Médicos

#### 6.6.1. Obtener Lista de Tiendas
- **Endpoint**: `GET /api/supplies`
- **Headers**: No requiere autenticación
- **Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "supply-uuid",
      "name": "Insumos Médicos Central",
      "description": "Equipos y suministros médicos",
      "imageUrl": "https://example.com/image.jpg",
      "rating": 4.5,
      "totalReviews": 30,
      "address": "Av. Principal 789",
      "phone": "+51987654321",
      "isActive": true
    }
  ]
}
```

#### 6.6.2. Obtener Detalle de Tienda
- **Endpoint**: `GET /api/supplies/{id}`
- **Headers**: No requiere autenticación
- **Response**: Objeto completo de la tienda

#### 6.6.3. Obtener Reseñas de Tienda
- **Endpoint**: `GET /api/supplies/{id}/reviews`
- **Headers**: No requiere autenticación
- **Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "review-uuid",
      "supplyStoreId": "supply-uuid",
      "userId": "user-uuid",
      "userName": "María González",
      "rating": 5,
      "comment": "Excelente servicio",
      "createdAt": "2024-12-20T10:00:00Z"
    }
  ]
}
```

#### 6.6.4. Crear Reseña
- **Endpoint**: `POST /api/supplies/{id}/reviews`
- **Headers**: `Authorization: Bearer <token>`
- **Request:**
```json
{
  "rating": 5,
  "comment": "Excelente servicio"
}
```
- **Response**: Reseña creada

---

## 7. Estructuras de Datos

### 7.1. User (Usuario)

```typescript
interface User {
  userId: string;        // UUID
  email: string;
  name: string;
  role: "admin" | "provider" | "patient";
  serviceType?: "doctor" | "pharmacy" | "laboratory" | "lab" | "ambulance" | "supplies";
}
```

### 7.2. WorkSchedule (Horario de Trabajo)

```typescript
interface WorkSchedule {
  day: string;  // "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
  enabled: boolean;
  startTime: string;  // Formato "HH:mm" (ej: "09:00")
  endTime: string;  // Formato "HH:mm" (ej: "18:00")
  timeSlots?: Array<{
    startTime: string;
    endTime: string;
    available: boolean;
  }>;
  blockedHours?: string[];  // Array de horas bloqueadas ["09:00", "10:00"]
}
```

### 7.3. Appointment (Cita)

```typescript
interface Appointment {
  id: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  date: string;  // Formato "YYYY-MM-DD"
  time: string;  // Formato "HH:mm"
  reason: string;
  notes?: string;
  status: "pending" | "paid" | "completed" | "cancelled" | "no-show";
  paymentMethod?: "card" | "cash";
  price?: number;
}
```

### 7.4. Payment (Pago)

```typescript
interface Payment {
  id: string;
  appointmentId: string;
  patientName: string;  // ⚠️ Nombre del PACIENTE, no del doctor
  date: string;
  amount: number;
  commission: number;
  netAmount: number;
  status: "pending" | "paid";
  paymentMethod: "card" | "cash";
  createdAt: string;
}
```

### 7.5. ProviderRequest (Solicitud de Proveedor)

```typescript
interface ProviderRequest {
  id: string;
  providerName: string;
  email: string;
  avatarUrl?: string;
  serviceType: "doctor" | "pharmacy" | "laboratory" | "ambulance" | "supplies";
  submissionDate: string;
  documentsCount: number;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
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

### 7.6. AdRequest (Solicitud de Anuncio)

```typescript
interface AdRequest {
  id: string;
  providerId: string;
  providerName: string;
  providerEmail: string;
  serviceType: "doctor" | "pharmacy" | "laboratory" | "ambulance" | "supplies";
  submissionDate: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  approvedAt?: string;
  rejectedAt?: string;
  hasActiveAd: boolean;
  adContent?: {
    label: string;  // Ej: "PRIMERA CITA"
    discount: string;  // Ej: "20% OFF"
    description: string;
    buttonText: string;  // Ej: "Canjear Ahora"
    imageUrl?: string;
    startDate: string;
    endDate?: string;
  };
}
```

### 7.7. DashboardStats (Estadísticas del Dashboard)

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
- Todos los campos numéricos deben tener valores por defecto (0)
- `recentActivity` debe ser un array (puede estar vacío `[]`)
- Si algún campo está `undefined` o `null`, el frontend mostrará un error

---

## 8. Códigos de Error

### 8.1. Códigos HTTP Esperados

| Código | Significado | Comportamiento del Frontend |
|--------|-------------|----------------------------|
| `200` | Éxito | Procesa la respuesta normalmente |
| `201` | Creado | Procesa la respuesta normalmente |
| `400` | Error de validación | Muestra el mensaje de error del backend |
| `401` | No autorizado | Limpia tokens, cierra sesión, NO redirige automáticamente |
| `403` | Acceso denegado | Muestra mensaje "Acceso denegado" |
| `404` | No encontrado | Muestra mensaje de error |
| `500` | Error interno | Muestra mensaje de error genérico |

### 8.2. Formato de Error Esperado

```json
{
  "success": false,
  "message": "Error descriptivo del problema",
  "errors": {
    "field": ["Error específico del campo"]
  }
}
```

---

## 9. Consideraciones Importantes

### 9.1. Formato de Fechas

- **ISO 8601**: Todas las fechas con hora deben estar en formato ISO 8601: `"2024-12-20T10:00:00Z"`
- **Fechas simples**: Para campos de fecha sin hora, usar formato: `"2024-12-20"`

### 9.2. Formato de Horas

- **24 horas**: Todas las horas deben estar en formato 24 horas: `"09:00"`, `"18:00"`

### 9.3. Valores por Defecto

- **Arrays vacíos**: Si no hay datos, retornar `[]` en lugar de `null` o `undefined`
- **Números**: Si no hay valor numérico, retornar `0` en lugar de `null` o `undefined`
- **Strings**: Si no hay texto, retornar `""` en lugar de `null` o `undefined`

### 9.4. Normalización de Valores

- **Roles**: Siempre en minúsculas: `"provider"`, `"admin"`, `"patient"`
- **ServiceTypes**: Siempre en minúsculas: `"doctor"`, `"pharmacy"`, `"laboratory"`, `"lab"`, `"ambulance"`, `"supplies"`
- **Estados**: Siempre en minúsculas: `"pending"`, `"approved"`, `"rejected"`, `"completed"`, etc.

### 9.5. Validación de Datos

- El frontend valida que `success` sea `true` antes de procesar `data`
- Si `success` es `false`, el frontend muestra el `message` como error

### 9.6. Filtrado de Datos

- El backend debe filtrar los datos según el usuario autenticado
- Ejemplo: `/api/doctors/payments` debe retornar solo los pagos del doctor autenticado
- Ejemplo: `/api/pharmacies/branches` debe retornar solo las sucursales de la farmacia autenticada

### 9.7. Paginación (Futuro)

Si un endpoint retorna muchos resultados, considerar implementar paginación:

```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  }
}
```

---

## 10. Resumen de Puntos Críticos

### ⚠️ CRÍTICO - Debe Implementarse Correctamente

1. **Formato de Respuesta**: Todas las respuestas deben tener `{ success: boolean, data: T }`
2. **Roles y ServiceTypes**: Siempre en minúsculas
3. **Token JWT**: Enviar en header `Authorization: Bearer <token>`
4. **Valores por Defecto**: Arrays vacíos `[]`, números `0`, strings `""`
5. **Filtrado**: El backend debe filtrar datos según el usuario autenticado
6. **Dashboard Stats**: Todos los campos deben tener valores por defecto
7. **PatientName en Payments**: Debe ser el nombre del paciente, no del doctor
8. **Laboratory ServiceType**: Aceptar tanto `"lab"` como `"laboratory"`

### ✅ Recomendaciones

1. Validar todos los campos requeridos antes de retornar
2. Usar códigos HTTP apropiados (200, 201, 400, 401, 403, 404, 500)
3. Incluir mensajes de error descriptivos
4. Implementar paginación para listas grandes
5. Documentar todos los endpoints con ejemplos

---

## 11. Contacto y Soporte

Si el backend necesita aclaraciones sobre algún endpoint, estructura de datos, o comportamiento del frontend, puede referirse a este documento o contactar al equipo de frontend.

**Última actualización**: Diciembre 2024

---

## 📝 Notas Finales

Este documento contiene **TODA** la información que el backend necesita conocer sobre el frontend. Si algo no está documentado aquí, es porque aún no está implementado en el frontend o es un caso edge que requiere consulta directa con el equipo de frontend.

**Versión del Documento**: 1.0
**Fecha de Creación**: Diciembre 2024
**Mantenido por**: Equipo de Frontend MediConnect
