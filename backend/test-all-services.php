<?php
/**
 * Script de diagnóstico para verificar que todos los servicios funcionan correctamente
 */

require_once __DIR__ . '/vendor/autoload.php';

// Cargar variables de entorno
$envFile = __DIR__ . '/api/.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            $value = trim($value, '"\'');
            $_ENV[$key] = $value;
        }
    }
}

echo "=== DIAGNÓSTICO DE SERVICIOS ===\n\n";

$errors = [];
$warnings = [];

// 1. Verificar conexión a base de datos
echo "1. Verificando conexión a base de datos...\n";
try {
    use App\Config\Database;
    $db = Database::getInstance();
    echo "   ✅ Conexión a base de datos OK\n";
} catch (\Exception $e) {
    $errors[] = "Error de conexión a BD: " . $e->getMessage();
    echo "   ❌ Error: " . $e->getMessage() . "\n";
}

// 2. Verificar que EvaluationScheduler se puede instanciar
echo "\n2. Verificando EvaluationScheduler...\n";
try {
    use App\Services\EvaluationScheduler;
    $scheduler = new EvaluationScheduler();
    echo "   ✅ EvaluationScheduler instanciado correctamente\n";
} catch (\Exception $e) {
    $errors[] = "Error en EvaluationScheduler: " . $e->getMessage();
    echo "   ❌ Error: " . $e->getMessage() . "\n";
    echo "   Stack trace: " . $e->getTraceAsString() . "\n";
}

// 3. Verificar que ReportesMensualesScheduler se puede instanciar
echo "\n3. Verificando ReportesMensualesScheduler...\n";
try {
    use App\Services\ReportesMensualesScheduler;
    $reportScheduler = new ReportesMensualesScheduler();
    echo "   ✅ ReportesMensualesScheduler instanciado correctamente\n";
} catch (\Exception $e) {
    $errors[] = "Error en ReportesMensualesScheduler: " . $e->getMessage();
    echo "   ❌ Error: " . $e->getMessage() . "\n";
    echo "   Stack trace: " . $e->getTraceAsString() . "\n";
}

// 4. Verificar que EmailService tiene los nuevos métodos
echo "\n4. Verificando EmailService...\n";
try {
    use App\Services\EmailService;
    $emailService = new EmailService();
    
    $methods = ['sendEvaluationReminderEmail', 'sendEvaluationAutoClosedEmail', 
                'sendDailyEvaluationReminderEmail', 'sendTicketReturnedFromEscalationEmail'];
    
    foreach ($methods as $method) {
        if (method_exists($emailService, $method)) {
            echo "   ✅ Método $method existe\n";
        } else {
            $errors[] = "Método $method no existe en EmailService";
            echo "   ❌ Método $method NO existe\n";
        }
    }
} catch (\Exception $e) {
    $errors[] = "Error en EmailService: " . $e->getMessage();
    echo "   ❌ Error: " . $e->getMessage() . "\n";
}

// 5. Verificar que los scripts ejecutables existen
echo "\n5. Verificando scripts ejecutables...\n";
$scripts = [
    'run-evaluation-scheduler.php',
    'run-monthly-reports-scheduler.php'
];

foreach ($scripts as $script) {
    $path = __DIR__ . '/' . $script;
    if (file_exists($path)) {
        echo "   ✅ $script existe\n";
        if (!is_readable($path)) {
            $warnings[] = "$script no es legible";
            echo "   ⚠️  $script no es legible (verificar permisos)\n";
        }
    } else {
        $errors[] = "$script no existe";
        echo "   ❌ $script NO existe\n";
    }
}

// 6. Verificar sintaxis PHP de los archivos nuevos
echo "\n6. Verificando sintaxis PHP...\n";
$phpFiles = [
    'src/Services/EvaluationScheduler.php',
    'src/Services/ReportesMensualesScheduler.php',
    'src/Routes/TicketRoutes.php',
    'src/Services/EmailService.php',
    'src/Controllers/ReportesController.php'
];

foreach ($phpFiles as $file) {
    $path = __DIR__ . '/' . $file;
    if (file_exists($path)) {
        $output = [];
        $return = 0;
        exec("php -l " . escapeshellarg($path) . " 2>&1", $output, $return);
        if ($return === 0) {
            echo "   ✅ $file - Sintaxis OK\n";
        } else {
            $errors[] = "Error de sintaxis en $file";
            echo "   ❌ $file - Error de sintaxis:\n";
            foreach ($output as $line) {
                echo "      $line\n";
            }
        }
    } else {
        $errors[] = "$file no existe";
        echo "   ❌ $file NO existe\n";
    }
}

// Resumen
echo "\n" . str_repeat("=", 50) . "\n";
echo "RESUMEN:\n";
echo str_repeat("=", 50) . "\n";

if (empty($errors) && empty($warnings)) {
    echo "✅ TODO ESTÁ CORRECTO\n";
    exit(0);
}

if (!empty($warnings)) {
    echo "⚠️  ADVERTENCIAS:\n";
    foreach ($warnings as $warning) {
        echo "   - $warning\n";
    }
    echo "\n";
}

if (!empty($errors)) {
    echo "❌ ERRORES ENCONTRADOS:\n";
    foreach ($errors as $error) {
        echo "   - $error\n";
    }
    exit(1);
}

