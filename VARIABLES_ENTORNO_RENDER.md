# 📋 Variables de Entorno para Render - Lista para Copiar y Pegar

Este documento contiene todas las variables de entorno que debes configurar en Render Dashboard.

## 🔧 Cómo Usar Este Documento

1. Ve a Render Dashboard → Tu servicio "Doca-link-backend" → **Environment**
2. Haz clic en **"+ Add"** para cada variable
3. Copia y pega el **KEY** y el **VALUE** de cada variable
4. Haz clic en **"Save, rebuild, and deploy"** al final

---

## ✅ Variables Requeridas

### 1. DATABASE_URL
```
KEY: DATABASE_URL
VALUE: (Tu URL de PostgreSQL - obténla de Render Dashboard → Database)
```
**Nota:** Esta variable ya debería estar configurada. Si no, ve a Render Dashboard → Database → Internal Database URL

---

### 2. CORS_ORIGINS
```
KEY: CORS_ORIGINS
VALUE: https://do-calink.vercel.app
```
**⚠️ Importante:** Sin el trailing slash `/` al final

---

### 3. FRONTEND_URL
```
KEY: FRONTEND_URL
VALUE: https://do-calink.vercel.app
```

---

### 4. FILE_BASE_URL
```
KEY: FILE_BASE_URL
VALUE: https://doca-link-backend.onrender.com
```

---

## ⚙️ Variables Recomendadas

### 5. NODE_ENV
```
KEY: NODE_ENV
VALUE: production
```

---

### 6. STAGE
```
KEY: STAGE
VALUE: prod
```

---

## 🔐 Variables Opcionales (Solo si las usas)

### 7. GMAIL_REDIRECT_URI (Solo si usas Gmail API)
```
KEY: GMAIL_REDIRECT_URI
VALUE: https://doca-link-backend.onrender.com/api/gmail/callback
```

---

### 8. AWS_REGION (Solo si usas AWS Cognito)
```
KEY: AWS_REGION
VALUE: us-east-1
```

---

### 9. COGNITO_USER_POOL_ID (Solo si usas AWS Cognito)
```
KEY: COGNITO_USER_POOL_ID
VALUE: (Tu User Pool ID de AWS Cognito)
```

---

### 10. COGNITO_USER_POOL_CLIENT_ID (Solo si usas AWS Cognito)
```
KEY: COGNITO_USER_POOL_CLIENT_ID
VALUE: (Tu Client ID de AWS Cognito)
```

---

## 📝 Resumen Rápido

Copia y pega estas en Render (las más importantes):

```
CORS_ORIGINS = https://do-calink.vercel.app
FRONTEND_URL = https://do-calink.vercel.app
FILE_BASE_URL = https://doca-link-backend.onrender.com
NODE_ENV = production
STAGE = prod
```

**Nota:** `DATABASE_URL` ya debería estar configurada. Si no, agrégalas también.

---

## ✅ Checklist

Después de configurar, verifica que tengas:

- [ ] `DATABASE_URL` configurada
- [ ] `CORS_ORIGINS` = `https://do-calink.vercel.app` (sin `/` al final)
- [ ] `FRONTEND_URL` = `https://do-calink.vercel.app`
- [ ] `FILE_BASE_URL` = `https://doca-link-backend.onrender.com`
- [ ] `NODE_ENV` = `production`
- [ ] `STAGE` = `prod`

---

## 🚨 Errores Comunes

### ❌ Error: CORS_ORIGINS con trailing slash
```
❌ INCORRECTO: https://do-calink.vercel.app/
✅ CORRECTO: https://do-calink.vercel.app
```

### ❌ Error: Espacios extra
```
❌ INCORRECTO: https://do-calink.vercel.app (con espacios)
✅ CORRECTO: https://do-calink.vercel.app
```

---

## 🔗 URLs de Referencia

- **Backend:** `https://doca-link-backend.onrender.com`
- **Frontend:** `https://do-calink.vercel.app`
- **API Base:** `https://doca-link-backend.onrender.com/api`
