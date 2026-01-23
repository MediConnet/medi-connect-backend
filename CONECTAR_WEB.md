# 🌐 Guía: Conectar Backend a Aplicación Web

Esta guía te muestra cómo conectar tu aplicación web (React, Next.js, Vue, etc.) con el backend serverless de MediConnect.

## 📋 Tabla de Contenidos

1. [Configuración Inicial](#configuración-inicial)
2. [Obtener URL del API](#obtener-url-del-api)
3. [Configurar CORS](#configurar-cors)
4. [Ejemplos de Código](#ejemplos-de-código)
5. [Autenticación](#autenticación)
6. [Variables de Entorno](#variables-de-entorno)
7. [Testing](#testing)

---

## 🚀 Configuración Inicial

### 1. Obtener URL del API Gateway

Después de hacer deploy, obtén la URL de tu API Gateway:

```bash
# Opción 1: Desde AWS Console
# Ve a API Gateway > APIs > Tu API > Stages > dev
# Copia la "Invoke URL"

# Opción 2: Desde CloudFormation
aws cloudformation describe-stacks \
  --stack-name medi-connect-backend \
  --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayUrl'].OutputValue" \
  --output text
```

La URL será algo como:
```
https://abc123xyz.execute-api.us-east-1.amazonaws.com/dev
```

---

## 🔧 Configurar CORS

### Desarrollo Local

En tu archivo `.env` del backend, configura:

```bash
# Permitir todos los orígenes (solo desarrollo)
CORS_ORIGIN=*

# O múltiples orígenes específicos
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:5173
```

### Producción

Al hacer deploy, especifica el origen de tu web app:

```bash
npm run deploy -- --parameter-overrides \
  Stage=prod \
  WebOrigin=https://tu-dominio.com \
  DatabaseUrl=postgresql://...
```

O edita `infrastructure/cloudformation/template.yaml` y actualiza el parámetro `WebOrigin`.

---

## 💻 Ejemplos de Código

### React / Next.js / Vue

#### 1. Crear un cliente API

**`src/lib/api.ts`** (o `utils/api.ts`):

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  'https://abc123xyz.execute-api.us-east-1.amazonaws.com/dev';

// Cliente API con manejo de autenticación
class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Cargar token del localStorage al inicializar
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('accessToken');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (token && typeof window !== 'undefined') {
      localStorage.setItem('accessToken', token);
    } else if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Agregar token si existe
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Para cookies si las usas
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Error en la petición');
    }

    return data.data; // El backend devuelve { success: true, data: ... }
  }

  // Métodos HTTP
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async put<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
```

#### 2. Servicio de Autenticación

**`src/services/auth.ts`**:

```typescript
import { apiClient } from '@/lib/api';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export interface RegisterData {
  email: string;
  password: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  role?: 'PATIENT' | 'DOCTOR' | 'PHARMACY' | 'LABORATORY' | 'AMBULANCE';
}

export const authService = {
  // Login
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/api/auth/login', {
      email,
      password,
    });
    
    // Guardar token
    apiClient.setToken(response.accessToken);
    
    return response;
  },

  // Registro
  async register(data: RegisterData): Promise<{ userId: string; email: string }> {
    return apiClient.post('/api/auth/register', data);
  },

  // Obtener usuario actual
  async getCurrentUser() {
    return apiClient.get('/api/auth/me');
  },

  // Cambiar contraseña
  async changePassword(currentPassword: string, newPassword: string) {
    return apiClient.post('/api/auth/change-password', {
      currentPassword,
      newPassword,
    });
  },

  // Logout
  logout() {
    apiClient.setToken(null);
  },

  // Refresh token
  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/api/auth/refresh', {
      refreshToken,
    });
    
    apiClient.setToken(response.accessToken);
    
    return response;
  },
};
```

#### 3. Hook de React para Autenticación

**`src/hooks/useAuth.ts`**:

```typescript
import { useState, useEffect } from 'react';
import { authService } from '@/services/auth';

interface User {
  id: string;
  email: string;
  role: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar si hay token y cargar usuario
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await authService.getCurrentUser();
      setUser(userData);
    } catch (error) {
      // No hay usuario autenticado
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await authService.login(email, password);
    await loadUser();
    return response;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  };
}
```

#### 4. Componente de Login

**`src/components/LoginForm.tsx`**:

```typescript
'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      
      <div>
        <label>Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error && <div style={{ color: 'red' }}>{error}</div>}

      <button type="submit" disabled={loading}>
        {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
      </button>
    </form>
  );
}
```

#### 5. Llamadas a Endpoints Protegidos

**`src/services/doctors.ts`**:

```typescript
import { apiClient } from '@/lib/api';

export const doctorsService = {
  // Obtener perfil del doctor
  async getProfile() {
    return apiClient.get('/api/doctors/profile');
  },

  // Actualizar perfil
  async updateProfile(data: {
    licenseNumber?: string;
    specialization?: string;
    hospital?: string;
    bio?: string;
  }) {
    return apiClient.put('/api/doctors/profile', data);
  },

  // Obtener citas
  async getAppointments(params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return apiClient.get(`/api/doctors/appointments${queryString}`);
  },
};
```

---

## 🔐 Autenticación

### Flujo de Autenticación

1. **Usuario hace login** → Backend devuelve JWT token
2. **Guardar token** → localStorage o httpOnly cookie
3. **Incluir en requests** → Header `Authorization: Bearer <token>`
4. **Refresh automático** → Renovar token antes de expirar

### Interceptor para Refresh Token

**`src/lib/api.ts`** (extensión):

```typescript
// Agregar al método request del ApiClient

private async request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${this.baseUrl}${endpoint}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (this.token) {
    headers['Authorization'] = `Bearer ${this.token}`;
  }

  let response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Si el token expiró (401), intentar refresh
  if (response.status === 401 && this.token) {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        const refreshResponse = await authService.refreshToken(refreshToken);
        // Reintentar request con nuevo token
        headers['Authorization'] = `Bearer ${refreshResponse.accessToken}`;
        response = await fetch(url, {
          ...options,
          headers,
          credentials: 'include',
        });
      }
    } catch (error) {
      // Refresh falló, redirigir a login
      this.setToken(null);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw error;
    }
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Error en la petición');
  }

  return data.data;
}
```

---

## 🌍 Variables de Entorno

### Frontend (Next.js / React)

**`.env.local`**:

```bash
# URL del API Gateway
NEXT_PUBLIC_API_URL=https://abc123xyz.execute-api.us-east-1.amazonaws.com/dev

# Para desarrollo local
# NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

**`.env.production`**:

```bash
NEXT_PUBLIC_API_URL=https://api.tu-dominio.com
```

### Backend

**`.env`** (backend):

```bash
# CORS - Desarrollo
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# CORS - Producción (se configura en CloudFormation)
# WebOrigin=https://tu-dominio.com
```

---

## 🧪 Testing

### Probar desde el Navegador

Abre la consola del navegador (F12) y ejecuta:

```javascript
// Test de endpoint público
fetch('https://tu-api.execute-api.us-east-1.amazonaws.com/dev/api/supplies/stores', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
})
.then(r => r.json())
.then(data => console.log('✅ Success:', data))
.catch(err => console.error('❌ Error:', err));

// Test de login
fetch('https://tu-api.execute-api.us-east-1.amazonaws.com/dev/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'Test123!@#'
  }),
})
.then(r => r.json())
.then(data => {
  console.log('✅ Login success:', data);
  const token = data.data.accessToken;
  
  // Test de endpoint protegido
  return fetch('https://tu-api.execute-api.us-east-1.amazonaws.com/dev/api/auth/me', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
})
.then(r => r.json())
.then(data => console.log('✅ Protected endpoint:', data))
.catch(err => console.error('❌ Error:', err));
```

---

## 📝 Checklist de Integración

- [ ] Obtener URL del API Gateway después del deploy
- [ ] Configurar `CORS_ORIGINS` en backend para desarrollo
- [ ] Configurar `NEXT_PUBLIC_API_URL` en frontend
- [ ] Crear cliente API con manejo de tokens
- [ ] Implementar servicio de autenticación
- [ ] Crear hook `useAuth` para React
- [ ] Implementar refresh token automático
- [ ] Probar endpoints públicos
- [ ] Probar endpoints protegidos
- [ ] Configurar CORS para producción

---

## 🚨 Troubleshooting

### Error: CORS policy blocked

**Solución**: Verifica que `CORS_ORIGINS` incluya el origen de tu web app:
```bash
# Backend .env
CORS_ORIGINS=http://localhost:3000
```

### Error: 401 Unauthorized

**Solución**: 
- Verifica que el token esté incluido en el header
- Verifica que el token no haya expirado
- Implementa refresh token automático

### Error: Network error

**Solución**:
- Verifica que la URL del API Gateway sea correcta
- Verifica que el API Gateway esté desplegado
- Revisa los logs de CloudWatch

---

## 📚 Recursos Adicionales

- [Documentación de API Gateway](https://docs.aws.amazon.com/apigateway/)
- [Guía de CORS](./WEB_AND_MOBILE.md)
- [Documentación de Cognito](https://docs.aws.amazon.com/cognito/)

---

¿Necesitas ayuda con algún framework específico? Puedo crear ejemplos para:
- Next.js con App Router
- React con Vite
- Vue 3 con Composition API
- Angular
- Svelte
