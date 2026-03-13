# 🚀 Instrucciones de Despliegue a Producción

## ⚠️ IMPORTANTE: Estamos en Producción

El frontend ya está en producción en `https://www.docalink.com` y necesita que el backend esté desplegado con los nuevos endpoints de comisiones.

---

## 📋 Cambios a Desplegar

### 1. Nuevos Archivos
- `src/admin/settings.controller.ts` - Controlador de settings
- `test/test-admin-settings.ts` - Tests

### 2. Archivos Modificados
- `src/admin/handler.ts` - Agregadas rutas de settings
- `prisma/schema.prisma` - Modelo admin_settings
- `serverless.yml` - Agregado adminHandler completo

### 3. Base de Datos
- Nueva tabla: `admin_settings`
- Migración aplicada con `prisma db push`

---

## 🔧 Pasos para Desplegar

### Paso 1: Verificar Build Local
```bash
npm run build
```
**Resultado esperado:** ✅ Sin errores

### Paso 2: Aplicar Migración en Producción
```bash
# Asegúrate de que DATABASE_URL apunte a producción
npx prisma db push
```

**Verificación:**
```sql
-- Conectarse a la BD de producción y verificar
SELECT * FROM admin_settings;
```

### Paso 3: Desplegar Backend a AWS Lambda

#### Opción A: Despliegue con Serverless Framework
```bash
# Si usas serverless framework
serverless deploy --stage prod
```

#### Opción B: Despliegue Manual
```bash
# 1. Build
npm run build

# 2. Empaquetar
npm run package

# 3. Subir a AWS (según tu proceso actual)
# Esto depende de cómo tengas configurado tu pipeline
```

#### Opción C: CI/CD Pipeline
Si tienes un pipeline configurado (GitHub Actions, GitLab CI, etc.):
```bash
# 1. Commit y push
git add .
git commit -m "feat: Add admin settings endpoints for commissions"
git push origin main

# 2. El pipeline debería desplegar automáticamente
```

---

## ✅ Verificación Post-Despliegue

### 1. Verificar que la tabla existe
```bash
# Conectarse a la BD de producción
psql $DATABASE_URL

# Ejecutar
SELECT * FROM admin_settings;
```

**Resultado esperado:**
- Si no existe registro: La tabla está vacía (se creará en el primer GET)
- Si existe: Verás 1 registro con id=1

### 2. Probar Endpoint GET
```bash
# Reemplaza {ADMIN_TOKEN} con un token válido de admin
curl -X GET https://api.docalink.com/api/admin/settings \
  -H "Authorization: Bearer {ADMIN_TOKEN}"
```

**Resultado esperado:**
```json
{
  "success": true,
  "data": {
    "commissionDoctor": 15,
    "commissionClinic": 10,
    ...
  }
}
```

### 3. Probar Endpoint PUT
```bash
curl -X PUT https://api.docalink.com/api/admin/settings \
  -H "Authorization: Bearer {ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "commissionDoctor": 20
  }'
```

**Resultado esperado:**
```json
{
  "success": true,
  "data": {
    "message": "Configuración actualizada correctamente",
    "commissionDoctor": 20,
    ...
  }
}
```

### 4. Verificar desde el Frontend
1. Ir a https://www.docalink.com
2. Iniciar sesión como admin
3. Ir a "Configuración de Comisiones"
4. Cambiar un valor
5. Guardar
6. Refrescar (F5)
7. Verificar que el valor persiste ✅

---

## 🔍 Troubleshooting

### Error: "Table admin_settings doesn't exist"
**Solución:**
```bash
# Aplicar migración en producción
npx prisma db push
```

### Error: "Not authorized" o 401
**Causa:** Token de admin inválido o expirado
**Solución:** Generar nuevo token de admin

### Error: "Function not found"
**Causa:** El adminHandler no está desplegado
**Solución:** Verificar que serverless.yml incluye adminHandler y redesplegar

### Error: CORS
**Causa:** El origen no está permitido
**Solución:** Verificar que `https://www.docalink.com` está en la lista de orígenes permitidos

---

## 📊 Monitoreo Post-Despliegue

### CloudWatch Logs
Buscar estos logs para verificar funcionamiento:
```
✅ [ADMIN] GET /api/admin/settings - Obteniendo configuración
⚙️ [GET_SETTINGS] Obteniendo configuración del sistema
✅ [GET_SETTINGS] Configuración obtenida exitosamente

✅ [ADMIN] PUT /api/admin/settings - Actualizando configuración
⚙️ [UPDATE_SETTINGS] Actualizando configuración del sistema
📝 [UPDATE_SETTINGS] Datos a actualizar: { ... }
✅ [UPDATE_SETTINGS] Configuración actualizada exitosamente
```

### Errores a Monitorear
```
❌ [GET_SETTINGS] Error al obtener configuración
❌ [UPDATE_SETTINGS] Error al actualizar configuración
❌ [ADMIN] Error de autenticación
```

---

## 🎯 Checklist de Despliegue

Antes de desplegar:
- [ ] Build local exitoso (`npm run build`)
- [ ] Tests pasando (opcional: `npx ts-node test/test-admin-settings.ts`)
- [ ] serverless.yml actualizado con adminHandler
- [ ] Commit realizado

Durante el despliegue:
- [ ] Migración aplicada en producción (`prisma db push`)
- [ ] Backend desplegado a AWS Lambda
- [ ] Logs de CloudWatch verificados

Después del despliegue:
- [ ] GET /api/admin/settings funciona
- [ ] PUT /api/admin/settings funciona
- [ ] Frontend puede guardar comisiones
- [ ] Valores persisten al refrescar
- [ ] No hay errores en CloudWatch

---

## 🚨 Rollback (Si algo sale mal)

Si necesitas revertir los cambios:

### 1. Revertir Código
```bash
git revert HEAD
git push origin main
```

### 2. Redesplegar Versión Anterior
```bash
serverless deploy --stage prod
```

### 3. Revertir Migración (Solo si es necesario)
```sql
-- Conectarse a la BD de producción
DROP TABLE IF EXISTS admin_settings;
```

---

## 📞 Contacto

Si tienes problemas durante el despliegue:
1. Revisa los logs de CloudWatch
2. Verifica que la tabla existe en la BD
3. Confirma que el adminHandler está desplegado
4. Prueba los endpoints con curl

---

## ✅ Resultado Esperado

Después del despliegue exitoso:
- ✅ Endpoints GET y PUT funcionando
- ✅ Tabla admin_settings en producción
- ✅ Frontend puede guardar comisiones
- ✅ Valores persisten correctamente
- ✅ Sin errores en CloudWatch

**Estado:** 🚀 LISTO PARA DESPLEGAR
