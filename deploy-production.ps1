# Script de Despliegue a Producción (PowerShell)
# Despliega los endpoints de admin settings

Write-Host "🚀 Iniciando despliegue a producción..." -ForegroundColor Green
Write-Host ""

# Verificar que estamos en el directorio correcto
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: No se encontró package.json" -ForegroundColor Red
    Write-Host "   Ejecuta este script desde la raíz del proyecto"
    exit 1
}

# Paso 1: Verificar pre-requisitos
Write-Host "📋 Paso 1: Verificando pre-requisitos..." -ForegroundColor Cyan
node scripts/pre-deploy-check.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Verificación fallida. Corrige los errores antes de continuar." -ForegroundColor Red
    exit 1
}
Write-Host ""

# Paso 2: Build
Write-Host "🔨 Paso 2: Compilando código..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build falló" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build exitoso" -ForegroundColor Green
Write-Host ""

# Paso 3: Aplicar migración en producción
Write-Host "🗄️  Paso 3: Aplicando migración en producción..." -ForegroundColor Cyan
Write-Host "⚠️  IMPORTANTE: Asegúrate de que DATABASE_URL apunte a producción" -ForegroundColor Yellow
$confirm = Read-Host "¿DATABASE_URL apunta a producción? (y/n)"
if ($confirm -ne "y") {
    Write-Host "❌ Despliegue cancelado" -ForegroundColor Red
    exit 1
}

npx prisma db push
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Migración falló" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Migración aplicada" -ForegroundColor Green
Write-Host ""

# Paso 4: Desplegar a AWS Lambda
Write-Host "☁️  Paso 4: Desplegando a AWS Lambda..." -ForegroundColor Cyan
serverless deploy --stage prod
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Despliegue falló" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Despliegue exitoso" -ForegroundColor Green
Write-Host ""

# Paso 5: Verificación
Write-Host "🧪 Paso 5: Verificando endpoints..." -ForegroundColor Cyan
Write-Host "Por favor, prueba manualmente:"
Write-Host ""
Write-Host 'curl -X GET https://api.docalink.com/api/admin/settings \' -ForegroundColor Yellow
Write-Host '  -H "Authorization: Bearer {ADMIN_TOKEN}"' -ForegroundColor Yellow
Write-Host ""
Write-Host "✅ Despliegue completado exitosamente!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Próximos pasos:" -ForegroundColor Cyan
Write-Host "1. Probar los endpoints con curl"
Write-Host "2. Verificar desde el frontend en https://www.docalink.com"
Write-Host "3. Monitorear logs en CloudWatch"
