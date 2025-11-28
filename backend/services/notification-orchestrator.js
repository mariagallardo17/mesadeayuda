const { query } = require('../config/database');
const emailService = require('./emailService');

/**
 * Maneja las notificaciones de un ticket recién creado/asignado
 */
async function notifyTicketAssignment({ ticket }) {
  if (!ticket) {
    console.warn('notifyTicketAssignment: ticket indefinido');
    return;
  }

  if (!ticket.tecnico_nombre || !ticket.tecnico_correo) {
    console.log('notifyTicketAssignment: no hay técnico asignado, se omite correo');
    return;
  }

  const ticketData = {
    id: ticket.id_ticket,
    titulo: `${ticket.categoria} - ${ticket.subcategoria}`,
    descripcion: ticket.descripcion,
    prioridad: ticket.prioridad,
    fecha_creacion: ticket.fecha_creacion
  };

  const technicianData = {
    nombre: ticket.tecnico_nombre,
    email: ticket.tecnico_correo
  };

  const employeeData = {
    nombre: ticket.nombre,
    email: ticket.correo
  };

  try {
    console.log(`📧 notifyTicketAssignment → ticket #${ticket.id_ticket}`);
    await emailService.sendTicketAssignedNotification(ticketData, technicianData, employeeData);
    console.log(`✅ Correo de asignación enviado para ticket #${ticket.id_ticket}`);
  } catch (error) {
    console.error(`❌ notifyTicketAssignment error (ticket #${ticket.id_ticket}):`, error.message);
  }
}

/**
 * Notifica cambios de estado del ticket (incluye reaperturas)
 */
async function notifyStatusChange({
  ticketId,
  estatus,
  isEmployeeReopening = false,
  cleanedComentarios = null,
  cleanedPendienteTiempo = null
}) {
  console.log(`🔔🔔🔔 notifyStatusChange LLAMADO 🔔🔔🔔`);
  console.log(`🔔 Parámetros recibidos:`, {
    ticketId,
    estatus,
    isEmployeeReopening,
    cleanedComentarios,
    cleanedPendienteTiempo
  });

  if (!ticketId) {
    console.error('❌ notifyStatusChange: ticketId requerido - ABORTANDO');
    return;
  }

  try {
    console.log(`📧 notifyStatusChange → ticket #${ticketId}, estado: ${estatus}`);

    const ticketInfo = await query(`
      SELECT
        t.id_ticket,
        t.descripcion,
        t.prioridad,
        t.estatus,
        t.fecha_creacion,
        t.pendiente_motivo,
        t.pendiente_tiempo_estimado,
        t.id_usuario AS usuario_id,
        s.categoria,
        s.subcategoria,
        u.nombre AS usuario_nombre,
        u.correo AS usuario_correo,
        u.rol AS usuario_rol,
        tec.nombre AS tecnico_nombre,
        tec.correo AS tecnico_correo
      FROM Tickets t
      JOIN Servicios s ON t.id_servicio = s.id_servicio
      JOIN Usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN Usuarios tec ON t.id_tecnico = tec.id_usuario
      WHERE t.id_ticket = ?
    `, [ticketId]);

    if (ticketInfo.length === 0) {
      console.warn(`notifyStatusChange: no se encontró ticket #${ticketId}`);
      return;
    }

    const ticketData = ticketInfo[0];
    const technicianInfo = ticketData.tecnico_nombre ? {
      nombre: ticketData.tecnico_nombre,
      email: ticketData.tecnico_correo
    } : { nombre: 'Equipo de soporte', email: null };

    const employeeInfo = {
      nombre: ticketData.usuario_nombre,
      email: ticketData.usuario_correo
    };

    // Crear notificación en BD PRIMERO (independiente de si hay email o no)
    console.log(`📧 ===== INICIANDO CREACIÓN DE NOTIFICACIÓN EN BD =====`);
    console.log(`📧 Ticket ID: ${ticketId}`);
    console.log(`📧 Estado: ${estatus}`);
    console.log(`📧 Datos completos del ticket:`, JSON.stringify(ticketData, null, 2));

    try {
      console.log(`📧 Verificando datos del ticket para notificación en BD:`, {
        ticketId: ticketData.id_ticket,
        usuario_id: ticketData.usuario_id,
        estatus: estatus,
        tiene_usuario_id: !!ticketData.usuario_id,
        tipo_usuario_id: typeof ticketData.usuario_id
      });

      if (!ticketData.usuario_id) {
        console.error(`❌ ERROR: ticket #${ticketId} NO tiene usuario_id`);
        console.error(`❌ Datos completos del ticket:`, JSON.stringify(ticketData, null, 2));
        console.error(`❌ Claves disponibles:`, Object.keys(ticketData));
        console.error(`❌ Valores de claves relacionadas:`, {
          'ticketData.id_usuario': ticketData.id_usuario,
          'ticketData.usuario_id': ticketData.usuario_id,
          'ticketData.usuario_nombre': ticketData.usuario_nombre
        });
        return; // Salir temprano si no hay usuario_id
      }

      let notificationMessage = '';

      // Solo crear notificaciones de "Finalizado" para usuarios/empleados, no para técnicos
      if (estatus === 'Finalizado') {
        // Verificar que el usuario sea empleado, no técnico ni administrador
        if (ticketData.usuario_rol && ticketData.usuario_rol !== 'empleado') {
          console.log(`⚠️ Omitiendo notificación de ticket finalizado para usuario con rol: ${ticketData.usuario_rol} (solo se notifica a empleados)`);
          // No crear notificación para técnicos/administradores
        } else {
          notificationMessage = `Tu ticket #${ticketData.id_ticket} ha sido finalizado. Está listo para que lo evalúes.`;
        }
      } else if (estatus === 'En Progreso') {
        notificationMessage = `Tu ticket #${ticketData.id_ticket} está en progreso. El técnico está trabajando en la solución.`;
      } else if (estatus === 'Escalado') {
        notificationMessage = `Tu ticket #${ticketData.id_ticket} ha sido escalado al administrador para su revisión.`;
      } else if (estatus === 'Pendiente' && isEmployeeReopening) {
        notificationMessage = `Tu ticket #${ticketData.id_ticket} ha sido reabierto. El técnico revisará tu solicitud.`;
      } else if (estatus === 'Pendiente') {
        notificationMessage = `Tu ticket #${ticketData.id_ticket} ha sido marcado como pendiente. El técnico retomará el trabajo según el tiempo estimado.`;
      } else {
        notificationMessage = `El ticket #${ticketData.id_ticket} cambió de estado a "${estatus}"`;
      }

      // Solo crear notificación si hay mensaje (puede estar vacío si el usuario es técnico)
      if (notificationMessage) {
        console.log(`📧 Preparando INSERT en BD:`, {
          id_usuario: ticketData.usuario_id,
          id_ticket: ticketData.id_ticket,
          tipo: 'Interna',
          mensaje: notificationMessage,
          usuario_rol: ticketData.usuario_rol
        });

        const insertParams = [
          ticketData.usuario_id,
          ticketData.id_ticket,
          'Interna', // ENUM válido: 'Correo', 'WhatsApp', 'Interna'
          notificationMessage
        ];

        console.log(`📧 Ejecutando INSERT con parámetros:`, insertParams);

        const result = await query(`
          INSERT INTO Notificaciones (id_usuario, id_ticket, tipo, mensaje)
          VALUES (?, ?, ?, ?)
        `, insertParams);

        console.log(`✅✅✅ NOTIFICACIÓN CREADA EXITOSAMENTE EN BD ✅✅✅`);
        console.log(`✅ Resultado del INSERT:`, {
          insertId: result.insertId,
          affectedRows: result.affectedRows,
          warningCount: result.warningCount
        });
        console.log(`✅ Detalles de la notificación:`, {
          notificationId: result.insertId,
          usuario_id: ticketData.usuario_id,
          ticket_id: ticketData.id_ticket,
          mensaje: notificationMessage
        });
      } else {
        console.log(`⚠️ No se creará notificación porque el mensaje está vacío (probablemente usuario técnico)`);
      }
    } catch (notifDbError) {
      console.error(`❌❌❌ ERROR CRÍTICO CREANDO NOTIFICACIÓN EN BD ❌❌❌`);
      console.error(`❌ Ticket ID: ${ticketId}`);
      console.error(`❌ Error message:`, notifDbError.message);
      console.error(`❌ Error code:`, notifDbError.code);
      console.error(`❌ Error sqlState:`, notifDbError.sqlState);
      console.error(`❌ Error sqlMessage:`, notifDbError.sqlMessage);
      console.error(`❌ Stack trace:`, notifDbError.stack);
      console.error(`❌ Datos del ticket:`, JSON.stringify(ticketData, null, 2));
    }

    console.log(`📧 ===== FIN DE CREACIÓN DE NOTIFICACIÓN EN BD =====`);

    // Enviar email solo si hay email disponible
    if (!employeeInfo.email) {
      console.warn(`⚠️ notifyStatusChange: el ticket #${ticketId} no tiene correo de usuario, se omite envío de email`);
      return; // Salir aquí porque no hay email para enviar
    }

    const baseUrl = emailService.getFrontendUrl();
    let actionUrl = `${baseUrl}/tickets/tracking?ticketId=${ticketData.id_ticket}`;
    let actionText = 'Ir al seguimiento del ticket';
    let subject = `🔔 Estado del ticket #${ticketData.id_ticket} actualizado`;
    let title = '🔔 Estado del Ticket Actualizado';
    let color = '#2196F3';
    let message = `<p>El estado de tu ticket ha sido actualizado:</p>`;

    if (estatus === 'Finalizado') {
      subject = `✅ Tu ticket #${ticketData.id_ticket} ha sido finalizado - Listo para evaluar`;
      title = '✅ Ticket Finalizado';
      color = '#28a745';
      actionUrl = `${baseUrl}/tickets/close?ticketId=${ticketData.id_ticket}`;
      actionText = 'Evaluar ticket';
      message = `
        <p>¡Excelente noticia! Tu ticket ha sido finalizado y está listo para que lo evalúes:</p>
        <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <h4 style="color: #28a745; margin-top: 0;">📝 Próximo paso: Evaluar el servicio</h4>
          <p>Ahora puedes evaluar la calidad del servicio recibido y cerrar tu ticket. Tu opinión es muy importante para nosotros.</p>
          <p><strong>¿Cómo evaluar?</strong></p>
          <ul>
            <li>Ve a la sección "Cerrar Ticket" en tu panel</li>
            <li>Selecciona este ticket de la lista</li>
            <li>Califica el servicio del 1 al 5</li>
            <li>Deja tus comentarios</li>
          </ul>
        </div>
      `;
    } else if (estatus === 'En Progreso') {
      subject = `🔄 Tu ticket #${ticketData.id_ticket} está en progreso`;
      title = '🔄 Ticket en Progreso';
      color = '#ffc107';
      actionUrl = `${baseUrl}/tickets/tracking?ticketId=${ticketData.id_ticket}`;
      actionText = 'Ver seguimiento del ticket';
      message = `
        <p>Tu ticket ha sido actualizado y está siendo atendido por el técnico asignado.</p>
        <p>El técnico está trabajando en la solución de tu solicitud.</p>
      `;
    } else if (estatus === 'Escalado') {
      subject = `📤 Tu ticket #${ticketData.id_ticket} ha sido escalado`;
      title = '📤 Ticket Escalado';
      color = '#17a2b8';
      actionUrl = `${baseUrl}/tickets/tracking?ticketId=${ticketData.id_ticket}`;
      actionText = 'Ver seguimiento del ticket';
      message = `
        <p>Tu ticket ha sido escalado al administrador para su revisión.</p>
        <p>El administrador revisará tu solicitud y tomará las acciones necesarias.</p>
      `;
    } else if (estatus === 'Pendiente') {
      // Si es reapertura por empleado
      if (isEmployeeReopening) {
        subject = `♻️ Tu ticket #${ticketData.id_ticket} ha sido reabierto`;
        title = '♻️ Ticket Reabierto';
        color = '#6c5ce7';
        actionUrl = `${baseUrl}/tickets/reopened`;
        actionText = 'Ver tickets reabiertos';
        const motivoReapertura = cleanedComentarios ? `<p><strong>Observaciones:</strong> ${cleanedComentarios}</p>` : '';
        message = `
          <p>Has reabierto tu ticket y ha regresado a la bandeja del equipo de soporte para su seguimiento.</p>
          ${motivoReapertura}
          <p>El técnico revisará tu solicitud y te dará seguimiento.</p>
        `;
      } else {
        // Si es marcado como pendiente por técnico/administrador
        const motivoTexto = cleanedComentarios ? ` por ${cleanedComentarios}` : '';
        subject = `⏸️ TICKET PENDIENTE${motivoTexto} - Ticket #${ticketData.id_ticket}`;
        title = '⏸️ Ticket Pendiente';
        color = '#ffc107';
        actionUrl = `${baseUrl}/tickets/tracking?ticketId=${ticketData.id_ticket}`;
        actionText = 'Ver seguimiento del ticket';
        const motivoPendiente = cleanedComentarios ? `<p><strong>TICKET PENDIENTE POR:</strong> ${cleanedComentarios}</p>` : '';
        const tiempoPendiente = cleanedPendienteTiempo ? `<p><strong>Tiempo estimado para retomar:</strong> ${cleanedPendienteTiempo}</p>` : '';
        message = `
          <p>Tu ticket ha sido marcado como <strong>PENDIENTE</strong> por el técnico.</p>
          ${motivoPendiente}
          ${tiempoPendiente}
          <p>El técnico retomará el trabajo en tu ticket según el tiempo estimado indicado.</p>
        `;
      }
    }

    // El email se envía solo si está disponible
    await emailService.sendEmail({
      to: employeeInfo.email,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${color}; color: white; padding: 20px; text-align: center;">
            <h1>${title}</h1>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
            <p>Hola <strong>${employeeInfo.nombre}</strong>,</p>
            ${message}
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid ${color};">
              <h3>Ticket #${ticketData.id_ticket}</h3>
              <p><strong>Categoría:</strong> ${ticketData.categoria} - ${ticketData.subcategoria}</p>
              <p><strong>Descripción:</strong> ${ticketData.descripcion}</p>
              <p><strong>Nuevo Estado:</strong> <span style="color: ${color}; font-weight: bold;">${estatus}</span></p>
              <p><strong>Prioridad:</strong> ${ticketData.prioridad}</p>
              <p><strong>Técnico asignado:</strong> ${ticketData.tecnico_nombre || 'Sin asignar'}</p>
              <p><strong>Fecha de creación:</strong> ${new Date(ticketData.fecha_creacion).toLocaleString('es-ES')}</p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${actionUrl}" style="background-color: ${color}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">${actionText}</a>
            </div>
            <p style="text-align: center; font-size: 14px;">O copia y pega este enlace:<br><a href="${actionUrl}" style="color: ${color}; word-break: break-all;">${actionUrl}</a></p>
          </div>
          <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
            <p>Este es un mensaje automático del sistema Mesa de Ayuda.</p>
          </div>
        </div>
      `
    });
    console.log(`✅ Correo de estado enviado al solicitante para ticket #${ticketData.id_ticket}`);

    if (isEmployeeReopening && technicianInfo?.email) {
      try {
        await emailService.sendTicketReopenedNotification({
          ticket: {
            id: ticketData.id_ticket,
            categoria: ticketData.categoria,
            subcategoria: ticketData.subcategoria,
            descripcion: ticketData.descripcion,
            prioridad: ticketData.prioridad,
            fecha_creacion: ticketData.fecha_creacion
          },
          technician: technicianInfo,
          employee: employeeInfo,
          comment: cleanedComentarios
        });
        console.log(`✅ Notificación de ticket reabierto enviada al técnico (${technicianInfo.email})`);
      } catch (reopenErr) {
        console.error(`❌ Error enviando correo de ticket reabierto (ticket #${ticketId}):`, reopenErr.message);
      }
    }
  } catch (error) {
    console.error(`❌ notifyStatusChange error (ticket #${ticketId}):`, error.message);
  }
}

/**
 * Notifica el cierre/evaluación de un ticket
 */
async function notifyTicketClosure({ ticketId, rating, comentarios }) {
  if (!ticketId) {
    console.warn('notifyTicketClosure: ticketId requerido');
    return;
  }

  try {
    console.log(`📧 notifyTicketClosure → ticket #${ticketId}`);

    const ticketDetailsRows = await query(`
      SELECT
        t.id_ticket,
        t.descripcion,
        t.prioridad,
        t.fecha_creacion,
        s.categoria,
        s.subcategoria,
        u.nombre AS usuario_nombre,
        u.correo AS usuario_correo,
        tec.nombre AS tecnico_nombre,
        tec.correo AS tecnico_correo
      FROM Tickets t
      JOIN Servicios s ON t.id_servicio = s.id_servicio
      JOIN Usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN Usuarios tec ON t.id_tecnico = tec.id_usuario
      WHERE t.id_ticket = ?
    `, [ticketId]);

    if (ticketDetailsRows.length === 0) {
      console.warn(`notifyTicketClosure: no se encontró ticket #${ticketId}`);
      return;
    }

    const ticketDetails = ticketDetailsRows[0];
    const ticketEmailData = {
      id: ticketDetails.id_ticket,
      titulo: `${ticketDetails.categoria} - ${ticketDetails.subcategoria}`,
      descripcion: ticketDetails.descripcion,
      prioridad: ticketDetails.prioridad,
      fecha_creacion: ticketDetails.fecha_creacion
    };

    const employeeEmailData = {
      nombre: ticketDetails.usuario_nombre,
      email: ticketDetails.usuario_correo
    };

    const technicianEmailData = ticketDetails.tecnico_nombre ? {
      nombre: ticketDetails.tecnico_nombre,
      email: ticketDetails.tecnico_correo
    } : null;

    const queueEmail = (label, fn) => {
      setImmediate(async () => {
        try {
          await fn();
          console.log(`📧 ${label} enviado para ticket #${ticketId}`);
        } catch (emailErr) {
          console.error(`❌ Error enviando ${label} (ticket #${ticketId}):`, emailErr.message);
        }
      });
    };

    if (employeeEmailData.email) {
      queueEmail('Confirmación de ticket cerrado al solicitante', () =>
        emailService.sendStatusChangeNotification(
          ticketEmailData,
          'Cerrado',
          technicianEmailData || { nombre: 'Equipo de soporte', email: null },
          employeeEmailData
        )
      );
    }

    if (technicianEmailData?.email) {
      const evaluationSummary = [
        `El solicitante ${employeeEmailData.nombre} cerró el ticket con una calificación de ${rating} estrella(s).`,
        comentarios ? `Comentarios del solicitante: ${comentarios}` : null
      ].filter(Boolean).join('\n\n');

      queueEmail('Resumen de evaluación para el técnico', () =>
        emailService.sendCommentNotification(
          ticketEmailData,
          evaluationSummary,
          { nombre: employeeEmailData.nombre, email: employeeEmailData.email },
          technicianEmailData
        )
      );
    }
  } catch (error) {
    console.error(`❌ notifyTicketClosure error (ticket #${ticketId}):`, error.message);
  }
}

/**
 * Notifica a los involucrados cuando un ticket es escalado
 */
async function notifyEscalation({ ticket, administrador, motivoEscalamiento, asignacionInfo }) {
  if (!ticket || !administrador) {
    console.warn('notifyEscalation: ticket y administrador son requeridos');
    return;
  }

  setImmediate(async () => {
    try {
      console.log(`📧 notifyEscalation → ticket #${ticket.id_ticket}`);

      const employeeInfoRows = await query(`
        SELECT nombre, correo FROM Usuarios WHERE id_usuario = ?
      `, [ticket.id_usuario]);

      const technicianInfoRows = await query(`
        SELECT nombre, correo FROM Usuarios WHERE id_usuario = ?
      `, [ticket.id_tecnico]);

      const employeeInfo = employeeInfoRows[0] || {};
      const technicianInfo = technicianInfoRows[0] || {};
      const reassignedTech = asignacionInfo && asignacionInfo.success ? {
        nombre: asignacionInfo.tecnico.nombre,
        email: asignacionInfo.tecnico.correo
      } : null;

      const emailData = {
        ticket: {
          id: ticket.id_ticket,
          categoria: ticket.categoria,
          subcategoria: ticket.subcategoria,
          descripcion: ticket.descripcion,
          prioridad: ticket.prioridad,
          fecha_creacion: ticket.fecha_creacion
        },
        admin: {
          nombre: administrador.nombre,
          correo: administrador.correo
        },
        technician: {
          nombre: technicianInfo.nombre || 'No disponible',
          email: technicianInfo.correo || null
        },
        employee: {
          nombre: employeeInfo.nombre || 'No disponible',
          email: employeeInfo.correo || null
        },
        reason: motivoEscalamiento,
        reassignedTechnician: reassignedTech
      };

      const result = await emailService.sendEscalationNotificationToAdmin(emailData);
      if (!result) {
        console.error(`❌ notifyEscalation: el envío retornó false para ticket #${ticket.id_ticket}`);
      }
    } catch (error) {
      console.error(`❌ notifyEscalation error (ticket #${ticket?.id_ticket}):`, error.message);
    }
  });
}

module.exports = {
  notifyTicketAssignment,
  notifyStatusChange,
  notifyTicketClosure,
  notifyEscalation
};

