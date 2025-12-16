<?php

namespace App\Routes;

use App\Config\Database;
use App\Middleware\AuthMiddleware;

class ReportRoutes
{
    private $router;
    private $db;
    
    public function __construct($router)
    {
        $this->router = $router;
        $this->db = Database::getInstance();
        $this->registerRoutes();
    }
    
    private function registerRoutes()
    {
        $this->router->addRoute('GET', '/reports', [$this, 'getReports']);
        $this->router->addRoute('GET', '/reports/tickets', [$this, 'getTicketReports']);
        $this->router->addRoute('GET', '/reports/summary', [$this, 'getReportsSummary']);
    }
    
    public function getReports()
    {
        $user = AuthMiddleware::authenticate();
        
        try {
            // Report generation logic would go here
            AuthMiddleware::sendResponse(['reports' => []]);
        } catch (\Exception $e) {
            error_log('Error getting reports: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }

    /**
     * GET /api/reports/summary
     * Obtiene el resumen completo de reportes (compatibilidad con frontend)
     * Query params: fechaInicio (YYYY-MM-DD), fechaFin (YYYY-MM-DD)
     */
    public function getReportsSummary()
    {
        $user = AuthMiddleware::authenticate();

        // Check admin permissions
        if ($user['rol'] !== 'administrador') {
            AuthMiddleware::sendError('Acceso denegado. Se requiere rol de administrador', 403);
            return;
        }

        try {
            require_once __DIR__ . '/../Controllers/ReportesController.php';
            $reportesController = new \App\Controllers\ReportesController();

            $fechaInicio = $_GET['fechaInicio'] ?? null;
            $fechaFin = $_GET['fechaFin'] ?? null;

            error_log('📊 Generando reporte summary...');
            error_log('👤 Usuario: ' . $user['nombre']);
            error_log('📅 Fecha inicio: ' . ($fechaInicio ?? 'null'));
            error_log('📅 Fecha fin: ' . ($fechaFin ?? 'null'));

            // Normalize dates
            if (!$fechaInicio || trim($fechaInicio) === '' || $fechaInicio === 'undefined') {
                $fechaInicio = null;
            }

            if (!$fechaFin || trim($fechaFin) === '' || $fechaFin === 'undefined') {
                $fechaFin = null;
            }

            // Get complete reports
            try {
                $reportesRaw = $reportesController->obtenerReportesCompletos($fechaInicio, $fechaFin);
                
                if (!is_array($reportesRaw)) {
                    error_log('❌ obtenerReportesCompletos no devolvió un array válido');
                    $reportesRaw = [];
                }
            } catch (\Exception $e) {
                error_log('❌ Error en obtenerReportesCompletos: ' . $e->getMessage());
                error_log('❌ Stack trace: ' . $e->getTraceAsString());
                // Usar valores por defecto si falla
                $reportesRaw = [
                    'ticketsSolicitados' => 0,
                    'ticketsAtendidos' => 0,
                    'ticketsAsignados' => 0,
                    'ticketsPendientes' => 0,
                    'ticketsSinCerrar' => 0,
                    'ticketsCerradosPorSistema' => 0,
                    'ticketsEscalados' => 0,
                    'ticketsTardios' => 0,
                    'ticketsReabiertos' => 0,
                    'evaluacionesTardias' => 0,
                    'satisfaccionPromedio' => 0,
                    'ticketsPorSemana' => [0, 0, 0, 0],
                    'cumplimientoSLA' => 0,
                    'mttr' => ['horas' => 0, 'minutos' => 0],
                    'mtta' => ['minutos' => 0],
                    'actualizacionesEstado' => ['porcentaje' => 0]
                ];
            }

            // Transformar la respuesta al formato que espera el frontend
            // El frontend espera: { summary: {...}, distribucionEstado: [...], rendimientoTecnico: [...] }
            
            // 1. Obtener distribución de estados
            $condicionesFecha = $fechaInicio && $fechaFin
                ? 'WHERE CAST(fecha_creacion AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)'
                : '';
            $paramsFecha = $fechaInicio && $fechaFin ? [$fechaInicio, $fechaFin] : [];
            
            $distribucionEstado = [];
            try {
                $stmtEstados = $this->db->query(
                    "SELECT estatus as estado, COUNT(*) as cantidad 
                     FROM tickets 
                     $condicionesFecha
                     GROUP BY estatus",
                    $paramsFecha
                );
                $estadosRaw = $stmtEstados->fetchAll();
                $totalEstados = array_sum(array_column($estadosRaw, 'cantidad'));
                
                foreach ($estadosRaw as $estado) {
                    $distribucionEstado[] = [
                        'estado' => $estado['estado'],
                        'cantidad' => (int)$estado['cantidad'],
                        'porcentaje' => $totalEstados > 0 ? round(((int)$estado['cantidad'] / $totalEstados) * 100, 1) : 0
                    ];
                }
            } catch (\Exception $e) {
                error_log('⚠️ Error obteniendo distribución de estados: ' . $e->getMessage());
                // Continuar con array vacío
                $distribucionEstado = [];
            }

            // 2. Obtener rendimiento de técnicos
            $rendimientoTecnico = [];
            try {
                $rendimientoQuery = $fechaInicio && $fechaFin
                    ? "SELECT 
                         u.id_usuario,
                         u.nombre,
                         COUNT(DISTINCT t.id_ticket) as ticketsAsignados,
                         COUNT(DISTINCT CASE WHEN t.estatus IN ('Finalizado', 'Cerrado') THEN t.id_ticket END) as ticketsResueltos,
                         COUNT(DISTINCT CASE WHEN t.estatus IN ('Abierto', 'En Progreso', 'Pendiente') THEN t.id_ticket END) as ticketsPendientes,
                         COUNT(DISTINCT CASE WHEN EXISTS (SELECT 1 FROM escalamientos e WHERE e.id_ticket = t.id_ticket) THEN t.id_ticket END) as ticketsEscalados,
                         COUNT(DISTINCT CASE WHEN EXISTS (SELECT 1 FROM ticketreaperturas tr WHERE tr.id_ticket = t.id_ticket) THEN t.id_ticket END) as ticketsReabiertos,
                         AVG(eva.calificacion) as calificacionPromedio
                       FROM usuarios u
                       LEFT JOIN tickets t ON u.id_usuario = t.id_tecnico
                         AND CAST(t.fecha_creacion AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
                       LEFT JOIN evaluaciones eva ON t.id_ticket = eva.id_ticket
                       WHERE u.rol IN ('tecnico', 'administrador')
                       GROUP BY u.id_usuario, u.nombre
                       HAVING ticketsAsignados > 0
                       ORDER BY ticketsResueltos DESC"
                    : "SELECT 
                         u.id_usuario,
                         u.nombre,
                         COUNT(DISTINCT t.id_ticket) as ticketsAsignados,
                         COUNT(DISTINCT CASE WHEN t.estatus IN ('Finalizado', 'Cerrado') THEN t.id_ticket END) as ticketsResueltos,
                         COUNT(DISTINCT CASE WHEN t.estatus IN ('Abierto', 'En Progreso', 'Pendiente') THEN t.id_ticket END) as ticketsPendientes,
                         COUNT(DISTINCT CASE WHEN EXISTS (SELECT 1 FROM escalamientos e WHERE e.id_ticket = t.id_ticket) THEN t.id_ticket END) as ticketsEscalados,
                         COUNT(DISTINCT CASE WHEN EXISTS (SELECT 1 FROM ticketreaperturas tr WHERE tr.id_ticket = t.id_ticket) THEN t.id_ticket END) as ticketsReabiertos,
                         AVG(eva.calificacion) as calificacionPromedio
                       FROM usuarios u
                       LEFT JOIN tickets t ON u.id_usuario = t.id_tecnico
                       LEFT JOIN evaluaciones eva ON t.id_ticket = eva.id_ticket
                       WHERE u.rol IN ('tecnico', 'administrador')
                       GROUP BY u.id_usuario, u.nombre
                       HAVING ticketsAsignados > 0
                       ORDER BY ticketsResueltos DESC";
                
                $stmtRendimiento = $this->db->query($rendimientoQuery, $paramsFecha);
                $rendimientoRaw = $stmtRendimiento->fetchAll();
                
                foreach ($rendimientoRaw as $tech) {
                    $rendimientoTecnico[] = [
                        'idUsuario' => (int)$tech['id_usuario'],
                        'nombre' => $tech['nombre'],
                        'ticketsAsignados' => (int)$tech['ticketsAsignados'],
                        'ticketsResueltos' => (int)$tech['ticketsResueltos'],
                        'ticketsPendientes' => (int)($tech['ticketsPendientes'] ?? 0),
                        'ticketsEscalados' => (int)($tech['ticketsEscalados'] ?? 0),
                        'ticketsReabiertos' => (int)($tech['ticketsReabiertos'] ?? 0),
                        'calificacionPromedio' => $tech['calificacionPromedio'] ? round((float)$tech['calificacionPromedio'], 1) : 0
                    ];
                }
            } catch (\Exception $e) {
                error_log('⚠️ Error obteniendo rendimiento de técnicos: ' . $e->getMessage());
                // Continuar con array vacío
                $rendimientoTecnico = [];
            }

            // 3. Obtener distribución de servicios
            $distribucionServicio = [];
            try {
                $distribucionQuery = $fechaInicio && $fechaFin
                    ? "SELECT 
                         CONCAT(s.categoria, ' - ', s.subcategoria) as tipoServicio,
                         COUNT(*) as total
                       FROM tickets t
                       JOIN servicios s ON t.id_servicio = s.id_servicio
                       WHERE CAST(t.fecha_creacion AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
                       GROUP BY s.categoria, s.subcategoria
                       ORDER BY total DESC"
                    : "SELECT 
                         CONCAT(s.categoria, ' - ', s.subcategoria) as tipoServicio,
                         COUNT(*) as total
                       FROM tickets t
                       JOIN servicios s ON t.id_servicio = s.id_servicio
                       GROUP BY s.categoria, s.subcategoria
                       ORDER BY total DESC";
                
                $stmtServicios = $this->db->query($distribucionQuery, $paramsFecha);
                $serviciosRaw = $stmtServicios->fetchAll();
                
                foreach ($serviciosRaw as $servicio) {
                    $distribucionServicio[] = [
                        'tipoServicio' => $servicio['tipoServicio'],
                        'total' => (int)$servicio['total']
                    ];
                }
            } catch (\Exception $e) {
                error_log('⚠️ Error obteniendo distribución de servicios: ' . $e->getMessage());
                // Continuar con array vacío
                $distribucionServicio = [];
            }

            // 3.5. Obtener distribución de evaluaciones
            $distribucionEvaluaciones = ['1' => 0, '2' => 0, '3' => 0, '4' => 0, '5' => 0];
            try {
                $evalQuery = $fechaInicio && $fechaFin
                    ? "SELECT calificacion, COUNT(*) as cantidad 
                       FROM evaluaciones 
                       WHERE DATE(fecha_evaluacion) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
                       GROUP BY calificacion"
                    : "SELECT calificacion, COUNT(*) as cantidad 
                       FROM evaluaciones 
                       GROUP BY calificacion";
                
                $stmtEval = $this->db->query($evalQuery, $paramsFecha);
                $evalRaw = $stmtEval->fetchAll();
                
                foreach ($evalRaw as $eval) {
                    $calificacion = (string)$eval['calificacion'];
                    if (isset($distribucionEvaluaciones[$calificacion])) {
                        $distribucionEvaluaciones[$calificacion] = (int)$eval['cantidad'];
                    }
                }
            } catch (\Exception $e) {
                error_log('⚠️ Error obteniendo distribución de evaluaciones: ' . $e->getMessage());
                // Continuar con valores por defecto
                $distribucionEvaluaciones = ['1' => 0, '2' => 0, '3' => 0, '4' => 0, '5' => 0];
            }

            // 4. Transformar summary al formato esperado por el frontend
            $mttrHoras = 0;
            $mttrMinutos = 0;
            if (isset($reportesRaw['mttr']) && is_array($reportesRaw['mttr'])) {
                $mttrHoras = $reportesRaw['mttr']['horas'] ?? 0;
                $mttrMinutos = $reportesRaw['mttr']['minutos'] ?? 0;
            }

            $mttaMinutos = 0;
            if (isset($reportesRaw['mtta']) && is_array($reportesRaw['mtta'])) {
                $mttaMinutos = $reportesRaw['mtta']['minutos'] ?? 0;
            }

            $porcentajeActualizaciones = 0;
            if (isset($reportesRaw['actualizacionesEstado']) && is_array($reportesRaw['actualizacionesEstado'])) {
                $porcentajeActualizaciones = $reportesRaw['actualizacionesEstado']['porcentaje'] ?? 0;
            }

            $summary = [
                'ticketsSolicitados' => $reportesRaw['ticketsSolicitados'] ?? 0,
                'ticketsAtendidos' => $reportesRaw['ticketsAtendidos'] ?? 0,
                'ticketsAsignados' => $reportesRaw['ticketsAsignados'] ?? 0,
                'ticketsPendientes' => $reportesRaw['ticketsPendientes'] ?? 0,
                'ticketsSinCerrar' => $reportesRaw['ticketsSinCerrar'] ?? 0,
                'ticketsCerradosPorSistema' => $reportesRaw['ticketsCerradosPorSistema'] ?? 0,
                'ticketsEscalados' => $reportesRaw['ticketsEscalados'] ?? 0,
                'ticketsTardios' => $reportesRaw['ticketsTardios'] ?? 0,
                'ticketsReabiertos' => $reportesRaw['ticketsReabiertos'] ?? 0,
                'evaluacionesTardias' => $reportesRaw['evaluacionesTardias'] ?? 0,
                'satisfaccionPromedio' => $reportesRaw['satisfaccionPromedio'] ?? 0,
                'ticketsPorSemana' => $reportesRaw['ticketsPorSemana'] ?? [0, 0, 0, 0],
                'mttrHoras' => $mttrHoras,
                'mttrMinutos' => $mttrMinutos,
                'mttaMinutos' => $mttaMinutos,
                'cumplimientoSLA' => $reportesRaw['cumplimientoSLA'] ?? 0,
                'porcentajeActualizaciones' => $porcentajeActualizaciones,
                'distribucionEvaluaciones' => $distribucionEvaluaciones
            ];

            // 5. Construir respuesta final en el formato esperado por el frontend
            $response = [
                'summary' => $summary,
                'distribucionEstado' => $distribucionEstado,
                'rendimientoTecnico' => $rendimientoTecnico,
                'distribucionServicio' => $distribucionServicio
            ];

            error_log('✅ Reporte summary generado exitosamente');
            AuthMiddleware::sendResponse($response);

        } catch (\Exception $e) {
            error_log('❌ Error generando reporte summary: ' . $e->getMessage());
            error_log('❌ Stack trace: ' . $e->getTraceAsString());
            AuthMiddleware::sendError('Error interno del servidor al generar reportes', 500);
        }
    }
    
    public function getTicketReports()
    {
        $user = AuthMiddleware::authenticate();
        
        try {
            $stmt = $this->db->query(
                'SELECT COUNT(*) as total, estatus 
                 FROM tickets 
                 GROUP BY estatus'
            );
            
            $reports = $stmt->fetchAll();
            AuthMiddleware::sendResponse($reports);
        } catch (\Exception $e) {
            error_log('Error getting ticket reports: ' . $e->getMessage());
            AuthMiddleware::sendError('Error interno del servidor', 500);
        }
    }
}
