<?php
/**
 * Script para ejecutar el scheduler de evaluaciones
 * Este script debe ejecutarse periódicamente mediante cron job
 * 
 * Ejemplo de cron job (cada hora):
 * 0 * * * * /usr/bin/php /ruta/al/proyecto/backend/run-evaluation-scheduler.php
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

use App\Services\EvaluationScheduler;

try {
    error_log("🔄 Iniciando scheduler de evaluaciones: " . date('Y-m-d H:i:s'));
    
    $scheduler = new EvaluationScheduler();
    $result = $scheduler->processEvaluationReminders();
    
    if ($result['success']) {
        error_log("✅ Scheduler completado exitosamente:");
        error_log("   - Recordatorios enviados: " . $result['remindersSent']);
        error_log("   - Tickets cerrados automáticamente: " . $result['autoClosed']);
        error_log("   - Correos diarios enviados: " . $result['dailyRemindersSent']);
    } else {
        error_log("❌ Error en scheduler: " . ($result['error'] ?? 'Error desconocido'));
        exit(1);
    }
} catch (\Exception $e) {
    error_log("❌ Error fatal en scheduler: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    exit(1);
}

