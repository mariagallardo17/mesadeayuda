<?php
/**
 * Script simple para enviar un correo de prueba
 * Accede desde: https://atiendeti.com/backend/enviar-correo-prueba.php
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
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enviar Correo de Prueba</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 600px;
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
        input[type="email"] {
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 5px;
            font-size: 16px;
            margin: 10px 0;
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
            width: 100%;
        }
        .btn:hover {
            background: #1565C0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📧 Enviar Correo de Prueba</h1>

        <?php
        if (isset($_POST['enviar'])) {
            $destinatario = trim($_POST['email'] ?? '');

            if (empty($destinatario) || !filter_var($destinatario, FILTER_VALIDATE_EMAIL)) {
                echo '<div class="error">❌ Por favor, ingresa un correo válido</div>';
            } else {
                try {
                    $emailService = new EmailService();

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
                                <p><strong>Destinatario:</strong> ' . htmlspecialchars($destinatario) . '</p>
                                <p><strong>Estado:</strong> ✅ Sistema de correo funcionando</p>
                            </div>
                            <p>El sistema de correo de Mesa de Ayuda está configurado y funcionando correctamente.</p>
                            <hr style="border:none; border-top:2px solid #ececec; margin: 32px 0 15px 0;">
                            <div style="font-size: 13px; color:#777; text-align: center;">Mesa de Ayuda - ITS<br>No responder a este correo.</div>
                        </div>
                    </body>
                    </html>
                    ';

                    echo '<p>📤 Enviando correo a: <strong>' . htmlspecialchars($destinatario) . '</strong></p>';
                    echo '<p>⏳ Por favor espera...</p>';

                    $result = $emailService->sendEmail($destinatario, $subject, $htmlBody);

                    if ($result) {
                        echo '<div class="success">';
                        echo '<strong>✅ ¡ÉXITO!</strong><br>';
                        echo 'El correo se envió correctamente a: <strong>' . htmlspecialchars($destinatario) . '</strong><br><br>';
                        echo '📧 Revisa la bandeja de entrada (y la carpeta de spam si no lo encuentras).';
                        echo '</div>';
                    }

                } catch (\Exception $e) {
                    echo '<div class="error">';
                    echo '<strong>❌ Error al enviar correo:</strong><br>';
                    echo htmlspecialchars($e->getMessage());
                    echo '</div>';
                }
            }
        }
        ?>

        <form method="POST">
            <label for="email"><strong>Correo destinatario:</strong></label>
            <input
                type="email"
                id="email"
                name="email"
                value="cj106558@gmail.com"
                required
                placeholder="correo@ejemplo.com"
            >
            <button type="submit" name="enviar" class="btn">
                🚀 Enviar Correo de Prueba
            </button>
        </form>

        <div style="margin-top: 30px; padding: 15px; background: #fff3cd; border-radius: 5px; color: #856404;">
            <strong>⚠️ Importante:</strong> Elimina este archivo después de probar por seguridad.
        </div>
    </div>
</body>
</html>


