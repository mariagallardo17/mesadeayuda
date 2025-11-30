const express = require('express');
const { query } = require('../config/database');
const jwt = require('jsonwebtoken');

const router = express.Router();

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.rol !== 'administrador') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador' });
  }
  next();
};

async function tableExists(tableName) {
  try {
    const result = await query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
    `, [tableName]);
    return result[0]?.count > 0;
  } catch (error) {
    console.error(`⚠️ Error verificando tabla ${tableName}:`, error.message);
    return false;
  }
}

async function getReportesSummary(fechaInicio, fechaFin) {
  try {
    console.log('📊 Generando reportes summary...');
    console.log('📅 Fecha inicio:', fechaInicio);
    console.log('📅 Fecha fin:', fechaFin);
    console.log('📅 Tipo de fecha inicio:', typeof fechaInicio, '¿Es vacío?', !fechaInicio);
    console.log('📅 Tipo de fecha fin:', typeof fechaFin, '¿Es vacío?', !fechaFin);

    // Verificar qué tablas existen
    const hasTicketReaperturas = await tableExists('TicketReaperturas');
    const hasEscalamientos = await tableExists('Escalamientos');
    const hasAsignacionesTickets = await tableExists('AsignacionesTickets');
    const hasHistorialTickets = await tableExists('Historial_Tickets');

    console.log('📋 Tablas disponibles:');
    console.log(`  - TicketReaperturas: ${hasTicketReaperturas ? 'SÍ' : 'NO'}`);
    console.log(`  - Escalamientos: ${hasEscalamientos ? 'SÍ' : 'NO'}`);
    console.log(`  - AsignacionesTickets: ${hasAsignacionesTickets ? 'SÍ' : 'NO'}`);
    console.log(`  - Historial_Tickets: ${hasHistorialTickets ? 'SÍ' : 'NO'}`);

    const safeQuery = async (queryFn, defaultValue = 0) => {
      try {
        const result = await queryFn();

        // Si el resultado es un array con elementos
        if (Array.isArray(result) && result.length > 0) {
          const firstRow = result[0];
          // Intentar extraer count, total, o cualquier valor numérico
          const count = firstRow?.count ?? firstRow?.total ?? firstRow?.cantidad ??
                       (typeof firstRow === 'number' ? firstRow : defaultValue);

          // Convertir a número si es string
          const numericCount = typeof count === 'string' ? parseFloat(count) : count;

          if (!isNaN(numericCount) && numericCount !== null && numericCount !== undefined) {
            return numericCount;
          }
        }
        // Si el resultado es un objeto directo (no array)
        else if (result && typeof result === 'object' && !Array.isArray(result)) {
          const count = result.count ?? result.total ?? result.cantidad ?? defaultValue;
          const numericCount = typeof count === 'string' ? parseFloat(count) : count;
          if (!isNaN(numericCount) && numericCount !== null && numericCount !== undefined) {
            return numericCount;
          }
        }
        // Si el resultado es un número directo
        else if (typeof result === 'number') {
          return result;
        }

        return defaultValue;
      } catch (error) {
        console.error('⚠️ Error en consulta:', error.message);
        console.error('⚠️ Stack trace:', error.stack);
        return defaultValue;
      }
    };

    // 1. Número de tickets solicitados por los usuarios
    const ticketsSolicitados = await safeQuery(async () => {
      let ticketsSolicitadosQuery, ticketsSolicitadosParams;

      if (fechaInicio && fechaFin) {
        ticketsSolicitadosQuery = 'SELECT COUNT(*) as count FROM Tickets WHERE CAST(fecha_creacion AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)';
        ticketsSolicitadosParams = [fechaInicio, fechaFin];
        console.log('📅 Consulta con fechas:', ticketsSolicitadosQuery);
        console.log('📅 Parámetros:', ticketsSolicitadosParams);

        const totalTest = await query('SELECT COUNT(*) as total FROM Tickets');
        console.log('📊 Total de tickets en BD:', totalTest[0]?.total || 0);

        const testQuery = await query('SELECT COUNT(*) as count, MIN(fecha_creacion) as min_fecha, MAX(fecha_creacion) as max_fecha FROM Tickets');
        console.log('📊 Tickets en BD - Total:', testQuery[0]?.count || 0, 'Min fecha:', testQuery[0]?.min_fecha, 'Max fecha:', testQuery[0]?.max_fecha);
      } else {
        ticketsSolicitadosQuery = 'SELECT COUNT(*) as count FROM Tickets';
        ticketsSolicitadosParams = [];
        console.log('📅 Consulta SIN fechas - Cargando TODOS los tickets');
      }

      const result = await query(ticketsSolicitadosQuery, ticketsSolicitadosParams);
      console.log('✅ Tickets solicitados encontrados:', result[0]?.count || 0);
      console.log('✅ Resultado completo de query:', JSON.stringify(result, null, 2));
      return result;
    }, 0);

    const ticketsAtendidos = await safeQuery(async () => {
      let ticketsAtendidosQuery, ticketsAtendidosParams;

      if (fechaInicio && fechaFin) {
        ticketsAtendidosQuery = 'SELECT COUNT(*) as count FROM Tickets WHERE CAST(fecha_creacion AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) AND estatus IN ("En Progreso", "Finalizado", "Cerrado") AND id_tecnico IS NOT NULL';
        ticketsAtendidosParams = [fechaInicio, fechaFin];
      } else {
        ticketsAtendidosQuery = 'SELECT COUNT(*) as count FROM Tickets WHERE estatus IN ("En Progreso", "Finalizado", "Cerrado") AND id_tecnico IS NOT NULL';
        ticketsAtendidosParams = [];
      }

      return await query(ticketsAtendidosQuery, ticketsAtendidosParams);
    }, 0);

    const ticketsAsignados = await safeQuery(async () => {
      let ticketsAsignadosQuery, ticketsAsignadosParams;

      if (fechaInicio && fechaFin) {
        ticketsAsignadosQuery = 'SELECT COUNT(*) as count FROM Tickets WHERE id_tecnico IS NOT NULL AND CAST(fecha_creacion AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)';
        ticketsAsignadosParams = [fechaInicio, fechaFin];
      } else {
        // Si no hay fechas, cargar TODOS los tickets asignados
        ticketsAsignadosQuery = 'SELECT COUNT(*) as count FROM Tickets WHERE id_tecnico IS NOT NULL';
        ticketsAsignadosParams = [];
      }

      return await query(ticketsAsignadosQuery, ticketsAsignadosParams);
    }, 0);

    // 4. Número de tickets pendientes (siempre sin filtro de fecha)
    const ticketsPendientes = await safeQuery(async () => {
      const ticketsPendientesQuery = 'SELECT COUNT(*) as count FROM Tickets WHERE estatus IN ("Abierto", "En Progreso", "Pendiente")';
      console.log('📊 Consultando tickets pendientes (sin filtro de fecha)');
      return await query(ticketsPendientesQuery);
    }, 0);

    // 5. Número de tickets cerrados por el sistema (evaluacion_cierre_automatico = 1)
    const ticketsCerradosPorSistema = await safeQuery(async () => {
      let ticketsCerradosQuery, ticketsCerradosParams;

      if (fechaInicio && fechaFin) {
        ticketsCerradosQuery = 'SELECT COUNT(*) as count FROM Tickets WHERE estatus = "Cerrado" AND COALESCE(evaluacion_cierre_automatico, 0) = 1 AND CAST(fecha_cierre AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)';
        ticketsCerradosParams = [fechaInicio, fechaFin];
      } else {
        // Si no hay fechas, cargar TODOS los tickets cerrados por sistema
        ticketsCerradosQuery = 'SELECT COUNT(*) as count FROM Tickets WHERE estatus = "Cerrado" AND COALESCE(evaluacion_cierre_automatico, 0) = 1';
        ticketsCerradosParams = [];
      }

      return await query(ticketsCerradosQuery, ticketsCerradosParams);
    }, 0);

    // 5.1 Número de tickets sin cierre por el usuario (mantener para compatibilidad)
    const ticketsSinCerrar = await safeQuery(async () => {
      let ticketsSinCerrarQuery, ticketsSinCerrarParams;

      if (fechaInicio && fechaFin) {
        ticketsSinCerrarQuery = 'SELECT COUNT(*) as count FROM Tickets WHERE estatus = "Finalizado" AND fecha_cierre IS NULL AND CAST(fecha_creacion AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)';
        ticketsSinCerrarParams = [fechaInicio, fechaFin];
      } else {
        // Si no hay fechas, cargar TODOS los tickets sin cerrar
        ticketsSinCerrarQuery = 'SELECT COUNT(*) as count FROM Tickets WHERE estatus = "Finalizado" AND fecha_cierre IS NULL';
        ticketsSinCerrarParams = [];
      }

      return await query(ticketsSinCerrarQuery, ticketsSinCerrarParams);
    }, 0);

    // 6. Número de tickets escalados
    // Si existe tabla Escalamientos, usarla; si no, usar Tickets con estatus "Escalado"
    const ticketsEscalados = await safeQuery(async () => {
      if (hasEscalamientos) {
        let ticketsEscaladosQuery, ticketsEscaladosParams;

        if (fechaInicio && fechaFin) {
          ticketsEscaladosQuery = 'SELECT COUNT(*) as count FROM Escalamientos WHERE CAST(fecha_escalamiento AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)';
          ticketsEscaladosParams = [fechaInicio, fechaFin];
        } else {
          // Si no hay fechas, cargar TODOS los escalamientos
          ticketsEscaladosQuery = 'SELECT COUNT(*) as count FROM Escalamientos';
          ticketsEscaladosParams = [];
        }

        return await query(ticketsEscaladosQuery, ticketsEscaladosParams);
      } else {
        // Usar Tickets directamente buscando tickets con estatus "Escalado"
        let altQuery, params;

        if (fechaInicio && fechaFin) {
          altQuery = 'SELECT COUNT(*) as count FROM Tickets WHERE estatus = "Escalado" AND CAST(fecha_creacion AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)';
          params = [fechaInicio, fechaFin];
        } else {
          // Si no hay fechas, cargar TODOS los tickets escalados
          altQuery = 'SELECT COUNT(*) as count FROM Tickets WHERE estatus = "Escalado"';
          params = [];
        }

        return await query(altQuery, params);
      }
    }, 0);

    // 7. Número de tickets finalizados fuera de tiempo (comparar con tiempo_objetivo del servicio)
    const ticketsTardios = await safeQuery(async () => {
      let ticketsTardiosQuery, ticketsTardiosParams;

      if (fechaInicio && fechaFin) {
        ticketsTardiosQuery = `SELECT COUNT(*) as count
          FROM Tickets t
          INNER JOIN Servicios s ON t.id_servicio = s.id_servicio
          WHERE t.fecha_cierre IS NOT NULL
          AND CAST(t.fecha_cierre AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
          AND t.estatus IN ('Finalizado', 'Cerrado')
          AND TIMESTAMPDIFF(HOUR, t.fecha_creacion, COALESCE(t.fecha_cierre, t.fecha_finalizacion)) > s.tiempo_objetivo`;
        ticketsTardiosParams = [fechaInicio, fechaFin];
      } else {
        // Si no hay fechas, cargar TODOS los tickets tardíos
        ticketsTardiosQuery = `SELECT COUNT(*) as count
          FROM Tickets t
          INNER JOIN Servicios s ON t.id_servicio = s.id_servicio
          WHERE t.fecha_cierre IS NOT NULL
          AND t.estatus IN ('Finalizado', 'Cerrado')
          AND TIMESTAMPDIFF(HOUR, t.fecha_creacion, COALESCE(t.fecha_cierre, t.fecha_finalizacion)) > s.tiempo_objetivo`;
        ticketsTardiosParams = [];
      }

      return await query(ticketsTardiosQuery, ticketsTardiosParams);
    }, 0);

    // 8. Satisfacción del usuario (número de estrellas)
    let satisfaccionPromedio = 0;
    let distribucionEvaluaciones = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    try {
      const satisfaccionQuery = fechaInicio && fechaFin
        ? 'SELECT AVG(calificacion) as promedio, SUM(calificacion) as total FROM Evaluaciones WHERE DATE(fecha_evaluacion) BETWEEN ? AND ?'
        : 'SELECT AVG(calificacion) as promedio, SUM(calificacion) as total FROM Evaluaciones';

      const satisfaccionParams = fechaInicio && fechaFin ? [fechaInicio, fechaFin] : [];
      const satisfaccionResult = await query(satisfaccionQuery, satisfaccionParams);
      satisfaccionPromedio = satisfaccionResult && satisfaccionResult[0] ? (parseFloat(satisfaccionResult[0].promedio) || 0) : 0;
      console.log('📊 Satisfacción promedio calculada:', satisfaccionPromedio);

      // Obtener distribución de evaluaciones por calificación
      const distribucionQuery = fechaInicio && fechaFin
        ? 'SELECT calificacion, COUNT(*) as cantidad FROM Evaluaciones WHERE DATE(fecha_evaluacion) BETWEEN ? AND ? GROUP BY calificacion'
        : 'SELECT calificacion, COUNT(*) as cantidad FROM Evaluaciones GROUP BY calificacion';

      const distribucionResult = await query(distribucionQuery, satisfaccionParams);
      distribucionResult.forEach((row) => {
        const calificacion = parseInt(row.calificacion);
        if (calificacion >= 1 && calificacion <= 5) {
          distribucionEvaluaciones[calificacion] = row.cantidad || 0;
        }
      });
      console.log('📊 Distribución de evaluaciones:', distribucionEvaluaciones);
    } catch (error) {
      console.error('⚠️ Error obteniendo satisfacción:', error.message);
      satisfaccionPromedio = 0;
    }

    // 9. Número de tickets reabiertos
    // Si existe tabla TicketReaperturas, usarla; si no, usar Historial_Tickets o calcular desde Tickets
    let ticketsReabiertos = 0;
    try {
      if (hasTicketReaperturas) {
        let ticketsReabiertosQuery, ticketsReabiertosParams;

        if (fechaInicio && fechaFin) {
          ticketsReabiertosQuery = `SELECT COUNT(DISTINCT tr.id_ticket) as count
             FROM TicketReaperturas tr
             WHERE CAST(tr.fecha_reapertura AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)`;
          ticketsReabiertosParams = [fechaInicio, fechaFin];
        } else {
          // Si no hay fechas, cargar TODOS los tickets reabiertos
          ticketsReabiertosQuery = `SELECT COUNT(DISTINCT tr.id_ticket) as count
             FROM TicketReaperturas tr`;
          ticketsReabiertosParams = [];
        }

        const ticketsReabiertosResult = await query(ticketsReabiertosQuery, ticketsReabiertosParams);
        ticketsReabiertos = ticketsReabiertosResult && ticketsReabiertosResult[0] ? (parseInt(ticketsReabiertosResult[0].count) || 0) : 0;
        console.log('📊 Tickets reabiertos encontrados:', ticketsReabiertos);
      } else if (hasHistorialTickets) {
        // Si no existe TicketReaperturas pero existe Historial_Tickets, buscar cambios de estado
        let ticketsReabiertosQuery, ticketsReabiertosParams;

        if (fechaInicio && fechaFin) {
          ticketsReabiertosQuery = `SELECT COUNT(DISTINCT ht.id_ticket) as count
             FROM Historial_Tickets ht
             INNER JOIN Tickets t ON ht.id_ticket = t.id_ticket
             WHERE ht.estado_anterior IN ('Finalizado', 'Cerrado')
               AND ht.estado_nuevo IN ('Abierto', 'En Progreso', 'Reabierto')
               AND CAST(ht.fecha_cambio AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)`;
          ticketsReabiertosParams = [fechaInicio, fechaFin];
        } else {
          // Si no hay fechas, cargar TODOS los tickets reabiertos
          ticketsReabiertosQuery = `SELECT COUNT(DISTINCT ht.id_ticket) as count
             FROM Historial_Tickets ht
             INNER JOIN Tickets t ON ht.id_ticket = t.id_ticket
             WHERE ht.estado_anterior IN ('Finalizado', 'Cerrado')
               AND ht.estado_nuevo IN ('Abierto', 'En Progreso', 'Reabierto')`;
          ticketsReabiertosParams = [];
        }

        const ticketsReabiertosResult = await query(ticketsReabiertosQuery, ticketsReabiertosParams);
        ticketsReabiertos = ticketsReabiertosResult && ticketsReabiertosResult[0] ? (parseInt(ticketsReabiertosResult[0].count) || 0) : 0;
        console.log('📊 Tickets reabiertos encontrados:', ticketsReabiertos);
      } else {
        // Si no existe ninguna tabla auxiliar, buscar tickets que cambiaron de "Finalizado" a otro estado
        // Esto es una aproximación básica
        console.log('⚠️ No hay tablas auxiliares para calcular tickets reabiertos, usando 0');
        ticketsReabiertos = 0;
      }
    } catch (error) {
      console.error('⚠️ Error obteniendo tickets reabiertos:', error.message);
      ticketsReabiertos = 0;
    }

    // 10. Número de evaluaciones tardías
    // Evaluación tardía: tickets finalizados pero sin evaluación después de 2 días
    // Incluye tickets cerrados automáticamente por evaluación tardía
    let evaluacionesTardias = 0;
    try {
      let evaluacionesTardiasQuery, evaluacionesTardiasParams;

      if (fechaInicio && fechaFin) {
        evaluacionesTardiasQuery = `SELECT COUNT(*) as count
           FROM Tickets t
           LEFT JOIN Evaluaciones e ON t.id_ticket = e.id_ticket
           WHERE (t.estatus = 'Finalizado' OR (t.estatus = 'Cerrado' AND COALESCE(t.evaluacion_cierre_automatico, 0) = 1))
           AND e.id_evaluacion IS NULL
           AND COALESCE(t.fecha_finalizacion, t.fecha_cierre) IS NOT NULL
           AND CAST(COALESCE(t.fecha_finalizacion, t.fecha_cierre) AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
           AND CAST(COALESCE(t.fecha_finalizacion, t.fecha_cierre) AS DATE) < DATE_SUB(NOW(), INTERVAL 2 DAY)`;
        evaluacionesTardiasParams = [fechaInicio, fechaFin];
      } else {
        // Si no hay fechas, cargar TODAS las evaluaciones tardías
        evaluacionesTardiasQuery = `SELECT COUNT(*) as count
           FROM Tickets t
           LEFT JOIN Evaluaciones e ON t.id_ticket = e.id_ticket
           WHERE (t.estatus = 'Finalizado' OR (t.estatus = 'Cerrado' AND COALESCE(t.evaluacion_cierre_automatico, 0) = 1))
           AND e.id_evaluacion IS NULL
           AND COALESCE(t.fecha_finalizacion, t.fecha_cierre) IS NOT NULL
           AND DATE(COALESCE(t.fecha_finalizacion, t.fecha_cierre)) < DATE_SUB(NOW(), INTERVAL 2 DAY)`;
        evaluacionesTardiasParams = [];
      }
      const evaluacionesTardiasResult = await query(evaluacionesTardiasQuery, evaluacionesTardiasParams);
      evaluacionesTardias = evaluacionesTardiasResult && evaluacionesTardiasResult[0] ? (parseInt(evaluacionesTardiasResult[0].count) || 0) : 0;
      console.log('📊 Evaluaciones tardías encontradas:', evaluacionesTardias);
    } catch (error) {
      console.error('⚠️ Error obteniendo evaluaciones tardías:', error.message);
      evaluacionesTardias = 0;
    }

    // 11. Tickets generados por semana (últimas 4 semanas del período)
    let ticketsPorSemana = [0, 0, 0, 0];
    try {
      if (fechaInicio && fechaFin) {
        const semanasQuery = `
          SELECT
            WEEK(fecha_creacion, 1) - WEEK(CAST(? AS DATE), 1) + 1 as semana,
            COUNT(*) as cantidad
          FROM Tickets
          WHERE CAST(fecha_creacion AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
          GROUP BY WEEK(fecha_creacion, 1)
          ORDER BY semana
          LIMIT 4
        `;
        const semanasResult = await query(semanasQuery, [fechaInicio, fechaInicio, fechaFin]);
        semanasResult.forEach((row, index) => {
          if (index < 4) {
            ticketsPorSemana[index] = row.cantidad || 0;
          }
        });
      } else {
        // Si no hay fechas, usar las últimas 4 semanas de TODOS los tickets
        const semanasQuery = `
          SELECT
            WEEK(fecha_creacion, 1) as semana,
            COUNT(*) as cantidad
          FROM Tickets
          GROUP BY WEEK(fecha_creacion, 1)
          ORDER BY semana DESC
          LIMIT 4
        `;
        const semanasResult = await query(semanasQuery);
        const semanas = semanasResult.reverse();
        semanas.forEach((row, index) => {
          if (index < 4) {
            ticketsPorSemana[index] = row.cantidad || 0;
          }
        });
      }
    } catch (error) {
      console.error('⚠️ Error obteniendo tickets por semana:', error.message);
    }

    // 12. MTTR (Mean Time To Resolution) - Tiempo promedio de resolución
    let mttrHoras = 0;
    let mttrMinutos = 0;
    try {
      let mttrQuery, mttrParams;
      if (fechaInicio && fechaFin) {
        mttrQuery = `
          SELECT AVG(TIMESTAMPDIFF(MINUTE, fecha_creacion, COALESCE(fecha_cierre, fecha_finalizacion))) as promedio_minutos
          FROM Tickets
          WHERE estatus IN ('Finalizado', 'Cerrado')
          AND fecha_cierre IS NOT NULL
          AND CAST(fecha_cierre AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
        `;
        mttrParams = [fechaInicio, fechaFin];
      } else {
        // Si no hay fechas, calcular MTTR de TODOS los tickets
        mttrQuery = `
          SELECT AVG(TIMESTAMPDIFF(MINUTE, fecha_creacion, COALESCE(fecha_cierre, fecha_finalizacion))) as promedio_minutos
          FROM Tickets
          WHERE estatus IN ('Finalizado', 'Cerrado')
          AND fecha_cierre IS NOT NULL
        `;
        mttrParams = [];
      }
      const mttrResult = await query(mttrQuery, mttrParams);
      const promedioMinutos = mttrResult && mttrResult[0] ? (parseFloat(mttrResult[0].promedio_minutos) || 0) : 0;
      mttrHoras = Math.floor(promedioMinutos / 60);
      mttrMinutos = Math.round(promedioMinutos % 60);
      console.log('📊 MTTR calculado - Minutos:', promedioMinutos, 'Horas:', mttrHoras, 'Minutos restantes:', mttrMinutos);
    } catch (error) {
      console.error('⚠️ Error calculando MTTR:', error.message);
    }

    // 13. MTTA (Mean Time To Acknowledge) - Tiempo promedio de atención
    let mttaMinutos = 0;
    try {
      let mttaQuery, mttaParams;
      if (fechaInicio && fechaFin) {
        mttaQuery = `
          SELECT AVG(TIMESTAMPDIFF(MINUTE, fecha_creacion, COALESCE(fecha_asignacion, fecha_creacion))) as promedio_minutos
          FROM Tickets
          WHERE id_tecnico IS NOT NULL
          AND fecha_asignacion IS NOT NULL
          AND CAST(fecha_creacion AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
        `;
        mttaParams = [fechaInicio, fechaFin];
      } else {
        // Si no hay fechas, calcular MTTA de TODOS los tickets
        mttaQuery = `
          SELECT AVG(TIMESTAMPDIFF(MINUTE, fecha_creacion, COALESCE(fecha_asignacion, fecha_creacion))) as promedio_minutos
          FROM Tickets
          WHERE id_tecnico IS NOT NULL
          AND fecha_asignacion IS NOT NULL
        `;
        mttaParams = [];
      }
      const mttaResult = await query(mttaQuery, mttaParams);
      mttaMinutos = mttaResult && mttaResult[0] ? Math.round(parseFloat(mttaResult[0].promedio_minutos) || 0) : 0;
      console.log('📊 MTTA calculado - Minutos:', mttaMinutos);
    } catch (error) {
      console.error('⚠️ Error calculando MTTA:', error.message);
    }

    // 14. Cumplimiento de SLA técnico (% de tickets resueltos dentro del tiempo objetivo)
    let cumplimientoSLA = 0;
    try {
      let slaQuery, slaParams;
      if (fechaInicio && fechaFin) {
        slaQuery = `
          SELECT
            COUNT(*) as total,
            SUM(CASE
              WHEN TIMESTAMPDIFF(HOUR, t.fecha_creacion, COALESCE(t.fecha_cierre, t.fecha_finalizacion)) <= s.tiempo_objetivo
              THEN 1 ELSE 0
            END) as cumplidos
          FROM Tickets t
          INNER JOIN Servicios s ON t.id_servicio = s.id_servicio
          WHERE t.estatus IN ('Finalizado', 'Cerrado')
          AND t.fecha_cierre IS NOT NULL
          AND CAST(t.fecha_cierre AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
        `;
        slaParams = [fechaInicio, fechaFin];
      } else {
        // Si no hay fechas, calcular SLA de TODOS los tickets
        slaQuery = `
          SELECT
            COUNT(*) as total,
            SUM(CASE
              WHEN TIMESTAMPDIFF(HOUR, t.fecha_creacion, COALESCE(t.fecha_cierre, t.fecha_finalizacion)) <= s.tiempo_objetivo
              THEN 1 ELSE 0
            END) as cumplidos
          FROM Tickets t
          INNER JOIN Servicios s ON t.id_servicio = s.id_servicio
          WHERE t.estatus IN ('Finalizado', 'Cerrado')
          AND t.fecha_cierre IS NOT NULL
        `;
        slaParams = [];
      }
      const slaResult = await query(slaQuery, slaParams);
      const total = slaResult && slaResult[0] ? (parseInt(slaResult[0].total) || 0) : 0;
      const cumplidos = slaResult && slaResult[0] ? (parseInt(slaResult[0].cumplidos) || 0) : 0;
      cumplimientoSLA = total > 0 ? Number(((cumplidos / total) * 100).toFixed(1)) : 0;
      console.log('📊 SLA calculado - Total:', total, 'Cumplidos:', cumplidos, 'Porcentaje:', cumplimientoSLA);
    } catch (error) {
      console.error('⚠️ Error calculando cumplimiento SLA:', error.message);
    }

    // 15. Porcentaje de actualización del estado del ticket
    let porcentajeActualizaciones = 0;
    try {
      if (hasHistorialTickets) {
        let actualizacionesQuery, actualizacionesParams;
        if (fechaInicio && fechaFin) {
          actualizacionesQuery = `
            SELECT
              COUNT(DISTINCT t.id_ticket) as total_tickets,
              COUNT(DISTINCT ht.id_ticket) as tickets_con_actualizaciones
            FROM Tickets t
            LEFT JOIN Historial_Tickets ht ON t.id_ticket = ht.id_ticket
            WHERE CAST(t.fecha_creacion AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
          `;
          actualizacionesParams = [fechaInicio, fechaFin];
        } else {
          // Si no hay fechas, calcular porcentaje de TODOS los tickets
          actualizacionesQuery = `
            SELECT
              COUNT(DISTINCT t.id_ticket) as total_tickets,
              COUNT(DISTINCT ht.id_ticket) as tickets_con_actualizaciones
            FROM Tickets t
            LEFT JOIN Historial_Tickets ht ON t.id_ticket = ht.id_ticket
          `;
          actualizacionesParams = [];
        }
        const actualizacionesResult = await query(actualizacionesQuery, actualizacionesParams);
        const total = actualizacionesResult && actualizacionesResult[0] ? (parseInt(actualizacionesResult[0].total_tickets) || 0) : 0;
        const conActualizaciones = actualizacionesResult && actualizacionesResult[0] ? (parseInt(actualizacionesResult[0].tickets_con_actualizaciones) || 0) : 0;
        porcentajeActualizaciones = total > 0 ? Number(((conActualizaciones / total) * 100).toFixed(1)) : 0;
        console.log('📊 Actualizaciones calculadas - Total:', total, 'Con actualizaciones:', conActualizaciones, 'Porcentaje:', porcentajeActualizaciones);
      }
    } catch (error) {
      console.error('⚠️ Error calculando porcentaje de actualizaciones:', error.message);
    }

    return {
      ticketsSolicitados,
      ticketsAtendidos,
      ticketsAsignados,
      ticketsPendientes,
      ticketsSinCerrar,
      ticketsCerradosPorSistema,
      ticketsEscalados,
      ticketsTardios,
      ticketsReabiertos,
      evaluacionesTardias,
      satisfaccionPromedio: Number(satisfaccionPromedio.toFixed(1)),
      ticketsPorSemana,
      mttrHoras,
      mttrMinutos,
      mttaMinutos,
      cumplimientoSLA,
      porcentajeActualizaciones,
      distribucionEvaluaciones
    };
  } catch (error) {
    console.error('❌ Error generando reportes summary:', error);
    console.error('❌ Stack trace:', error.stack);
    // En lugar de lanzar el error, devolver valores por defecto
    return {
      ticketsSolicitados: 0,
      ticketsAtendidos: 0,
      ticketsAsignados: 0,
      ticketsPendientes: 0,
      ticketsSinCerrar: 0,
      ticketsCerradosPorSistema: 0,
      ticketsEscalados: 0,
      ticketsTardios: 0,
      ticketsReabiertos: 0,
      evaluacionesTardias: 0,
      satisfaccionPromedio: 0,
      ticketsPorSemana: [0, 0, 0, 0],
      mttrHoras: 0,
      mttrMinutos: 0,
      mttaMinutos: 0,
      cumplimientoSLA: 0,
      porcentajeActualizaciones: 0
    };
  }
}

async function getDistribucionPorServicio(fechaInicio, fechaFin) {
  try {
    let distribucionQuery, distribucionParams;

    if (fechaInicio && fechaFin) {
      distribucionQuery = `
        SELECT
          CONCAT(s.categoria, ' - ', s.subcategoria) as tipo_servicio,
          COUNT(t.id_ticket) as total
        FROM Tickets t
        INNER JOIN Servicios s ON t.id_servicio = s.id_servicio
        WHERE CAST(t.fecha_creacion AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
        GROUP BY s.categoria, s.subcategoria
        ORDER BY total DESC
      `;
      distribucionParams = [fechaInicio, fechaFin];
    } else {
      distribucionQuery = `
        SELECT
          CONCAT(s.categoria, ' - ', s.subcategoria) as tipo_servicio,
          COUNT(t.id_ticket) as total
        FROM Tickets t
        INNER JOIN Servicios s ON t.id_servicio = s.id_servicio
        GROUP BY s.categoria, s.subcategoria
        ORDER BY total DESC
      `;
      distribucionParams = [];
    }

    const distribucionResult = await query(distribucionQuery, distribucionParams);
    return distribucionResult.map(item => ({
      tipoServicio: item.tipo_servicio,
      total: item.total
    }));
  } catch (error) {
    console.error('❌ Error obteniendo distribución por servicio:', error.message);
    return [];
  }
}

async function getDistribucionEstados(fechaInicio, fechaFin) {
  try {
    let distribucionQuery, distribucionParams;

    if (fechaInicio && fechaFin) {
      distribucionQuery = 'SELECT estatus as estado, COUNT(*) as cantidad FROM Tickets WHERE CAST(fecha_creacion AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) GROUP BY estatus';
      distribucionParams = [fechaInicio, fechaFin];
      console.log('📅 Distribución - Consulta con fechas:', distribucionQuery);
      console.log('📅 Distribución - Parámetros:', distribucionParams);
    } else {
      // Si no hay fechas, cargar TODOS los estados
      distribucionQuery = 'SELECT estatus as estado, COUNT(*) as cantidad FROM Tickets GROUP BY estatus';
      distribucionParams = [];
    }

    const distribucionResult = await query(distribucionQuery, distribucionParams);
    console.log('📊 Resultados de distribución:', distribucionResult);

    // Calcular total para porcentajes
    const total = distribucionResult.reduce((sum, item) => sum + item.cantidad, 0);

    return distribucionResult.map(item => ({
      estado: item.estado,
      cantidad: item.cantidad,
      porcentaje: total > 0 ? Number(((item.cantidad / total) * 100).toFixed(1)) : 0
    }));
  } catch (error) {
    console.error('❌ Error obteniendo distribución de estados:', error.message);
    console.error('❌ Stack trace:', error.stack);
    // Devolver array vacío en lugar de lanzar error
    return [];
  }
}

// Función para obtener rendimiento de técnicos
async function getRendimientoTecnicos(fechaInicio, fechaFin) {
  try {
    let rendimientoQuery, rendimientoParams;

    if (fechaInicio && fechaFin) {
      // Obtener tickets asignados y resueltos por técnico
      rendimientoQuery = `SELECT
          u.id_usuario,
          u.nombre,
          COUNT(t.id_ticket) as ticketsAsignados,
          SUM(CASE WHEN t.estatus IN ('Finalizado', 'Cerrado') THEN 1 ELSE 0 END) as ticketsResueltos,
          SUM(CASE WHEN t.estatus = 'Pendiente' OR t.estatus = 'En Progreso' THEN 1 ELSE 0 END) as ticketsPendientes,
          SUM(CASE WHEN EXISTS (
            SELECT 1 FROM Escalamientos e WHERE e.id_ticket = t.id_ticket
          ) OR t.estatus = 'Escalado' THEN 1 ELSE 0 END) as ticketsEscalados,
          SUM(CASE WHEN EXISTS (
            SELECT 1 FROM TicketReaperturas tr WHERE tr.id_ticket = t.id_ticket
          ) THEN 1 ELSE 0 END) as ticketsReabiertos,
          SUM(CASE WHEN t.fecha_cierre IS NOT NULL AND EXISTS (
            SELECT 1 FROM Tickets t2
            INNER JOIN Servicios s ON t2.id_servicio = s.id_servicio
            WHERE t2.id_ticket = t.id_ticket
            AND TIMESTAMPDIFF(HOUR, t2.fecha_creacion, t2.fecha_cierre) > s.tiempo_objetivo
          ) THEN 1 ELSE 0 END) as ticketsFueraTiempo,
          AVG(e.calificacion) as calificacionPromedio
        FROM Tickets t
        JOIN Usuarios u ON t.id_tecnico = u.id_usuario
        LEFT JOIN Evaluaciones e ON t.id_ticket = e.id_ticket
        WHERE t.id_tecnico IS NOT NULL
        AND CAST(t.fecha_creacion AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
        GROUP BY u.id_usuario, u.nombre`;
      rendimientoParams = [fechaInicio, fechaFin];
    } else {
      rendimientoQuery = `SELECT
          u.id_usuario,
          u.nombre,
          COUNT(t.id_ticket) as ticketsAsignados,
          SUM(CASE WHEN t.estatus IN ('Finalizado', 'Cerrado') THEN 1 ELSE 0 END) as ticketsResueltos,
          SUM(CASE WHEN t.estatus = 'Pendiente' OR t.estatus = 'En Progreso' THEN 1 ELSE 0 END) as ticketsPendientes,
          SUM(CASE WHEN EXISTS (
            SELECT 1 FROM Escalamientos e WHERE e.id_ticket = t.id_ticket
          ) OR t.estatus = 'Escalado' THEN 1 ELSE 0 END) as ticketsEscalados,
          SUM(CASE WHEN EXISTS (
            SELECT 1 FROM TicketReaperturas tr WHERE tr.id_ticket = t.id_ticket
          ) THEN 1 ELSE 0 END) as ticketsReabiertos,
          SUM(CASE WHEN t.fecha_cierre IS NOT NULL AND EXISTS (
            SELECT 1 FROM Tickets t2
            INNER JOIN Servicios s ON t2.id_servicio = s.id_servicio
            WHERE t2.id_ticket = t.id_ticket
            AND TIMESTAMPDIFF(HOUR, t2.fecha_creacion, t2.fecha_cierre) > s.tiempo_objetivo
          ) THEN 1 ELSE 0 END) as ticketsFueraTiempo,
          AVG(e.calificacion) as calificacionPromedio
        FROM Tickets t
        JOIN Usuarios u ON t.id_tecnico = u.id_usuario
        LEFT JOIN Evaluaciones e ON t.id_ticket = e.id_ticket
        WHERE t.id_tecnico IS NOT NULL
        GROUP BY u.id_usuario, u.nombre`;
      rendimientoParams = [];
    }
    const rendimientoResult = await query(rendimientoQuery, rendimientoParams);
    console.log('📊 Resultados de rendimiento técnicos:', rendimientoResult);

    return rendimientoResult.map(tech => ({
      idUsuario: tech.id_usuario,
      nombre: tech.nombre,
      ticketsAsignados: tech.ticketsAsignados || 0,
      ticketsResueltos: tech.ticketsResueltos || 0,
      ticketsPendientes: tech.ticketsPendientes || 0,
      ticketsEscalados: tech.ticketsEscalados || 0,
      ticketsReabiertos: tech.ticketsReabiertos || 0,
      ticketsFueraTiempo: tech.ticketsFueraTiempo || 0,
      calificacionPromedio: tech.calificacionPromedio ? Number(tech.calificacionPromedio.toFixed(1)) : 0
    }));
  } catch (error) {
    console.error('❌ Error obteniendo rendimiento de técnicos:', error.message);
    console.error('❌ Stack trace:', error.stack);
    return [];
  }
}

// Función helper para normalizar fechas (convertir DD/MM/YYYY o DD-MM-YYYY a YYYY-MM-DD)
function normalizarFecha(fecha) {
  if (!fecha || fecha === 'undefined' || fecha === 'null' || fecha.trim() === '') return null;

  // Si ya está en formato YYYY-MM-DD, devolverla tal cual
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return fecha;
  }

  // Intentar convertir de DD/MM/YYYY o DD-MM-YYYY
  const partes = fecha.split(/[\/-]/);
  if (partes.length === 3) {
    // Si el primer elemento es > 12, probablemente es YYYY-MM-DD ya
    if (parseInt(partes[0]) > 12) {
      return fecha; // Ya está en formato YYYY-MM-DD
    }
    // Convertir DD/MM/YYYY o DD-MM-YYYY a YYYY-MM-DD
    const dia = partes[0].padStart(2, '0');
    const mes = partes[1].padStart(2, '0');
    const anio = partes[2];
    return `${anio}-${mes}-${dia}`;
  }

  return fecha;
}

router.get('/summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let { fechaInicio, fechaFin } = req.query;

    console.log('📊 Generando reportes summary...');
    console.log('👤 Usuario:', req.user.nombre);
    console.log('📅 Fecha inicio (query original):', req.query.fechaInicio);
    console.log('📅 Fecha fin (query original):', req.query.fechaFin);
    console.log('📅 Fecha inicio (después de destructuring):', fechaInicio);
    console.log('📅 Fecha fin (después de destructuring):', fechaFin);
    console.log('📅 Tipo fecha inicio:', typeof fechaInicio);
    console.log('📅 Tipo fecha fin:', typeof fechaFin);

    if (!fechaInicio || fechaInicio.trim() === '' || fechaInicio === 'undefined') {
      fechaInicio = null;
      console.log('📅 Fecha inicio establecida como null (cargar todos los tickets)');
    } else {
      fechaInicio = normalizarFecha(fechaInicio);
    }

    if (!fechaFin || fechaFin.trim() === '' || fechaFin === 'undefined') {
      fechaFin = null;
      console.log('📅 Fecha fin establecida como null (cargar todos los tickets)');
    } else {
      fechaFin = normalizarFecha(fechaFin);
    }

    console.log('📅 Fecha inicio (normalizada/final):', fechaInicio);
    console.log('📅 Fecha fin (normalizada/final):', fechaFin);

    let summary, distribucionEstado, rendimientoTecnico;

    try {
      summary = await getReportesSummary(fechaInicio, fechaFin);
      console.log('✅ Summary obtenido exitosamente');
    } catch (error) {
      console.error('❌ Error obteniendo summary:', error.message);
      summary = {
        ticketsSolicitados: 0,
        ticketsAtendidos: 0,
        ticketsAsignados: 0,
        ticketsPendientes: 0,
        ticketsSinCerrar: 0,
        ticketsCerradosPorSistema: 0,
        ticketsEscalados: 0,
        ticketsTardios: 0,
        ticketsReabiertos: 0,
        evaluacionesTardias: 0,
        satisfaccionPromedio: 0,
        ticketsPorSemana: [0, 0, 0, 0],
        mttrHoras: 0,
        mttrMinutos: 0,
        mttaMinutos: 0,
        cumplimientoSLA: 0,
        porcentajeActualizaciones: 0,
        distribucionEvaluaciones: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      };
    }

    try {
      distribucionEstado = await getDistribucionEstados(fechaInicio, fechaFin);
      console.log('✅ Distribución de estados obtenida exitosamente');
    } catch (error) {
      console.error('❌ Error obteniendo distribución de estados:', error.message);
      distribucionEstado = [];
    }

    try {
      rendimientoTecnico = await getRendimientoTecnicos(fechaInicio, fechaFin);
      console.log('✅ Rendimiento de técnicos obtenido exitosamente');
    } catch (error) {
      console.error('❌ Error obteniendo rendimiento de técnicos:', error.message);
      rendimientoTecnico = [];
    }

    let distribucionServicio = [];
    try {
      distribucionServicio = await getDistribucionPorServicio(fechaInicio, fechaFin);
      console.log('✅ Distribución por servicio obtenida exitosamente');
    } catch (error) {
      console.error('❌ Error obteniendo distribución por servicio:', error.message);
      distribucionServicio = [];
    }

    const response = {
      summary,
      distribucionEstado,
      rendimientoTecnico,
      distribucionServicio
    };

    console.log('📊 Respuesta completa del reporte:', JSON.stringify(response, null, 2));
    console.log('📊 Tickets solicitados en respuesta:', response.summary.ticketsSolicitados);

    // Guardar reporte generado en la tabla REPORTES (si existe)
    try {
      // Verificar si la tabla REPORTES existe
      const reportesTableExists = await query(`
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'REPORTES'
      `);

      if (reportesTableExists[0]?.count > 0) {
        await query(
          'INSERT INTO REPORTES (nombre_reporte, tipo_reporte, descripcion, id_usuario_generador, fecha_inicio, fecha_fin, parametros, datos_reporte, tiempo_procesamiento_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            'Reporte Resumen General',
            'reporte_completo',
            'Reporte completo con todas las métricas del sistema',
            req.user.id_usuario,
            fechaInicio || null,
            fechaFin || null,
            JSON.stringify({ fechaInicio, fechaFin }),
            JSON.stringify(response),
            Date.now()
          ]
        );
        console.log('✅ Reporte guardado en tabla REPORTES');
      } else {
        console.log('⚠️ Tabla REPORTES no existe, omitiendo guardado');
      }
    } catch (saveError) {
      // Si falla el guardado, continuar de todas formas
      console.error('⚠️ Error guardando reporte en tabla REPORTES:', saveError.message);
      console.log('ℹ️ Continuando con envío de respuesta al cliente...');
    }

    console.log('✅ Reportes generados exitosamente');
    console.log('📊 Datos del resumen:', JSON.stringify(response.summary, null, 2));
    console.log('📊 Tickets solicitados en respuesta:', response.summary.ticketsSolicitados);
    console.log('📊 Tickets atendidos en respuesta:', response.summary.ticketsAtendidos);

    // Verificar si hay datos
    if (response.summary.ticketsSolicitados === 0) {
      console.warn('⚠️ ADVERTENCIA: No se encontraron tickets en el rango de fechas especificado');
      console.warn('⚠️ Fecha inicio:', fechaInicio);
      console.warn('⚠️ Fecha fin:', fechaFin);
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Error generando reportes:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      error: 'Error interno del servidor al generar reportes',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Ruta para reportes por período
router.get('/period/:periodo', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { periodo } = req.params;
    let fechaInicio, fechaFin;

    const hoy = new Date();
    switch (periodo) {
      case 'hoy':
        fechaInicio = fechaFin = hoy.toISOString().split('T')[0];
        break;
      case 'semana':
        const inicioSemana = new Date(hoy);
        inicioSemana.setDate(hoy.getDate() - hoy.getDay());
        fechaInicio = inicioSemana.toISOString().split('T')[0];
        fechaFin = hoy.toISOString().split('T')[0];
        break;
      case 'mes':
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        fechaInicio = inicioMes.toISOString().split('T')[0];
        fechaFin = hoy.toISOString().split('T')[0];
        break;
      case 'año':
        const inicioAño = new Date(hoy.getFullYear(), 0, 1);
        fechaInicio = inicioAño.toISOString().split('T')[0];
        fechaFin = hoy.toISOString().split('T')[0];
        break;
      default:
        return res.status(400).json({ error: 'Período no válido' });
    }

    console.log('📊 Generando reportes para período:', periodo);
    console.log('📅 Fecha inicio:', fechaInicio);
    console.log('📅 Fecha fin:', fechaFin);

    // Obtener datos de los reportes
    const summary = await getReportesSummary(fechaInicio, fechaFin);
    const distribucionEstado = await getDistribucionEstados(fechaInicio, fechaFin);
    const rendimientoTecnico = await getRendimientoTecnicos(fechaInicio, fechaFin);

    const response = {
      summary,
      distribucionEstado,
      rendimientoTecnico
    };

    // Guardar reporte generado en la tabla REPORTES (si existe)
    try {
      const reportesTableExists = await tableExists('REPORTES');
      if (reportesTableExists) {
        await query(
          'INSERT INTO REPORTES (nombre_reporte, tipo_reporte, descripcion, id_usuario_generador, fecha_inicio, fecha_fin, parametros, datos_reporte, tiempo_procesamiento_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            `Reporte Período ${periodo}`,
            'reporte_completo',
            `Reporte generado para el período: ${periodo}`,
            req.user.id_usuario,
            fechaInicio,
            fechaFin,
            JSON.stringify({ periodo }),
            JSON.stringify(response),
            Date.now()
          ]
        );
        console.log('✅ Reporte guardado en tabla REPORTES');
      } else {
        console.log('⚠️ Tabla REPORTES no existe, omitiendo guardado');
      }
    } catch (saveError) {
      console.error('⚠️ Error guardando reporte en tabla REPORTES:', saveError.message);
      console.log('ℹ️ Continuando con envío de respuesta al cliente...');
    }

    console.log('✅ Reportes por período generados exitosamente');
    res.json(response);

  } catch (error) {
    console.error('❌ Error generando reportes por período:', error);
    res.status(500).json({ error: 'Error interno del servidor al generar reportes' });
  }
});

// Ruta para obtener logs de reportes
router.get('/logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    // Verificar si la tabla REPORTES existe
    const reportesTableExists = await tableExists('REPORTES');

    if (!reportesTableExists) {
      console.log('⚠️ Tabla REPORTES no existe, devolviendo array vacío');
      return res.json({ logs: [] });
    }

    const logs = await query(
      'SELECT r.*, u.nombre as usuario_nombre FROM REPORTES r JOIN Usuarios u ON r.id_usuario_generador = u.id_usuario ORDER BY r.fecha_generacion DESC LIMIT ? OFFSET ?',
      [parseInt(limit), parseInt(offset)]
    );

    res.json({ logs });

  } catch (error) {
    console.error('❌ Error obteniendo logs de reportes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/reports/saved - Obtener reportes guardados
router.get('/saved', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { limit = 50, offset = 0, tipo_reporte } = req.query;
    console.log('📊 Obteniendo reportes guardados...');

    // Verificar si la tabla REPORTES existe
    const reportesTableExists = await tableExists('REPORTES');

    if (!reportesTableExists) {
      console.log('⚠️ Tabla REPORTES no existe, devolviendo array vacío');
      return res.json([]);
    }

    let query_sql = `
      SELECT r.*, u.nombre as usuario_nombre
      FROM REPORTES r
      JOIN Usuarios u ON r.id_usuario_generador = u.id_usuario
    `;

    let params = [];

    if (tipo_reporte) {
      query_sql += ' WHERE r.tipo_reporte = ?';
      params.push(tipo_reporte);
    }

    query_sql += ' ORDER BY r.fecha_generacion DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const reportes = await query(query_sql, params);

    console.log(`✅ ${reportes.length} reportes guardados obtenidos`);
    res.json(reportes);

  } catch (error) {
    console.error('Error al obtener reportes guardados:', error);
    res.status(500).json({ error: 'Error interno del servidor al obtener reportes guardados' });
  }
});

// GET /api/reports/saved/:id - Obtener un reporte específico
router.get('/saved/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📊 Obteniendo reporte ID: ${id}...`);

    // Verificar si la tabla REPORTES existe
    const reportesTableExists = await tableExists('REPORTES');

    if (!reportesTableExists) {
      console.log('⚠️ Tabla REPORTES no existe');
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }

    const reporte = await query(
      'SELECT r.*, u.nombre as usuario_nombre FROM REPORTES r JOIN Usuarios u ON r.id_usuario_generador = u.id_usuario WHERE r.id_reporte = ?',
      [id]
    );

    if (reporte.length === 0) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }

    console.log(`✅ Reporte ${id} obtenido exitosamente`);
    res.json(reporte[0]);

  } catch (error) {
    console.error('Error al obtener reporte:', error);
    res.status(500).json({ error: 'Error interno del servidor al obtener reporte' });
  }
});

// Ruta para obtener reporte individual por técnico
router.get('/tecnico/:idTecnico', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { idTecnico } = req.params;
    let { fechaInicio, fechaFin } = req.query;

    // Normalizar fechas
    fechaInicio = normalizarFecha(fechaInicio);
    fechaFin = normalizarFecha(fechaFin);

    console.log(`📊 Generando reporte individual para técnico ID: ${idTecnico}`);

    // Obtener información del técnico
    const tecnicoInfo = await query(
      'SELECT id_usuario, nombre, email FROM Usuarios WHERE id_usuario = ? AND rol IN ("tecnico", "administrador")',
      [idTecnico]
    );

    if (tecnicoInfo.length === 0) {
      return res.status(404).json({ error: 'Técnico no encontrado' });
    }

    const tecnico = tecnicoInfo[0];

    // Construir query para métricas del técnico
    let metricasQuery, metricasParams;
    if (fechaInicio && fechaFin) {
      metricasQuery = `
        SELECT
          COUNT(t.id_ticket) as ticketsAsignados,
          SUM(CASE WHEN t.estatus IN ('Finalizado', 'Cerrado') THEN 1 ELSE 0 END) as ticketsResueltos,
          SUM(CASE WHEN t.estatus = 'Pendiente' OR t.estatus = 'En Progreso' THEN 1 ELSE 0 END) as ticketsPendientes,
          SUM(CASE WHEN EXISTS (
            SELECT 1 FROM Escalamientos e WHERE e.id_ticket = t.id_ticket
          ) OR t.estatus = 'Escalado' THEN 1 ELSE 0 END) as ticketsEscalados,
          SUM(CASE WHEN EXISTS (
            SELECT 1 FROM TicketReaperturas tr WHERE tr.id_ticket = t.id_ticket
          ) THEN 1 ELSE 0 END) as ticketsReabiertos,
          SUM(CASE WHEN t.fecha_cierre IS NOT NULL AND EXISTS (
            SELECT 1 FROM Tickets t2
            INNER JOIN Servicios s ON t2.id_servicio = s.id_servicio
            WHERE t2.id_ticket = t.id_ticket
            AND TIMESTAMPDIFF(HOUR, t2.fecha_creacion, t2.fecha_cierre) > s.tiempo_objetivo
          ) THEN 1 ELSE 0 END) as ticketsFueraTiempo,
          AVG(e.calificacion) as calificacionPromedio
        FROM Tickets t
        LEFT JOIN Evaluaciones e ON t.id_ticket = e.id_ticket
        WHERE t.id_tecnico = ?
        AND CAST(t.fecha_creacion AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
      `;
      metricasParams = [idTecnico, fechaInicio, fechaFin];
    } else {
      metricasQuery = `
        SELECT
          COUNT(t.id_ticket) as ticketsAsignados,
          SUM(CASE WHEN t.estatus IN ('Finalizado', 'Cerrado') THEN 1 ELSE 0 END) as ticketsResueltos,
          SUM(CASE WHEN t.estatus = 'Pendiente' OR t.estatus = 'En Progreso' THEN 1 ELSE 0 END) as ticketsPendientes,
          SUM(CASE WHEN EXISTS (
            SELECT 1 FROM Escalamientos e WHERE e.id_ticket = t.id_ticket
          ) OR t.estatus = 'Escalado' THEN 1 ELSE 0 END) as ticketsEscalados,
          SUM(CASE WHEN EXISTS (
            SELECT 1 FROM TicketReaperturas tr WHERE tr.id_ticket = t.id_ticket
          ) THEN 1 ELSE 0 END) as ticketsReabiertos,
          SUM(CASE WHEN t.fecha_cierre IS NOT NULL AND EXISTS (
            SELECT 1 FROM Tickets t2
            INNER JOIN Servicios s ON t2.id_servicio = s.id_servicio
            WHERE t2.id_ticket = t.id_ticket
            AND TIMESTAMPDIFF(HOUR, t2.fecha_creacion, t2.fecha_cierre) > s.tiempo_objetivo
          ) THEN 1 ELSE 0 END) as ticketsFueraTiempo,
          AVG(e.calificacion) as calificacionPromedio
        FROM Tickets t
        LEFT JOIN Evaluaciones e ON t.id_ticket = e.id_ticket
        WHERE t.id_tecnico = ?
        AND DATE(t.fecha_creacion) >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `;
      metricasParams = [idTecnico];
    }

    const metricasResult = await query(metricasQuery, metricasParams);
    const metricas = metricasResult[0] || {};

    const reporte = {
      tecnico: {
        id: tecnico.id_usuario,
        nombre: tecnico.nombre,
        email: tecnico.email
      },
      periodo: {
        fechaInicio: fechaInicio || null,
        fechaFin: fechaFin || null
      },
      metricas: {
        ticketsAsignados: metricas.ticketsAsignados || 0,
        ticketsResueltos: metricas.ticketsResueltos || 0,
        ticketsPendientes: metricas.ticketsPendientes || 0,
        ticketsEscalados: metricas.ticketsEscalados || 0,
        ticketsReabiertos: metricas.ticketsReabiertos || 0,
        ticketsFueraTiempo: metricas.ticketsFueraTiempo || 0,
        calificacionPromedio: metricas.calificacionPromedio ? Number(metricas.calificacionPromedio.toFixed(1)) : 0
      }
    };

    console.log('✅ Reporte individual generado exitosamente');
    res.json(reporte);

  } catch (error) {
    console.error('❌ Error generando reporte individual:', error);
    res.status(500).json({ error: 'Error interno del servidor al generar reporte individual' });
  }
});

module.exports = router;
