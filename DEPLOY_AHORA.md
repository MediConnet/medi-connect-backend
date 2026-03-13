# 🚀 Desplegar AHORA a Producción

## ⚡ Comandos Rápidos

### Paso 1: Aplicar Migración en Producción
```bash
# IMPORTANTE: Verifica que DATABASE_URL apunte a producción
npx prisma db push
```

### Paso 2: Desplegar Backend
```bash
# Si usas Serverless Framework
serverless deploy --stage prod

# O si tienes un script personalizado
npm run deploy:prod
```

### Paso 3: Verificar
```bash
# Probar endpoint (reemplaza {ADMIN_TOKEN})
curl -X GET https://api.docalink.com/api/admin/settings \
  -H "Authorization: Bearer {ADMIN_TOKEN}"
```

---

## ✅ Resultado Esperado

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

## 🎯 Después del Despliegue

1. Ir a https://www.docalink.com
2. Login como admin
3. Probar "Configuración de Comisiones"
4. Guardar cambios
5. Refrescar y verificar persistencia

---

**¿Listo?** Ejecuta los comandos arriba ☝️
