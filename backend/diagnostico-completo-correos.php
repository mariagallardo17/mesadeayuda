<?php
/**
 * Diagnóstico completo del sistema de correos
 * Accede desde: https://atiendeti.com/api/diagnostico-completo-correos.php
 */

require_once __DIR__ . '/vendor/autoload.php';

use App\Services\EmailService;
use App\Config\Database;

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
        $dotenv = Dotenv\Dotenv::createImmutable($envPath);
        $dotenv->safeLoad();
        $envLoaded = true;
        break;
    }
}

if (!$envLoaded) {
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
    <title>Diagnóstico Completo de Correos</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 1000px; margin: 20px auto; padding: 20px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #1976D2; border-bottom: 3px solid #1976D2; padding-bottom: 10px; }
        h2 { color: #333; margin-top: 30px; }
        .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .warning { background: #fff3cd; border: 1px solid #ffc107; color: #856404; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .info { background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; padding: 15px; border-radius: 5px; margin: 15px 0; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f8f9fa; font-weight: bold; }
        .btn { background: #1976D2; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; text-decoration: none; display: inline-block; margin: 5px; }
        .btn:hover { background: #1565C0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 Diagnóstico Completo del Sistema de Correos</h1>

        <?php
        // 1. Verificar configuración
        echo '<h2>1. 📋 Configuración</h2>';
        echo '<div class="info">';
        echo '<strong>SENDGRID_API_KEY:</strong> ' . (empty($sendGridApiKey) ? '<span style="color: red;">❌ NO CONFIGURADO</span>' : '<span style="color: green;">✅ Configurado (' . substr($sendGridApiKey, 0, 10) . '...)</span>') . '<br>';
        echo '<strong>SMTP_FROM:</strong> ' . ($smtpFrom ?: 'No configurado') . '<br>';
        echo '<strong>SMTP_USER:</strong> ' . ($smtpUser ?: 'No configurado') . '<br>';
        echo '<strong>Remitente que se usará:</strong> ' . htmlspecialchars($fromEmail) . ' (' . htmlspecialchars($fromName) . ')';
        echo '</div>';

        if (empty($sendGridApiKey)) {
            echo '<div class="error">❌ SENDGRID_API_KEY no está configurado. Los correos no se pueden enviar.</div>';
            exit;
        }

        // 2. Verificar remitente en SendGrid
        echo '<h2>2. 📧 Verificación del Remitente en SendGrid</h2>';
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
                        break;
                    }
                }
            }
            
            if ($isVerified) {
                echo '<div class="success">✅ Remitente verificado: ' . htmlspecialchars($fromEmail) . '</div>';
            } else {
                echo '<div class="warning">⚠️ Remitente NO verificado: ' . htmlspecialchars($fromEmail) . '<br>';
                echo 'SendGrid acepta el correo pero puede no entregarlo si el remitente no está verificado.</div>';
            }
        } else {
            echo '<div class="warning">⚠️ No se pudo verificar el estado del remitente (HTTP ' . $httpCode . ')</div>';
        }

        // 3. Verificar correos en BD
        echo '<h2>3. 📊 Correos en Base de Datos</h2>';
        try {
            $db = Database::getInstance();
            $pdo = $db->getConnection();
            
            $stmt = $pdo->query('SELECT id_usuario, nombre, correo, rol FROM usuarios ORDER BY nombre');
            $usuarios = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $correosConMayusculas = [];
            foreach ($usuarios as $usuario) {
                $correoOriginal = $usuario['correo'] ?? '';
                $correoNormalizado = trim(strtolower($correoOriginal));
                if ($correoOriginal !== $correoNormalizado) {
                    $correosConMayusculas[] = [
                        'usuario' => $usuario['nombre'],
                        'original' => $correoOriginal,
                        'normalizado' => $correoNormalizado
                    ];
                }
            }
            
            if (empty($correosConMayusculas)) {
                echo '<div class="success">✅ Todos los correos están en formato correcto (sin mayúsculas)</div>';
            } else {
                echo '<div class="warning">⚠️ Se encontraron ' . count($correosConMayusculas) . ' correos con mayúsculas que se normalizarán automáticamente:</div>';
                echo '<table>';
                echo '<tr><th>Usuario</th><th>Correo Original</th><th>Correo Normalizado</th></tr>';
                foreach ($correosConMayusculas as $item) {
                    echo '<tr>';
                    echo '<td>' . htmlspecialchars($item['usuario']) . '</td>';
                    echo '<td><code>' . htmlspecialchars($item['original']) . '</code></td>';
                    echo '<td><code>' . htmlspecialchars($item['normalizado']) . '</code></td>';
                    echo '</tr>';
                }
                echo '</table>';
            }
        } catch (Exception $e) {
            echo '<div class="error">❌ Error al consultar base de datos: ' . htmlspecialchars($e->getMessage()) . '</div>';
        }

        // 4. Recomendaciones
        echo '<h2>4. 💡 Recomendaciones</h2>';
        echo '<div class="info">';
        echo '<strong>Si SendGrid acepta el correo (HTTP 202) pero no llega:</strong><br><br>';
        echo '<strong>1. Revisa SendGrid Activity:</strong><br>';
        echo '   Ve a <a href="https://app.sendgrid.com/activity" target="_blank">SendGrid Activity</a> y busca los correos enviados.<br>';
        echo '   Verifica el estado: "Delivered" (llegó), "Bounced" (rebotado), "Blocked" (bloqueado).<br><br>';
        echo '<strong>2. Revisa la carpeta de spam:</strong><br>';
        echo '   Los correos pueden estar en spam, especialmente correos institucionales (.tecnm.mx).<br><br>';
        echo '<strong>3. Verifica el remitente:</strong><br>';
        echo '   Asegúrate de que <strong>' . htmlspecialchars($fromEmail) . '</strong> esté verificado en SendGrid.<br><br>';
        echo '<strong>4. Delay en entrega:</strong><br>';
        echo '   Puede tardar 2-10 minutos en llegar, especialmente a correos institucionales.<br><br>';
        echo '<strong>5. Prueba con un correo personal:</strong><br>';
        echo '   Prueba enviando a un correo personal (Gmail, Outlook) para verificar que el sistema funciona.';
        echo '</div>';

        // 5. Scripts de prueba
        echo '<h2>5. 🔗 Scripts de Prueba</h2>';
        echo '<a href="test-envio-correo-completo.php?email=cj106558@gmail.com" class="btn">Probar Envío Completo</a>';
        echo '<a href="test-sendgrid-directo.php?email=cj106558@gmail.com" class="btn">Probar SendGrid Directo</a>';
        echo '<a href="verificar-correos-bd.php" class="btn">Verificar Correos en BD</a>';
        echo '<a href="revisar-activity-sendgrid.php" class="btn">Revisar SendGrid Activity</a>';
        ?>

    </div>
</body>
</html>

