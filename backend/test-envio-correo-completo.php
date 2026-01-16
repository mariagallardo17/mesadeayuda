<?php
/**
 * Script completo para probar el envío de correo con normalización
 * Accede desde: https://atiendeti.com/api/test-envio-correo-completo.php?email=correo@ejemplo.com
 */

require_once __DIR__ . '/vendor/autoload.php';

use App\Services\EmailService;
use App\Config\Database;

// Cargar variables de entorno
$envPaths = [
    __DIR__,
    __DIR__ . '/api',
    dirname(__DIR__) . '/api',
];

$envLoaded = false;
foreach ($envPaths as $envPath) {
    $envFile = $envPath . '/.env';
    if (file_exists($envFile)) {
        $dotenv = Dotenv\Dotenv::createImmutable($envPath);
        $dotenv->safeLoad();
        $envLoaded = true;
        break;
    }
}

if (!$envLoaded) {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
    $dotenv->safeLoad();
}

header('Content-Type: text/html; charset=UTF-8');

$cleanEnv = function($key, $default = '') {
    $value = $_ENV[$key] ?? $default;
    if (is_string($value) && strlen($value) > 0) {
        if (($value[0] === '"' && substr($value, -1) === '"') || ($value[0] === "'" && substr($value, -1) === "'")) {
            $value = substr($value, 1, -1);
        }
    }
    return trim($value);
};

$sendGridApiKey = $cleanEnv('SENDGRID_API_KEY', '');
$toEmail = $_GET['email'] ?? '';

if (empty($toEmail)) {
    echo '<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Prueba Completa de Correo</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #1976D2; border-bottom: 3px solid #1976D2; padding-bottom: 10px; }
        .form-group { margin: 20px 0; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input { width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 5px; font-size: 16px; }
        .btn { background: #1976D2; color: white; padding: 12px 24px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; width: 100%; }
        .btn:hover { background: #1565C0; }
        .info { background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📧 Prueba Completa de Envío de Correo</h1>
        <div class="info">
            <strong>Este script prueba el envío usando EmailService con normalización completa</strong>
        </div>
        <form method="GET">
            <div class="form-group">
                <label for="email">Correo destinatario:</label>
                <input type="email" id="email" name="email" required placeholder="correo@ejemplo.com" value="cj106558@gmail.com">
            </div>
            <button type="submit" class="btn">Enviar Correo de Prueba</button>
        </form>
    </div>
</body>
</html>';
    exit;
}

// Normalizar correo
$toEmailNormalized = trim(strtolower($toEmail));

echo '<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Resultado de Prueba</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #1976D2; }
        .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .info { background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; padding: 15px; border-radius: 5px; margin: 20px 0; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📧 Resultado de Prueba de Correo</h1>';

echo '<div class="info">';
echo '<strong>Correo original:</strong> ' . htmlspecialchars($toEmail) . '<br>';
echo '<strong>Correo normalizado:</strong> ' . htmlspecialchars($toEmailNormalized) . '<br>';
echo '</div>';

try {
    $emailService = new EmailService();
    
    $subject = "Prueba de correo - Sistema completo";
    $htmlBody = <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Prueba de Correo</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f8f9fa; margin:0; padding:0;">
    <div style="max-width: 600px; margin: 30px auto; background: #fff; border-radius: 15px; box-shadow: 0 2px 8px #e0e0e0; padding: 30px;">
        <h2 style="text-align: center; color: #4CAF50; margin-bottom: 10px;">✅ Prueba de Correo Exitosa</h2>
        <hr style="border:none; border-top:2px solid #4CAF50; margin-bottom: 30px;">
        <p>Este es un correo de prueba desde el sistema de Mesa de Ayuda.</p>
        <p>Si recibes este correo, significa que el sistema está funcionando correctamente.</p>
        <p><strong>Fecha:</strong> ' . date('d/m/Y H:i:s') . '</p>
        <p><strong>Correo original:</strong> ' . htmlspecialchars($toEmail) . '</p>
        <p><strong>Correo normalizado:</strong> ' . htmlspecialchars($toEmailNormalized) . '</p>
        <hr style="border:none; border-top:2px solid #ececec; margin: 32px 0 15px 0;">
        <div style="font-size: 13px; color:#777; text-align: center;">Mesa de Ayuda - ITS<br>No responder a este correo.</div>
    </div>
</body>
</html>
HTML;

    echo '<p>📤 Intentando enviar correo usando EmailService...</p>';
    
    $result = $emailService->sendEmail($toEmailNormalized, $subject, $htmlBody);
    
    if ($result) {
        echo '<div class="success">';
        echo '<strong>✅ Correo Enviado Exitosamente</strong><br>';
        echo 'El correo fue enviado a: <strong>' . htmlspecialchars($toEmailNormalized) . '</strong><br><br>';
        echo '<strong>📋 Próximos pasos:</strong><br>';
        echo '1. Revisa tu bandeja de entrada<br>';
        echo '2. Revisa la carpeta de spam/correo no deseado<br>';
        echo '3. Espera 2-5 minutos (puede haber delay)<br>';
        echo '4. Revisa <a href="https://app.sendgrid.com/activity" target="_blank">SendGrid Activity</a> para ver el estado de entrega';
        echo '</div>';
    } else {
        echo '<div class="error">';
        echo '<strong>❌ Error al enviar correo</strong><br>';
        echo 'Revisa los logs del servidor para más detalles.';
        echo '</div>';
    }
    
} catch (\Exception $e) {
    echo '<div class="error">';
    echo '<strong>❌ Error:</strong><br>';
    echo htmlspecialchars($e->getMessage());
    echo '</div>';
    
    echo '<div class="info">';
    echo '<strong>🔍 Información de Debug:</strong><br>';
    echo '<pre>' . htmlspecialchars($e->getTraceAsString()) . '</pre>';
    echo '</div>';
}

echo '</div></body></html>';
?>

