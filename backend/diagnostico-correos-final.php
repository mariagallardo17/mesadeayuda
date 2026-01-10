<?php
/**
 * Script de diagnóstico FINAL para correos
 * Ejecutar desde navegador: https://tu-dominio.com/api/diagnostico-correos-final.php
 * O desde terminal: php diagnostico-correos-final.php
 */

header('Content-Type: text/html; charset=UTF-8');

require_once __DIR__ . '/vendor/autoload.php';

use App\Services\EmailService;

// Cargar variables de entorno
$envPaths = [
    __DIR__,  // backend/
    __DIR__ . '/api',  // backend/api/
    dirname(__DIR__) . '/api',  // api/
];

$envLoaded = false;
$envFileFound = null;

foreach ($envPaths as $envPath) {
    $envFile = $envPath . '/.env';
    if (file_exists($envFile)) {
        $dotenv = Dotenv\Dotenv::createImmutable($envPath);
        $dotenv->safeLoad();
        $envLoaded = true;
        $envFileFound = $envFile;
        break;
    }
}

$cleanEnv = function($key, $default = '') {
    $value = $_ENV[$key] ?? $default;
    if (is_string($value) && strlen($value) > 0) {
        if (($value[0] === '"' && substr($value, -1) === '"') || ($value[0] === "'" && substr($value, -1) === "'")) {
            $value = substr($value, 1, -1);
        }
    }
    return trim($value);
};

echo "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Diagnóstico de Correos</title>";
echo "<style>body{font-family:Arial,sans-serif;max-width:900px;margin:20px auto;padding:20px;}";
echo ".ok{color:green;font-weight:bold;}.error{color:red;font-weight:bold;}.warning{color:orange;font-weight:bold;}";
echo "pre{background:#f5f5f5;padding:10px;border-radius:5px;overflow-x:auto;}";
echo "h2{border-bottom:2px solid #333;padding-bottom:10px;}</style></head><body>";
echo "<h1>🔍 Diagnóstico de Sistema de Correos</h1>";

// 1. Verificar archivo .env
echo "<h2>1. Archivo .env</h2>";
if ($envLoaded && $envFileFound) {
    echo "<p class='ok'>✅ Archivo .env encontrado en: <code>$envFileFound</code></p>";
} else {
    echo "<p class='error'>❌ Archivo .env NO encontrado</p>";
    echo "<p>Buscado en:</p><ul>";
    foreach ($envPaths as $path) {
        echo "<li><code>$path/.env</code></li>";
    }
    echo "</ul>";
    echo "<p><strong>SOLUCIÓN:</strong> Copia <code>env.example</code> a <code>.env</code> y configura SENDGRID_API_KEY</p>";
}

// 2. Verificar configuración SMTP
echo "<h2>2. Configuración SMTP</h2>";
$smtpHost = $cleanEnv('SMTP_HOST', '');
$smtpPort = $cleanEnv('SMTP_PORT', '587');
$smtpUser = $cleanEnv('SMTP_USER', '');
$smtpPass = $cleanEnv('SMTP_PASS', '');
$smtpFrom = $cleanEnv('SMTP_FROM', '');

$smtpConfigured = !empty($smtpHost) && !empty($smtpUser) && !empty($smtpPass);

if ($smtpConfigured) {
    echo "<p class='ok'>✅ SMTP está configurado</p>";
    echo "<ul>";
    echo "<li><strong>Host:</strong> <code>$smtpHost</code></li>";
    echo "<li><strong>Puerto:</strong> <code>$smtpPort</code></li>";
    echo "<li><strong>Usuario:</strong> <code>$smtpUser</code></li>";
    echo "<li><strong>Contraseña:</strong> " . (empty($smtpPass) ? '<span class="error">❌ Vacía</span>' : '<span class="ok">✅ Configurada</span>') . "</li>";
    echo "<li><strong>Remitente:</strong> <code>" . ($smtpFrom ?: $smtpUser) . "</code></li>";
    echo "</ul>";
} else {
    echo "<p class='warning'>⚠️ SMTP no está completamente configurado</p>";
    echo "<ul>";
    echo "<li><strong>SMTP_HOST:</strong> " . ($smtpHost ? "<code>$smtpHost</code>" : '<span class="error">❌ Vacío</span>') . "</li>";
    echo "<li><strong>SMTP_USER:</strong> " . ($smtpUser ? "<code>$smtpUser</code>" : '<span class="error">❌ Vacío</span>') . "</li>";
    echo "<li><strong>SMTP_PASS:</strong> " . (empty($smtpPass) ? '<span class="error">❌ Vacío</span>' : '<span class="ok">✅ Configurada</span>') . "</li>";
    echo "</ul>";
    echo "<p><strong>SOLUCIÓN:</strong> Configura SMTP_HOST, SMTP_USER y SMTP_PASS en el archivo .env</p>";
}

// 3. Verificar SENDGRID_API_KEY (como alternativa)
echo "<h2>3. Configuración SendGrid (Alternativa)</h2>";
$sendGridApiKey = $cleanEnv('SENDGRID_API_KEY', '');
if (empty($sendGridApiKey)) {
    echo "<p class='warning'>⚠️ SENDGRID_API_KEY no está configurado (opcional si usas SMTP)</p>";
} else {
    echo "<p class='ok'>✅ SENDGRID_API_KEY configurado (Longitud: " . strlen($sendGridApiKey) . " caracteres)</p>";
    echo "<p>Primeros 10 caracteres: <code>" . substr($sendGridApiKey, 0, 10) . "...</code></p>";
}

// 4. Verificar PHPMailer
echo "<h2>4. Verificar PHPMailer</h2>";
if (class_exists('PHPMailer\PHPMailer\PHPMailer')) {
    echo "<p class='ok'>✅ PHPMailer está instalado y disponible</p>";
} else {
    echo "<p class='error'>❌ PHPMailer NO está instalado</p>";
    echo "<p>Ejecuta: <code>composer install</code> en la carpeta backend/</p>";
}

// 5. Probar envío de correo
echo "<h2>5. Prueba de Envío</h2>";
$testEmail = $_GET['test_email'] ?? '';

if ($testEmail && filter_var($testEmail, FILTER_VALIDATE_EMAIL)) {
    echo "<p>Intentando enviar correo de prueba a: <code>$testEmail</code>...</p>";
    
    try {
        $emailService = new EmailService();
        $subject = "Prueba de Correo - Mesa de Ayuda";
        $htmlBody = "<html><body><h1>Correo de Prueba</h1><p>Si recibes este correo, el sistema de correos está funcionando correctamente.</p><p>Fecha: " . date('Y-m-d H:i:s') . "</p></body></html>";
        
        $result = $emailService->sendEmail($testEmail, $subject, $htmlBody);
        
        if ($result) {
            echo "<p class='ok'>✅ Correo enviado exitosamente a $testEmail</p>";
            echo "<p>Revisa tu bandeja de entrada y spam.</p>";
        } else {
            echo "<p class='error'>❌ No se pudo enviar el correo</p>";
            echo "<p>Revisa los logs del servidor para más detalles.</p>";
        }
    } catch (\Exception $e) {
        echo "<p class='error'>❌ Error: " . htmlspecialchars($e->getMessage()) . "</p>";
        echo "<pre>" . htmlspecialchars($e->getTraceAsString()) . "</pre>";
    }
} else {
    echo "<p>Para probar el envío de correos, agrega el parámetro: <code>?test_email=tu@email.com</code></p>";
    echo "<p>Ejemplo: <code>diagnostico-correos-final.php?test_email=tu@email.com</code></p>";
}

// 6. Verificar que EmailService se puede instanciar
echo "<h2>6. Clase EmailService</h2>";
try {
    $emailService = new EmailService();
    echo "<p class='ok'>✅ EmailService se puede instanciar correctamente</p>";
} catch (\Exception $e) {
    echo "<p class='error'>❌ Error instanciando EmailService: " . htmlspecialchars($e->getMessage()) . "</p>";
}

// 7. Verificar extensiones PHP
echo "<h2>7. Extensiones PHP</h2>";
if (function_exists('curl_init')) {
    echo "<p class='ok'>✅ cURL está disponible</p>";
} else {
    echo "<p class='error'>❌ cURL NO está disponible - necesario para SendGrid</p>";
}

if (function_exists('json_encode')) {
    echo "<p class='ok'>✅ JSON está disponible</p>";
} else {
    echo "<p class='error'>❌ JSON NO está disponible</p>";
}

// 8. Resumen y próximos pasos
echo "<h2>8. Resumen y Próximos Pasos</h2>";
if (!$smtpConfigured && empty($sendGridApiKey)) {
    echo "<div style='background:#ffebee;padding:15px;border-radius:5px;border-left:4px solid red;'>";
    echo "<h3 class='error'>⚠️ CONFIGURACIÓN REQUERIDA</h3>";
    echo "<p><strong>Debes configurar SMTP O SendGrid:</strong></p>";
    echo "<h4>Opción A: Configurar SMTP (RECOMENDADO)</h4>";
    echo "<ol>";
    echo "<li><strong>Crear archivo .env:</strong> Copia <code>env.example</code> a <code>.env</code> en la carpeta <code>backend/</code></li>";
    echo "<li><strong>Configurar SMTP:</strong> Agrega estas variables al .env:</li>";
    echo "<pre>SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASS=tu_contraseña_de_aplicacion
SMTP_FROM=\"Mesa de Ayuda ITS &lt;tu_email@gmail.com&gt;\"</pre>";
    echo "<li><strong>Para Gmail:</strong> Usa una <a href='https://myaccount.google.com/apppasswords' target='_blank'>contraseña de aplicación</a>, NO tu contraseña normal</li>";
    echo "</ol>";
    echo "<h4>Opción B: Configurar SendGrid</h4>";
    echo "<ol>";
    echo "<li><strong>Crear archivo .env:</strong> Copia <code>env.example</code> a <code>.env</code></li>";
    echo "<li><strong>Obtener API Key:</strong> Desde <a href='https://app.sendgrid.com/settings/api_keys' target='_blank'>SendGrid</a></li>";
    echo "<li><strong>Agregar al .env:</strong> <code>SENDGRID_API_KEY=tu_api_key_aqui</code></li>";
    echo "</ol>";
    echo "<li><strong>Reiniciar servidor:</strong> Reinicia PHP para que cargue las nuevas variables</li>";
    echo "<li><strong>Probar:</strong> Usa este script con <code>?test_email=tu@email.com</code> para probar</li>";
    echo "</div>";
} elseif ($smtpConfigured) {
    echo "<p class='ok'>✅ SMTP está configurado correctamente</p>";
    echo "<p>Si los correos aún no funcionan, verifica:</p>";
    echo "<ul>";
    echo "<li>Que SMTP_PASS sea una contraseña de aplicación (para Gmail)</li>";
    echo "<li>Los logs del servidor para errores específicos</li>";
    echo "<li>Que el puerto SMTP no esté bloqueado por el firewall</li>";
    echo "</ul>";
} else {
    echo "<p class='ok'>✅ SendGrid está configurado</p>";
    echo "<p>Si los correos aún no funcionan, verifica:</p>";
    echo "<ul>";
    echo "<li>Que el remitente esté verificado en SendGrid</li>";
    echo "<li>Los logs del servidor para errores específicos</li>";
    echo "<li>Que la API Key tenga permisos de envío</li>";
    echo "</ul>";
}

echo "</body></html>";
