<?php
/**
 * Script para ejecutar el scheduler de reportes mensuales
 * Este script debe ejecutarse el día 1 de cada mes a las 00:00 mediante cron job
 * 
 * Ejemplo de cron job (día 1 de cada mes a las 00:00):
 * 0 0 1 * * /usr/bin/php /ruta/al/proyecto/backend/run-monthly-reports-scheduler.php
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

use App\Services\ReportesMensualesScheduler;

try {
    error_log("📅 Iniciando generación de reporte mensual: " . date('Y-m-d H:i:s'));
    
    $scheduler = new ReportesMensualesScheduler();
    $result = $scheduler->generarReporteMensual();
    
    if ($result['success']) {
        error_log("✅ Reporte mensual generado exitosamente:");
        error_log("   - ID Reporte: " . $result['idReporte']);
        error_log("   - Período: " . $result['fechaInicio'] . " a " . $result['fechaFin']);
        error_log("   - Tickets solicitados: " . ($result['datosReporte']['ticketsSolicitados'] ?? 0));
    } else {
        error_log("❌ Error generando reporte mensual: " . ($result['error'] ?? 'Error desconocido'));
        exit(1);
    }
} catch (\Exception $e) {
    error_log("❌ Error fatal en scheduler de reportes: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    exit(1);
}

