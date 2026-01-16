<?php

namespace App\Services;

use App\Config\Database;
use App\Controllers\ReportesController;

/**
 * Scheduler para generar reportes mensuales automáticamente
 */
class ReportesMensualesScheduler
{
    private $db;
    private $reportesController;
    
    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->reportesController = new ReportesController();
    }
    
    /**
     * Genera un reporte mensual para el mes anterior
     */
    public function generarReporteMensual()
    {
        try {
            error_log('📅 Iniciando generación de reporte mensual automático...');
            
            // Obtener el primer día del mes anterior
            $ahora = new \DateTime();
            $mesAnterior = new \DateTime();
            $mesAnterior->modify('-1 month');
            $mesAnterior->modify('first day of this month');
            
            $ultimoDiaMesAnterior = new \DateTime();
            $ultimoDiaMesAnterior->modify('-1 month');
            $ultimoDiaMesAnterior->modify('last day of this month');
            
            $fechaInicio = $mesAnterior->format('Y-m-d');
            $fechaFin = $ultimoDiaMesAnterior->format('Y-m-d');
            
            error_log("📊 Generando reporte para el período: $fechaInicio a $fechaFin");
            
            // Verificar que la tabla existe
            $this->reportesController->crearTablaReportesMensuales();
            
            // Obtener todos los datos del reporte
            $datosReporte = $this->reportesController->obtenerReportesCompletos($fechaInicio, $fechaFin);
            
            // Guardar el reporte en la base de datos
            $idReporte = $this->reportesController->guardarReporteMensual(
                $datosReporte,
                $fechaInicio,
                $fechaFin,
                null // null porque es generado automáticamente
            );
            
            error_log("✅ Reporte mensual generado exitosamente con ID: $idReporte");
            error_log("📊 Período: $fechaInicio a $fechaFin");
            error_log("📈 Tickets solicitados: " . ($datosReporte['ticketsSolicitados'] ?? 0));
            error_log("⭐ Satisfacción promedio: " . ($datosReporte['satisfaccionPromedio'] ?? 'N/A'));
            
            return [
                'success' => true,
                'idReporte' => $idReporte,
                'fechaInicio' => $fechaInicio,
                'fechaFin' => $fechaFin,
                'datosReporte' => $datosReporte
            ];
        } catch (\Exception $e) {
            error_log('❌ Error generando reporte mensual automático: ' . $e->getMessage());
            error_log('Stack trace: ' . $e->getTraceAsString());
            
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
    
    /**
     * Genera un reporte mensual manualmente (útil para testing)
     */
    public function generarReporteMensualManual($fechaInicio, $fechaFin, $idUsuario = null)
    {
        try {
            error_log("📊 Generando reporte mensual manual para: $fechaInicio a $fechaFin");
            
            // Verificar que la tabla existe
            $this->reportesController->crearTablaReportesMensuales();
            
            $datosReporte = $this->reportesController->obtenerReportesCompletos($fechaInicio, $fechaFin);
            $idReporte = $this->reportesController->guardarReporteMensual(
                $datosReporte,
                $fechaInicio,
                $fechaFin,
                $idUsuario
            );
            
            error_log("✅ Reporte mensual manual generado con ID: $idReporte");
            return [
                'success' => true,
                'idReporte' => $idReporte,
                'fechaInicio' => $fechaInicio,
                'fechaFin' => $fechaFin,
                'datosReporte' => $datosReporte
            ];
        } catch (\Exception $e) {
            error_log('❌ Error generando reporte mensual manual: ' . $e->getMessage());
            throw $e;
        }
    }
}

