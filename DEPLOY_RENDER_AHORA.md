# 🚀 Desplegar a Render (Producción)

## ✅ Situación

El backend está en **Render**, no en AWS Lambda. El despliegue es automático con Git.

---

## 📋 Pasos para Desplegar

### 1. Commit de los Cambios
```bash
git add .
git commit -m "feat: Add admin settings endpoints for commissions management"
```

### 2. Push a la Rama de Producción
```bash
# Si tu rama de producción es 'main'
git push origin main

# O si es 'master'
git push origin master
```

### 3. Render Desplegará Automáticamente
- Render detectará el push
- Ejecutará el build automáticamente
- Desplegará la nueva versión
- Tiempo estimado: 3-5 minutos

---

## 🔍 Verificar el Despliegue en Render

1. Ve a tu dashboard de Render: https://dashboard.render.com
2. Busca tu servicio de backend
3. Ve a la pestaña "Events" o "Logs"
4. Verás el despliegue en progreso

**Logs esperados:**
```
==> Building...
==> Installing dependencies...
==> Running build command...
==> Deploying...
==> Deploy successful!
```

---

## ✅ Verificar que Funcionó

Una vez que Render termine el despliegue (3-5 minutos):

```bash
# Probar GET (reemplaza {ADMIN_TOKEN} con un token válido)
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

---

## 📊 Verificar desde el Frontend

1. Ir a https://www.docalink.com
2. Login como admin
3. Ir a "Configuración de Comisiones"
4. Cambiar un valor
5. Guardar
6. Refrescar (F5)
7. ✅ Verificar que el valor persiste

---

## ⏰ Timeline

- Commit y push: 30 segundos
- Render build y deploy: 3-5 minutos
- Verificación: 1 minuto

**Total: ~5-7 minutos**

---

## 🎯 Comandos Rápidos

```bash
# Todo en uno
git add . && git commit -m "feat: Add admin settings endpoints" && git push origin main
```

Luego espera 5 minutos y prueba los endpoints.

---

**¿Listo?** Ejecuta el commit y push arriba ☝️
