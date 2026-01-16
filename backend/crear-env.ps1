# Script para crear archivo .env desde env.example
# Ejecutar: .\crear-env.ps1

$envPath = Join-Path $PSScriptRoot ".env"
$envExamplePath = Join-Path $PSScriptRoot "env.example"

Write-Host "🔧 Creando archivo .env..." -ForegroundColor Cyan

if (Test-Path $envPath) {
    Write-Host "⚠️  El archivo .env ya existe." -ForegroundColor Yellow
    $overwrite = Read-Host "¿Deseas sobrescribirlo? (S/N)"
    if ($overwrite -ne "S" -and $overwrite -ne "s") {
        Write-Host "❌ Operación cancelada." -ForegroundColor Red
        exit
    }
}

if (-not (Test-Path $envExamplePath)) {
    Write-Host "❌ Error: No se encontró env.example" -ForegroundColor Red
    exit 1
}

try {
    Copy-Item $envExamplePath $envPath -Force
    Write-Host "✅ Archivo .env creado exitosamente desde env.example" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 PRÓXIMOS PASOS:" -ForegroundColor Yellow
    Write-Host "1. Edita el archivo .env con tu editor favorito" -ForegroundColor White
    Write-Host "2. Configura SENDGRID_API_KEY con tu API Key de SendGrid" -ForegroundColor White
    Write-Host "3. O configura SMTP_HOST, SMTP_USER, SMTP_PASS para usar SMTP" -ForegroundColor White
    Write-Host ""
    Write-Host "Ubicación del archivo: $envPath" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Error creando .env: $_" -ForegroundColor Red
    exit 1
}
