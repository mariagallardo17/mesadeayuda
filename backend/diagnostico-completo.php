<?php
/**
 * Script de diagnóstico completo del sistema
 * Ejecutar: php diagnostico-completo.php
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "=== DIAGNÓSTICO COMPLETO DEL SISTEMA ===\n\n";

// 1. Verificar que el autoload funciona
echo "1. Verificando autoload...\n";
try {
    require_once __DIR__ . '/vendor/autoload.php';
    echo "   ✅ Autoload cargado correctamente\n";
} catch (\Exception $e) {
    echo "   ❌ Error cargando autoload: " . $e->getMessage() . "\n";
    exit(1);
}

// 2. Cargar variables de entorno
echo "\n2. Cargando variables de entorno...\n";
$envFile = __DIR__ . '/api/.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $loaded = 0;
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            $value = trim($value, '"\'');
            $_ENV[$key] = $value;
            $loaded++;
        }
    }
    echo "   ✅ Archivo .env cargado ($loaded variables)\n";
} else {
    echo "   ⚠️  Archivo .env no encontrado en: $envFile\n";
}

// 3. Verificar clases críticas
echo "\n3. Verificando clases críticas...\n";
$classes = [
    'App\\Config\\Database',
    'App\\Services\\EmailService',
    'App\\Services\\EvaluationScheduler',
    'App\\Services\\ReportesMensualesScheduler',
    'App\\Controllers\\ReportesController',
    'App\\Routes\\TicketRoutes',
    'App\\Middleware\\AuthMiddleware'
];

foreach ($classes as $class) {
    if (class_exists($class)) {
        echo "   ✅ $class existe\n";
    } else {
        echo "   ❌ $class NO existe\n";
    }
}

// 4. Verificar métodos en EmailService
echo "\n4. Verificando métodos en EmailService...\n";
try {
    $emailService = new App\Services\EmailService();
    $requiredMethods = [
        'sendEvaluationReminderEmail',
        'sendEvaluationAutoClosedEmail',
        'sendDailyEvaluationReminderEmail',
        'sendTicketReturnedFromEscalationEmail',
        'sendTicketStatusChangeNotification'
    ];
    
    foreach ($requiredMethods as $method) {
        if (method_exists($emailService, $method)) {
            echo "   ✅ Método $method existe\n";
        } else {
            echo "   ❌ Método $method NO existe\n";
        }
    }
} catch (\Exception $e) {
    echo "   ❌ Error instanciando EmailService: " . $e->getMessage() . "\n";
    echo "   Stack: " . $e->getTraceAsString() . "\n";
}

// 5. Verificar sintaxis de archivos PHP
echo "\n5. Verificando sintaxis PHP...\n";
$files = [
    'src/Services/EvaluationScheduler.php',
    'src/Services/ReportesMensualesScheduler.php',
    'src/Services/EmailService.php',
    'src/Routes/TicketRoutes.php',
    'src/Controllers/ReportesController.php'
];

foreach ($files as $file) {
    $path = __DIR__ . '/' . $file;
    if (!file_exists($path)) {
        echo "   ❌ $file NO existe\n";
        continue;
    }
    
    $output = [];
    $return = 0;
    exec("php -l " . escapeshellarg($path) . " 2>&1", $output, $return);
    
    if ($return === 0) {
        echo "   ✅ $file - Sintaxis OK\n";
    } else {
        echo "   ❌ $file - Error de sintaxis:\n";
        foreach ($output as $line) {
            echo "      $line\n";
        }
    }
}

// 6. Probar instanciación de servicios
echo "\n6. Probando instanciación de servicios...\n";

try {
    $scheduler = new App\Services\EvaluationScheduler();
    echo "   ✅ EvaluationScheduler instanciado\n";
} catch (\Exception $e) {
    echo "   ❌ Error instanciando EvaluationScheduler: " . $e->getMessage() . "\n";
    echo "   Stack: " . $e->getTraceAsString() . "\n";
}

try {
    $reportScheduler = new App\Services\ReportesMensualesScheduler();
    echo "   ✅ ReportesMensualesScheduler instanciado\n";
} catch (\Exception $e) {
    echo "   ❌ Error instanciando ReportesMensualesScheduler: " . $e->getMessage() . "\n";
    echo "   Stack: " . $e->getTraceAsString() . "\n";
}

// 7. Verificar conexión a base de datos
echo "\n7. Verificando conexión a base de datos...\n";
try {
    $db = App\Config\Database::getInstance();
    echo "   ✅ Conexión a BD exitosa\n";
    
    // Probar una query simple
    $stmt = $db->query('SELECT 1 as test');
    $result = $stmt->fetch();
    if ($result && $result['test'] == 1) {
        echo "   ✅ Query de prueba exitosa\n";
    }
} catch (\Exception $e) {
    echo "   ❌ Error de conexión a BD: " . $e->getMessage() . "\n";
}

// 8. Verificar que los scripts ejecutables existen
echo "\n8. Verificando scripts ejecutables...\n";
$scripts = [
    'run-evaluation-scheduler.php',
    'run-monthly-reports-scheduler.php'
];

foreach ($scripts as $script) {
    $path = __DIR__ . '/' . $script;
    if (file_exists($path)) {
        echo "   ✅ $script existe\n";
        if (is_readable($path)) {
            echo "      ✅ Es legible\n";
        } else {
            echo "      ⚠️  No es legible (verificar permisos)\n";
        }
    } else {
        echo "   ❌ $script NO existe\n";
    }
}

echo "\n" . str_repeat("=", 60) . "\n";
echo "DIAGNÓSTICO COMPLETADO\n";
echo str_repeat("=", 60) . "\n";
echo "\nSi hay errores, revisa:\n";
echo "1. Que todos los archivos se subieron correctamente\n";
echo "2. Que la estructura de carpetas es correcta\n";
echo "3. Que composer install se ejecutó en el servidor\n";
echo "4. Los logs de error de PHP (error_log)\n";

