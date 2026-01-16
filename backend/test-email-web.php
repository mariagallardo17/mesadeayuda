<?php
/**
 * Script de prueba de correo accesible desde el navegador
 * Accede desde: https://atiendeti.com/backend/test-email-web.php
 *
 * IMPORTANTE: Elimina este archivo después de probar por seguridad
 */

// Solo permitir acceso si estás en desarrollo o con autenticación
// Descomenta la siguiente línea y agrega tu IP para mayor seguridad:
// if ($_SERVER['REMOTE_ADDR'] !== 'TU_IP_AQUI') { die('Acceso denegado'); }

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prueba de Correo - Mesa de Ayuda</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #1976D2;
            border-bottom: 3px solid #1976D2;
            padding-bottom: 10px;
        }
        .success {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .error {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .info {
            background: #d1ecf1;
            border: 1px solid #bee5eb;
            color: #0c5460;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        pre {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            border-left: 4px solid #1976D2;
        }
        .btn {
            background: #1976D2;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            margin-top: 20px;
        }
        .btn:hover {
            background: #1565C0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📧 Prueba de Correo - Mesa de Ayuda</h1>

        <?php
        require_once __DIR__ . '/vendor/autoload.php';

        use App\Services\EmailService;

        // Cargar variables de entorno
        $envPaths = [
            __DIR__,  // backend/
            __DIR__ . '/api',  // backend/api/
            dirname(__DIR__) . '/api',  // api/ (si está al mismo nivel que backend)
        ];

        $envLoaded = false;
        $envPath = '';
        foreach ($envPaths as $path) {
            $envFile = $path . '/.env';
            if (file_exists($envFile)) {
                $dotenv = Dotenv\Dotenv::createImmutable($path);
                $dotenv->safeLoad();
                $envLoaded = true;
                $envPath = $path;
                break;
            }
        }

        if (!$envLoaded) {
            echo '<div class="error">';
            echo '<strong>❌ Error:</strong> No se encontró archivo .env<br>';
            echo 'Buscado en:<ul>';
            foreach ($envPaths as $path) {
                echo '<li>' . $path . '/.env</li>';
            }
            echo '</ul></div>';
            exit;
        }

        echo '<div class="info">';
        echo '<strong>✅ Archivo .env cargado desde:</strong> ' . $envPath;
        echo '</div>';

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
        $smtpPass = $cleanEnv('SMTP_PASS', '');

        echo '<h2>📋 Configuración SMTP</h2>';
        echo '<pre>';
        echo 'SMTP_HOST: ' . $cleanEnv('SMTP_HOST', 'smtp.gmail.com') . "\n";
        echo 'SMTP_PORT: ' . $cleanEnv('SMTP_PORT', '587') . "\n";
        echo 'SMTP_USER: ' . $smtpUser . "\n";
        echo 'SMTP_PASS: ' . (empty($smtpPass) ? '❌ VACÍO' : '✅ Configurado') . "\n";
        echo 'SMTP_FROM: ' . ($cleanEnv('SMTP_FROM', '') ?: 'No configurado');
        echo '</pre>';

        // Validar configuración
        if (empty($smtpUser) || empty($smtpPass)) {
            echo '<div class="error">';
            echo '<strong>❌ Error:</strong> SMTP_USER o SMTP_PASS no están configurados';
            echo '</div>';
            exit;
        }

        // Si se presionó el botón de prueba
        if (isset($_POST['test_email'])) {
            echo '<hr>';
            echo '<h2>📤 Enviando correo de prueba...</h2>';

            try {
                // Crear instancia de EmailService
                $emailService = new EmailService();

                // Preparar correo de prueba
                $testEmail = $smtpUser;
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

                // Intentar enviar
                echo '<p>📧 Enviando a: <strong>' . $testEmail . '</strong></p>';
                echo '<p>⏳ Por favor espera...</p>';

                $result = $emailService->sendEmail($testEmail, $subject, $htmlBody);

                if ($result) {
                    echo '<div class="success">';
                    echo '<strong>✅ ¡ÉXITO!</strong><br>';
                    echo 'El correo se envió correctamente.<br><br>';
                    echo '📧 Revisa tu bandeja de entrada en: <strong>' . $testEmail . '</strong><br>';
                    echo '📧 También revisa la carpeta de spam si no lo encuentras.<br><br>';
                    echo '💡 El sistema de correo está funcionando correctamente.';
                    echo '</div>';
                } else {
                    echo '<div class="error">';
                    echo '<strong>❌ Error:</strong> No se pudo enviar el correo (sendEmail devolvió false)';
                    echo '</div>';
                }

            } catch (\Exception $e) {
                echo '<div class="error">';
                echo '<strong>❌ Error al enviar correo:</strong><br>';
                echo '<pre>' . htmlspecialchars($e->getMessage()) . '</pre>';
                echo '<br><strong>💡 Posibles soluciones:</strong><br>';
                echo '<ul>';
                echo '<li>Verifica que SMTP_USER y SMTP_PASS sean correctos</li>';
                echo '<li>Si usas Gmail, asegúrate de usar una contraseña de aplicación</li>';
                echo '<li>Verifica que el servidor SMTP esté accesible</li>';
                echo '<li>Revisa los logs del servidor para más detalles</li>';
                echo '<li>Asegúrate de que SMTP_FROM use el mismo correo que SMTP_USER</li>';
                echo '</ul>';
                echo '</div>';
            }

            echo '<hr>';
        }
        ?>

        <form method="POST">
            <button type="submit" name="test_email" class="btn">
                🚀 Enviar Correo de Prueba
            </button>
        </form>

        <div class="info" style="margin-top: 30px;">
            <strong>⚠️ Importante:</strong> Elimina este archivo después de probar por seguridad.
        </div>
    </div>
</body>
</html>


