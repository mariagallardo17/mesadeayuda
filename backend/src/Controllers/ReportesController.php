<?php

namespace App\Controllers;

use App\Config\Database;

class ReportesController
{
    private $db;
    
    public function __construct()
    {
        $this->db = Database::getInstance();
    }
    
    /**
     * Obtiene todos los KPIs de reportes en un solo objeto optimizado
     * @param string|null $fechaInicio - Fecha de inicio en formato YYYY-MM-DD
     * @param string|null $fechaFin - Fecha de fin en formato YYYY-MM-DD
     * @return array Objeto con todos los KPIs
     */
    public function obtenerReportesCompletos($fechaInicio = null, $fechaFin = null)
    {
        try {
            error_log('📊 Generando reportes completos...');
            error_log('📅 Fecha inicio: ' . ($fechaInicio ?? 'null'));
            error_log('📅 Fecha fin: ' . ($fechaFin ?? 'null'));

            // Construir condiciones de fecha
            $condicionesFecha = $fechaInicio && $fechaFin
                ? 'WHERE CAST(t.fecha_creacion AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)'
                : '';
            $paramsFecha = $fechaInicio && $fechaFin ? [$fechaInicio, $fechaFin] : [];

            // 1. Tickets solicitados
            $stmt = $this->db->query(
                "SELECT COUNT(*) as count FROM tickets $condicionesFecha",
                $paramsFecha
            );
            $ticketsSolicitados = (int)$stmt->fetch()['count'];

            // 2. Tickets atendidos (con técnico asignado y en progreso/finalizado/cerrado)
            $whereClause = $condicionesFecha ? $condicionesFecha . ' AND' : 'WHERE';
            $stmt = $this->db->query(
                "SELECT COUNT(*) as count FROM tickets 
                 $whereClause 
                 id_tecnico IS NOT NULL 
                 AND estatus IN ('En Progreso', 'Finalizado', 'Cerrado')",
                $paramsFecha
            );
            $ticketsAtendidos = (int)$stmt->fetch()['count'];

            // 3. Tickets cerrados por el sistema
            $stmt = $this->db->query(
                "SELECT COUNT(*) as count FROM tickets 
                 $whereClause 
                 estatus = 'Cerrado' 
                 AND COALESCE(evaluacion_cierre_automatico, 0) = 1",
                $paramsFecha
            );
            $ticketsCerradosPorSistema = (int)$stmt->fetch()['count'];

            // 4. Tickets asignados
            $stmt = $this->db->query(
                "SELECT COUNT(*) as count FROM tickets 
                 $whereClause 
                 id_tecnico IS NOT NULL",
                $paramsFecha
            );
            $ticketsAsignados = (int)$stmt->fetch()['count'];

            // 5. Tickets pendientes (sin filtro de fecha - estado actual)
            $stmt = $this->db->query(
                "SELECT COUNT(*) as count FROM tickets 
                 WHERE estatus IN ('Abierto', 'En Progreso', 'Pendiente')"
            );
            $ticketsPendientes = (int)$stmt->fetch()['count'];

            // 6. Tickets sin cerrar (finalizados pero sin fecha_cierre)
            $stmt = $this->db->query(
                "SELECT COUNT(*) as count FROM tickets 
                 $whereClause 
                 estatus = 'Finalizado' 
                 AND fecha_cierre IS NULL",
                $paramsFecha
            );
            $ticketsSinCerrar = (int)$stmt->fetch()['count'];

            // 7. Tickets escalados
            $fechaConditionEscalamiento = $fechaInicio && $fechaFin
                ? 'WHERE CAST(e.fecha_escalamiento AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)'
                : '';
            $stmt = $this->db->query(
                "SELECT COUNT(DISTINCT e.id_ticket) as count 
                 FROM escalamientos e
                 $fechaConditionEscalamiento",
                $paramsFecha
            );
            $ticketsEscalados = (int)$stmt->fetch()['count'];

            // 8. Tickets tardíos
            $whereClauseTardios = $condicionesFecha ? 'WHERE CAST(t.fecha_cierre AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) AND' : 'WHERE';
            $stmt = $this->db->query(
                "SELECT COUNT(*) as count
                 FROM tickets t
                 INNER JOIN servicios s ON t.id_servicio = s.id_servicio
                 $whereClauseTardios
                 t.fecha_cierre IS NOT NULL
                 AND t.estatus IN ('Finalizado', 'Cerrado')
                 AND s.tiempo_objetivo IS NOT NULL
                 AND (
                   (s.tiempo_objetivo LIKE '%días%' OR s.tiempo_objetivo LIKE '%dias%' OR s.tiempo_objetivo LIKE '%día%' OR s.tiempo_objetivo LIKE '%dia%')
                   AND TIMESTAMPDIFF(MINUTE, t.fecha_creacion, t.fecha_cierre) > (CAST(SUBSTRING_INDEX(s.tiempo_objetivo, ' ', 1) AS UNSIGNED) * 24 * 60)
                   OR
                   (s.tiempo_objetivo LIKE '%:%')
                   AND TIMESTAMPDIFF(MINUTE, t.fecha_creacion, t.fecha_cierre) > (TIME_TO_SEC(CAST(s.tiempo_objetivo AS TIME)) / 60)
                   OR
                   (CAST(s.tiempo_objetivo AS UNSIGNED) > 0)
                   AND TIMESTAMPDIFF(MINUTE, t.fecha_creacion, t.fecha_cierre) > CAST(s.tiempo_objetivo AS UNSIGNED)
                 )",
                $paramsFecha
            );
            $ticketsTardios = (int)$stmt->fetch()['count'];

            // 9. Tickets reabiertos
            $fechaConditionReapertura = $fechaInicio && $fechaFin
                ? 'WHERE CAST(tr.fecha_reapertura AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)'
                : '';
            $stmt = $this->db->query(
                "SELECT COUNT(DISTINCT tr.id_ticket) as count
                 FROM ticketreaperturas tr
                 $fechaConditionReapertura",
                $paramsFecha
            );
            $ticketsReabiertos = (int)$stmt->fetch()['count'];

            // 10. Evaluaciones tardías
            $whereClauseEval = $condicionesFecha ? 'WHERE CAST(COALESCE(t.fecha_finalizacion, t.fecha_cierre) AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) AND' : 'WHERE';
            $stmt = $this->db->query(
                "SELECT COUNT(*) as count
                 FROM tickets t
                 LEFT JOIN evaluaciones e ON t.id_ticket = e.id_ticket
                 $whereClauseEval
                 (t.estatus = 'Finalizado' OR (t.estatus = 'Cerrado' AND COALESCE(t.evaluacion_cierre_automatico, 0) = 1))
                 AND e.id_evaluacion IS NULL
                 AND COALESCE(t.fecha_finalizacion, t.fecha_cierre) IS NOT NULL
                 AND DATE(COALESCE(t.fecha_finalizacion, t.fecha_cierre)) < DATE_SUB(NOW(), INTERVAL 2 DAY)",
                $paramsFecha
            );
            $evaluacionesTardias = (int)$stmt->fetch()['count'];

            // 11. Satisfacción promedio
            $satisfaccionQuery = $fechaInicio && $fechaFin
                ? 'SELECT AVG(calificacion) as promedio FROM Evaluaciones WHERE DATE(fecha_evaluacion) BETWEEN ? AND ?'
                : 'SELECT AVG(calificacion) as promedio FROM Evaluaciones';
            $stmt = $this->db->query($satisfaccionQuery, $paramsFecha);
            $satisfaccionResult = $stmt->fetch();
            $satisfaccionPromedio = $satisfaccionResult['promedio'] 
                ? round((float)$satisfaccionResult['promedio'], 1) 
                : 0;

            // 12. MTTR (Mean Time To Resolution)
            $mttrQuery = $fechaInicio && $fechaFin
                ? "SELECT AVG(TIMESTAMPDIFF(MINUTE, fecha_creacion, COALESCE(fecha_cierre, fecha_finalizacion))) as promedio_minutos
                   FROM Tickets
                   WHERE estatus IN ('Finalizado', 'Cerrado')
                   AND fecha_cierre IS NOT NULL
                   AND CAST(fecha_cierre AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)"
                : "SELECT AVG(TIMESTAMPDIFF(MINUTE, fecha_creacion, COALESCE(fecha_cierre, fecha_finalizacion))) as promedio_minutos
                   FROM Tickets
                   WHERE estatus IN ('Finalizado', 'Cerrado')
                   AND fecha_cierre IS NOT NULL";
            $stmt = $this->db->query($mttrQuery, $paramsFecha);
            $mttrResult = $stmt->fetch();
            $promedioMinutos = $mttrResult['promedio_minutos'] ?? 0;
            $mttrHoras = floor($promedioMinutos / 60);
            $mttrMinutos = round($promedioMinutos % 60);

            // 13. MTTA (Mean Time To Acknowledge)
            $mttaQuery = $fechaInicio && $fechaFin
                ? "SELECT AVG(TIMESTAMPDIFF(MINUTE, fecha_creacion, COALESCE(fecha_asignacion, fecha_inicio_atencion, fecha_creacion))) as promedio_minutos
                   FROM Tickets
                   WHERE id_tecnico IS NOT NULL
                   AND (fecha_asignacion IS NOT NULL OR fecha_inicio_atencion IS NOT NULL)
                   AND CAST(fecha_creacion AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)"
                : "SELECT AVG(TIMESTAMPDIFF(MINUTE, fecha_creacion, COALESCE(fecha_asignacion, fecha_inicio_atencion, fecha_creacion))) as promedio_minutos
                   FROM Tickets
                   WHERE id_tecnico IS NOT NULL
                   AND (fecha_asignacion IS NOT NULL OR fecha_inicio_atencion IS NOT NULL)";
            $stmt = $this->db->query($mttaQuery, $paramsFecha);
            $mttaResult = $stmt->fetch();
            $mttaMinutos = $mttaResult['promedio_minutos'] 
                ? round((float)$mttaResult['promedio_minutos']) 
                : 0;

            // 14. Cumplimiento de SLA
            $slaQuery = $fechaInicio && $fechaFin
                ? "SELECT
                     COUNT(*) as total,
                     SUM(CASE
                       WHEN s.tiempo_objetivo IS NOT NULL AND
                            (
                              (s.tiempo_objetivo LIKE '%días%' OR s.tiempo_objetivo LIKE '%dias%' OR s.tiempo_objetivo LIKE '%día%' OR s.tiempo_objetivo LIKE '%dia%')
                              AND TIMESTAMPDIFF(MINUTE, t.fecha_creacion, t.fecha_cierre) <= (CAST(SUBSTRING_INDEX(s.tiempo_objetivo, ' ', 1) AS UNSIGNED) * 24 * 60)
                              OR
                              (s.tiempo_objetivo LIKE '%:%')
                              AND TIMESTAMPDIFF(MINUTE, t.fecha_creacion, t.fecha_cierre) <= (TIME_TO_SEC(CAST(s.tiempo_objetivo AS TIME)) / 60)
                              OR
                              (CAST(s.tiempo_objetivo AS UNSIGNED) > 0)
                              AND TIMESTAMPDIFF(MINUTE, t.fecha_creacion, t.fecha_cierre) <= CAST(s.tiempo_objetivo AS UNSIGNED)
                            )
                       THEN 1 ELSE 0
                     END) as cumplidos
                   FROM tickets t
                   INNER JOIN servicios s ON t.id_servicio = s.id_servicio
                   WHERE t.estatus IN ('Finalizado', 'Cerrado')
                   AND t.fecha_cierre IS NOT NULL
                   AND s.tiempo_objetivo IS NOT NULL
                   AND CAST(t.fecha_cierre AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)"
                : "SELECT
                     COUNT(*) as total,
                     SUM(CASE
                       WHEN s.tiempo_objetivo IS NOT NULL AND
                            (
                              (s.tiempo_objetivo LIKE '%días%' OR s.tiempo_objetivo LIKE '%dias%' OR s.tiempo_objetivo LIKE '%día%' OR s.tiempo_objetivo LIKE '%dia%')
                              AND TIMESTAMPDIFF(MINUTE, t.fecha_creacion, t.fecha_cierre) <= (CAST(SUBSTRING_INDEX(s.tiempo_objetivo, ' ', 1) AS UNSIGNED) * 24 * 60)
                              OR
                              (s.tiempo_objetivo LIKE '%:%')
                              AND TIMESTAMPDIFF(MINUTE, t.fecha_creacion, t.fecha_cierre) <= (TIME_TO_SEC(CAST(s.tiempo_objetivo AS TIME)) / 60)
                              OR
                              (CAST(s.tiempo_objetivo AS UNSIGNED) > 0)
                              AND TIMESTAMPDIFF(MINUTE, t.fecha_creacion, t.fecha_cierre) <= CAST(s.tiempo_objetivo AS UNSIGNED)
                            )
                       THEN 1 ELSE 0
                     END) as cumplidos
                   FROM tickets t
                   INNER JOIN servicios s ON t.id_servicio = s.id_servicio
                   WHERE t.estatus IN ('Finalizado', 'Cerrado')
                   AND t.fecha_cierre IS NOT NULL
                   AND s.tiempo_objetivo IS NOT NULL";
            $stmt = $this->db->query($slaQuery, $paramsFecha);
            $slaResult = $stmt->fetch();
            $totalSLA = (int)$slaResult['total'];
            $cumplidosSLA = (int)$slaResult['cumplidos'];
            $cumplimientoSLA = $totalSLA > 0 
                ? round(($cumplidosSLA / $totalSLA) * 100, 1) 
                : 0;

            // 15. Actualizaciones de estado
            $actualizacionesQuery = $fechaInicio && $fechaFin
                ? "SELECT COUNT(*) as count
                   FROM Tickets
                   $condicionesFecha
                   AND estatus != 'Abierto'"
                : "SELECT COUNT(*) as count
                   FROM Tickets
                   WHERE estatus != 'Abierto'";
            $stmt = $this->db->query($actualizacionesQuery, $paramsFecha);
            $actualizaciones = (int)$stmt->fetch()['count'];
            $porcentajeActualizaciones = $ticketsSolicitados > 0
                ? round(($actualizaciones / $ticketsSolicitados) * 100, 1)
                : 0;

            // 16. Tickets por semana (últimas 4 semanas del período)
            $ticketsPorSemana = [0, 0, 0, 0];
            try {
                $semanasQuery = $fechaInicio && $fechaFin
                    ? "SELECT
                         WEEK(fecha_creacion, 1) - WEEK(CAST(? AS DATE), 1) + 1 as semana,
                         COUNT(*) as cantidad
                       FROM Tickets
                       WHERE CAST(fecha_creacion AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
                       GROUP BY WEEK(fecha_creacion, 1)
                       ORDER BY semana
                       LIMIT 4"
                    : "SELECT
                         WEEK(fecha_creacion, 1) as semana,
                         COUNT(*) as cantidad
                       FROM Tickets
                       WHERE fecha_creacion >= DATE_SUB(NOW(), INTERVAL 4 WEEK)
                       GROUP BY WEEK(fecha_creacion, 1)
                       ORDER BY semana DESC
                       LIMIT 4";
                
                $semanasParams = $fechaInicio && $fechaFin ? [$fechaInicio, $fechaInicio, $fechaFin] : [];
                $stmt = $this->db->query($semanasQuery, $semanasParams);
                $semanasResult = $stmt->fetchAll();
                
                foreach ($semanasResult as $index => $row) {
                    if ($index < 4) {
                        $ticketsPorSemana[$index] = (int)$row['cantidad'];
                    }
                }
            } catch (\Exception $e) {
                error_log('⚠️ Error calculando tickets por semana: ' . $e->getMessage());
            }

            // Preparar respuesta
            $reportes = [
                'ticketsSolicitados' => $ticketsSolicitados,
                'ticketsAtendidos' => $ticketsAtendidos,
                'ticketsCerradosPorSistema' => $ticketsCerradosPorSistema,
                'ticketsAsignados' => $ticketsAsignados,
                'ticketsPendientes' => $ticketsPendientes,
                'ticketsSinCerrar' => $ticketsSinCerrar,
                'ticketsEscalados' => $ticketsEscalados,
                'ticketsTardios' => $ticketsTardios,
                'ticketsReabiertos' => $ticketsReabiertos,
                'evaluacionesTardias' => $evaluacionesTardias,
                'satisfaccionPromedio' => $satisfaccionPromedio,
                'mttr' => [
                    'horas' => (int)$mttrHoras,
                    'minutos' => (int)$mttrMinutos,
                    'totalMinutos' => (float)$promedioMinutos
                ],
                'mtta' => [
                    'minutos' => (int)$mttaMinutos
                ],
                'cumplimientoSLA' => $cumplimientoSLA,
                'actualizacionesEstado' => [
                    'cantidad' => $actualizaciones,
                    'porcentaje' => $porcentajeActualizaciones
                ],
                'ticketsPorSemana' => $ticketsPorSemana,
                'periodoConsultado' => [
                    'fechaInicio' => $fechaInicio,
                    'fechaFin' => $fechaFin
                ]
            ];

            error_log('✅ Reportes generados exitosamente');
            return $reportes;

        } catch (\Exception $e) {
            error_log('❌ Error generando reportes: ' . $e->getMessage());
            throw $e;
        }
    }
    
    /**
     * Obtiene los reportes mensuales guardados
     * @param int $limit
     * @param int $offset
     * @return array
     */
    public function obtenerReportesMensualesGuardados($limit = 50, $offset = 0)
    {
        try {
            $stmt = $this->db->query(
                'SELECT * FROM reportesmensuales ORDER BY fecha_generacion DESC LIMIT ? OFFSET ?',
                [(int)$limit, (int)$offset]
            );
            
            return $stmt->fetchAll();
        } catch (\Exception $e) {
            error_log('❌ Error obteniendo reportes mensuales: ' . $e->getMessage());
            throw $e;
        }
    }
    
    /**
     * Guarda un reporte mensual en la base de datos
     * @param array $datosReporte
     * @param string $fechaInicio
     * @param string $fechaFin
     * @param int|null $idUsuarioGenerador
     * @return int ID del reporte guardado
     */
    public function guardarReporteMensual($datosReporte, $fechaInicio, $fechaFin, $idUsuarioGenerador = null)
    {
        try {
            // Asegurar que la tabla existe
            $this->crearTablaReportesMensuales();
            
            // Convertir datos a JSON
            $datosJson = json_encode($datosReporte, JSON_UNESCAPED_UNICODE);
            
            $stmt = $this->db->query(
                'INSERT INTO reportesmensuales (fecha_inicio, fecha_fin, datos_reporte, id_usuario_generador, fecha_generacion)
                 VALUES (?, ?, ?, ?, NOW())',
                [$fechaInicio, $fechaFin, $datosJson, $idUsuarioGenerador]
            );
            
            $idReporte = $this->db->getConnection()->lastInsertId();
            
            error_log("✅ Reporte mensual guardado con ID: $idReporte");
            return $idReporte;
        } catch (\Exception $e) {
            error_log('❌ Error guardando reporte mensual: ' . $e->getMessage());
            throw $e;
        }
    }
    
    /**
     * Crea la tabla reportesmensuales si no existe
     */
    public function crearTablaReportesMensuales()
    {
        try {
            $this->db->query(
                'CREATE TABLE IF NOT EXISTS reportesmensuales (
                    id_reporte INT AUTO_INCREMENT PRIMARY KEY,
                    fecha_inicio DATE NOT NULL COMMENT "Fecha de inicio del período del reporte",
                    fecha_fin DATE NOT NULL COMMENT "Fecha de fin del período del reporte",
                    datos_reporte JSON NOT NULL COMMENT "Datos completos del reporte en formato JSON",
                    id_usuario_generador INT NULL COMMENT "ID del usuario que generó el reporte (NULL si fue automático)",
                    fecha_generacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT "Fecha y hora de generación del reporte",
                    INDEX idx_fecha_inicio (fecha_inicio),
                    INDEX idx_fecha_fin (fecha_fin),
                    INDEX idx_fecha_generacion (fecha_generacion),
                    FOREIGN KEY (id_usuario_generador) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                COMMENT="Tabla para almacenar reportes mensuales generados automáticamente"'
            );
            
            error_log('✅ Tabla reportesmensuales verificada/creada');
        } catch (\Exception $e) {
            error_log('⚠️ Error verificando/creando tabla reportesmensuales: ' . $e->getMessage());
            // No lanzar excepción, solo loggear
        }
    }
}
