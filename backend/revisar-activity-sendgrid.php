<?php
/**
 * Script para revisar el estado de entrega en SendGrid Activity
 * Accede desde: https://atiendeti.com/api/revisar-activity-sendgrid.php
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
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Revisar Activity SendGrid</title>
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
        .info { background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .btn { background: #1976D2; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; text-decoration: none; display: inline-block; margin: 5px; }
        .btn:hover { background: #1565C0; }
        ul { line-height: 1.8; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Revisar Activity de SendGrid</h1>

        <div class="info">
            <strong>✅ Remitente Verificado</strong><br>
            Tu remitente <strong>mesadeayuda042@gmail.com</strong> está verificado en SendGrid.
        </div>

        <h2>🔍 ¿Por qué no llegan los correos?</h2>
        
        <p>Si SendGrid acepta el correo (HTTP 202) y el remitente está verificado, pero no llegan, revisa:</p>

        <h3>1. 📧 Revisa SendGrid Activity</h3>
        <p>Ve a <a href="https://app.sendgrid.com/activity" target="_blank" class="btn">SendGrid Activity</a> y busca los correos enviados.</p>
        <p>Allí verás el estado real de cada correo:</p>
        <ul>
            <li><strong>Delivered</strong> (Entregado) - El correo llegó correctamente</li>
            <li><strong>Bounced</strong> (Rebotado) - El servidor del destinatario rechazó el correo</li>
            <li><strong>Blocked</strong> (Bloqueado) - El correo fue bloqueado</li>
            <li><strong>Dropped</strong> (Descartado) - SendGrid descartó el correo</li>
            <li><strong>Deferred</strong> (Diferido) - El correo está en cola para reenvío</li>
        </ul>

        <h3>2. 🗑️ Revisa la Carpeta de Spam</h3>
        <p>Aunque el remitente esté verificado, algunos servidores de correo pueden enviar los correos a spam, especialmente:</p>
        <ul>
            <li>Correos institucionales (como .edu, .tecnm.mx)</li>
            <li>Primeros correos desde un nuevo remitente</li>
            <li>Correos con contenido que parece promocional</li>
        </ul>

        <h3>3. ⏱️ Delay en Entrega</h3>
        <p>Puede tardar unos minutos (hasta 5-10 minutos) en llegar, especialmente a correos institucionales.</p>

        <h3>4. 🚫 Bloqueo del Servidor Destinatario</h3>
        <p>Algunos servidores de correo (especialmente institucionales) pueden bloquear correos de SendGrid o requerir whitelisting.</p>

        <h2>💡 Próximos Pasos</h2>
        <ol>
            <li>Ve a <a href="https://app.sendgrid.com/activity" target="_blank">SendGrid Activity</a></li>
            <li>Busca el correo que enviaste (por email del destinatario o fecha)</li>
            <li>Revisa el estado: si dice "Delivered", el correo llegó (revisa spam)</li>
            <li>Si dice "Bounced" o "Blocked", hay un problema con el servidor del destinatario</li>
        </ol>

        <h2>🔗 Enlaces Útiles</h2>
        <a href="https://app.sendgrid.com/activity" target="_blank" class="btn">Ver Activity de SendGrid</a>
        <a href="test-sendgrid-directo.php" class="btn">Probar Envío Nuevamente</a>
        <a href="verificar-sendgrid.php" class="btn">Verificar Configuración</a>
    </div>
</body>
</html>

