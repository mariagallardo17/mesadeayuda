const { query } = require('../config/database');

/**
 * Obtiene todos los KPIs de reportes en un solo objeto optimizado
 * @param {string} fechaInicio - Fecha de inicio en formato YYYY-MM-DD
 * @param {string} fechaFin - Fecha de fin en formato YYYY-MM-DD
 * @returns {Promise<Object>} Objeto con todos los KPIs
 */
async function obtenerReportesCompletos(fechaInicio, fechaFin) {
  try {
    console.log('📊 Generando reportes completos...');
    console.log('📅 Fecha inicio:', fechaInicio);
    console.log('📅 Fecha fin:', fechaFin);

    // Construir condiciones de fecha
    const condicionesFecha = fechaInicio && fechaFin
      ? 'WHERE CAST(t.fecha_creacion AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)'
      : '';
    const paramsFecha = fechaInicio && fechaFin ? [fechaInicio, fechaFin] : [];

    // 1. Tickets solicitados
    const ticketsSolicitados = await query(
      `SELECT COUNT(*) as count FROM tickets ${condicionesFecha}`,
      paramsFecha
    ).then(r => r[0]?.count || 0);

    // 2. Tickets atendidos (con técnico asignado y en progreso/finalizado/cerrado)
    const ticketsAtendidos = await query(
      `SELECT COUNT(*) as count FROM tickets 
       ${condicionesFecha ? condicionesFecha + ' AND' : 'WHERE'} 
       id_tecnico IS NOT NULL 
       AND estatus IN ('En Progreso', 'Finalizado', 'Cerrado')`,
      paramsFecha
    ).then(r => r[0]?.count || 0);

    // 3. Tickets cerrados por el sistema
    const ticketsCerradosPorSistema = await query(
      `SELECT COUNT(*) as count FROM tickets 
       ${condicionesFecha ? condicionesFecha + ' AND' : 'WHERE'} 
       estatus = 'Cerrado' 
       AND COALESCE(evaluacion_cierre_automatico, 0) = 1`,
      paramsFecha
    ).then(r => r[0]?.count || 0);

    // 4. Tickets asignados
    const ticketsAsignados = await query(
      `SELECT COUNT(*) as count FROM tickets 
       ${condicionesFecha ? condicionesFecha + ' AND' : 'WHERE'} 
       id_tecnico IS NOT NULL`,
      paramsFecha
    ).then(r => r[0]?.count || 0);

    // 5. Tickets pendientes (sin filtro de fecha - estado actual)
    const ticketsPendientes = await query(
      `SELECT COUNT(*) as count FROM tickets 
       WHERE estatus IN ('Abierto', 'En Progreso', 'Pendiente')`
    ).then(r => r[0]?.count || 0);

    // 6. Tickets sin cerrar (finalizados pero sin fecha_cierre)
    const ticketsSinCerrar = await query(
      `SELECT COUNT(*) as count FROM tickets 
       ${condicionesFecha ? condicionesFecha + ' AND' : 'WHERE'} 
       estatus = 'Finalizado' 
       AND fecha_cierre IS NULL`,
      paramsFecha
    ).then(r => r[0]?.count || 0);

    // 7. Tickets escalados
    const ticketsEscalados = await query(
      `SELECT COUNT(DISTINCT e.id_ticket) as count 
       FROM escalamientos e
       ${condicionesFecha ? 'WHERE CAST(e.fecha_escalamiento AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)' : ''}`,
      paramsFecha
    ).then(r => r[0]?.count || 0);

    // 8. Tickets tardíos (fuera del tiempo objetivo del servicio en minutos)
    const ticketsTardios = await query(
      `SELECT COUNT(*) as count
       FROM tickets t
       INNER JOIN servicios s ON t.id_servicio = s.id_servicio
       ${condicionesFecha ? 'WHERE CAST(t.fecha_cierre AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) AND' : 'WHERE'}
       t.fecha_cierre IS NOT NULL
       AND t.estatus IN ('Finalizado', 'Cerrado')
       AND s.tiempo_objetivo IS NOT NULL
       AND (
         -- Si tiempo_objetivo está en formato "X días"
         (s.tiempo_objetivo LIKE '%días%' OR s.tiempo_objetivo LIKE '%dias%' OR s.tiempo_objetivo LIKE '%día%' OR s.tiempo_objetivo LIKE '%dia%')
         AND TIMESTAMPDIFF(MINUTE, t.fecha_creacion, t.fecha_cierre) > (CAST(SUBSTRING_INDEX(s.tiempo_objetivo, ' ', 1) AS UNSIGNED) * 24 * 60)
         OR
         -- Si tiempo_objetivo está en formato "HH:MM:SS"
         (s.tiempo_objetivo LIKE '%:%')
         AND TIMESTAMPDIFF(MINUTE, t.fecha_creacion, t.fecha_cierre) > (TIME_TO_SEC(CAST(s.tiempo_objetivo AS TIME)) / 60)
         OR
         -- Si tiempo_objetivo es un número directo (asumiendo minutos)
         (CAST(s.tiempo_objetivo AS UNSIGNED) > 0)
         AND TIMESTAMPDIFF(MINUTE, t.fecha_creacion, t.fecha_cierre) > CAST(s.tiempo_objetivo AS UNSIGNED)
       )`,
      paramsFecha
    ).then(r => r[0]?.count || 0);

    // 9. Tickets reabiertos
    const ticketsReabiertos = await query(
      `SELECT COUNT(DISTINCT tr.id_ticket) as count
       FROM ticketreaperturas tr
       ${condicionesFecha ? 'WHERE CAST(tr.fecha_reapertura AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)' : ''}`,
      paramsFecha
    ).then(r => r[0]?.count || 0);

    // 10. Evaluaciones tardías (tickets finalizados sin evaluación después de 2 días)
    const evaluacionesTardias = await query(
      `SELECT COUNT(*) as count
       FROM tickets t
       LEFT JOIN evaluaciones e ON t.id_ticket = e.id_ticket
       ${condicionesFecha ? 'WHERE CAST(COALESCE(t.fecha_finalizacion, t.fecha_cierre) AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) AND' : 'WHERE'}
       (t.estatus = 'Finalizado' OR (t.estatus = 'Cerrado' AND COALESCE(t.evaluacion_cierre_automatico, 0) = 1))
       AND e.id_evaluacion IS NULL
       AND COALESCE(t.fecha_finalizacion, t.fecha_cierre) IS NOT NULL
       AND DATE(COALESCE(t.fecha_finalizacion, t.fecha_cierre)) < DATE_SUB(NOW(), INTERVAL 2 DAY)`,
      paramsFecha
    ).then(r => r[0]?.count || 0);

    // 11. Satisfacción promedio
    const satisfaccionQuery = fechaInicio && fechaFin
      ? 'SELECT AVG(calificacion) as promedio FROM evaluaciones WHERE DATE(fecha_evaluacion) BETWEEN ? AND ?'
      : 'SELECT AVG(calificacion) as promedio FROM evaluaciones';
    const satisfaccionResult = await query(satisfaccionQuery, paramsFecha);
    const satisfaccionPromedio = satisfaccionResult[0]?.promedio 
      ? Number(parseFloat(satisfaccionResult[0].promedio).toFixed(1)) 
      : 0;

    // 12. MTTR (Mean Time To Resolution) - Tiempo promedio de resolución
    const mttrQuery = fechaInicio && fechaFin
      ? `SELECT AVG(TIMESTAMPDIFF(MINUTE, fecha_creacion, COALESCE(fecha_cierre, fecha_finalizacion))) as promedio_minutos
         FROM tickets
         WHERE estatus IN ('Finalizado', 'Cerrado')
         AND fecha_cierre IS NOT NULL
         AND CAST(fecha_cierre AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)`
      : `SELECT AVG(TIMESTAMPDIFF(MINUTE, fecha_creacion, COALESCE(fecha_cierre, fecha_finalizacion))) as promedio_minutos
         FROM tickets
         WHERE estatus IN ('Finalizado', 'Cerrado')
         AND fecha_cierre IS NOT NULL`;
    const mttrResult = await query(mttrQuery, paramsFecha);
    const promedioMinutos = mttrResult[0]?.promedio_minutos || 0;
    const mttrHoras = Math.floor(promedioMinutos / 60);
    const mttrMinutos = Math.round(promedioMinutos % 60);

    // 13. MTTA (Mean Time To Acknowledge) - Tiempo promedio de atención
    const mttaQuery = fechaInicio && fechaFin
      ? `SELECT AVG(TIMESTAMPDIFF(MINUTE, fecha_creacion, COALESCE(fecha_asignacion, fecha_inicio_atencion, fecha_creacion))) as promedio_minutos
         FROM tickets
         WHERE id_tecnico IS NOT NULL
         AND (fecha_asignacion IS NOT NULL OR fecha_inicio_atencion IS NOT NULL)
         AND CAST(fecha_creacion AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)`
      : `SELECT AVG(TIMESTAMPDIFF(MINUTE, fecha_creacion, COALESCE(fecha_asignacion, fecha_inicio_atencion, fecha_creacion))) as promedio_minutos
         FROM tickets
         WHERE id_tecnico IS NOT NULL
         AND (fecha_asignacion IS NOT NULL OR fecha_inicio_atencion IS NOT NULL)`;
    const mttaResult = await query(mttaQuery, paramsFecha);
    const mttaMinutos = mttaResult[0]?.promedio_minutos 
      ? Math.round(parseFloat(mttaResult[0].promedio_minutos)) 
      : 0;

    // 14. Cumplimiento de SLA (% de tickets resueltos dentro del tiempo objetivo en minutos)
    const slaQuery = fechaInicio && fechaFin
      ? `SELECT
           COUNT(*) as total,
           SUM(CASE
             WHEN s.tiempo_objetivo IS NOT NULL AND
                  (
                    -- Si tiempo_objetivo está en formato "X días"
                    (s.tiempo_objetivo LIKE '%días%' OR s.tiempo_objetivo LIKE '%dias%' OR s.tiempo_objetivo LIKE '%día%' OR s.tiempo_objetivo LIKE '%dia%')
                    AND TIMESTAMPDIFF(MINUTE, t.fecha_creacion, t.fecha_cierre) <= (CAST(SUBSTRING_INDEX(s.tiempo_objetivo, ' ', 1) AS UNSIGNED) * 24 * 60)
                    OR
                    -- Si tiempo_objetivo está en formato "HH:MM:SS"
                    (s.tiempo_objetivo LIKE '%:%')
                    AND TIMESTAMPDIFF(MINUTE, t.fecha_creacion, t.fecha_cierre) <= (TIME_TO_SEC(CAST(s.tiempo_objetivo AS TIME)) / 60)
                    OR
                    -- Si tiempo_objetivo es un número directo (asumiendo minutos)
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
         AND CAST(t.fecha_cierre AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)`
      : `SELECT
           COUNT(*) as total,
           SUM(CASE
             WHEN s.tiempo_objetivo IS NOT NULL AND
                  (
                    -- Si tiempo_objetivo está en formato "X días"
                    (s.tiempo_objetivo LIKE '%días%' OR s.tiempo_objetivo LIKE '%dias%' OR s.tiempo_objetivo LIKE '%día%' OR s.tiempo_objetivo LIKE '%dia%')
                    AND TIMESTAMPDIFF(MINUTE, t.fecha_creacion, t.fecha_cierre) <= (CAST(SUBSTRING_INDEX(s.tiempo_objetivo, ' ', 1) AS UNSIGNED) * 24 * 60)
                    OR
                    -- Si tiempo_objetivo está en formato "HH:MM:SS"
                    (s.tiempo_objetivo LIKE '%:%')
                    AND TIMESTAMPDIFF(MINUTE, t.fecha_creacion, t.fecha_cierre) <= (TIME_TO_SEC(CAST(s.tiempo_objetivo AS TIME)) / 60)
                    OR
                    -- Si tiempo_objetivo es un número directo (asumiendo minutos)
                    (CAST(s.tiempo_objetivo AS UNSIGNED) > 0)
                    AND TIMESTAMPDIFF(MINUTE, t.fecha_creacion, t.fecha_cierre) <= CAST(s.tiempo_objetivo AS UNSIGNED)
                  )
             THEN 1 ELSE 0
           END) as cumplidos
         FROM tickets t
         INNER JOIN servicios s ON t.id_servicio = s.id_servicio
         WHERE t.estatus IN ('Finalizado', 'Cerrado')
         AND t.fecha_cierre IS NOT NULL
         AND s.tiempo_objetivo IS NOT NULL`;
    const slaResult = await query(slaQuery, paramsFecha);
    const totalSLA = slaResult[0]?.total || 0;
    const cumplidosSLA = slaResult[0]?.cumplidos || 0;
    const cumplimientoSLA = totalSLA > 0 
      ? Number(((cumplidosSLA / totalSLA) * 100).toFixed(1)) 
      : 0;

    // 15. Actualizaciones de estado (usando cambios de estatus en tickets)
    // Como no hay tabla de historial, contamos tickets que han cambiado de estado
    // Aproximación: tickets que no están en el estado inicial 'Abierto'
    const actualizacionesQuery = fechaInicio && fechaFin
      ? `SELECT COUNT(*) as count
         FROM tickets
         ${condicionesFecha}
         AND estatus != 'Abierto'`
      : `SELECT COUNT(*) as count
         FROM tickets
         WHERE estatus != 'Abierto'`;
    const actualizaciones = await query(actualizacionesQuery, paramsFecha).then(r => r[0]?.count || 0);
    const porcentajeActualizaciones = ticketsSolicitados > 0
      ? Number(((actualizaciones / ticketsSolicitados) * 100).toFixed(1))
      : 0;

    // 16. Tickets por semana (últimas 4 semanas del período)
    let ticketsPorSemana = [0, 0, 0, 0];
    try {
      const semanasQuery = fechaInicio && fechaFin
        ? `SELECT
             WEEK(fecha_creacion, 1) - WEEK(CAST(? AS DATE), 1) + 1 as semana,
             COUNT(*) as cantidad
           FROM tickets
           WHERE CAST(fecha_creacion AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
           GROUP BY WEEK(fecha_creacion, 1)
           ORDER BY semana
           LIMIT 4`
        : `SELECT
             WEEK(fecha_creacion, 1) as semana,
             COUNT(*) as cantidad
           FROM tickets
           GROUP BY WEEK(fecha_creacion, 1)
           ORDER BY semana DESC
           LIMIT 4`;
      const semanasParams = fechaInicio && fechaFin ? [fechaInicio, fechaInicio, fechaFin] : [];
      const semanasResult = await query(semanasQuery, semanasParams);
      const semanas = fechaInicio && fechaFin ? semanasResult : semanasResult.reverse();
      semanas.forEach((row, index) => {
        if (index < 4) {
          ticketsPorSemana[index] = row.cantidad || 0;
        }
      });
    } catch (error) {
      console.error('⚠️ Error obteniendo tickets por semana:', error.message);
    }

    // 17. Rendimiento por técnico
    const rendimientoTecnicos = await obtenerRendimientoPorTecnico(fechaInicio, fechaFin);

    // 18. Histograma de evaluaciones
    const histogramaEvaluaciones = await obtenerHistogramaEvaluaciones(fechaInicio, fechaFin);

    // 19. Resumen ejecutivo
    const resumenEjecutivo = generarResumenEjecutivo({
      ticketsSolicitados,
      ticketsAtendidos,
      ticketsCerradosPorSistema,
      ticketsAsignados,
      ticketsPendientes,
      ticketsSinCerrar,
      ticketsEscalados,
      ticketsTardios,
      ticketsReabiertos,
      evaluacionesTardias,
      satisfaccionPromedio,
      mttrHoras,
      mttrMinutos,
      mttaMinutos,
      cumplimientoSLA,
      porcentajeActualizaciones
    });

    return {
      ticketsSolicitados,
      ticketsAtendidos,
      ticketsCerradosPorSistema,
      ticketsAsignados,
      ticketsPendientes,
      ticketsSinCerrar,
      ticketsEscalados,
      ticketsTardios,
      ticketsReabiertos,
      evaluacionesTardias,
      satisfaccionPromedio,
      mttr: {
        horas: mttrHoras,
        minutos: mttrMinutos,
        totalMinutos: promedioMinutos
      },
      mtta: {
        minutos: mttaMinutos
      },
      cumplimientoSLA,
      actualizacionesEstado: {
        total: actualizaciones,
        porcentaje: porcentajeActualizaciones
      },
      ticketsPorSemana,
      rendimientoPorTecnico: rendimientoTecnicos,
      histogramaEvaluaciones,
      resumenEjecutivo
    };
  } catch (error) {
    console.error('❌ Error generando reportes completos:', error);
    throw error;
  }
}

/**
 * Obtiene el rendimiento por técnico
 */
async function obtenerRendimientoPorTecnico(fechaInicio, fechaFin) {
  try {
    const condicionesFecha = fechaInicio && fechaFin
      ? 'AND CAST(t.fecha_creacion AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)'
      : '';
    const paramsFecha = fechaInicio && fechaFin ? [fechaInicio, fechaFin] : [];

    const rendimientoQuery = `
      SELECT
        u.id_usuario,
        u.nombre,
        COUNT(t.id_ticket) as ticketsAsignados,
        SUM(CASE WHEN t.estatus IN ('Finalizado', 'Cerrado') THEN 1 ELSE 0 END) as ticketsResueltos,
        SUM(CASE WHEN t.estatus IN ('Pendiente', 'En Progreso') THEN 1 ELSE 0 END) as ticketsPendientes,
        SUM(CASE WHEN EXISTS (
          SELECT 1 FROM escalamientos e WHERE e.id_ticket = t.id_ticket
        ) OR t.estatus = 'Escalado' THEN 1 ELSE 0 END) as ticketsEscalados,
        SUM(CASE WHEN EXISTS (
          SELECT 1 FROM ticketreaperturas tr WHERE tr.id_ticket = t.id_ticket
        ) THEN 1 ELSE 0 END) as ticketsReabiertos,
        AVG(e.calificacion) as calificacionPromedio,
        AVG(CASE 
          WHEN t.fecha_cierre IS NOT NULL AND t.fecha_inicio_atencion IS NOT NULL
          THEN TIMESTAMPDIFF(MINUTE, t.fecha_inicio_atencion, t.fecha_cierre)
          ELSE NULL
        END) as tiempoPromedioResolucion,
        COUNT(CASE 
          WHEN t.fecha_cierre IS NOT NULL 
          AND t.estatus IN ('Finalizado', 'Cerrado')
          AND s.tiempo_objetivo IS NOT NULL
          AND (
            (s.tiempo_objetivo LIKE '%días%' OR s.tiempo_objetivo LIKE '%dias%' OR s.tiempo_objetivo LIKE '%día%' OR s.tiempo_objetivo LIKE '%dia%')
            AND TIMESTAMPDIFF(MINUTE, t.fecha_creacion, t.fecha_cierre) <= (CAST(SUBSTRING_INDEX(s.tiempo_objetivo, ' ', 1) AS UNSIGNED) * 24 * 60)
            OR
            (s.tiempo_objetivo LIKE '%:%')
            AND TIMESTAMPDIFF(MINUTE, t.fecha_creacion, t.fecha_cierre) <= (TIME_TO_SEC(CAST(s.tiempo_objetivo AS TIME)) / 60)
            OR
            (CAST(s.tiempo_objetivo AS UNSIGNED) > 0)
            AND TIMESTAMPDIFF(MINUTE, t.fecha_creacion, t.fecha_cierre) <= CAST(s.tiempo_objetivo AS UNSIGNED)
          )
          THEN 1
        END) as ticketsEnTiempo,
        COUNT(CASE 
          WHEN t.fecha_cierre IS NOT NULL 
          AND t.estatus IN ('Finalizado', 'Cerrado')
          AND s.tiempo_objetivo IS NOT NULL
          THEN 1
        END) as ticketsConSLA
      FROM tickets t
      INNER JOIN usuarios u ON t.id_tecnico = u.id_usuario
      INNER JOIN servicios s ON t.id_servicio = s.id_servicio
      LEFT JOIN evaluaciones e ON t.id_ticket = e.id_ticket
      WHERE t.id_tecnico IS NOT NULL
      ${condicionesFecha}
      GROUP BY u.id_usuario, u.nombre
      ORDER BY ticketsResueltos DESC
    `;

    const resultado = await query(rendimientoQuery, paramsFecha);
    
    return resultado.map(tech => {
      const ticketsConSLA = tech.ticketsConSLA || 0;
      const ticketsEnTiempo = tech.ticketsEnTiempo || 0;
      const cumplimientoSLA = ticketsConSLA > 0 
        ? Number(((ticketsEnTiempo / ticketsConSLA) * 100).toFixed(1))
        : 0;

      return {
        idUsuario: tech.id_usuario,
        nombre: tech.nombre,
        ticketsAsignados: tech.ticketsAsignados || 0,
        ticketsResueltos: tech.ticketsResueltos || 0,
        ticketsPendientes: tech.ticketsPendientes || 0,
        ticketsEscalados: tech.ticketsEscalados || 0,
        ticketsReabiertos: tech.ticketsReabiertos || 0,
        calificacionPromedio: tech.calificacionPromedio 
          ? Number(parseFloat(tech.calificacionPromedio).toFixed(1)) 
          : 0,
        tiempoPromedioResolucion: tech.tiempoPromedioResolucion 
          ? Math.round(parseFloat(tech.tiempoPromedioResolucion)) 
          : 0,
        cumplimientoSLA: cumplimientoSLA,
        ticketsEnTiempo: ticketsEnTiempo,
        ticketsTardios: ticketsConSLA - ticketsEnTiempo
      };
    });
  } catch (error) {
    console.error('⚠️ Error obteniendo rendimiento por técnico:', error.message);
    return [];
  }
}

/**
 * Obtiene el histograma de evaluaciones (distribución por calificación)
 */
async function obtenerHistogramaEvaluaciones(fechaInicio, fechaFin) {
  try {
    const distribucionQuery = fechaInicio && fechaFin
      ? 'SELECT calificacion, COUNT(*) as cantidad FROM evaluaciones WHERE DATE(fecha_evaluacion) BETWEEN ? AND ? GROUP BY calificacion ORDER BY calificacion'
      : 'SELECT calificacion, COUNT(*) as cantidad FROM evaluaciones GROUP BY calificacion ORDER BY calificacion';
    const paramsFecha = fechaInicio && fechaFin ? [fechaInicio, fechaFin] : [];

    const resultado = await query(distribucionQuery, paramsFecha);
    const distribucion = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    
    resultado.forEach(row => {
      const calificacion = parseInt(row.calificacion);
      if (calificacion >= 1 && calificacion <= 5) {
        distribucion[calificacion] = row.cantidad || 0;
      }
    });

    return distribucion;
  } catch (error) {
    console.error('⚠️ Error obteniendo histograma de evaluaciones:', error.message);
    return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  }
}

/**
 * Genera un resumen ejecutivo con fortalezas y áreas de mejora
 */
function generarResumenEjecutivo(metricas) {
  const fortalezas = [];
  const areasMejora = [];

  // Análisis de fortalezas
  if (metricas.satisfaccionPromedio >= 4.0) {
    fortalezas.push('Excelente nivel de satisfacción del usuario');
  }
  if (metricas.cumplimientoSLA >= 80) {
    fortalezas.push('Alto cumplimiento de SLA');
  }
  if (metricas.ticketsEscalados / metricas.ticketsSolicitados < 0.1 && metricas.ticketsSolicitados > 0) {
    fortalezas.push('Bajo índice de escalamientos');
  }
  if (metricas.mttr.horas < 24) {
    fortalezas.push('Tiempo de resolución rápido');
  }

  // Análisis de áreas de mejora
  if (metricas.satisfaccionPromedio < 3.5) {
    areasMejora.push('Mejorar la satisfacción del usuario');
  }
  if (metricas.cumplimientoSLA < 70) {
    areasMejora.push('Aumentar el cumplimiento de SLA');
  }
  if (metricas.ticketsTardios / metricas.ticketsSolicitados > 0.2 && metricas.ticketsSolicitados > 0) {
    areasMejora.push('Reducir tickets tardíos');
  }
  if (metricas.evaluacionesTardias > 0) {
    areasMejora.push('Implementar recordatorios más efectivos para evaluaciones');
  }
  if (metricas.ticketsReabiertos / metricas.ticketsSolicitados > 0.15 && metricas.ticketsSolicitados > 0) {
    areasMejora.push('Mejorar la calidad de resolución para reducir reaperturas');
  }
  if (metricas.mttaMinutos > 60) {
    areasMejora.push('Reducir el tiempo de primera respuesta');
  }

  return {
    fortalezas: fortalezas.length > 0 ? fortalezas : ['Sistema funcionando correctamente'],
    areasMejora: areasMejora.length > 0 ? areasMejora : ['Mantener los estándares actuales']
  };
}

/**
 * Guarda un reporte mensual en la base de datos
 */
async function guardarReporteMensual(datosReporte, fechaInicio, fechaFin, idUsuarioGenerador = null) {
  try {
    // Verificar si la tabla existe
    const tablaExiste = await query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'reportesmensuales'
    `);

    if (tablaExiste[0]?.count === 0) {
      console.log('⚠️ Tabla reportesmensuales no existe, creándola...');
      await crearTablaReportesMensuales();
    }

    const resultado = await query(
      `INSERT INTO reportesmensuales 
       (fecha_inicio, fecha_fin, datos_reporte, id_usuario_generador, fecha_generacion)
       VALUES (?, ?, ?, ?, NOW())`,
      [
        fechaInicio,
        fechaFin,
        JSON.stringify(datosReporte),
        idUsuarioGenerador
      ]
    );

    console.log('✅ Reporte mensual guardado con ID:', resultado.insertId);
    return resultado.insertId;
  } catch (error) {
    console.error('❌ Error guardando reporte mensual:', error);
    throw error;
  }
}

/**
 * Crea la tabla reportesmensuales si no existe
 */
async function crearTablaReportesMensuales() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS reportesmensuales (
        id_reporte INT AUTO_INCREMENT PRIMARY KEY,
        fecha_inicio DATE NOT NULL,
        fecha_fin DATE NOT NULL,
        datos_reporte JSON NOT NULL,
        id_usuario_generador INT NULL,
        fecha_generacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_fecha_inicio (fecha_inicio),
        INDEX idx_fecha_fin (fecha_fin),
        INDEX idx_fecha_generacion (fecha_generacion),
        FOREIGN KEY (id_usuario_generador) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabla reportesmensuales creada exitosamente');
  } catch (error) {
    console.error('❌ Error creando tabla reportesmensuales:', error);
    throw error;
  }
}

/**
 * Obtiene reportes mensuales guardados
 */
async function obtenerReportesMensualesGuardados(limit = 50, offset = 0) {
  try {
    const tablaExiste = await query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'reportesmensuales'
    `);

    if (tablaExiste[0]?.count === 0) {
      return [];
    }

    const reportes = await query(`
      SELECT 
        r.*,
        u.nombre as usuario_nombre
      FROM reportesmensuales r
      LEFT JOIN usuarios u ON r.id_usuario_generador = u.id_usuario
      ORDER BY r.fecha_generacion DESC
      LIMIT ? OFFSET ?
    `, [parseInt(limit), parseInt(offset)]);

    return reportes;
  } catch (error) {
    console.error('❌ Error obteniendo reportes mensuales:', error);
    return [];
  }
}

module.exports = {
  obtenerReportesCompletos,
  obtenerRendimientoPorTecnico,
  obtenerHistogramaEvaluaciones,
  generarResumenEjecutivo,
  guardarReporteMensual,
  crearTablaReportesMensuales,
  obtenerReportesMensualesGuardados
};

