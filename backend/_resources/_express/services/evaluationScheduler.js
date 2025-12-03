const { query, testConnection } = require('../config/database');
const emailService = require('./emailService');

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function parseIntegerEnv(name, defaultValue) {
  const value = parseInt(process.env[name] || '', 10);
  return Number.isNaN(value) ? defaultValue : value;
}

function minutesToMs(minutes) {
  return Math.max(1, minutes) * 60 * 1000;
}

let schedulerHandle = null;

async function getTicketsPendingEvaluation({ reminderDays, autoCloseDays }) {
  const [reminderTickets, autoCloseTickets, allPendingTickets] = await Promise.all([
    // Tickets que necesitan recordatorio: finalizados hace X días pero menos de Y días
    // Usamos COALESCE para usar fecha_finalizacion si existe, sino fecha_cierre
    query(`
      SELECT
        t.id_ticket,
        t.descripcion,
        t.estatus,
        COALESCE(t.fecha_finalizacion, t.fecha_cierre) AS fecha_finalizacion,
        t.evaluacion_ultimo_recordatorio,
        t.evaluacion_recordatorio_contador,
        u.id_usuario,
        u.nombre AS usuario_nombre,
        u.correo AS usuario_correo
      FROM Tickets t
      JOIN Usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN Evaluaciones e ON e.id_ticket = t.id_ticket
      WHERE t.estatus = 'Finalizado'
        AND e.id_evaluacion IS NULL
        AND COALESCE(t.fecha_finalizacion, t.fecha_cierre) IS NOT NULL
        AND DATE(COALESCE(t.fecha_finalizacion, t.fecha_cierre)) <= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND DATE(COALESCE(t.fecha_finalizacion, t.fecha_cierre)) > DATE_SUB(NOW(), INTERVAL ? DAY)
        AND (t.evaluacion_ultimo_recordatorio IS NULL OR DATE(t.evaluacion_ultimo_recordatorio) < DATE(NOW()))
    `, [reminderDays, autoCloseDays]),
    // Tickets que deben cerrarse automáticamente: finalizados hace X+ días sin evaluación
    query(`
      SELECT
        t.id_ticket,
        t.descripcion,
        t.estatus,
        COALESCE(t.fecha_finalizacion, t.fecha_cierre) AS fecha_finalizacion,
        u.id_usuario,
        u.nombre AS usuario_nombre,
        u.correo AS usuario_correo,
        tec.nombre AS tecnico_nombre,
        tec.correo AS tecnico_correo
      FROM Tickets t
      JOIN Usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN Usuarios tec ON t.id_tecnico = tec.id_usuario
      LEFT JOIN Evaluaciones e ON e.id_ticket = t.id_ticket
      WHERE t.estatus = 'Finalizado'
        AND e.id_evaluacion IS NULL
        AND COALESCE(t.fecha_finalizacion, t.fecha_cierre) IS NOT NULL
        AND DATE(COALESCE(t.fecha_finalizacion, t.fecha_cierre)) <= DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [autoCloseDays]),
    // TODOS los tickets pendientes de evaluación (para correos diarios)
    query(`
      SELECT
        t.id_ticket,
        t.descripcion,
        t.estatus,
        COALESCE(t.fecha_finalizacion, t.fecha_cierre) AS fecha_finalizacion,
        u.id_usuario,
        u.nombre AS usuario_nombre,
        u.correo AS usuario_correo
      FROM Tickets t
      JOIN Usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN Evaluaciones e ON e.id_ticket = t.id_ticket
      WHERE (t.estatus = 'Finalizado' OR (t.estatus = 'Cerrado' AND COALESCE(t.evaluacion_cierre_automatico, 0) = 1))
        AND e.id_evaluacion IS NULL
        AND COALESCE(t.fecha_finalizacion, t.fecha_cierre) IS NOT NULL
        AND (t.evaluacion_ultimo_recordatorio_diario IS NULL OR DATE(t.evaluacion_ultimo_recordatorio_diario) < DATE(NOW()))
    `)
  ]);

  return { reminderTickets, autoCloseTickets, allPendingTickets };
}

async function sendReminderEmail(ticket) {
  try {
    await emailService.sendEvaluationReminderEmail(ticket);
    await query(`
      UPDATE Tickets
      SET evaluacion_ultimo_recordatorio = NOW(), evaluacion_recordatorio_contador = COALESCE(evaluacion_recordatorio_contador, 0) + 1
      WHERE id_ticket = ?
    `, [ticket.id_ticket]);
    console.log(`📧 Recordatorio de evaluación enviado para ticket #${ticket.id_ticket}`);
  } catch (error) {
    console.error(`❌ Error enviando recordatorio de evaluación para ticket #${ticket.id_ticket}:`, error.message);
  }
}

async function closeTicketAutomatically(ticket) {
  try {
    // Cerrar el ticket automáticamente pero mantener fecha_finalizacion original
    // Solo actualizar fecha_cierre si no existe (para no sobrescribir si ya estaba cerrado)
    await query(`
      UPDATE Tickets
      SET
        estatus = 'Cerrado',
        fecha_cierre = COALESCE(fecha_cierre, NOW()),
        evaluacion_cierre_automatico = 1,
        evaluacion_ultimo_recordatorio = NOW()
      WHERE id_ticket = ?
    `, [ticket.id_ticket]);

    // Actualizar el objeto ticket para el email
    ticket.estatus = 'Cerrado por el sistema';

    await emailService.sendEvaluationAutoClosedEmail(ticket);

    console.log(`✅ Ticket #${ticket.id_ticket} cerrado automáticamente por evaluación tardía - Estado: "Cerrado por el sistema"`);
  } catch (error) {
    console.error(`❌ Error cerrando automáticamente ticket #${ticket.id_ticket}:`, error.message);
  }
}

async function sendDailyReminders(allPendingTickets) {
  // Agrupar tickets por usuario
  const ticketsByUser = {};
  for (const ticket of allPendingTickets) {
    if (!ticketsByUser[ticket.id_usuario]) {
      ticketsByUser[ticket.id_usuario] = {
        usuario: {
          id_usuario: ticket.id_usuario,
          nombre: ticket.usuario_nombre,
          correo: ticket.usuario_correo
        },
        tickets: []
      };
    }
    ticketsByUser[ticket.id_usuario].tickets.push({
      id_ticket: ticket.id_ticket,
      descripcion: ticket.descripcion,
      estatus: ticket.estatus,
      fecha_finalizacion: ticket.fecha_finalizacion
    });
  }

  // Enviar correo diario a cada usuario con sus tickets pendientes
  for (const userId in ticketsByUser) {
    const { usuario, tickets } = ticketsByUser[userId];
    try {
      await emailService.sendDailyEvaluationReminderEmail(usuario, tickets);

      // Actualizar fecha del último recordatorio diario para todos los tickets del usuario
      const ticketIds = tickets.map(t => t.id_ticket);
      if (ticketIds.length > 0) {
        await query(`
          UPDATE Tickets
          SET evaluacion_ultimo_recordatorio_diario = NOW()
          WHERE id_ticket IN (${ticketIds.map(() => '?').join(',')})
        `, ticketIds);
      }

      console.log(`📧 Correo diario de evaluación enviado a ${usuario.nombre} (${tickets.length} ticket(s) pendiente(s))`);
    } catch (error) {
      console.error(`❌ Error enviando correo diario a ${usuario.nombre}:`, error.message);
    }
  }
}

async function processEvaluationReminders({ reminderDays, autoCloseDays }) {
  try {
    const connected = await testConnection();
    if (!connected) {
      console.warn('⚠️ No se pudo ejecutar el scheduler de evaluaciones: sin conexión a la base de datos');
      return;
    }

    const { reminderTickets, autoCloseTickets, allPendingTickets } = await getTicketsPendingEvaluation({ reminderDays, autoCloseDays });

    // Enviar correos diarios a todos los usuarios con tickets pendientes
    if (allPendingTickets.length > 0) {
      await sendDailyReminders(allPendingTickets);
    }

    // Enviar recordatorios específicos
    for (const ticket of reminderTickets) {
      await sendReminderEmail(ticket);
    }

    // Cerrar tickets automáticamente
    for (const ticket of autoCloseTickets) {
      await closeTicketAutomatically(ticket);
    }
  } catch (error) {
    console.error('❌ Error en el scheduler de recordatorios de evaluación:', error.message);
  }
}

function startEvaluationScheduler() {
  if (schedulerHandle) {
    return;
  }

  const reminderDays = parseIntegerEnv('EVALUATION_REMINDER_DAYS', 1);
  const autoCloseDays = parseIntegerEnv('EVALUATION_AUTO_CLOSE_DAYS', 2);
  const checkIntervalMinutes = parseIntegerEnv('EVALUATION_CHECK_INTERVAL_MINUTES', 60);
  // Para correos diarios, ejecutar una vez al día (1440 minutos = 24 horas)
  const dailyCheckIntervalMinutes = parseIntegerEnv('EVALUATION_DAILY_CHECK_INTERVAL_MINUTES', 1440);

  console.log(`⏱️ Scheduler de evaluaciones iniciado:`);
  console.log(`   - Recordatorio cada ${reminderDays} día(s)`);
  console.log(`   - Cierre automático tras ${autoCloseDays} día(s)`);
  console.log(`   - Verificación general cada ${checkIntervalMinutes} min`);
  console.log(`   - Correos diarios cada ${dailyCheckIntervalMinutes} min (${dailyCheckIntervalMinutes / 60} horas)`);

  const run = () => processEvaluationReminders({ reminderDays, autoCloseDays });

  // Ejecutar inmediatamente
  run();

  // Ejecutar periódicamente según el intervalo configurado
  schedulerHandle = setInterval(run, minutesToMs(checkIntervalMinutes));
}

function stopEvaluationScheduler() {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }
}

module.exports = {
  startEvaluationScheduler,
  stopEvaluationScheduler
};


