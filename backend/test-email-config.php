<?php
/**
 * Script para verificar la configuración de correo
 * Ejecutar: php test-email-config.php
 */

require_once __DIR__ . '/vendor/autoload.php';

// Cargar variables de entorno
$envPaths = [
    __DIR__,  // backend/
    __DIR__ . '/api',  // backend/api/
    dirname(__DIR__) . '/api',  // api/ (si está al mismo nivel que backend)
];

$envLoaded = false;
foreach ($envPaths as $envPath) {
    $envFile = $envPath . '/.env';
    if (file_exists($envFile)) {
        $dotenv = Dotenv\Dotenv::createImmutable($envPath);
        $dotenv->safeLoad();
        echo "✅ Archivo .env cargado desde: $envPath\n\n";
        $envLoaded = true;
        break;
    }
}

if (!$envLoaded) {
    echo "⚠️  No se encontró archivo .env\n";
    echo "Buscado en:\n";
    foreach ($envPaths as $path) {
        echo "  - $path/.env\n";
    }
    exit(1);
}

// Helper para limpiar variables de entorno
$cleanEnv = function($key, $default = '') {
    $value = $_ENV[$key] ?? $default;
    if (is_string($value) && strlen($value) > 0) {
        if (($value[0] === '"' && substr($value, -1) === '"') || ($value[0] === "'" && substr($value, -1) === "'")) {
            $value = substr($value, 1, -1);
        }
    }
    return trim($value);
};

echo "=== CONFIGURACIÓN SMTP ===\n\n";

$smtpHost = $cleanEnv('SMTP_HOST', 'smtp.gmail.com');
$smtpPort = (int)$cleanEnv('SMTP_PORT', '587');
$smtpUser = $cleanEnv('SMTP_USER', '');
$smtpPass = $cleanEnv('SMTP_PASS', '');
$smtpFrom = $cleanEnv('SMTP_FROM', '');

echo "SMTP_HOST: $smtpHost\n";
echo "SMTP_PORT: $smtpPort\n";
echo "SMTP_USER: $smtpUser\n";
echo "SMTP_PASS: " . (empty($smtpPass) ? '❌ VACÍO' : '✅ Configurado (' . substr($smtpPass, 0, 4) . '...)') . "\n";
echo "SMTP_FROM: " . ($smtpFrom ?: 'No configurado') . "\n\n";

// Validaciones
$errors = [];

if (empty($smtpUser)) {
    $errors[] = "❌ SMTP_USER está vacío";
}

if (empty($smtpPass)) {
    $errors[] = "❌ SMTP_PASS está vacío";
}

if (!empty($smtpFrom)) {
    // Extraer email del formato "Nombre <email@domain.com>"
    $fromEmail = $smtpFrom;
    if (preg_match('/^(.+?)\s*<(.+?)>$/', $smtpFrom, $matches)) {
        $fromEmail = trim($matches[2]);
    }

    if (!empty($smtpUser) && strtolower($fromEmail) !== strtolower($smtpUser)) {
        $errors[] = "⚠️  ADVERTENCIA: SMTP_FROM ($fromEmail) no coincide con SMTP_USER ($smtpUser)";
        $errors[] = "   Gmail puede rechazar correos si el remitente no coincide con la cuenta autenticada.";
        $errors[] = "   Se usará SMTP_USER como remitente automáticamente.";
    }
}

if (empty($errors)) {
    echo "✅ Configuración válida\n\n";

    // Probar crear instancia de EmailService
    echo "=== PROBANDO EmailService ===\n\n";
    try {
        $emailService = new App\Services\EmailService();
        echo "✅ EmailService creado correctamente\n";
        echo "\n💡 Para probar el envío de correo, ejecuta: php test-smtp.php\n";
    } catch (\Exception $e) {
        echo "❌ Error al crear EmailService: " . $e->getMessage() . "\n";
        exit(1);
    }
} else {
    echo "=== ERRORES ENCONTRADOS ===\n\n";
    foreach ($errors as $error) {
        echo "$error\n";
    }
    echo "\n";
    exit(1);
}


