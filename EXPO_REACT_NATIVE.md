# 📱 Expo + React Native - Guía de Integración

## ✅ Backend Optimizado para Expo y React Native

Este backend está **completamente compatible** con Expo y React Native. No requiere configuración especial de CORS ya que las apps móviles no tienen restricciones CORS del navegador.

## 🚀 Configuración Rápida

### 1. Variables de Entorno en Expo

Crea un archivo `.env` en tu proyecto Expo:

```bash
# .env
EXPO_PUBLIC_API_URL=https://api.mediconnect.com
# O para desarrollo local (si usas ngrok o similar)
# EXPO_PUBLIC_API_URL=http://localhost:3000
```

**Nota**: En Expo, las variables de entorno deben empezar con `EXPO_PUBLIC_` para ser accesibles en el cliente.

### 2. Configurar API Client

Crea un archivo `api/client.ts` en tu proyecto Expo:

```typescript
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 
                process.env.EXPO_PUBLIC_API_URL || 
                'https://api.mediconnect.com';

// Cliente API con interceptores
class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(API_URL);
```

### 3. Almacenar Tokens con Expo SecureStore

```typescript
// utils/storage.ts
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const storage = {
  async saveToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },

  async getToken(): Promise<string | null> {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  },

  async saveRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },

  async clearTokens(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
};
```

### 4. Servicio de Autenticación

```typescript
// services/auth.ts
import { apiClient } from '../api/client';
import { storage } from '../utils/storage';

interface LoginResponse {
  success: true;
  data: {
    accessToken: string;
    refreshToken: string;
    idToken: string;
    expiresIn: number;
  };
}

interface RegisterResponse {
  success: true;
  data: {
    userId: string;
    email: string;
    message: string;
  };
}

export const authService = {
  async login(email: string, password: string) {
    const response = await apiClient.post<LoginResponse>('/api/auth/login', {
      email,
      password,
    });

    if (response.success && response.data) {
      await storage.saveToken(response.data.accessToken);
      await storage.saveRefreshToken(response.data.refreshToken);
      apiClient.setToken(response.data.accessToken);
    }

    return response;
  },

  async register(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) {
    const response = await apiClient.post<RegisterResponse>(
      '/api/auth/register',
      data
    );
    return response;
  },

  async refreshToken() {
    const refreshToken = await storage.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await apiClient.post<LoginResponse>('/api/auth/refresh', {
      refreshToken,
    });

    if (response.success && response.data) {
      await storage.saveToken(response.data.accessToken);
      apiClient.setToken(response.data.accessToken);
    }

    return response;
  },

  async getCurrentUser() {
    const response = await apiClient.get('/api/auth/me');
    return response;
  },

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await apiClient.post('/api/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response;
  },

  async logout() {
    await storage.clearTokens();
    apiClient.setToken(null);
  },

  async initialize() {
    // Restaurar token al iniciar la app
    const token = await storage.getToken();
    if (token) {
      apiClient.setToken(token);
      // Opcional: validar token llamando a /api/auth/me
      try {
        await this.getCurrentUser();
      } catch (error) {
        // Token inválido, intentar refresh
        try {
          await this.refreshToken();
        } catch {
          // Refresh falló, limpiar tokens
          await this.logout();
        }
      }
    }
  },
};
```

## 📋 Ejemplos de Uso

### Login Screen

```typescript
// screens/LoginScreen.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import { authService } from '../services/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);
      const response = await authService.login(email, password);
      
      if (response.success) {
        // Navegar a home
        // navigation.navigate('Home');
        Alert.alert('Éxito', 'Login exitoso');
      } else {
        Alert.alert('Error', response.message || 'Error al iniciar sesión');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title="Login" onPress={handleLogin} disabled={loading} />
    </View>
  );
}
```

### Obtener Perfil de Doctor

```typescript
// screens/DoctorProfileScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { apiClient } from '../api/client';

export default function DoctorProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await apiClient.get('/api/doctors/profile');
      if (response.success) {
        setProfile(response.data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Text>Cargando...</Text>;
  if (!profile) return <Text>No se encontró el perfil</Text>;

  return (
    <View>
      <Text>Especialidad: {profile.specialization}</Text>
      <Text>Hospital: {profile.hospital}</Text>
    </View>
  );
}
```

### Listar Tiendas (Público)

```typescript
// screens/StoresScreen.tsx
import React, { useEffect, useState } from 'react';
import { FlatList, View, Text } from 'react-native';
import { apiClient } from '../api/client';

export default function StoresScreen() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      const response = await apiClient.get('/api/supplies/stores');
      if (response.success) {
        setStores(response.data.stores);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FlatList
      data={stores}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View>
          <Text>{item.name}</Text>
          <Text>{item.address}</Text>
        </View>
      )}
    />
  );
}
```

## 🔐 Manejo de Errores

### Interceptor de Errores Global

```typescript
// api/client.ts - Mejorar el método request
private async request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${this.baseURL}${endpoint}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(this.token && { Authorization: `Bearer ${this.token}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    // Manejar errores de autenticación
    if (response.status === 401) {
      // Intentar refresh token
      try {
        await this.refreshToken();
        // Reintentar request
        return this.request<T>(endpoint, options);
      } catch {
        // Refresh falló, redirigir a login
        throw new Error('Session expired. Please login again.');
      }
    }

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

private async refreshToken() {
  const refreshToken = await storage.getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');

  const response = await fetch(`${this.baseURL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  const data = await response.json();
  if (data.success && data.data) {
    await storage.saveToken(data.data.accessToken);
    this.token = data.data.accessToken;
  } else {
    throw new Error('Token refresh failed');
  }
}
```

## 📦 Dependencias Necesarias

```json
{
  "dependencies": {
    "expo": "~49.0.0",
    "expo-secure-store": "~12.3.1",
    "react-native": "0.72.6"
  }
}
```

Instalar:
```bash
npx expo install expo-secure-store
```

## 🎯 Características del Backend para Expo

### ✅ Lo que Funciona Perfectamente

1. **Sin CORS**: Las apps móviles no tienen restricciones CORS
2. **JWT Authentication**: Tokens Cognito funcionan perfectamente
3. **HTTPS**: API Gateway usa HTTPS por defecto
4. **JSON Responses**: Formato estándar compatible
5. **Error Handling**: Respuestas de error consistentes

### 🔧 Configuración del Backend

El backend ya está configurado correctamente. Solo necesitas:

1. **Obtener la URL del API** después del deploy:
   ```bash
   # CloudFormation output
   ApiGatewayUrl: https://xxxxx.execute-api.us-east-1.amazonaws.com
   ```

2. **Configurar en Expo**:
   ```bash
   EXPO_PUBLIC_API_URL=https://xxxxx.execute-api.us-east-1.amazonaws.com
   ```

## 🚨 Troubleshooting

### Error: Network request failed
- Verifica que la URL del API sea correcta
- Asegúrate de que el dispositivo/emulador tenga conexión a internet
- Verifica que el API Gateway esté desplegado

### Error: 401 Unauthorized
- Verifica que el token esté guardado correctamente
- Verifica que el token no haya expirado
- Intenta hacer refresh del token

### Error: CORS (solo en desarrollo web)
- Si estás probando en web (Expo Web), necesitas configurar CORS
- En mobile (iOS/Android) no deberías ver errores CORS

## 📱 Testing

### Probar en Expo Go

```bash
# Iniciar Expo
npx expo start

# Escanear QR con Expo Go app
# O presionar 'i' para iOS simulator
# O presionar 'a' para Android emulator
```

### Probar en Desarrollo

Si estás usando un emulador/simulador local, puedes usar:
- iOS Simulator: `http://localhost:3000` (si tienes un proxy)
- Android Emulator: `http://10.0.2.2:3000` (dirección especial de Android)

Para producción, siempre usa la URL de API Gateway.

## 🎉 Listo para Usar

Tu backend está **100% compatible** con Expo y React Native. Solo necesitas:

1. ✅ Configurar `EXPO_PUBLIC_API_URL`
2. ✅ Usar el `apiClient` para hacer requests
3. ✅ Almacenar tokens con `expo-secure-store`
4. ✅ Manejar autenticación con el servicio de auth

¡Todo listo! 🚀
