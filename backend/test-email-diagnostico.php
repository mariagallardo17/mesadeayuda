<?php
/**
 * Endpoint de diagnóstico de correos accesible desde navegador
 * Accede desde: https://tudominio.com/backend/test-email-diagnostico.php
 */

header('Content-Type: text/html; charset=utf-8');

// Cargar dependencias
if (!file_exists(__DIR__ . '/vendor/autoload.php')) {
    die('❌ ERROR: Ejecuta "composer install" en la carpeta backend/');
}

require_once __DIR__ . '/vendor/autoload.php';

use Dotenv\Dotenv;

// Cargar .env
$envPath = __DIR__;
if (file_exists($envPath . '/.env')) {
    $dotenv = Dotenv::createImmutable($envPath);
    $dotenv->load();
} else {
    die('❌ ERROR: Archivo .env no encontrado en: ' . $envPath);
}

// Helper para limpiar variables
$cleanEnv = function($key, $default = '') {
    $value = $_ENV[$key] ?? $default;
    if (is_string($value) && strlen($value) > 0) {
        if (($value[0] === '"' && substr($value, -1) === '"') || ($value[0] === "'" && substr($value, -1) === "'")) {
            $value = substr($value, 1, -1);
        }
    }
    return trim($value);
};

?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Diagnóstico de Correos - Mesa de Ayuda</title>
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
        h1 {
            color: #1976D2;
            border-bottom: 3px solid #1976D2;
            padding-bottom: 10px;
        }
        .section {
            margin: 20px 0;
            padding: 15px;
            background: #f9f9f9;
            border-left: 4px solid #2196F3;
            border-radius: 5px;
        }
        .ok { color: #4CAF50; font-weight: bold; }
        .error { color: #f44336; font-weight: bold; }
        .warning { color: #FF9800; font-weight: bold; }
        .info { color: #2196F3; }
        pre {
            background: #263238;
            color: #aed581;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            font-size: 12px;
        }
        .test-form {
            margin-top: 30px;
            padding: 20px;
            background: #e3f2fd;
            border-radius: 5px;
        }
        input[type="email"] {
            width: 300px;
            padding: 10px;
            border: 1px solid #ccc;
            border-radius: 5px;
            font-size: 14px;
        }
        button {
            padding: 10px 20px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            margin-left: 10px;
        }
        button:hover {
            background: #45a049;
        }
        .result {
            margin-top: 20px;
            padding: 15px;
            border-radius: 5px;
        }
        .result.success {
            background: #e8f5e9;
            border-left: 4px solid #4CAF50;
        }
        .result.error {
            background: #ffebee;
            border-left: 4px solid #f44336;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 Diagnóstico de Correos - Mesa de Ayuda</h1>
        
        <?php
        // 1. Verificar configuración
        echo '<div class="section">';
        echo '<h2>1. Configuración</h2>';
        
        $smtpHost = $cleanEnv('SMTP_HOST', '');
        $smtpPort = (int)$cleanEnv('SMTP_PORT', 587);
        $smtpUser = $cleanEnv('SMTP_USER', '');
        $smtpPass = $cleanEnv('SMTP_PASS', '');
        $sendGridApiKey = $cleanEnv('SENDGRID_API_KEY', '');
        
        $smtpOk = !empty($smtpHost) && !empty($smtpUser) && !empty($smtpPass);
        $sendGridOk = !empty($sendGridApiKey);
        
        echo '<p>SMTP_HOST: ' . ($smtpHost ? '<span class="ok">✅ ' . htmlspecialchars($smtpHost) . '</span>' : '<span class="error">❌ NO CONFIGURADO</span>') . '</p>';
        echo '<p>SMTP_PORT: ' . ($smtpPort ? '<span class="ok">✅ ' . $smtpPort . '</span>' : '<span class="warning">⚠️ Usando 587</span>') . '</p>';
        echo '<p>SMTP_USER: ' . ($smtpUser ? '<span class="ok">✅ ' . htmlspecialchars($smtpUser) . '</span>' : '<span class="error">❌ NO CONFIGURADO</span>') . '</p>';
        echo '<p>SMTP_PASS: ' . ($smtpPass ? '<span class="ok">✅ ' . str_repeat('*', min(strlen($smtpPass), 10)) . ' (' . strlen($smtpPass) . ' caracteres)</span>' : '<span class="error">❌ NO CONFIGURADO</span>') . '</p>';
        echo '<p>SENDGRID_API_KEY: ' . ($sendGridApiKey ? '<span class="ok">✅ ' . str_repeat('*', min(strlen($sendGridApiKey), 10)) . ' (' . strlen($sendGridApiKey) . ' caracteres)</span>' : '<span class="error">❌ NO CONFIGURADO</span>') . '</p>';
        
        if (!$smtpOk && !$sendGridOk) {
            echo '<p class="error">❌ ERROR: Ninguna configuración de correo está completa.</p>';
        } else {
            echo '<p class="ok">✅ Al menos una configuración está completa.</p>';
        }
        echo '</div>';
        
        // 2. Verificar extensiones PHP
        echo '<div class="section">';
        echo '<h2>2. Extensiones PHP</h2>';
        echo '<p>cURL: ' . (extension_loaded('curl') ? '<span class="ok">✅ Instalada</span>' : '<span class="error">❌ NO instalada</span>') . '</p>';
        echo '<p>OpenSSL: ' . (extension_loaded('openssl') ? '<span class="ok">✅ Instalada</span>' : '<span class="warning">⚠️ NO instalada</span>') . '</p>';
        echo '<p>PHPMailer: ' . (class_exists('PHPMailer\PHPMailer\PHPMailer') ? '<span class="ok">✅ Instalado</span>' : '<span class="error">❌ NO instalado</span>') . '</p>';
        echo '</div>';
        
        // 3. Probar envío si se envió formulario
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['email'])) {
            $emailDestino = filter_var($_POST['email'], FILTER_VALIDATE_EMAIL);
            
            if (!$emailDestino) {
                echo '<div class="result error">';
                echo '<p class="error">❌ Correo inválido: ' . htmlspecialchars($_POST['email']) . '</p>';
                echo '</div>';
            } else {
                echo '<div class="section">';
                echo '<h2>3. Resultado del Envío de Prueba</h2>';
                
                try {
                    require_once __DIR__ . '/src/Services/EmailService.php';
                    $emailService = new App\Services\EmailService();
                    
                    $subject = "Prueba de correo - Mesa de Ayuda";
                    $htmlBody = "
                    <html>
                    <body style='font-family: Arial, sans-serif;'>
                        <h2>Correo de Prueba</h2>
                        <p>Este es un correo de prueba del sistema Mesa de Ayuda.</p>
                        <p>Si recibes este correo, la configuración está funcionando correctamente.</p>
                        <p><strong>Fecha:</strong> " . date('Y-m-d H:i:s') . "</p>
                        <p><strong>Servidor:</strong> " . $_SERVER['SERVER_NAME'] . "</p>
                    </body>
                    </html>
                    ";
                    
                    $resultado = $emailService->sendEmail($emailDestino, $subject, $htmlBody);
                    
                    if ($resultado) {
                        echo '<div class="result success">';
                        echo '<p class="ok">✅ Correo enviado exitosamente a: ' . htmlspecialchars($emailDestino) . '</p>';
                        echo '<p class="info">📧 Revisa la bandeja de entrada (y carpeta de spam) de: ' . htmlspecialchars($emailDestino) . '</p>';
                        echo '</div>';
                    } else {
                        echo '<div class="result error">';
                        echo '<p class="error">❌ No se pudo enviar el correo</p>';
                        echo '<p class="info">Revisa los logs del servidor para más detalles</p>';
                        echo '</div>';
                    }
                } catch (Exception $e) {
                    echo '<div class="result error">';
                    echo '<p class="error">❌ Error: ' . htmlspecialchars($e->getMessage()) . '</p>';
                    echo '<pre>' . htmlspecialchars($e->getTraceAsString()) . '</pre>';
                    echo '</div>';
                }
                echo '</div>';
            }
        }
        ?>
        
        <div class="test-form">
            <h2>📧 Enviar Correo de Prueba</h2>
            <form method="POST">
                <label for="email">Correo de destino:</label><br>
                <input type="email" id="email" name="email" placeholder="tu@correo.com" required>
                <button type="submit">Enviar Prueba</button>
            </form>
        </div>
        
        <div class="section">
            <h2>💡 Recomendaciones</h2>
            <ul>
                <li>Si SMTP no funciona, verifica que el hosting permita conexiones SMTP salientes</li>
                <li>Algunos hostings bloquean el puerto 587, prueba con 465 (SSL) o 25</li>
                <li>Verifica que el correo remitente esté verificado en el servidor SMTP</li>
                <li>Si usas SendGrid, verifica el remitente en: <a href="https://app.sendgrid.com/settings/sender_auth" target="_blank">SendGrid Sender Auth</a></li>
                <li>Si los correos se envían pero no llegan, revisa la carpeta de spam</li>
                <li>Revisa los logs de error del servidor para más detalles</li>
            </ul>
        </div>
    </div>
</body>
</html>
