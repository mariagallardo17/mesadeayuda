<?php
/**
 * Script de diagnóstico para verificar el estado del sistema de correos
 * Ejecutar desde la línea de comandos: php diagnostico-correos.php
 */

require_once __DIR__ . '/vendor/autoload.php';

use Dotenv\Dotenv;

// Cargar variables de entorno
if (file_exists(__DIR__ . '/.env')) {
    $dotenv = Dotenv::createImmutable(__DIR__);
    $dotenv->load();
}

echo "========================================\n";
echo "DIAGNÓSTICO DEL SISTEMA DE CORREOS\n";
echo "========================================\n\n";

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

// 1. Verificar configuración de SendGrid
echo "1. VERIFICACIÓN DE CONFIGURACIÓN\n";
echo "--------------------------------\n";

$sendGridApiKey = $cleanEnv('SENDGRID_API_KEY', '');
if (empty($sendGridApiKey)) {
    echo "❌ SENDGRID_API_KEY: NO CONFIGURADO\n";
    echo "   → Esto impedirá el envío de correos\n";
} else {
    $keyLength = strlen($sendGridApiKey);
    $keyPreview = substr($sendGridApiKey, 0, 10) . '...' . substr($sendGridApiKey, -5);
    echo "✅ SENDGRID_API_KEY: Configurado (Longitud: $keyLength caracteres)\n";
    echo "   Preview: $keyPreview\n";
}

$smtpFrom = $cleanEnv('SMTP_FROM', '');
$smtpUser = $cleanEnv('SMTP_USER', '');

$fromEmail = $smtpUser;
if (!empty($smtpFrom)) {
    if (preg_match('/^(.+?)\s*<(.+?)>$/', $smtpFrom, $matches)) {
        $fromEmail = trim($matches[2]);
    } else {
        $fromEmail = $smtpFrom;
    }
}

if (empty($fromEmail)) {
    echo "❌ SMTP_FROM/SMTP_USER: NO CONFIGURADO\n";
    echo "   → No se puede determinar el remitente\n";
} else {
    echo "✅ Remitente configurado: $fromEmail\n";
}

echo "\n";

// 2. Probar conexión con SendGrid
echo "2. PRUEBA DE CONEXIÓN CON SENDGRID\n";
echo "-----------------------------------\n";

if (empty($sendGridApiKey)) {
    echo "⚠️ No se puede probar: SENDGRID_API_KEY no configurado\n";
} else {
    // Probar conexión básica
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
        echo "❌ Error de conexión: $curlError\n";
        echo "   → Verifica tu conexión a internet\n";
    } elseif ($httpCode === 200) {
        echo "✅ Conexión exitosa con SendGrid (HTTP 200)\n";
        $profile = json_decode($response, true);
        if ($profile && isset($profile['username'])) {
            echo "   Usuario: {$profile['username']}\n";
        }
    } elseif ($httpCode === 401) {
        echo "❌ Error 401: API Key inválida o expirada\n";
        echo "   → Verifica que SENDGRID_API_KEY sea correcto\n";
    } elseif ($httpCode === 403) {
        echo "❌ Error 403: Sin permisos\n";
        echo "   → Verifica que la API Key tenga permisos de lectura\n";
    } else {
        echo "⚠️ Respuesta inesperada: HTTP $httpCode\n";
        echo "   Respuesta: " . substr($response, 0, 200) . "\n";
    }
}

echo "\n";

// 3. Verificar remitente verificado
echo "3. VERIFICACIÓN DE REMITENTE\n";
echo "----------------------------\n";

if (empty($sendGridApiKey) || empty($fromEmail)) {
    echo "⚠️ No se puede verificar: Configuración incompleta\n";
} else {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://api.sendgrid.com/v3/verified_senders');
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $sendGridApiKey,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200) {
        $verified = json_decode($response, true);
        if ($verified && isset($verified['results'])) {
            $found = false;
            foreach ($verified['results'] as $sender) {
                if (isset($sender['from']['email']) && $sender['from']['email'] === $fromEmail) {
                    $found = true;
                    $status = $sender['verified']['status'] ?? 'unknown';
                    echo "✅ Remitente encontrado: $fromEmail\n";
                    echo "   Estado: $status\n";
                    break;
                }
            }
            if (!$found) {
                echo "❌ Remitente NO verificado: $fromEmail\n";
                echo "   → Debes verificar este remitente en SendGrid\n";
                echo "   → Ve a SendGrid > Settings > Sender Authentication\n";
            }
        }
    } else {
        echo "⚠️ No se pudo verificar remitente (HTTP $httpCode)\n";
    }
}

echo "\n";

// 4. Probar envío de correo de prueba
echo "4. PRUEBA DE ENVÍO DE CORREO\n";
echo "-----------------------------\n";

$testEmail = $cleanEnv('TEST_EMAIL', '');
if (empty($testEmail)) {
    echo "⚠️ TEST_EMAIL no configurado - No se enviará correo de prueba\n";
    echo "   → Configura TEST_EMAIL en .env para probar el envío\n";
} else {
    echo "Enviando correo de prueba a: $testEmail\n";
    
    try {
        $emailService = new \App\Services\EmailService();
        $result = $emailService->sendEmail(
            $testEmail,
            'Prueba de correo - Mesa de Ayuda',
            '<h1>Correo de Prueba</h1><p>Este es un correo de prueba del sistema de Mesa de Ayuda.</p>'
        );
        
        if ($result) {
            echo "✅ Correo de prueba enviado exitosamente\n";
            echo "   → Revisa la bandeja de entrada (y spam) de $testEmail\n";
        } else {
            echo "❌ No se pudo enviar el correo de prueba\n";
            echo "   → Revisa los logs del servidor para más detalles\n";
        }
    } catch (\Exception $e) {
        echo "❌ Error al enviar correo de prueba: " . $e->getMessage() . "\n";
    }
}

echo "\n";

// 5. Verificar logs recientes
echo "5. RESUMEN\n";
echo "----------\n";
echo "Para diagnosticar problemas:\n";
echo "1. Revisa los logs del servidor (error_log)\n";
echo "2. Busca líneas con [CORREOS] o [DIAGNÓSTICO]\n";
echo "3. Verifica el estado de SendGrid en https://status.sendgrid.com/\n";
echo "4. Revisa tu cuenta de SendGrid para ver si hay límites alcanzados\n";
echo "\n";
echo "========================================\n";

