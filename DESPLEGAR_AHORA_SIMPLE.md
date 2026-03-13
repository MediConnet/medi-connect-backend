# 🚀 Desplegar Endpoints de Comisiones AHORA

## ⚡ Opción 1: Script Automático (Recomendado)

### Windows (PowerShell):
```powershell
.\deploy-production.ps1
```

### Linux/Mac (Bash):
```bash
chmod +x deploy-production.sh
./deploy-production.sh
```

---

## ⚡ Opción 2: Comandos Manuales

### Paso 1: Verificar
```bash
node scripts/pre-deploy-check.js
```

### Paso 2: Build
```bash
npm run build
```

### Paso 3: Migración en Producción
```bash
# ⚠️ IMPORTANTE: Verifica que DATABASE_URL apunte a producción
npx prisma db push
```

### Paso 4: Desplegar
```bash
serverless deploy --stage prod
```

### Paso 5: Probar
```bash
# Reemplaza {ADMIN_TOKEN} con un token válido
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
    "commissionLaboratory": 12,
    "commissionPharmacy": 8,
    "commissionSupplies": 10,
    "commissionAmbulance": 15,
    ...
  }
}
```

---

## ⏰ Tiempo Total: ~10 minutos

1. Verificación: 10 segundos
2. Build: 1 minuto
3. Migración: 30 segundos
4. Deploy: 5 minutos
5. Prueba: 30 segundos

---

## 🎯 Después del Despliegue

1. Ir a https://www.docalink.com
2. Login como admin
3. Ir a "Configuración de Comisiones"
4. Cambiar un valor
5. Guardar
6. Refrescar (F5)
7. ✅ Verificar que el valor persiste

---

**¿Listo?** Ejecuta el script o los comandos arriba ☝️
