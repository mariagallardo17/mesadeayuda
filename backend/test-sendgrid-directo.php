<?php
/**
 * Script de prueba directo para SendGrid
 * Accede directamente a: https://tu-dominio.com/api/test-sendgrid-directo.php?email=tu@email.com
 */

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
        require_once __DIR__ . '/vendor/autoload.php';
        $dotenv = Dotenv\Dotenv::createImmutable($envPath);
        $dotenv->safeLoad();
        $envLoaded = true;
        break;
    }
}

if (!$envLoaded) {
    require_once __DIR__ . '/vendor/autoload.php';
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
$smtpFrom = $cleanEnv('SMTP_FROM', '');
$smtpUser = $cleanEnv('SMTP_USER', '');

// Obtener email de destino desde parámetro GET
$toEmail = $_GET['email'] ?? '';

if (empty($toEmail)) {
    echo '<h1>🔍 Prueba de SendGrid</h1>';
    echo '<p>Usa este script para probar SendGrid directamente.</p>';
    echo '<p><strong>Uso:</strong> <code>?email=tu@email.com</code></p>';
    echo '<hr>';
    echo '<h2>📋 Configuración Actual</h2>';
    echo '<pre>';
    echo 'SENDGRID_API_KEY: ' . (empty($sendGridApiKey) ? '❌ NO CONFIGURADO' : '✅ Configurado (' . substr($sendGridApiKey, 0, 10) . '...)') . "\n";
    echo 'SMTP_FROM: ' . ($smtpFrom ?: 'No configurado') . "\n";
    echo 'SMTP_USER: ' . ($smtpUser ?: 'No configurado') . "\n";
    echo '</pre>';
    exit;
}

// Determinar remitente
$fromEmail = $smtpUser;
$fromName = 'Mesa de Ayuda - ITS';

if (!empty($smtpFrom)) {
    if (preg_match('/^(.+?)\s*<(.+?)>$/', $smtpFrom, $matches)) {
        $fromName = trim($matches[1]);
        $fromEmail = trim($matches[2]);
    } else {
        $fromEmail = $smtpFrom;
    }
}

if (empty($sendGridApiKey)) {
    echo '<h1>❌ Error</h1>';
    echo '<p><strong>SENDGRID_API_KEY no está configurado.</strong></p>';
    echo '<p>Configura esta variable en tu archivo .env</p>';
    exit;
}

if (!filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
    echo '<h1>❌ Error</h1>';
    echo '<p><strong>Email inválido:</strong> ' . htmlspecialchars($toEmail) . '</p>';
    exit;
}

echo '<h1>📤 Enviando correo de prueba...</h1>';
echo '<p><strong>Desde:</strong> ' . htmlspecialchars($fromEmail) . ' (' . htmlspecialchars($fromName) . ')</p>';
echo '<p><strong>Hacia:</strong> ' . htmlspecialchars($toEmail) . '</p>';
echo '<hr>';

// Preparar datos para SendGrid API
$subject = "Prueba de correo - Mesa de Ayuda";
$htmlBody = <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Prueba de Correo</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f8f9fa; margin:0; padding:0;">
    <div style="max-width: 600px; margin: 30px auto; background: #fff; border-radius: 15px; box-shadow: 0 2px 8px #e0e0e0; padding: 30px;">
        <h2 style="text-align: center; color: #1976D2; margin-bottom: 10px;">✅ Correo de Prueba</h2>
        <hr style="border:none; border-top:2px solid #1976D2; margin-bottom: 30px;">
        <p>Este es un correo de prueba desde el sistema de Mesa de Ayuda.</p>
        <p>Si recibes este correo, significa que SendGrid está funcionando correctamente.</p>
        <p><strong>Fecha:</strong> ' . date('d/m/Y H:i:s') . '</p>
        <hr style="border:none; border-top:2px solid #ececec; margin: 32px 0 15px 0;">
        <div style="font-size: 13px; color:#777; text-align: center;">Mesa de Ayuda - ITS<br>No responder a este correo.</div>
    </div>
</body>
</html>
HTML;

$data = [
    'personalizations' => [
        [
            'to' => [
                ['email' => $toEmail]
            ],
            'subject' => $subject
        ]
    ],
    'from' => [
        'email' => $fromEmail,
        'name' => $fromName
    ],
    'content' => [
        [
            'type' => 'text/html',
            'value' => $htmlBody
        ]
    ]
];

// Enviar a través de SendGrid API usando cURL
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://api.sendgrid.com/v3/mail/send');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $sendGridApiKey,
    'Content-Type: application/json'
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
$curlInfo = curl_getinfo($ch);
curl_close($ch);

echo '<h2>📊 Resultado de la Prueba</h2>';

if ($curlError) {
    echo '<div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 10px 0;">';
    echo '<h3 style="color: #721c24; margin-top: 0;">❌ Error de cURL</h3>';
    echo '<p><strong>Error:</strong> ' . htmlspecialchars($curlError) . '</p>';
    echo '</div>';
} else {
    if ($httpCode >= 200 && $httpCode < 300) {
        echo '<div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 10px 0;">';
        echo '<h3 style="color: #155724; margin-top: 0;">✅ Correo Enviado Exitosamente</h3>';
        echo '<p><strong>HTTP Code:</strong> ' . $httpCode . '</p>';
        echo '<p>El correo fue aceptado por SendGrid. Revisa tu bandeja de entrada (y spam) en unos minutos.</p>';
        echo '</div>';
    } else {
        echo '<div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 10px 0;">';
        echo '<h3 style="color: #721c24; margin-top: 0;">❌ Error de SendGrid</h3>';
        echo '<p><strong>HTTP Code:</strong> ' . $httpCode . '</p>';
        
        // Parsear respuesta de error
        $errorDetails = $response;
        try {
            $errorJson = json_decode($response, true);
            if (isset($errorJson['errors']) && is_array($errorJson['errors'])) {
                echo '<p><strong>Errores:</strong></p><ul>';
                foreach ($errorJson['errors'] as $error) {
                    echo '<li>' . htmlspecialchars($error['message'] ?? 'Error desconocido') . '</li>';
                    if (isset($error['field'])) {
                        echo ' (Campo: ' . htmlspecialchars($error['field']) . ')';
                    }
                }
                echo '</ul>';
            } else {
                echo '<p><strong>Respuesta:</strong> ' . htmlspecialchars(substr($response, 0, 500)) . '</p>';
            }
        } catch (\Exception $e) {
            echo '<p><strong>Respuesta:</strong> ' . htmlspecialchars(substr($response, 0, 500)) . '</p>';
        }
        echo '</div>';
    }
}

echo '<hr>';
echo '<h2>🔍 Información de Debug</h2>';
echo '<pre style="background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto;">';
echo 'HTTP Code: ' . $httpCode . "\n";
echo 'cURL Error: ' . ($curlError ?: 'Ninguno') . "\n";
echo 'Tiempo total: ' . ($curlInfo['total_time'] ?? 'N/A') . " segundos\n";
echo 'Remitente usado: ' . $fromEmail . "\n";
echo 'Nombre remitente: ' . $fromName . "\n";
echo '</pre>';

echo '<hr>';
echo '<p><a href="?">← Volver a la página de prueba</a></p>';
?>

