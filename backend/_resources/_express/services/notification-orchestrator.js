const { query } = require('../config/database');
const emailService = require('./emailService');

/**
 * Notifica cuando se crea un ticket nuevo
 * Envía correo al usuario (confirmación) y al técnico asignado
 */
async function notifyTicketAssignment({ ticket }) {
  if (!ticket) {
    console.warn('notifyTicketAssignment: ticket indefinido');
    return;
  }

  try {
    console.log(`📧 notifyTicketAssignment → ticket #${ticket.id_ticket}`);

    const baseUrl = emailService.getFrontendUrl();

    // 1. CORREO AL USUARIO (confirmación de creación)
    if (ticket.correo) {
      const userSubject = `✅ Tu ticket #${ticket.id_ticket} ha sido creado`;
      const userHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Ticket Creado</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .ticket-info { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4CAF50; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Ticket Creado Exitosamente</h1>
            </div>
            <div class="content">
              <p>Hola <strong>${ticket.nombre}</strong>,</p>
              <p>Tu ticket ha sido creado exitosamente y está siendo procesado.</p>
              <div class="ticket-info">
                <h3>Detalles del Ticket</h3>
                <p><strong>ID:</strong> #${ticket.id_ticket}</p>
                <p><strong>Categoría:</strong> ${ticket.categoria} - ${ticket.subcategoria}</p>
                <p><strong>Descripción:</strong> ${ticket.descripcion || 'Sin descripción'}</p>
                <p><strong>Prioridad:</strong> ${ticket.prioridad || 'Media'}</p>
                <p><strong>Estado:</strong> ${ticket.estatus || 'Pendiente'}</p>
                ${ticket.tecnico_nombre ? `<p><strong>Técnico asignado:</strong> ${ticket.tecnico_nombre}</p>` : '<p><strong>Técnico asignado:</strong> En proceso de asignación</p>'}
                <p><strong>Fecha de creación:</strong> ${new Date(ticket.fecha_creacion).toLocaleString('es-ES')}</p>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${baseUrl}/tickets/tracking?ticketId=${ticket.id_ticket}" style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Ver Seguimiento del Ticket</a>
              </div>
            </div>
            <div class="footer">
              <p>Este es un mensaje automático del sistema Mesa de Ayuda.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await emailService.sendEmail({
        to: ticket.correo,
        subject: userSubject,
        html: userHtml
      });
      console.log(`✅ Correo de confirmación enviado al usuario para ticket #${ticket.id_ticket}`);

      // Crear notificación en BD para el usuario
      await query(`
        INSERT INTO Notificaciones (id_usuario, id_ticket, tipo, mensaje)
        VALUES (?, ?, 'Interna', ?)
      `, [ticket.id_usuario, ticket.id_ticket, `Tu ticket #${ticket.id_ticket} ha sido creado exitosamente.`]);
    }

    // 2. CORREO AL TÉCNICO (si está asignado)
    if (ticket.tecnico_nombre && ticket.tecnico_correo) {
      const techSubject = `🔧 Nuevo ticket asignado #${ticket.id_ticket}`;
      const techHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Nuevo Ticket Asignado</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .ticket-info { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #2196F3; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔧 Nuevo Ticket Asignado</h1>
            </div>
            <div class="content">
              <p>Hola <strong>${ticket.tecnico_nombre}</strong>,</p>
              <p>Se te ha asignado un nuevo ticket que requiere tu atención.</p>
              <div class="ticket-info">
                <h3>Detalles del Ticket</h3>
                <p><strong>ID:</strong> #${ticket.id_ticket}</p>
                <p><strong>Categoría:</strong> ${ticket.categoria} - ${ticket.subcategoria}</p>
                <p><strong>Descripción:</strong> ${ticket.descripcion || 'Sin descripción'}</p>
                <p><strong>Prioridad:</strong> ${ticket.prioridad || 'Media'}</p>
                <p><strong>Solicitante:</strong> ${ticket.nombre} (${ticket.correo})</p>
                <p><strong>Fecha de creación:</strong> ${new Date(ticket.fecha_creacion).toLocaleString('es-ES')}</p>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${baseUrl}/tickets/assigned" style="background-color: #2196F3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Ver Tickets Asignados</a>
              </div>
            </div>
            <div class="footer">
              <p>Este es un mensaje automático del sistema Mesa de Ayuda.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await emailService.sendEmail({
        to: ticket.tecnico_correo,
        subject: techSubject,
        html: techHtml
      });
      console.log(`✅ Correo de asignación enviado al técnico para ticket #${ticket.id_ticket}`);

      // Crear notificación en BD para el técnico
      await query(`
        INSERT INTO Notificaciones (id_usuario, id_ticket, tipo, mensaje)
        VALUES (?, ?, 'Interna', ?)
      `, [ticket.id_tecnico, ticket.id_ticket, `Se te ha asignado un nuevo ticket #${ticket.id_ticket}.`]);
    }
  } catch (error) {
    console.error(`❌ notifyTicketAssignment error (ticket #${ticket?.id_ticket}):`, error.message);
  }
}

/**
 * Notifica cambios de estado del ticket
 * SOLO para transiciones específicas: Pendiente→En Progreso, En Progreso→Escalado, Escalado→Finalizado
 */
async function notifyStatusChange({
  ticketId,
  estatus,
  estadoAnterior,
  isEmployeeReopening = false,
  cleanedComentarios = null,
  cleanedPendienteTiempo = null
}) {
  if (!ticketId) {
    console.error('❌ notifyStatusChange: ticketId requerido');
    return;
  }

  try {
    console.log(`📧 notifyStatusChange → ticket #${ticketId}, estado anterior: ${estadoAnterior}, nuevo estado: ${estatus}`);

    // Obtener información completa del ticket
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
        t.id_tecnico,
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
    const baseUrl = emailService.getFrontendUrl();

    // Determinar si debemos enviar correo según las transiciones permitidas
    let shouldNotify = false;
    let notificationMessage = '';
    let emailSubject = '';
    let emailTitle = '';
    let emailColor = '#2196F3';
    let emailMessage = '';

    // Transiciones permitidas para usuarios:
    // 1. En Progreso → Pendiente (técnico marca como pendiente)
    if (estadoAnterior === 'En Progreso' && estatus === 'Pendiente' && !isEmployeeReopening) {
      shouldNotify = true;
      const motivoPendiente = cleanedComentarios || 'No se especificó motivo';
      const tiempoEstimado = cleanedPendienteTiempo || 'No especificado';
      notificationMessage = `Tu ticket #${ticketData.id_ticket} ha sido marcado como pendiente. El técnico retomará el trabajo según el tiempo estimado.`;
      emailSubject = `⏸️ Tu ticket #${ticketData.id_ticket} ha sido marcado como pendiente`;
      emailTitle = '⏸️ Ticket Pendiente';
      emailColor = '#ffc107';
      emailMessage = `
        <p>Tu ticket ha sido marcado como <strong>PENDIENTE</strong> por el técnico asignado.</p>
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ffc107;">
          <h4 style="color: #856404; margin-top: 0;">📋 Motivo del técnico:</h4>
          <p style="color: #856404; margin: 0;">${motivoPendiente.replace(/\n/g, '<br>')}</p>
        </div>
        <div style="background: #e7f3ff; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #2196F3;">
          <p style="margin: 0;"><strong>⏱️ Tiempo estimado para retomar:</strong> ${tiempoEstimado}</p>
        </div>
        <p>El técnico retomará el trabajo en tu ticket según el tiempo estimado indicado.</p>
      `;
    }
    // 2. Pendiente → En Progreso
    else if (estadoAnterior === 'Pendiente' && estatus === 'En Progreso') {
      shouldNotify = true;
      notificationMessage = `Tu ticket #${ticketData.id_ticket} está en progreso. El técnico está trabajando en la solución.`;
      emailSubject = `🔄 Tu ticket #${ticketData.id_ticket} está en progreso`;
      emailTitle = '🔄 Ticket en Progreso';
      emailColor = '#ffc107';
      emailMessage = `<p>Tu ticket ha sido actualizado y está siendo atendido por el técnico asignado.</p><p>El técnico está trabajando en la solución de tu solicitud.</p>`;
    }
    // 3. En Progreso → Escalado
    else if (estadoAnterior === 'En Progreso' && estatus === 'Escalado') {
      shouldNotify = true;
      notificationMessage = `Tu ticket #${ticketData.id_ticket} ha sido escalado al administrador para su revisión.`;
      emailSubject = `📤 Tu ticket #${ticketData.id_ticket} ha sido escalado`;
      emailTitle = '📤 Ticket Escalado';
      emailColor = '#17a2b8';
      emailMessage = `<p>Tu ticket ha sido escalado al administrador para su revisión.</p><p>El administrador revisará tu solicitud y tomará las acciones necesarias.</p>`;
    }
    // 4. Escalado → Finalizado
    else if (estadoAnterior === 'Escalado' && estatus === 'Finalizado') {
      shouldNotify = true;
      notificationMessage = `Tu ticket #${ticketData.id_ticket} ha sido finalizado. Está listo para que lo evalúes.`;
      emailSubject = `✅ Tu ticket #${ticketData.id_ticket} ha sido finalizado - Listo para evaluar`;
      emailTitle = '✅ Ticket Finalizado';
      emailColor = '#28a745';
      emailMessage = `
        <p>¡Excelente noticia! Tu ticket ha sido finalizado y está listo para que lo evalúes:</p>
        <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <h4 style="color: #28a745; margin-top: 0;">📝 Próximo paso: Evaluar el servicio</h4>
          <p>Ahora puedes evaluar la calidad del servicio recibido y cerrar tu ticket. Tu opinión es muy importante para nosotros.</p>
        </div>
      `;
    }
    // 5. Reapertura (Cerrado → Pendiente por empleado)
    else if (isEmployeeReopening && estatus === 'Pendiente') {
      shouldNotify = true;
      notificationMessage = `Tu ticket #${ticketData.id_ticket} ha sido reabierto. El técnico revisará tu solicitud.`;
      emailSubject = `♻️ Tu ticket #${ticketData.id_ticket} ha sido reabierto`;
      emailTitle = '♻️ Ticket Reabierto';
      emailColor = '#6c5ce7';
      const motivoReapertura = cleanedComentarios ? `<p><strong>Observaciones:</strong> ${cleanedComentarios}</p>` : '';
      emailMessage = `<p>Has reabierto tu ticket y ha regresado a la bandeja del equipo de soporte para su seguimiento.</p>${motivoReapertura}<p>El técnico revisará tu solicitud y te dará seguimiento.</p>`;

      // Enviar correo al técnico cuando se reabre un ticket
      if (ticketData.tecnico_correo && ticketData.tecnico_nombre) {
        const techReopenSubject = `♻️ Ticket #${ticketData.id_ticket} reabierto por ${ticketData.usuario_nombre}`;
        const techReopenHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Ticket Reabierto</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #6c5ce7; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background: #f9f9f9; }
              .ticket-info { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #6c5ce7; }
              .comment-box { background: white; padding: 15px; margin: 15px 0; border: 1px solid #ddd; border-radius: 5px; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>♻️ Ticket Reabierto</h1>
              </div>
              <div class="content">
                <p>Hola <strong>${ticketData.tecnico_nombre}</strong>,</p>
                <p>El solicitante <strong>${ticketData.usuario_nombre}</strong> ha reabierto el ticket que atendiste. Por favor, revisa los detalles y da seguimiento cuanto antes.</p>
                <div class="ticket-info">
                  <h3>Detalles del Ticket</h3>
                  <p><strong>ID:</strong> #${ticketData.id_ticket}</p>
                  <p><strong>Categoría:</strong> ${ticketData.categoria}</p>
                  ${ticketData.subcategoria ? `<p><strong>Subcategoría:</strong> ${ticketData.subcategoria}</p>` : ''}
                  <p><strong>Prioridad:</strong> ${ticketData.prioridad || 'Media'}</p>
                  <p><strong>Descripción:</strong> ${ticketData.descripcion || 'No disponible'}</p>
                  <p><strong>Fecha de creación:</strong> ${ticketData.fecha_creacion ? new Date(ticketData.fecha_creacion).toLocaleString('es-ES') : 'N/D'}</p>
                  <p><strong>Solicitante:</strong> ${ticketData.usuario_nombre} ${ticketData.usuario_correo ? `(${ticketData.usuario_correo})` : ''}</p>
                </div>
                ${cleanedComentarios ? `
                <div class="comment-box">
                  <h4>Mensaje del solicitante:</h4>
                  <p>${cleanedComentarios.replace(/\n/g, '<br>')}</p>
                </div>
                ` : ''}
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${baseUrl}/tickets/assigned" style="background-color: #6c5ce7; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Revisar Tickets Asignados</a>
                </div>
              </div>
              <div class="footer">
                <p>Este es un mensaje automático del sistema Mesa de Ayuda.</p>
              </div>
            </div>
          </body>
          </html>
        `;

        await emailService.sendEmail({
          to: ticketData.tecnico_correo,
          subject: techReopenSubject,
          html: techReopenHtml
        });
        console.log(`✅ Correo de reapertura enviado al técnico para ticket #${ticketId}`);

        // Crear notificación en BD para el técnico
        if (ticketData.id_tecnico) {
          await query(`
            INSERT INTO Notificaciones (id_usuario, id_ticket, tipo, mensaje)
            VALUES (?, ?, 'Interna', ?)
          `, [ticketData.id_tecnico, ticketId, `El ticket #${ticketId} ha sido reabierto por ${ticketData.usuario_nombre}.`]);
        }
      }
    }

    // Solo enviar si es una transición permitida
    if (!shouldNotify) {
      console.log(`⚠️ Transición de estado no requiere notificación: ${estadoAnterior} → ${estatus}`);
      return;
    }

    // Crear notificación en BD para el usuario
    if (ticketData.usuario_id && notificationMessage) {
      try {
        await query(`
          INSERT INTO Notificaciones (id_usuario, id_ticket, tipo, mensaje)
          VALUES (?, ?, 'Interna', ?)
        `, [ticketData.usuario_id, ticketData.id_ticket, notificationMessage]);
        console.log(`✅ Notificación creada en BD para usuario del ticket #${ticketId}`);
      } catch (notifError) {
        console.error(`❌ Error creando notificación en BD:`, notifError.message);
      }
    }

    // Enviar correo al usuario
    if (ticketData.usuario_correo && emailSubject) {
      const actionUrl = estatus === 'Finalizado'
        ? `${baseUrl}/tickets/close?ticketId=${ticketData.id_ticket}`
        : `${baseUrl}/tickets/tracking?ticketId=${ticketData.id_ticket}`;
      const actionText = estatus === 'Finalizado' ? 'Evaluar ticket' : 'Ver seguimiento del ticket';

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${emailColor}; color: white; padding: 20px; text-align: center;">
            <h1>${emailTitle}</h1>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
            <p>Hola <strong>${ticketData.usuario_nombre}</strong>,</p>
            ${emailMessage}
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid ${emailColor};">
              <h3>Ticket #${ticketData.id_ticket}</h3>
              <p><strong>Categoría:</strong> ${ticketData.categoria} - ${ticketData.subcategoria}</p>
              <p><strong>Descripción:</strong> ${ticketData.descripcion || 'Sin descripción'}</p>
              <p><strong>Nuevo Estado:</strong> <span style="color: ${emailColor}; font-weight: bold;">${estatus}</span></p>
              <p><strong>Prioridad:</strong> ${ticketData.prioridad}</p>
              ${ticketData.tecnico_nombre ? `<p><strong>Técnico asignado:</strong> ${ticketData.tecnico_nombre}</p>` : ''}
              <p><strong>Fecha de creación:</strong> ${new Date(ticketData.fecha_creacion).toLocaleString('es-ES')}</p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${actionUrl}" style="background-color: ${emailColor}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">${actionText}</a>
            </div>
          </div>
          <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
            <p>Este es un mensaje automático del sistema Mesa de Ayuda.</p>
          </div>
        </div>
      `;

      await emailService.sendEmail({
        to: ticketData.usuario_correo,
        subject: emailSubject,
        html: emailHtml
      });
      console.log(`✅ Correo de cambio de estado enviado al usuario para ticket #${ticketId}`);
    }

  } catch (error) {
    console.error(`❌ notifyStatusChange error (ticket #${ticketId}):`, error.message);
  }
}

/**
 * Notifica cuando un ticket es escalado
 * Envía correo al técnico destino (nuevo asignado) y crea notificación
 */
async function notifyEscalation({ ticket, administrador, motivoEscalamiento, asignacionInfo }) {
  if (!ticket || !administrador) {
    console.warn('notifyEscalation: ticket y administrador son requeridos');
    return;
  }

  try {
    console.log(`📧 notifyEscalation → ticket #${ticket.id_ticket}`);

    const baseUrl = emailService.getFrontendUrl();
    const ticketsUrl = `${baseUrl}/tickets/escalados`;

    // Obtener información completa del ticket con descripción
    const ticketInfo = await query(`
      SELECT
        t.id_ticket,
        t.descripcion,
        t.prioridad,
        t.fecha_creacion,
        s.categoria,
        s.subcategoria,
        u.nombre AS usuario_nombre,
        u.correo AS usuario_correo
      FROM Tickets t
      JOIN Servicios s ON t.id_servicio = s.id_servicio
      JOIN Usuarios u ON t.id_usuario = u.id_usuario
      WHERE t.id_ticket = ?
    `, [ticket.id_ticket]);

    if (ticketInfo.length === 0) {
      console.warn(`notifyEscalation: no se encontró ticket #${ticket.id_ticket}`);
      return;
    }

    const ticketData = ticketInfo[0];

    // CORREO AL TÉCNICO DESTINO (el que recibe el escalamiento)
    if (administrador.correo) {
      const techSubject = `🚨 Ticket #${ticket.id_ticket} ESCALADO - Requiere tu atención`;
      const techHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Ticket Escalado</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #ff6b35; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .ticket-info { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #ff6b35; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚨 Ticket Escalado</h1>
            </div>
            <div class="content">
              <p>Hola <strong>${administrador.nombre}</strong>,</p>
              <p>El siguiente ticket ha sido escalado y requiere tu atención.</p>
              <div class="ticket-info">
                <h3>Detalles del Ticket</h3>
                <p><strong>ID:</strong> #${ticket.id_ticket}</p>
                <p><strong>Categoría:</strong> ${ticketData.categoria || 'N/A'}</p>
                ${ticketData.subcategoria ? `<p><strong>Subcategoría:</strong> ${ticketData.subcategoria}</p>` : ''}
                <p><strong>Descripción:</strong> ${ticketData.descripcion || 'No disponible'}</p>
                <p><strong>Prioridad:</strong> ${ticketData.prioridad || 'Media'}</p>
                <p><strong>Solicitante:</strong> ${ticketData.usuario_nombre} ${ticketData.usuario_correo ? `(${ticketData.usuario_correo})` : ''}</p>
                <p><strong>Fecha de creación:</strong> ${ticketData.fecha_creacion ? new Date(ticketData.fecha_creacion).toLocaleString('es-ES') : 'N/A'}</p>
                <hr style="margin: 15px 0; border: none; border-top: 1px solid #ddd;">
                <p><strong>Motivo de escalamiento:</strong></p>
                <p style="background: #fff3cd; padding: 10px; border-left: 3px solid #ff6b35; margin: 10px 0;">${motivoEscalamiento || 'No especificado'}</p>
                <p><strong>Fecha de escalamiento:</strong> ${new Date().toLocaleString('es-ES')}</p>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${ticketsUrl}" style="background-color: #ff6b35; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Ver Tickets Escalados</a>
              </div>
            </div>
            <div class="footer">
              <p>Este es un mensaje automático del sistema Mesa de Ayuda.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await emailService.sendEmail({
        to: administrador.correo,
        subject: techSubject,
        html: techHtml
      });
      console.log(`✅ Correo de escalamiento enviado al técnico destino para ticket #${ticket.id_ticket}`);

      // Crear notificación en BD para el técnico destino
      if (asignacionInfo && asignacionInfo.success && asignacionInfo.tecnico) {
        await query(`
          INSERT INTO Notificaciones (id_usuario, id_ticket, tipo, mensaje)
          VALUES (?, ?, 'Interna', ?)
        `, [asignacionInfo.tecnico.id || asignacionInfo.tecnico.id_usuario, ticket.id_ticket, `Tienes un ticket nuevo asignado debido al escalamiento: Ticket #${ticket.id_ticket}`]);
        console.log(`✅ Notificación creada en BD para técnico destino del ticket #${ticket.id_ticket}`);
      }
    }

    // CORREO AL USUARIO (información de escalamiento)
    if (ticketData.usuario_correo) {
      const userSubject = `📤 Tu ticket #${ticket.id_ticket} ha sido escalado`;
      const userHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Ticket Escalado</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #ff6b35; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .ticket-info { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #ff6b35; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📤 Ticket Escalado</h1>
            </div>
            <div class="content">
              <p>Hola <strong>${ticketData.usuario_nombre}</strong>,</p>
              <p>Te informamos que tu ticket <strong>#${ticket.id_ticket}</strong> ha sido escalado para darle seguimiento.</p>
              <div class="ticket-info">
                <h3>Detalles del Ticket</h3>
                <p><strong>ID:</strong> #${ticket.id_ticket}</p>
                <p><strong>Categoría:</strong> ${ticketData.categoria || 'N/A'}</p>
                ${ticketData.subcategoria ? `<p><strong>Subcategoría:</strong> ${ticketData.subcategoria}</p>` : ''}
                <p><strong>Descripción:</strong> ${ticketData.descripcion || 'No disponible'}</p>
                <p><strong>Estado:</strong> Escalado</p>
              </div>
              <p>Un técnico especializado se encargará de dar seguimiento a tu solicitud. Te notificaremos cuando haya actualizaciones.</p>
            </div>
            <div class="footer">
              <p>Este es un mensaje automático del sistema Mesa de Ayuda.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await emailService.sendEmail({
        to: ticketData.usuario_correo,
        subject: userSubject,
        html: userHtml
      });
      console.log(`✅ Correo de escalamiento enviado al usuario para ticket #${ticket.id_ticket}`);
    }

  } catch (error) {
    console.error(`❌ notifyEscalation error (ticket #${ticket?.id_ticket}):`, error.message);
  }
}

/**
 * Notifica cuando el usuario evalúa el ticket
 * Envía correo al técnico con la calificación
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
        u.id_usuario AS usuario_id,
        tec.nombre AS tecnico_nombre,
        tec.correo AS tecnico_correo,
        tec.id_usuario AS tecnico_id
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
    const baseUrl = emailService.getFrontendUrl();

    // CORREO AL TÉCNICO con la evaluación
    if (ticketDetails.tecnico_correo && ticketDetails.tecnico_id) {
      const stars = '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
      const techSubject = `⭐ Evaluación recibida - Ticket #${ticketId}`;
      const techHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Evaluación de Ticket</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #FFD700; color: #333; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .ticket-info { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #FFD700; }
            .evaluation-box { background: #fff3cd; padding: 15px; margin: 15px 0; border-left: 4px solid #ffc107; border-radius: 5px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⭐ Evaluación Recibida</h1>
            </div>
            <div class="content">
              <p>Hola <strong>${ticketDetails.tecnico_nombre}</strong>,</p>
              <p>El usuario ha evaluado el ticket que atendiste.</p>
              <div class="ticket-info">
                <h3>Detalles del Ticket</h3>
                <p><strong>ID:</strong> #${ticketId}</p>
                <p><strong>Categoría:</strong> ${ticketDetails.categoria} - ${ticketDetails.subcategoria}</p>
                <p><strong>Descripción:</strong> ${ticketDetails.descripcion || 'Sin descripción'}</p>
                <p><strong>Solicitante:</strong> ${ticketDetails.usuario_nombre}</p>
              </div>
              <div class="evaluation-box">
                <h4 style="color: #856404; margin-top: 0;">📊 Evaluación del Usuario</h4>
                <p style="font-size: 24px; margin: 10px 0;"><strong>Calificación:</strong> ${stars} (${rating}/5)</p>
                ${comentarios ? `<p><strong>Comentarios:</strong></p><p style="background: white; padding: 10px; border-radius: 5px; margin: 10px 0;">${comentarios.replace(/\n/g, '<br>')}</p>` : '<p><em>El usuario no dejó comentarios adicionales.</em></p>'}
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${baseUrl}/tickets/assigned" style="background-color: #FFD700; color: #333; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Ver Mis Tickets</a>
              </div>
            </div>
            <div class="footer">
              <p>Este es un mensaje automático del sistema Mesa de Ayuda.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await emailService.sendEmail({
        to: ticketDetails.tecnico_correo,
        subject: techSubject,
        html: techHtml
      });
      console.log(`✅ Correo de evaluación enviado al técnico para ticket #${ticketId}`);

      // Crear notificación en BD para el técnico
      const evaluationText = comentarios
        ? `El usuario evaluó tu ticket #${ticketId} con ${rating} estrella(s). Comentarios: ${comentarios}`
        : `El usuario evaluó tu ticket #${ticketId} con ${rating} estrella(s).`;

      await query(`
        INSERT INTO Notificaciones (id_usuario, id_ticket, tipo, mensaje)
        VALUES (?, ?, 'Interna', ?)
      `, [ticketDetails.tecnico_id, ticketId, evaluationText]);
      console.log(`✅ Notificación de evaluación creada en BD para técnico del ticket #${ticketId}`);
    }

  } catch (error) {
    console.error(`❌ notifyTicketClosure error (ticket #${ticketId}):`, error.message);
  }
}

module.exports = {
  notifyTicketAssignment,
  notifyStatusChange,
  notifyTicketClosure,
  notifyEscalation
};
