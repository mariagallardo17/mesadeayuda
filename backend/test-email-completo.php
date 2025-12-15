<?php
/**
 * Script completo de prueba de correo usando EmailService
 * Ejecutar: php test-email-completo.php
 */

require_once __DIR__ . '/vendor/autoload.php';

use App\Services\EmailService;

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
    echo "❌ No se encontró archivo .env\n";
    echo "Buscado en:\n";
    foreach ($envPaths as $path) {
        echo "  - $path/.env\n";
    }
    exit(1);
}

echo "=== PRUEBA COMPLETA DE CORREO ===\n\n";

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

// Mostrar configuración
$smtpUser = $cleanEnv('SMTP_USER', '');
echo "📋 Configuración:\n";
echo "   SMTP_HOST: " . $cleanEnv('SMTP_HOST', 'smtp.gmail.com') . "\n";
echo "   SMTP_PORT: " . $cleanEnv('SMTP_PORT', '587') . "\n";
echo "   SMTP_USER: $smtpUser\n";
echo "   SMTP_PASS: " . (empty($cleanEnv('SMTP_PASS', '')) ? '❌ VACÍO' : '✅ Configurado') . "\n";
echo "   SMTP_FROM: " . ($cleanEnv('SMTP_FROM', '') ?: 'No configurado') . "\n\n";

// Validar que las credenciales estén configuradas
if (empty($smtpUser) || empty($cleanEnv('SMTP_PASS', ''))) {
    echo "❌ ERROR: SMTP_USER o SMTP_PASS no están configurados\n";
    exit(1);
}

// Crear instancia de EmailService
echo "🔧 Creando instancia de EmailService...\n";
try {
    $emailService = new EmailService();
    echo "✅ EmailService creado correctamente\n\n";
} catch (\Exception $e) {
    echo "❌ Error al crear EmailService: " . $e->getMessage() . "\n";
    exit(1);
}

// Preparar correo de prueba
$testEmail = $smtpUser; // Enviar a sí mismo para prueba
$subject = 'Prueba de correo - Mesa de Ayuda';
$htmlBody = '
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Prueba de Correo</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f8f9fa; margin:0; padding:0;">
    <div style="max-width: 600px; margin: 30px auto; background: #fff; border-radius: 15px; box-shadow: 0 2px 8px #e0e0e0; padding: 30px;">
        <h2 style="text-align: center; color: #1976D2; margin-bottom: 10px;">✅ Prueba de Correo Exitosa</h2>
        <hr style="border:none; border-top:2px solid #1976D2; margin-bottom: 30px;">
        <p>Hola,</p>
        <p>Si recibes este correo, significa que la configuración SMTP está funcionando correctamente.</p>
        <div style="background: #e3f2fd; border-left: 6px solid #1976D2; padding: 20px; margin: 25px 0;">
            <p><strong>Fecha:</strong> ' . date('d/m/Y H:i:s') . '</p>
            <p><strong>Servidor:</strong> ' . ($_SERVER['SERVER_NAME'] ?? 'N/A') . '</p>
            <p><strong>Estado:</strong> ✅ Sistema de correo funcionando</p>
        </div>
        <p>El sistema de correo de Mesa de Ayuda está configurado y funcionando correctamente.</p>
        <hr style="border:none; border-top:2px solid #ececec; margin: 32px 0 15px 0;">
        <div style="font-size: 13px; color:#777; text-align: center;">Mesa de Ayuda - ITS<br>No responder a este correo.</div>
    </div>
</body>
</html>
';

// Intentar enviar el correo
echo "📤 Intentando enviar correo de prueba a: $testEmail\n";
echo "📤 Asunto: $subject\n";
echo "📤 Conectando al servidor SMTP...\n\n";

try {
    $result = $emailService->sendEmail($testEmail, $subject, $htmlBody);

    if ($result) {
        echo "\n";
        echo "═══════════════════════════════════════════════════════════\n";
        echo "✅ ¡ÉXITO! El correo se envió correctamente.\n";
        echo "═══════════════════════════════════════════════════════════\n";
        echo "\n";
        echo "📧 Revisa tu bandeja de entrada en: $testEmail\n";
        echo "📧 También revisa la carpeta de spam si no lo encuentras.\n";
        echo "\n";
        echo "💡 El sistema de correo está funcionando correctamente.\n";
        echo "   Ahora puedes usar el EmailService en tu aplicación.\n";
        exit(0);
    } else {
        echo "\n❌ ERROR: No se pudo enviar el correo (sendEmail devolvió false)\n";
        exit(1);
    }

} catch (\Exception $e) {
    echo "\n";
    echo "═══════════════════════════════════════════════════════════\n";
    echo "❌ ERROR AL ENVIAR CORREO\n";
    echo "═══════════════════════════════════════════════════════════\n";
    echo "\n";
    echo "Mensaje: " . $e->getMessage() . "\n";
    echo "\n";
    echo "💡 Posibles soluciones:\n";
    echo "   1. Verifica que SMTP_USER y SMTP_PASS sean correctos\n";
    echo "   2. Si usas Gmail, asegúrate de usar una contraseña de aplicación\n";
    echo "      Genera una en: https://myaccount.google.com/apppasswords\n";
    echo "   3. Verifica que el servidor SMTP esté accesible desde tu hosting\n";
    echo "   4. Revisa los logs en: " . __DIR__ . "/error.log\n";
    echo "   5. Asegúrate de que SMTP_FROM use el mismo correo que SMTP_USER\n";
    echo "\n";
    exit(1);
}


