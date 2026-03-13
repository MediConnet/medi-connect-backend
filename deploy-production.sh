#!/bin/bash

# Script de Despliegue a Producción
# Despliega los endpoints de admin settings

echo "🚀 Iniciando despliegue a producción..."
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: No se encontró package.json"
    echo "   Ejecuta este script desde la raíz del proyecto"
    exit 1
fi

# Paso 1: Verificar pre-requisitos
echo "📋 Paso 1: Verificando pre-requisitos..."
node scripts/pre-deploy-check.js
if [ $? -ne 0 ]; then
    echo "❌ Verificación fallida. Corrige los errores antes de continuar."
    exit 1
fi
echo ""

# Paso 2: Build
echo "🔨 Paso 2: Compilando código..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build falló"
    exit 1
fi
echo "✅ Build exitoso"
echo ""

# Paso 3: Aplicar migración en producción
echo "🗄️  Paso 3: Aplicando migración en producción..."
echo "⚠️  IMPORTANTE: Asegúrate de que DATABASE_URL apunte a producción"
read -p "¿DATABASE_URL apunta a producción? (y/n): " confirm
if [ "$confirm" != "y" ]; then
    echo "❌ Despliegue cancelado"
    exit 1
fi

npx prisma db push
if [ $? -ne 0 ]; then
    echo "❌ Migración falló"
    exit 1
fi
echo "✅ Migración aplicada"
echo ""

# Paso 4: Desplegar a AWS Lambda
echo "☁️  Paso 4: Desplegando a AWS Lambda..."
serverless deploy --stage prod
if [ $? -ne 0 ]; then
    echo "❌ Despliegue falló"
    exit 1
fi
echo "✅ Despliegue exitoso"
echo ""

# Paso 5: Verificación
echo "🧪 Paso 5: Verificando endpoints..."
echo "Por favor, prueba manualmente:"
echo ""
echo "curl -X GET https://api.docalink.com/api/admin/settings \\"
echo "  -H \"Authorization: Bearer {ADMIN_TOKEN}\""
echo ""
echo "✅ Despliegue completado exitosamente!"
echo ""
echo "📊 Próximos pasos:"
echo "1. Probar los endpoints con curl"
echo "2. Verificar desde el frontend en https://www.docalink.com"
echo "3. Monitorear logs en CloudWatch"
