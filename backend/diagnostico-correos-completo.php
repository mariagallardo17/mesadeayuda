<?php
/**
 * Script de diagnóstico completo para correos
 * Verifica configuración, conexiones y envío de prueba
 */

// Cargar variables de entorno
require_once __DIR__ . '/vendor/autoload.php';

use Dotenv\Dotenv;

// Cargar .env
$envPath = __DIR__;
if (file_exists($envPath . '/.env')) {
    $dotenv = Dotenv::createImmutable($envPath);
    $dotenv->load();
    echo "✅ Archivo .env encontrado y cargado\n";
} else {
    echo "❌ ERROR: Archivo .env NO encontrado en: $envPath\n";
    echo "   Crea el archivo .env en la carpeta backend/\n";
    exit(1);
}

echo "\n=== DIAGNÓSTICO DE CONFIGURACIÓN DE CORREOS ===\n\n";

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

// 1. Verificar configuración SMTP
echo "1. VERIFICANDO CONFIGURACIÓN SMTP:\n";
$smtpHost = $cleanEnv('SMTP_HOST', '');
$smtpPort = (int)$cleanEnv('SMTP_PORT', 587);
$smtpUser = $cleanEnv('SMTP_USER', '');
$smtpPass = $cleanEnv('SMTP_PASS', '');
$smtpFrom = $cleanEnv('SMTP_FROM', '');

echo "   SMTP_HOST: " . ($smtpHost ? "✅ '$smtpHost'" : "❌ NO CONFIGURADO") . "\n";
echo "   SMTP_PORT: " . ($smtpPort ? "✅ $smtpPort" : "❌ NO CONFIGURADO (usando 587)") . "\n";
echo "   SMTP_USER: " . ($smtpUser ? "✅ '$smtpUser'" : "❌ NO CONFIGURADO") . "\n";
echo "   SMTP_PASS: " . ($smtpPass ? "✅ " . str_repeat('*', min(strlen($smtpPass), 10)) . " (" . strlen($smtpPass) . " caracteres)" : "❌ NO CONFIGURADO") . "\n";
echo "   SMTP_FROM: " . ($smtpFrom ? "✅ '$smtpFrom'" : "⚠️ NO CONFIGURADO (usará SMTP_USER)") . "\n";

$smtpConfigurado = !empty($smtpHost) && !empty($smtpUser) && !empty($smtpPass);
echo "   RESULTADO SMTP: " . ($smtpConfigurado ? "✅ CONFIGURADO" : "❌ INCOMPLETO") . "\n\n";

// 2. Verificar configuración SendGrid
echo "2. VERIFICANDO CONFIGURACIÓN SENDGRID:\n";
$sendGridApiKey = $cleanEnv('SENDGRID_API_KEY', '');
echo "   SENDGRID_API_KEY: " . ($sendGridApiKey ? "✅ " . str_repeat('*', min(strlen($sendGridApiKey), 10)) . " (" . strlen($sendGridApiKey) . " caracteres)" : "❌ NO CONFIGURADO") . "\n";
$sendGridConfigurado = !empty($sendGridApiKey);
echo "   RESULTADO SENDGRID: " . ($sendGridConfigurado ? "✅ CONFIGURADO" : "❌ NO CONFIGURADO") . "\n\n";

// 3. Verificar que al menos uno esté configurado
if (!$smtpConfigurado && !$sendGridConfigurado) {
    echo "❌ ERROR CRÍTICO: Ninguna configuración de correo está completa.\n";
    echo "   Configura SMTP o SendGrid en el archivo .env\n\n";
    exit(1);
}

// 4. Verificar PHPMailer
echo "3. VERIFICANDO PHPMailer:\n";
if (class_exists('PHPMailer\PHPMailer\PHPMailer')) {
    echo "   ✅ PHPMailer está instalado\n";
} else {
    echo "   ❌ PHPMailer NO está instalado\n";
    echo "   Ejecuta: composer require phpmailer/phpmailer\n\n";
    exit(1);
}

// 5. Verificar extensión cURL (para SendGrid)
echo "4. VERIFICANDO EXTENSIONES PHP:\n";
echo "   cURL: " . (extension_loaded('curl') ? "✅ Instalada" : "❌ NO instalada (necesaria para SendGrid)") . "\n";
echo "   OpenSSL: " . (extension_loaded('openssl') ? "✅ Instalada" : "⚠️ NO instalada (puede causar problemas SSL)") . "\n";
echo "   PDO: " . (extension_loaded('pdo') ? "✅ Instalada" : "❌ NO instalada") . "\n\n";

// 6. Probar conexión SMTP (si está configurado)
if ($smtpConfigurado) {
    echo "5. PROBANDO CONEXIÓN SMTP:\n";
    try {
        $mail = new PHPMailer\PHPMailer\PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = $smtpHost;
        $mail->SMTPAuth = true;
        $mail->Username = $smtpUser;
        $mail->Password = $smtpPass;
        $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = $smtpPort;
        $mail->SMTPDebug = 2; // Habilitar debug
        $mail->Debugoutput = function($str, $level) {
            echo "   DEBUG: $str";
        };
        $mail->SMTPOptions = [
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            ]
        ];
        
        echo "   Intentando conectar a $smtpHost:$smtpPort...\n";
        $mail->smtpConnect();
        echo "   ✅ Conexión SMTP exitosa\n";
        $mail->smtpClose();
    } catch (Exception $e) {
        echo "   ❌ Error de conexión SMTP: " . $e->getMessage() . "\n";
        echo "   Verifica:\n";
        echo "   - Que el host SMTP sea correcto\n";
        echo "   - Que el puerto sea correcto (587 para TLS, 465 para SSL)\n";
        echo "   - Que las credenciales sean correctas\n";
        echo "   - Que el firewall no bloquee la conexión\n";
    }
    echo "\n";
}

// 7. Probar API de SendGrid (si está configurado)
if ($sendGridConfigurado) {
    echo "6. PROBANDO API SENDGRID:\n";
    try {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://api.sendgrid.com/v3/user/profile');
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $sendGridApiKey,
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);
        
        if ($curlError) {
            echo "   ❌ Error cURL: $curlError\n";
        } elseif ($httpCode === 200) {
            echo "   ✅ API Key de SendGrid válida\n";
        } elseif ($httpCode === 401) {
            echo "   ❌ API Key de SendGrid inválida o expirada\n";
        } else {
            echo "   ⚠️ Respuesta inesperada de SendGrid (HTTP $httpCode)\n";
        }
    } catch (Exception $e) {
        echo "   ❌ Error probando SendGrid: " . $e->getMessage() . "\n";
    }
    echo "\n";
}

// 8. Solicitar correo de prueba
echo "7. ENVÍO DE CORREO DE PRUEBA:\n";
echo "   ¿Deseas enviar un correo de prueba? (s/n): ";
$handle = fopen("php://stdin", "r");
$line = fgets($handle);
$enviarPrueba = trim(strtolower($line)) === 's';
fclose($handle);

if ($enviarPrueba) {
    echo "   Ingresa el correo de destino: ";
    $handle = fopen("php://stdin", "r");
    $correoDestino = trim(fgets($handle));
    fclose($handle);
    
    if (!filter_var($correoDestino, FILTER_VALIDATE_EMAIL)) {
        echo "   ❌ Correo inválido: $correoDestino\n";
        exit(1);
    }
    
    echo "   Enviando correo de prueba a: $correoDestino\n";
    
    try {
        require_once __DIR__ . '/src/Services/EmailService.php';
        $emailService = new App\Services\EmailService();
        
        $subject = "Prueba de correo - Mesa de Ayuda";
        $htmlBody = "
        <html>
        <body>
            <h2>Correo de Prueba</h2>
            <p>Este es un correo de prueba del sistema Mesa de Ayuda.</p>
            <p>Si recibes este correo, la configuración está funcionando correctamente.</p>
            <p>Fecha: " . date('Y-m-d H:i:s') . "</p>
        </body>
        </html>
        ";
        
        $resultado = $emailService->sendEmail($correoDestino, $subject, $htmlBody);
        
        if ($resultado) {
            echo "   ✅ Correo enviado exitosamente\n";
            echo "   Revisa la bandeja de entrada (y spam) de: $correoDestino\n";
        } else {
            echo "   ❌ No se pudo enviar el correo\n";
            echo "   Revisa los logs de error arriba\n";
        }
    } catch (Exception $e) {
        echo "   ❌ Error enviando correo: " . $e->getMessage() . "\n";
        echo "   Stack trace: " . $e->getTraceAsString() . "\n";
    }
}

echo "\n=== FIN DEL DIAGNÓSTICO ===\n";
echo "\nRECOMENDACIONES:\n";
if ($smtpConfigurado) {
    echo "- Si SMTP no funciona, verifica que el hosting permita conexiones SMTP salientes\n";
    echo "- Algunos hostings bloquean el puerto 587, prueba con 465 (SSL)\n";
    echo "- Verifica que el correo remitente esté verificado en el servidor SMTP\n";
}
if ($sendGridConfigurado) {
    echo "- SendGrid requiere que el correo remitente esté verificado en SendGrid\n";
    echo "- Verifica el remitente en: https://app.sendgrid.com/settings/sender_auth\n";
}
echo "- Revisa los logs de error del servidor para más detalles\n";
echo "- Si los correos se envían pero no llegan, revisa la carpeta de spam\n";
