<?php

namespace App\Routes;

use App\Config\Database;
use App\Middleware\AuthMiddleware;
use App\Controllers\ReportesController;

class ReportesRoutes
{
    private $router;
    private $db;
    private $reportesController;

    public function __construct($router)
    {
        $this->router = $router;
        $this->db = Database::getInstance();
        $this->reportesController = new ReportesController();
        $this->registerRoutes();
    }

    private function registerRoutes()
    {
        $this->router->addRoute('GET', '/reportes/gestion-servicios', [$this, 'getGestionServicios']);
        $this->router->addRoute('GET', '/reportes/mensuales', [$this, 'getReportesMensuales']);
        $this->router->addRoute('GET', '/reportes/mensuales/:id', [$this, 'getReporteMensualById']);
    }

    /**
     * Helper function to normalize dates
     */
    private function normalizarFecha($fecha)
    {
        if (!$fecha || $fecha === 'undefined' || $fecha === 'null' || trim($fecha) === '') {
            return null;
        }

        // If already in YYYY-MM-DD format, return as is
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
            return $fecha;
        }

        // Try to convert from DD/MM/YYYY or DD-MM-YYYY
        $partes = preg_split('/[\/-]/', $fecha);
        if (count($partes) === 3) {
            // If first element is > 12, probably already YYYY-MM-DD
            if ((int)$partes[0] > 12) {
                return $fecha;
            }
            // Convert DD/MM/YYYY or DD-MM-YYYY to YYYY-MM-DD
            $dia = str_pad($partes[0], 2, '0', STR_PAD_LEFT);
            $mes = str_pad($partes[1], 2, '0', STR_PAD_LEFT);
            $anio = $partes[2];
            return "$anio-$mes-$dia";
        }

        return $fecha;
    }

    /**
     * GET /api/reportes/gestion-servicios
     * Obtiene todos los KPIs de reportes de gestión de servicios
     * Query params: fechaInicio (YYYY-MM-DD), fechaFin (YYYY-MM-DD)
     */
    public function getGestionServicios()
    {
        $user = AuthMiddleware::authenticate();

        // Check admin permissions
        if ($user['rol'] !== 'administrador') {
            AuthMiddleware::sendError('Acceso denegado. Se requiere rol de administrador', 403);
        }

        try {
            $fechaInicio = $_GET['fechaInicio'] ?? null;
            $fechaFin = $_GET['fechaFin'] ?? null;

            error_log('📊 Generando reporte de gestión de servicios...');
            error_log('👤 Usuario: ' . $user['nombre']);
            error_log('📅 Fecha inicio (original): ' . ($fechaInicio ?? 'null'));
            error_log('📅 Fecha fin (original): ' . ($fechaFin ?? 'null'));

            // Normalize dates
            if (!$fechaInicio || trim($fechaInicio) === '' || $fechaInicio === 'undefined') {
                $fechaInicio = null;
            } else {
                $fechaInicio = $this->normalizarFecha($fechaInicio);
            }

            if (!$fechaFin || trim($fechaFin) === '' || $fechaFin === 'undefined') {
                $fechaFin = null;
            } else {
                $fechaFin = $this->normalizarFecha($fechaFin);
            }

            error_log('📅 Fecha inicio (normalizada): ' . ($fechaInicio ?? 'null'));
            error_log('📅 Fecha fin (normalizada): ' . ($fechaFin ?? 'null'));

            // Get complete reports
            $reportes = $this->reportesController->obtenerReportesCompletos($fechaInicio, $fechaFin);

            error_log('✅ Reporte generado exitosamente');
            AuthMiddleware::sendResponse($reportes);

        } catch (\Exception $e) {
            error_log('❌ Error generando reporte de gestión de servicios: ' . $e->getMessage());
            error_log('❌ Stack trace: ' . $e->getTraceAsString());
            AuthMiddleware::sendError('Error interno del servidor al generar reportes', 500);
        }
    }

    /**
     * GET /api/reportes/mensuales
     * Obtiene los reportes mensuales guardados
     */
    public function getReportesMensuales()
    {
        $user = AuthMiddleware::authenticate();

        // Check admin permissions
        if ($user['rol'] !== 'administrador') {
            AuthMiddleware::sendError('Acceso denegado. Se requiere rol de administrador', 403);
        }

        try {
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
            $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

            $reportes = $this->reportesController->obtenerReportesMensualesGuardados($limit, $offset);

            AuthMiddleware::sendResponse($reportes);

        } catch (\Exception $e) {
            error_log('❌ Error obteniendo reportes mensuales: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }

    /**
     * GET /api/reportes/mensuales/:id
     * Obtiene un reporte mensual específico por ID
     */
    public function getReporteMensualById($id)
    {
        $user = AuthMiddleware::authenticate();

        // Check admin permissions
        if ($user['rol'] !== 'administrador') {
            AuthMiddleware::sendError('Acceso denegado. Se requiere rol de administrador', 403);
        }

        try {
            $stmt = $this->db->query(
                'SELECT * FROM reportesmensuales WHERE id_reporte = ?',
                [$id]
            );

            $reporte = $stmt->fetch();

            if (!$reporte) {
                AuthMiddleware::sendError('Reporte no encontrado', 404);
            }

            AuthMiddleware::sendResponse($reporte);

        } catch (\Exception $e) {
            error_log('❌ Error obteniendo reporte mensual: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
}
