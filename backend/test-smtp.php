<?php
/**
 * Script de prueba para diagnosticar problemas SMTP
 * Ejecutar desde línea de comandos: php test-smtp.php
 */

require_once __DIR__ . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// Cargar variables de entorno
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->safeLoad();

echo "🔍 Probando configuración SMTP...\n\n";

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

$smtpHost = $cleanEnv('SMTP_HOST', 'smtp.gmail.com');
$smtpPort = (int)$cleanEnv('SMTP_PORT', '587');
$smtpUser = $cleanEnv('SMTP_USER', '');
$smtpPass = $cleanEnv('SMTP_PASS', '');
$smtpFrom = $cleanEnv('SMTP_FROM', '');

echo "📋 Configuración cargada:\n";
echo "   Host: $smtpHost\n";
echo "   Port: $smtpPort\n";
echo "   User: $smtpUser\n";
echo "   Pass: " . (empty($smtpPass) ? 'VACÍO' : substr($smtpPass, 0, 4) . '...') . "\n";
echo "   From: " . ($smtpFrom ?: 'No configurado') . "\n\n";

// Validar configuración
if (empty($smtpUser) || empty($smtpPass)) {
    echo "❌ ERROR: SMTP_USER o SMTP_PASS no están configurados\n";
    exit(1);
}

// Crear instancia de PHPMailer
$mail = new PHPMailer(true);

try {
    // Configuración del servidor
    $mail->isSMTP();
    $mail->Host = $smtpHost;
    $mail->SMTPAuth = true;
    $mail->Username = $smtpUser;
    $mail->Password = $smtpPass;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port = $smtpPort;
    $mail->CharSet = 'UTF-8';
    
    // Opciones SSL para desarrollo
    $mail->SMTPOptions = [
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false,
            'allow_self_signed' => true
        ]
    ];
    
    // Habilitar debug
    $mail->SMTPDebug = 2;
    $mail->Debugoutput = function($str, $level) {
        echo "   [$level] $str\n";
    };
    
    // Configurar remitente
    if (!empty($smtpFrom)) {
        if (preg_match('/^(.+?)\s*<(.+?)>$/', $smtpFrom, $matches)) {
            $mail->setFrom(trim($matches[2]), trim($matches[1]));
        } else {
            $mail->setFrom($smtpFrom);
        }
    } else {
        $mail->setFrom($smtpUser, 'Mesa de Ayuda - ITS');
    }
    
    // Configurar destinatario (usar el mismo correo para prueba)
    $testEmail = $smtpUser; // Enviar a sí mismo para prueba
    $mail->addAddress($testEmail);
    
    // Contenido del correo de prueba
    $mail->isHTML(true);
    $mail->Subject = 'Prueba de configuración SMTP - Mesa de Ayuda';
    $mail->Body = '<h1>Prueba de Correo</h1><p>Si recibes este correo, la configuración SMTP está funcionando correctamente.</p>';
    $mail->AltBody = 'Prueba de Correo - Si recibes este correo, la configuración SMTP está funcionando correctamente.';
    
    echo "📤 Intentando enviar correo de prueba a: $testEmail\n";
    echo "📤 Conectando al servidor SMTP...\n\n";
    
    // Intentar enviar
    $result = $mail->send();
    
    if ($result) {
        echo "\n✅ ¡ÉXITO! El correo se envió correctamente.\n";
        echo "   Revisa tu bandeja de entrada en: $testEmail\n";
        exit(0);
    } else {
        echo "\n❌ ERROR: No se pudo enviar el correo\n";
        echo "   ErrorInfo: " . $mail->ErrorInfo . "\n";
        exit(1);
    }
    
} catch (Exception $e) {
    echo "\n❌ EXCEPCIÓN: " . $e->getMessage() . "\n";
    echo "   ErrorInfo: " . $mail->ErrorInfo . "\n";
    echo "\n💡 Posibles soluciones:\n";
    echo "   1. Verifica que SMTP_USER y SMTP_PASS sean correctos\n";
    echo "   2. Si usas Gmail, asegúrate de usar una contraseña de aplicación\n";
    echo "   3. Verifica que el servidor SMTP esté accesible desde tu servidor\n";
    echo "   4. Revisa los logs del servidor para más detalles\n";
    exit(1);
}

