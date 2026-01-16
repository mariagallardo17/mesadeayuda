# Script para subir cambios a Git
Write-Host "🚀 Subiendo cambios a Git..." -ForegroundColor Cyan

# Commit
Write-Host "📝 Haciendo commit..." -ForegroundColor Yellow
git commit -m "Corregir sistema de notificaciones y configurar SMTP para correos"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Commit realizado exitosamente" -ForegroundColor Green
} else {
    Write-Host "❌ Error en commit" -ForegroundColor Red
    exit 1
}

# Push
Write-Host "📤 Subiendo a GitHub..." -ForegroundColor Yellow
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Cambios subidos exitosamente a GitHub!" -ForegroundColor Green
} else {
    Write-Host "❌ Error al subir cambios" -ForegroundColor Red
    Write-Host "Verifica tus credenciales de GitHub" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "✅ ¡Listo! Todos los cambios están en GitHub" -ForegroundColor Green
