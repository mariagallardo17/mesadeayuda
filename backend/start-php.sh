#!/bin/bash

# Start PHP backend server
# This script starts the PHP built-in server for development

PORT=${PORT:-3000}

echo "🚀 Iniciando servidor PHP en puerto $PORT"
echo "🌐 Servidor accesible en http://localhost:$PORT"
echo "📍 API disponible en http://localhost:$PORT/api"
echo ""
echo "Presiona Ctrl+C para detener el servidor"
echo ""

php -S 0.0.0.0:$PORT index.php
