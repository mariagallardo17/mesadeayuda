<?php
/**
 * Script para verificar el estado de SendGrid y el remitente
 * Accede desde: https://atiendeti.com/api/verificar-sendgrid.php
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
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verificación SendGrid</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 900px;
            margin: 20px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #1976D2; border-bottom: 3px solid #1976D2; padding-bottom: 10px; }
        h2 { color: #333; margin-top: 30px; }
        .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .warning { background: #fff3cd; border: 1px solid #ffc107; color: #856404; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .info { background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; padding: 15px; border-radius: 5px; margin: 15px 0; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; }
        .btn { background: #1976D2; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; text-decoration: none; display: inline-block; margin: 5px; }
        .btn:hover { background: #1565C0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 Verificación de SendGrid</h1>

        <?php
        if (empty($sendGridApiKey)) {
            echo '<div class="error">';
            echo '<strong>❌ SENDGRID_API_KEY no está configurado</strong>';
            echo '</div>';
            exit;
        }

        echo '<div class="info">';
        echo '<strong>📋 Configuración Actual:</strong><br>';
        echo 'Remitente: <strong>' . htmlspecialchars($fromEmail) . '</strong><br>';
        echo 'Nombre: <strong>' . htmlspecialchars($fromName) . '</strong><br>';
        echo 'API Key: <strong>' . substr($sendGridApiKey, 0, 10) . '...</strong>';
        echo '</div>';

        // Verificar remitente verificado en SendGrid
        echo '<h2>📧 Verificación del Remitente</h2>';
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://api.sendgrid.com/v3/verified_senders');
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $sendGridApiKey,
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200) {
            $verifiedSenders = json_decode($response, true);
            $isVerified = false;
            
            if (isset($verifiedSenders['results']) && is_array($verifiedSenders['results'])) {
                foreach ($verifiedSenders['results'] as $sender) {
                    if (isset($sender['from']['email']) && strtolower($sender['from']['email']) === strtolower($fromEmail)) {
                        $isVerified = true;
                        $verificationStatus = $sender['verified'] ?? ['status' => 'unknown'];
                        break;
                    }
                }
            }
            
            if ($isVerified) {
                echo '<div class="success">';
                echo '<strong>✅ Remitente Verificado</strong><br>';
                echo 'El correo <strong>' . htmlspecialchars($fromEmail) . '</strong> está verificado en SendGrid.';
                echo '</div>';
            } else {
                echo '<div class="warning">';
                echo '<strong>⚠️ Remitente NO Verificado</strong><br>';
                echo 'El correo <strong>' . htmlspecialchars($fromEmail) . '</strong> NO está verificado en SendGrid.<br><br>';
                echo '<strong>🔧 Solución:</strong><br>';
                echo '1. Ve a <a href="https://app.sendgrid.com/settings/sender_auth/senders/new" target="_blank">SendGrid - Single Sender Verification</a><br>';
                echo '2. Agrega y verifica el correo: <strong>' . htmlspecialchars($fromEmail) . '</strong><br>';
                echo '3. Revisa tu correo y confirma la verificación<br>';
                echo '4. Una vez verificado, los correos deberían llegar correctamente';
                echo '</div>';
            }
        } else {
            echo '<div class="warning">';
            echo '<strong>⚠️ No se pudo verificar el estado del remitente</strong><br>';
            echo 'HTTP Code: ' . $httpCode . '<br>';
            echo 'Esto puede ser normal si no tienes permisos para consultar esta API.';
            echo '</div>';
        }

        // Información adicional
        echo '<h2>💡 Información Importante</h2>';
        echo '<div class="info">';
        echo '<strong>¿Por qué SendGrid acepta el correo (HTTP 202) pero no llega?</strong><br><br>';
        echo '<strong>1. Remitente no verificado:</strong> SendGrid acepta el correo pero puede no entregarlo si el remitente no está verificado.<br><br>';
        echo '<strong>2. Correo en spam:</strong> Revisa la carpeta de correo no deseado (spam).<br><br>';
        echo '<strong>3. Delay en entrega:</strong> Puede tardar unos minutos en llegar.<br><br>';
        echo '<strong>4. Verificar en SendGrid Activity:</strong> Ve a <a href="https://app.sendgrid.com/activity" target="_blank">SendGrid Activity</a> para ver el estado de entrega de los correos.';
        echo '</div>';

        echo '<h2>🔗 Enlaces Útiles</h2>';
        echo '<a href="https://app.sendgrid.com/settings/sender_auth/senders/new" target="_blank" class="btn">Verificar Remitente en SendGrid</a>';
        echo '<a href="https://app.sendgrid.com/activity" target="_blank" class="btn">Ver Activity de SendGrid</a>';
        echo '<a href="test-sendgrid-directo.php" class="btn">Probar Envío de Correo</a>';
        ?>
    </div>
</body>
</html>

