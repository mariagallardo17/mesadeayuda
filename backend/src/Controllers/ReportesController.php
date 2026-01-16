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
            $hasFechas = $fechaInicio && $fechaFin && trim($fechaInicio) !== '' && trim($fechaFin) !== '';
            $condicionesFecha = $hasFechas
                ? 'WHERE CAST(fecha_creacion AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)'
                : '';
            $paramsFecha = $hasFechas ? [$fechaInicio, $fechaFin] : [];

            // 1. Tickets solicitados (creados en el período)
            $stmt = $this->db->query(
                "SELECT COUNT(*) as count FROM tickets $condicionesFecha",
                $paramsFecha
            );
            $ticketsSolicitados = (int)$stmt->fetch()['count'];

            // 2. Tickets atendidos (con técnico asignado y en progreso/finalizado/cerrado) - dentro del período
            $whereClause = $hasFechas ? $condicionesFecha . ' AND' : 'WHERE';
            $stmt = $this->db->query(
                "SELECT COUNT(*) as count FROM tickets 
                 $whereClause 
                 id_tecnico IS NOT NULL 
                 AND estatus IN ('En Progreso', 'Finalizado', 'Cerrado')",
                $paramsFecha
            );
            $ticketsAtendidos = (int)$stmt->fetch()['count'];

            // 3. Tickets cerrados por el sistema - dentro del período
            $stmt = $this->db->query(
                "SELECT COUNT(*) as count FROM tickets 
                 $whereClause 
                 estatus = 'Cerrado' 
                 AND COALESCE(evaluacion_cierre_automatico, 0) = 1",
                $paramsFecha
            );
            $ticketsCerradosPorSistema = (int)$stmt->fetch()['count'];

            // 4. Tickets asignados - dentro del período
            $stmt = $this->db->query(
                "SELECT COUNT(*) as count FROM tickets 
                 $whereClause 
                 id_tecnico IS NOT NULL",
                $paramsFecha
            );
            $ticketsAsignados = (int)$stmt->fetch()['count'];

            // 5. Tickets pendientes (estado actual, no filtrado por fecha de creación)
            // Si hay fechas, contar solo los que fueron creados en el período Y están pendientes
            if ($hasFechas) {
                $stmt = $this->db->query(
                    "SELECT COUNT(*) as count FROM tickets 
                     $whereClause 
                     estatus IN ('Abierto', 'En Progreso', 'Pendiente')",
                    $paramsFecha
                );
            } else {
            $stmt = $this->db->query(
                "SELECT COUNT(*) as count FROM tickets 
                 WHERE estatus IN ('Abierto', 'En Progreso', 'Pendiente')"
            );
            }
            $ticketsPendientes = (int)$stmt->fetch()['count'];

            // 6. Tickets sin cerrar (finalizados pero sin fecha_cierre) - dentro del período
            $stmt = $this->db->query(
                "SELECT COUNT(*) as count FROM tickets 
                 $whereClause 
                 estatus = 'Finalizado' 
                 AND fecha_cierre IS NULL",
                $paramsFecha
            );
            $ticketsSinCerrar = (int)$stmt->fetch()['count'];

            // 7. Tickets escalados
            $fechaConditionEscalamiento = $hasFechas
                ? 'WHERE CAST(e.fecha_escalamiento AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)'
                : '';
            $paramsEscalamiento = $hasFechas ? [$fechaInicio, $fechaFin] : [];
            $stmt = $this->db->query(
                "SELECT COUNT(DISTINCT e.id_ticket) as count 
                 FROM escalamientos e
                 $fechaConditionEscalamiento",
                $paramsEscalamiento
            );
            $ticketsEscalados = (int)$stmt->fetch()['count'];

            // 8. Tickets tardíos
            $whereClauseTardios = $hasFechas ? 'WHERE CAST(t.fecha_cierre AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) AND' : 'WHERE';
            $paramsTardios = $hasFechas ? [$fechaInicio, $fechaFin] : [];
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
                $paramsTardios
            );
            $ticketsTardios = (int)$stmt->fetch()['count'];

            // 9. Tickets reabiertos
            $fechaConditionReapertura = $hasFechas
                ? 'WHERE CAST(tr.fecha_reapertura AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)'
                : '';
            $paramsReapertura = $hasFechas ? [$fechaInicio, $fechaFin] : [];
            $stmt = $this->db->query(
                "SELECT COUNT(DISTINCT tr.id_ticket) as count
                 FROM ticketreaperturas tr
                 $fechaConditionReapertura",
                $paramsReapertura
            );
            $ticketsReabiertos = (int)$stmt->fetch()['count'];

            // 10. Evaluaciones tardías (incluye tickets normales y reabiertos)
            $whereClauseEval = $hasFechas ? 'WHERE CAST(COALESCE(t.fecha_finalizacion, t.fecha_cierre) AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) AND' : 'WHERE';
            $paramsEval = $hasFechas ? [$fechaInicio, $fechaFin] : [];
            try {
                // Intentar consulta con evaluaciones_reaperturas
                $stmt = $this->db->query(
                    "SELECT COUNT(*) as count
                     FROM tickets t
                     LEFT JOIN evaluaciones e ON t.id_ticket = e.id_ticket
                     LEFT JOIN (
                         SELECT tr1.id_ticket, tr1.id_reapertura
                         FROM ticketreaperturas tr1
                         INNER JOIN (
                             SELECT id_ticket, MAX(fecha_reapertura) AS max_fecha
                             FROM ticketreaperturas
                             GROUP BY id_ticket
                         ) latest ON latest.id_ticket = tr1.id_ticket AND latest.max_fecha = tr1.fecha_reapertura
                     ) tr ON tr.id_ticket = t.id_ticket
                     LEFT JOIN evaluaciones_reaperturas er ON tr.id_reapertura = er.id_reapertura
                     $whereClauseEval
                     (t.estatus = 'Finalizado' OR (t.estatus = 'Cerrado' AND COALESCE(t.evaluacion_cierre_automatico, 0) = 1))
                     AND (
                         (tr.id_reapertura IS NULL AND e.id_evaluacion IS NULL)
                         OR (tr.id_reapertura IS NOT NULL AND er.id_evaluacion_reapertura IS NULL)
                     )
                     AND COALESCE(t.fecha_finalizacion, t.fecha_cierre) IS NOT NULL
                     AND DATE(COALESCE(t.fecha_finalizacion, t.fecha_cierre)) < DATE_SUB(NOW(), INTERVAL 2 DAY)",
                    $paramsEval
                );
                $evaluacionesTardias = (int)$stmt->fetch()['count'];
            } catch (\Exception $e) {
                // Fallback: si la tabla evaluaciones_reaperturas no existe, usar solo evaluaciones normales
                error_log('⚠️ Tabla evaluaciones_reaperturas no disponible, usando fallback para evaluaciones tardías: ' . $e->getMessage());
                $stmt = $this->db->query(
                    "SELECT COUNT(*) as count
                     FROM tickets t
                     LEFT JOIN evaluaciones e ON t.id_ticket = e.id_ticket
                     $whereClauseEval
                     (t.estatus = 'Finalizado' OR (t.estatus = 'Cerrado' AND COALESCE(t.evaluacion_cierre_automatico, 0) = 1))
                     AND e.id_evaluacion IS NULL
                     AND COALESCE(t.fecha_finalizacion, t.fecha_cierre) IS NOT NULL
                     AND DATE(COALESCE(t.fecha_finalizacion, t.fecha_cierre)) < DATE_SUB(NOW(), INTERVAL 2 DAY)",
                    $paramsEval
                );
                $evaluacionesTardias = (int)$stmt->fetch()['count'];
            }

            // 11. Satisfacción promedio (incluye evaluaciones normales y de reapertura)
            try {
                $satisfaccionQuery = $hasFechas
                    ? 'SELECT AVG(calificacion) as promedio FROM (
                         SELECT calificacion, fecha_evaluacion FROM evaluaciones WHERE DATE(fecha_evaluacion) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
                         UNION ALL
                         SELECT calificacion, fecha_evaluacion FROM evaluaciones_reaperturas WHERE DATE(fecha_evaluacion) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
                       ) todas_evaluaciones'
                    : 'SELECT AVG(calificacion) as promedio FROM (
                         SELECT calificacion FROM evaluaciones
                         UNION ALL
                         SELECT calificacion FROM evaluaciones_reaperturas
                       ) todas_evaluaciones';
                $paramsSatisfaccion = $hasFechas ? [$fechaInicio, $fechaFin, $fechaInicio, $fechaFin] : [];
                $stmt = $this->db->query($satisfaccionQuery, $paramsSatisfaccion);
                $satisfaccionResult = $stmt->fetch();
                $satisfaccionPromedio = ($satisfaccionResult['promedio'] !== null && $satisfaccionResult['promedio'] !== false)
                    ? round((float)$satisfaccionResult['promedio'], 1) 
                    : 0;
            } catch (\Exception $e) {
                // Fallback: si la tabla evaluaciones_reaperturas no existe, usar solo evaluaciones normales
                error_log('⚠️ Tabla evaluaciones_reaperturas no disponible, usando fallback para satisfacción promedio: ' . $e->getMessage());
                $satisfaccionQuery = $hasFechas
                    ? 'SELECT AVG(calificacion) as promedio FROM evaluaciones WHERE DATE(fecha_evaluacion) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)'
                    : 'SELECT AVG(calificacion) as promedio FROM evaluaciones';
                $paramsSatisfaccion = $hasFechas ? [$fechaInicio, $fechaFin] : [];
                $stmt = $this->db->query($satisfaccionQuery, $paramsSatisfaccion);
                $satisfaccionResult = $stmt->fetch();
                $satisfaccionPromedio = ($satisfaccionResult['promedio'] !== null && $satisfaccionResult['promedio'] !== false)
                    ? round((float)$satisfaccionResult['promedio'], 1) 
                    : 0;
            }

            // 12. MTTR (Mean Time To Resolution)
            $mttrQuery = $hasFechas
                ? "SELECT AVG(TIMESTAMPDIFF(MINUTE, fecha_creacion, COALESCE(fecha_cierre, fecha_finalizacion))) as promedio_minutos
                   FROM tickets
                   WHERE estatus IN ('Finalizado', 'Cerrado')
                   AND fecha_cierre IS NOT NULL
                   AND CAST(fecha_cierre AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)"
                : "SELECT AVG(TIMESTAMPDIFF(MINUTE, fecha_creacion, COALESCE(fecha_cierre, fecha_finalizacion))) as promedio_minutos
                   FROM tickets
                   WHERE estatus IN ('Finalizado', 'Cerrado')
                   AND fecha_cierre IS NOT NULL";
            $stmt = $this->db->query($mttrQuery, $paramsFecha);
            $mttrResult = $stmt->fetch();
            $promedioMinutos = $mttrResult['promedio_minutos'] ?? null;
            if ($promedioMinutos === null || $promedioMinutos === false) {
                $promedioMinutos = 0.0;
                $mttrHoras = 0;
                $mttrMinutos = 0;
            } else {
                $promedioMinutos = (float)$promedioMinutos;
            $mttrHoras = floor($promedioMinutos / 60);
            $mttrMinutos = round($promedioMinutos % 60);
            }

            // 13. MTTA (Mean Time To Acknowledge)
            $mttaQuery = $hasFechas
                ? "SELECT AVG(TIMESTAMPDIFF(MINUTE, fecha_creacion, COALESCE(fecha_asignacion, fecha_inicio_atencion, fecha_creacion))) as promedio_minutos
                   FROM tickets
                   WHERE id_tecnico IS NOT NULL
                   AND (fecha_asignacion IS NOT NULL OR fecha_inicio_atencion IS NOT NULL)
                   AND CAST(fecha_creacion AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)"
                : "SELECT AVG(TIMESTAMPDIFF(MINUTE, fecha_creacion, COALESCE(fecha_asignacion, fecha_inicio_atencion, fecha_creacion))) as promedio_minutos
                   FROM tickets
                   WHERE id_tecnico IS NOT NULL
                   AND (fecha_asignacion IS NOT NULL OR fecha_inicio_atencion IS NOT NULL)";
            $stmt = $this->db->query($mttaQuery, $paramsFecha);
            $mttaResult = $stmt->fetch();
            $mttaMinutos = ($mttaResult['promedio_minutos'] !== null && $mttaResult['promedio_minutos'] !== false)
                ? round((float)$mttaResult['promedio_minutos']) 
                : 0;

            // 14. Cumplimiento de SLA
            $slaQuery = $hasFechas
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
            $paramsSLA = $hasFechas ? [$fechaInicio, $fechaFin] : [];
            $stmt = $this->db->query($slaQuery, $paramsSLA);
            $slaResult = $stmt->fetch();
            $totalSLA = (int)$slaResult['total'];
            $cumplidosSLA = (int)$slaResult['cumplidos'];
            $cumplimientoSLA = $totalSLA > 0 
                ? round(($cumplidosSLA / $totalSLA) * 100, 1) 
                : 0;

            // 15. Actualizaciones de estado (tickets que no están en estado Abierto)
            $actualizacionesQuery = $hasFechas
                ? "SELECT COUNT(*) as count
                   FROM tickets
                   $condicionesFecha
                   AND estatus != 'Abierto'"
                : "SELECT COUNT(*) as count
                   FROM tickets
                   WHERE estatus != 'Abierto'";
            $stmt = $this->db->query($actualizacionesQuery, $paramsFecha);
            $actualizaciones = (int)$stmt->fetch()['count'];
            $porcentajeActualizaciones = $ticketsSolicitados > 0
                ? round(($actualizaciones / $ticketsSolicitados) * 100, 1)
                : 0;

            // 16. Tickets por semana (últimas 4 semanas del período)
            $ticketsPorSemana = [0, 0, 0, 0];
            try {
                $semanasQuery = $hasFechas
                    ? "SELECT
                         WEEK(fecha_creacion, 1) - WEEK(CAST(? AS DATE), 1) + 1 as semana,
                         COUNT(*) as cantidad
                       FROM tickets
                       WHERE CAST(fecha_creacion AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
                       GROUP BY WEEK(fecha_creacion, 1)
                       ORDER BY semana
                       LIMIT 4"
                    : "SELECT
                         WEEK(fecha_creacion, 1) as semana,
                         COUNT(*) as cantidad
                       FROM tickets
                       WHERE fecha_creacion >= DATE_SUB(NOW(), INTERVAL 4 WEEK)
                       GROUP BY WEEK(fecha_creacion, 1)
                       ORDER BY semana DESC
                       LIMIT 4";
                
                $semanasParams = $hasFechas ? [$fechaInicio, $fechaInicio, $fechaFin] : [];
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
            error_log('📊 Resumen de valores calculados:');
            error_log('   - Tickets solicitados: ' . $ticketsSolicitados);
            error_log('   - Tickets atendidos: ' . $ticketsAtendidos);
            error_log('   - Tickets asignados: ' . $ticketsAsignados);
            error_log('   - Tickets pendientes: ' . $ticketsPendientes);
            error_log('   - Satisfacción promedio: ' . $satisfaccionPromedio);
            error_log('   - Cumplimiento SLA: ' . $cumplimientoSLA . '%');
            
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
