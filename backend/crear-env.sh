#!/bin/bash
# Script para crear archivo .env desde env.example
# Ejecutar: chmod +x crear-env.sh && ./crear-env.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
ENV_EXAMPLE="$SCRIPT_DIR/env.example"

echo "🔧 Creando archivo .env..."

if [ -f "$ENV_FILE" ]; then
    echo "⚠️  El archivo .env ya existe."
    read -p "¿Deseas sobrescribirlo? (S/N): " overwrite
    if [ "$overwrite" != "S" ] && [ "$overwrite" != "s" ]; then
        echo "❌ Operación cancelada."
        exit
    fi
fi

if [ ! -f "$ENV_EXAMPLE" ]; then
    echo "❌ Error: No se encontró env.example"
    exit 1
fi

cp "$ENV_EXAMPLE" "$ENV_FILE"
echo "✅ Archivo .env creado exitosamente desde env.example"
echo ""
echo "📝 PRÓXIMOS PASOS:"
echo "1. Edita el archivo .env con tu editor favorito"
echo "2. Configura SENDGRID_API_KEY con tu API Key de SendGrid"
echo "3. O configura SMTP_HOST, SMTP_USER, SMTP_PASS para usar SMTP"
echo ""
echo "Ubicación del archivo: $ENV_FILE"
