# 🚀 Configuración de Variables de Entorno en Render

Este documento explica cómo configurar las variables de entorno necesarias para el backend en Render.com.

## 📋 Variables de Entorno Requeridas

### 1. Variables de Base de Datos

#### `DATABASE_URL`
- **Descripción:** URL de conexión a PostgreSQL
- **Formato:** `postgresql://usuario:contraseña@host:puerto/base_de_datos`
- **Ejemplo:** `postgresql://user:pass@host.render.com:5432/dbname`
- **Dónde obtenerla:** Render Dashboard → Database → Internal Database URL o External Database URL

---

### 2. Variables de CORS y URLs

#### `CORS_ORIGINS`
- **Descripción:** Orígenes permitidos para peticiones CORS (URLs del frontend)
- **Valor:** `https://do-calink.vercel.app`
- **Múltiples orígenes:** Separa con comas: `https://do-calink.vercel.app,http://localhost:5173`
- **Importante:** Sin esta variable, el frontend no podrá hacer peticiones al backend

#### `FRONTEND_URL`
- **Descripción:** URL del frontend para generar enlaces en emails e invitaciones
- **Valor:** `https://do-calink.vercel.app`
- **Uso:** Se usa en:
  - Enlaces de invitación de clínicas
  - Enlaces en emails de recuperación de contraseña
  - Enlaces en notificaciones

#### `FILE_BASE_URL`
- **Descripción:** URL base del backend para servir archivos subidos
- **Valor:** `https://doca-link-backend.onrender.com`
- **Uso:** Se usa para generar URLs de archivos/imágenes subidos

---

### 3. Variables Opcionales

#### `NODE_ENV`
- **Descripción:** Entorno de ejecución
- **Valor:** `production`
- **Por defecto:** Si no se configura, el código detecta automáticamente

#### `STAGE`
- **Descripción:** Etapa de despliegue
- **Valor:** `prod` o `production`
- **Uso:** Para determinar si está en producción o desarrollo

#### `GMAIL_REDIRECT_URI` (Solo si usas Gmail API)
- **Descripción:** URL de callback para OAuth de Gmail
- **Valor:** `https://doca-link-backend.onrender.com/api/gmail/callback`
- **Nota:** Solo necesario si usas la funcionalidad de Gmail

---

## 🔧 Cómo Configurar en Render

### Paso 1: Acceder a Environment Variables

1. Ve a [Render Dashboard](https://dashboard.render.com)
2. Selecciona tu servicio **"Doca-link-backend"**
3. En el menú lateral, haz clic en **"Environment"**

### Paso 2: Agregar Variables

1. Haz clic en **"Add Environment Variable"**
2. Agrega cada variable una por una:

```
Key: DATABASE_URL
Value: postgresql://tu-url-de-base-de-datos
```

```
Key: CORS_ORIGINS
Value: https://do-calink.vercel.app
```

```
Key: FRONTEND_URL
Value: https://do-calink.vercel.app
```

```
Key: FILE_BASE_URL
Value: https://doca-link-backend.onrender.com
```

```
Key: NODE_ENV
Value: production
```

```
Key: STAGE
Value: prod
```

### Paso 3: Guardar y Deploy

1. Después de agregar todas las variables, Render hará un **deploy automático**
2. Espera a que el deploy termine (puede tomar 2-5 minutos)
3. Verifica que el servicio esté **"Live"** (estado verde)

---

## ✅ Verificación

### 1. Verificar que las Variables Estén Configuradas

En Render Dashboard → Environment, deberías ver todas las variables listadas.

### 2. Verificar el Deploy

1. Ve a **"Events"** o **"Logs"** en Render
2. Busca el mensaje: `✅ Conexión a la base de datos exitosa`
3. Si aparece, el backend está funcionando correctamente

### 3. Probar el Endpoint

Puedes probar con curl o desde el frontend:

```bash
curl -X POST https://doca-link-backend.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@medicones.com","password":"admin123"}'
```

---

## 🔍 Valores por Defecto en el Código

Si alguna variable no está configurada, el código usa estos valores por defecto:

- `CORS_ORIGINS`: `*` (permite todos los orígenes - solo para desarrollo)
- `FRONTEND_URL`: `http://localhost:5173` (desarrollo) o `https://app.mediconnect.com` (producción)
- `FILE_BASE_URL`: `http://localhost:3000` (desarrollo)
- `NODE_ENV`: Detectado automáticamente
- `STAGE`: Detectado automáticamente

**⚠️ Importante:** En producción, siempre configura explícitamente estas variables.

---

## 📝 Resumen de Configuración

| Variable | Valor | Requerida |
|----------|-------|-----------|
| `DATABASE_URL` | `postgresql://...` | ✅ Sí |
| `CORS_ORIGINS` | `https://do-calink.vercel.app` | ✅ Sí |
| `FRONTEND_URL` | `https://do-calink.vercel.app` | ✅ Sí |
| `FILE_BASE_URL` | `https://doca-link-backend.onrender.com` | ✅ Sí |
| `NODE_ENV` | `production` | ⚠️ Recomendada |
| `STAGE` | `prod` | ⚠️ Recomendada |

---

## 🐛 Troubleshooting

### Error: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Solución:** Verifica que `CORS_ORIGINS` esté configurada con la URL exacta de tu frontend (sin trailing slash).

### Error: "Cannot find module" o errores de Prisma

**Solución:** Verifica que `DATABASE_URL` esté correctamente configurada y que la base de datos esté accesible.

### Los enlaces en emails apuntan a localhost

**Solución:** Verifica que `FRONTEND_URL` esté configurada con la URL de producción.

### Las imágenes no se cargan

**Solución:** Verifica que `FILE_BASE_URL` esté configurada con la URL de tu backend en Render.

---

## 🔗 URLs Importantes

- **Backend:** `https://doca-link-backend.onrender.com`
- **Frontend:** `https://do-calink.vercel.app`
- **API Base:** `https://doca-link-backend.onrender.com/api`

---

## 📞 Soporte

Si tienes problemas con la configuración:
1. Revisa los logs en Render Dashboard → Logs
2. Verifica que todas las variables estén correctamente escritas (sin espacios extra)
3. Asegúrate de que el deploy haya terminado correctamente
