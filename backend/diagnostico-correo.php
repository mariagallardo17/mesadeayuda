<?php
/**
 * Script de diagnóstico para verificar el envío de correos
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
        $envLoaded = true;
        break;
    }
}

if (!$envLoaded) {
    die('❌ Error: No se encontró archivo .env');
}

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Diagnóstico de Correo</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .info { background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .warning { background: #fff3cd; border: 1px solid #ffc107; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; }
        h1 { color: #1976D2; border-bottom: 3px solid #1976D2; padding-bottom: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 Diagnóstico de Correo</h1>

        <?php
        $cleanEnv = function($key, $default = '') {
            $value = $_ENV[$key] ?? $default;
            if (is_string($value) && strlen($value) > 0) {
                if (($value[0] === '"' && substr($value, -1) === '"') || ($value[0] === "'" && substr($value, -1) === "'")) {
                    $value = substr($value, 1, -1);
                }
            }
            return trim($value);
        };

        $sendGridKey = $cleanEnv('SENDGRID_API_KEY', '');
        $smtpFrom = $cleanEnv('SMTP_FROM', '');
        $smtpUser = $cleanEnv('SMTP_USER', '');

        echo '<h2>📋 Configuración Detectada</h2>';
        echo '<pre>';
        echo 'SENDGRID_API_KEY: ' . (empty($sendGridKey) ? '❌ NO CONFIGURADO' : '✅ Configurado (' . substr($sendGridKey, 0, 10) . '...)') . "\n";
        echo 'SMTP_FROM: ' . ($smtpFrom ?: 'No configurado') . "\n";
        echo 'SMTP_USER: ' . ($smtpUser ?: 'No configurado') . "\n";
        echo '</pre>';

        // Determinar remitente que se usará
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

        echo '<div class="info">';
        echo '<strong>📧 Remitente que se usará:</strong><br>';
        echo 'Email: <strong>' . htmlspecialchars($fromEmail) . '</strong><br>';
        echo 'Nombre: <strong>' . htmlspecialchars($fromName) . '</strong>';
        echo '</div>';

        if (empty($sendGridKey)) {
            echo '<div class="error">';
            echo '<strong>❌ Error:</strong> SENDGRID_API_KEY no está configurado en el .env';
            echo '</div>';
        } else {
            echo '<div class="success">';
            echo '<strong>✅ SendGrid está configurado</strong>';
            echo '</div>';

            // Probar envío de prueba
            if (isset($_POST['test'])) {
                $testEmail = trim($_POST['test_email'] ?? '');

                if (empty($testEmail) || !filter_var($testEmail, FILTER_VALIDATE_EMAIL)) {
                    echo '<div class="error">❌ Por favor, ingresa un correo válido</div>';
                } else {
                    echo '<hr>';
                    echo '<h2>📤 Enviando correo de prueba...</h2>';

                    try {
                        $emailService = new EmailService();

                        $subject = 'Prueba de diagnóstico - Mesa de Ayuda';
                        $htmlBody = '
                        <!DOCTYPE html>
                        <html>
                        <head><meta charset="UTF-8"></head>
                        <body style="font-family: Arial, sans-serif;">
                            <h2>✅ Correo de Prueba</h2>
                            <p>Este es un correo de prueba enviado desde el sistema de diagnóstico.</p>
                            <p><strong>Fecha:</strong> ' . date('d/m/Y H:i:s') . '</p>
                            <p><strong>Remitente:</strong> ' . htmlspecialchars($fromEmail) . '</p>
                            <p>Si recibes este correo, el sistema está funcionando correctamente.</p>
                        </body>
                        </html>
                        ';

                        echo '<p>📧 Enviando a: <strong>' . htmlspecialchars($testEmail) . '</strong></p>';
                        echo '<p>📧 Desde: <strong>' . htmlspecialchars($fromEmail) . '</strong></p>';
                        echo '<p>⏳ Por favor espera...</p>';

                        $result = $emailService->sendEmail($testEmail, $subject, $htmlBody);

                        if ($result) {
                            echo '<div class="success">';
                            echo '<strong>✅ Correo enviado exitosamente</strong><br><br>';
                            echo '📧 Revisa:<br>';
                            echo '1. <strong>Bandeja de entrada</strong> de: ' . htmlspecialchars($testEmail) . '<br>';
                            echo '2. <strong>Carpeta de spam/correo no deseado</strong><br>';
                            echo '3. Puede tardar 1-2 minutos en llegar<br><br>';
                            echo '<strong>💡 Consejos:</strong><br>';
                            echo '- Si no aparece, revisa la carpeta de spam<br>';
                            echo '- Verifica que el remitente esté verificado en SendGrid<br>';
                            echo '- Revisa los logs de SendGrid en tu cuenta';
                            echo '</div>';
                        }

                    } catch (\Exception $e) {
                        echo '<div class="error">';
                        echo '<strong>❌ Error:</strong><br>';
                        echo htmlspecialchars($e->getMessage());
                        echo '</div>';
                    }
                }
            }

            echo '<hr>';
            echo '<h2>🧪 Probar Envío</h2>';
            echo '<form method="POST">';
            echo '<label><strong>Correo de prueba:</strong></label><br>';
            echo '<input type="email" name="test_email" value="' . htmlspecialchars($testEmail ?? 'cj106558@gmail.com') . '" style="width: 100%; padding: 10px; margin: 10px 0; border: 2px solid #ddd; border-radius: 5px;"><br>';
            echo '<button type="submit" name="test" style="background: #1976D2; color: white; padding: 12px 24px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; margin-top: 10px;">🚀 Enviar Correo de Prueba</button>';
            echo '</form>';

            echo '<div class="warning" style="margin-top: 20px;">';
            echo '<strong>⚠️ Si el correo no llega:</strong><br>';
            echo '1. Revisa la <strong>carpeta de spam</strong><br>';
            echo '2. Verifica en SendGrid que el remitente esté <strong>verificado</strong><br>';
            echo '3. Revisa los <strong>logs de SendGrid</strong> en tu cuenta<br>';
            echo '4. Puede tardar 1-2 minutos en llegar<br>';
            echo '5. Si usas el mismo correo para SendGrid y como remitente, <strong>no es problema</strong>';
            echo '</div>';
        }
        ?>
    </div>
</body>
</html>


