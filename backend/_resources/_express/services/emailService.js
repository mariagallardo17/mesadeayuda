const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
  constructor() {
    // Configuración del transporter de correo con pool para mejorar performance
    this.transporter = nodemailer.createTransport({
      pool: true,
      maxConnections: parseInt(process.env.SMTP_MAX_CONN || '5', 10),
      maxMessages: parseInt(process.env.SMTP_MAX_MSG || '100', 10),
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false, // true para 465, false para otros puertos
      auth: {
        user: process.env.SMTP_USER || 'mesadeayuda042@gmail.com',
        pass: process.env.SMTP_PASS || 'ragr ftjy xgrv nmak'
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }


  /**
   * Envía un correo de notificación de ticket asignado
   */
  async sendTicketAssignedNotification(ticket, technician, employee) {
    const subject = `Nuevo ticket asignado #${ticket.id}`;
    const htmlContent = this.generateTicketAssignedEmail(ticket, technician, employee);

    try {
      // Enviar a técnico
      await this.sendEmail({
        to: technician.email,
        subject: subject,
        html: htmlContent
      });

      // Enviar confirmación a empleado
      const employeeSubject = `Tu ticket #${ticket.id} ha sido asignado`;
      const employeeContent = this.generateTicketAssignedEmployeeEmail(ticket, technician, employee);

      await this.sendEmail({
        to: employee.email,
        subject: employeeSubject,
        html: employeeContent
      });

      console.log(`Notificaciones de ticket asignado enviadas para ticket #${ticket.id}`);
      return true;
    } catch (error) {
      console.error('Error enviando notificaciones de ticket asignado:', error);
      return false;
    }
  }

  /**
   * Envía un correo de notificación de cambio de estado
   */
  async sendStatusChangeNotification(ticket, newStatus, technician, employee) {
    const subject = `Ticket #${ticket.id} - Estado actualizado a "${newStatus}"`;
    const htmlContent = this.generateStatusChangeEmail(ticket, newStatus, technician, employee);

    try {
      // Enviar a empleado
      await this.sendEmail({
        to: employee.email,
        subject: subject,
        html: htmlContent
      });

      console.log(`Notificación de cambio de estado enviada para ticket #${ticket.id}`);
      return true;
    } catch (error) {
      console.error('Error enviando notificación de cambio de estado:', error);
      return false;
    }
  }

  /**
   * Envía un correo de notificación de ticket completado
   */
  async sendTicketCompletedNotification(ticket, technician, employee) {
    const subject = `Ticket #${ticket.id} completado`;
    const htmlContent = this.generateTicketCompletedEmail(ticket, technician, employee);

    try {
      // Enviar a empleado
      await this.sendEmail({
        to: employee.email,
        subject: subject,
        html: htmlContent
      });

      console.log(`Notificación de ticket completado enviada para ticket #${ticket.id}`);
      return true;
    } catch (error) {
      console.error('Error enviando notificación de ticket completado:', error);
      return false;
    }
  }

  /**
   * Envía un correo al técnico cuando un ticket es reabierto por el solicitante
   */
  async sendTicketReopenedNotification({ ticket, technician, employee, comment }) {
    if (!technician || !technician.email) {
      console.warn('sendTicketReopenedNotification: no se envió correo porque el técnico no tiene email configurado');
      return false;
    }

    const subject = `Ticket #${ticket.id} reabierto por ${employee?.nombre || 'el solicitante'}`;
    const htmlContent = this.generateTicketReopenedTechnicianEmail(ticket, technician, employee, comment);

    try {
      await this.sendEmail({
        to: technician.email,
        subject,
        html: htmlContent
      });

      console.log(`Notificación de ticket reabierto enviada al técnico para ticket #${ticket.id}`);
      return true;
    } catch (error) {
      console.error('Error enviando notificación de ticket reabierto al técnico:', error);
      return false;
    }
  }

  /**
   * Envía un correo de notificación de nuevo comentario
   */
  async sendCommentNotification(ticket, comment, author, recipient) {
    const subject = `Nuevo comentario en ticket #${ticket.id}`;
    const htmlContent = this.generateCommentEmail(ticket, comment, author, recipient);

    try {
      await this.sendEmail({
        to: recipient.email,
        subject: subject,
        html: htmlContent
      });

      console.log(`Notificación de comentario enviada para ticket #${ticket.id}`);
      return true;
    } catch (error) {
      console.error('Error enviando notificación de comentario:', error);
      return false;
    }
  }

  /**
   * Obtiene la URL base del frontend
   */
  getFrontendUrl() {
    return process.env.FRONTEND_URL || 'http://localhost:4200';
  }

  /**
   * Envía recordatorio para que el usuario evalúe el ticket
   */
  async sendEvaluationReminderEmail(ticket) {
    const baseUrl = this.getFrontendUrl();
    const evaluateUrl = `${baseUrl}/tickets/tracking?ticketId=${ticket.id_ticket}#evaluacion`;

    const subject = `Recordatorio: evalúa el ticket #${ticket.id_ticket}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Recordatorio de evaluación</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6c5ce7; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .ticket-info { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #6c5ce7; }
          .warning-box { background: #fff3cd; padding: 15px; margin: 15px 0; border-left: 4px solid #ffc107; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏳ Recordatorio de Evaluación</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${ticket.usuario_nombre}</strong>,</p>
            <p>Tu ticket <strong>#${ticket.id_ticket}</strong> ${ticket.estatus === 'Cerrado' ? 'fue cerrado automáticamente por el sistema' : 'está finalizado'} y está en espera de evaluación. Tu opinión es importante para completar el proceso.</p>
            <div class="ticket-info">
              <p><strong>ID:</strong> #${ticket.id_ticket}</p>
              <p><strong>Estado:</strong> ${ticket.estatus || 'Finalizado'}</p>
              <p><strong>Descripción:</strong> ${ticket.descripcion || 'Sin descripción'}</p>
              <p><strong>${ticket.estatus === 'Cerrado' ? 'Cerrado el' : 'Finalizado el'}:</strong> ${ticket.fecha_finalizacion ? new Date(ticket.fecha_finalizacion).toLocaleString('es-ES') : 'N/A'}</p>
            </div>
            <div class="warning-box">
              <h3 style="margin-top: 0; color: #856404;">⚠️ Importante</h3>
              <p style="color: #856404; margin: 0;"><strong>No podrás crear nuevos tickets hasta que evalúes este ticket.</strong> ${ticket.estatus === 'Cerrado' ? 'Aunque este ticket fue cerrado automáticamente por el sistema, aún puedes evaluarlo para desbloquear la creación de nuevos tickets.' : 'Por favor, completa la evaluación para poder crear nuevos tickets.'}</p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${evaluateUrl}" style="background-color: #6c5ce7; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Evaluar Ticket</a>
            </div>
            <p style="text-align: center; font-size: 14px;">O copia y pega este enlace:<br><a href="${evaluateUrl}" style="color: #6c5ce7; word-break: break-all;">${evaluateUrl}</a></p>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático del sistema Mesa de Ayuda.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: ticket.usuario_correo,
      subject,
      html
    });
  }

  /**
   * Envía correo diario con todos los tickets pendientes de evaluación de un usuario
   */
  async sendDailyEvaluationReminderEmail(user, tickets) {
    const baseUrl = this.getFrontendUrl();
    const trackingUrl = `${baseUrl}/tickets/tracking`;

    const subject = `Recordatorio Diario: Tienes ${tickets.length} ticket(s) pendiente(s) de evaluación`;
    const ticketsList = tickets.map(ticket => {
      const evaluateUrl = `${baseUrl}/tickets/tracking?ticketId=${ticket.id_ticket}#evaluacion`;
      return `
        <div class="ticket-item" style="background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #6c5ce7; border-radius: 5px;">
          <h4 style="margin: 0 0 10px 0; color: #6c5ce7;">Ticket #${ticket.id_ticket}</h4>
          <p style="margin: 5px 0;"><strong>Estado:</strong> ${ticket.estatus || 'Finalizado'}</p>
          <p style="margin: 5px 0;"><strong>Descripción:</strong> ${ticket.descripcion ? (ticket.descripcion.length > 100 ? ticket.descripcion.substring(0, 100) + '...' : ticket.descripcion) : 'Sin descripción'}</p>
          <p style="margin: 5px 0;"><strong>${ticket.estatus === 'Cerrado' ? 'Cerrado el' : 'Finalizado el'}:</strong> ${ticket.fecha_finalizacion ? new Date(ticket.fecha_finalizacion).toLocaleString('es-ES') : 'N/A'}</p>
          <a href="${evaluateUrl}" style="display: inline-block; margin-top: 10px; background-color: #6c5ce7; color: white; padding: 8px 20px; text-decoration: none; border-radius: 5px; font-size: 14px;">Evaluar este ticket</a>
        </div>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Recordatorio Diario de Evaluación</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6c5ce7; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .warning-box { background: #fff3cd; padding: 15px; margin: 15px 0; border-left: 4px solid #ffc107; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📧 Recordatorio Diario de Evaluación</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${user.nombre}</strong>,</p>
            <p>Tienes <strong>${tickets.length} ticket(s)</strong> pendiente(s) de evaluación. Tu opinión es importante para completar el proceso y mantener el sistema funcionando correctamente.</p>

            <div class="warning-box">
              <h3 style="margin-top: 0; color: #856404;">⚠️ Importante - Bloqueo de Creación de Tickets</h3>
              <p style="color: #856404; margin: 0;"><strong>No podrás crear nuevos tickets hasta que evalúes todos tus tickets pendientes.</strong></p>
              <p style="color: #856404; margin: 10px 0 0 0;">${tickets.some(t => t.estatus === 'Cerrado') ? 'Aunque algunos tickets fueron cerrados automáticamente por el sistema, aún puedes evaluarlos para desbloquear la creación de nuevos tickets.' : 'Por favor, completa la evaluación de todos tus tickets para poder crear nuevos tickets.'}</p>
            </div>

            <h3 style="color: #333; margin-top: 25px;">Tickets Pendientes de Evaluación:</h3>
            ${ticketsList}

            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingUrl}" style="background-color: #6c5ce7; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Ver Todos mis Tickets</a>
            </div>
            <p style="text-align: center; font-size: 14px;">O copia y pega este enlace:<br><a href="${trackingUrl}" style="color: #6c5ce7; word-break: break-all;">${trackingUrl}</a></p>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático del sistema Mesa de Ayuda.</p>
            <p>Recibirás este recordatorio diariamente hasta que evalúes todos tus tickets pendientes.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: user.correo,
      subject,
      html
    });
  }

  /**
   * Informa al usuario que el ticket fue cerrado automáticamente por evaluación tardía
   */
  async sendEvaluationAutoClosedEmail(ticket) {
    const baseUrl = this.getFrontendUrl();
    const evaluateUrl = `${baseUrl}/tickets/tracking?ticketId=${ticket.id_ticket}#evaluacion`;

    const subject = `Ticket #${ticket.id_ticket} cerrado por evaluación tardía`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Cierre automático de ticket</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ff6b6b; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .ticket-info { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #ff6b6b; }
          .warning-box { background: #fff3cd; padding: 15px; margin: 15px 0; border-left: 4px solid #ffc107; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔒 Cierre automático de ticket</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${ticket.usuario_nombre}</strong>,</p>
            <p>El ticket <strong>#${ticket.id_ticket}</strong> fue cerrado automáticamente debido a que no se registró la evaluación dentro del plazo establecido (2 días después de la finalización).</p>
            <div class="ticket-info">
              <p><strong>ID:</strong> #${ticket.id_ticket}</p>
              <p><strong>Descripción:</strong> ${ticket.descripcion || 'Sin descripción'}</p>
              <p><strong>Finalizado el:</strong> ${ticket.fecha_finalizacion ? new Date(ticket.fecha_finalizacion).toLocaleString('es-ES') : 'N/A'}</p>
              <p><strong>Fecha de cierre automático:</strong> ${new Date().toLocaleString('es-ES')}</p>
            </div>
            <div class="warning-box">
              <h3 style="margin-top: 0; color: #856404;">⚠️ Importante</h3>
              <p style="color: #856404; margin: 0;"><strong>Aún puedes evaluar este ticket.</strong> Aunque el ticket fue cerrado automáticamente, puedes completar la evaluación para desbloquear la creación de nuevos tickets.</p>
            </div>
            <p><strong>Nota:</strong> No podrás crear nuevos tickets hasta que evalúes este ticket cerrado automáticamente.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${evaluateUrl}" style="background-color: #6c5ce7; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px; margin-right: 10px;">Evaluar Ticket Ahora</a>
              <a href="${baseUrl}/tickets/tracking?ticketId=${ticket.id_ticket}" style="background-color: #ff6b6b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Ver Detalles</a>
            </div>
            <p style="text-align: center; font-size: 14px;">O copia y pega este enlace para evaluar:<br><a href="${evaluateUrl}" style="color: #6c5ce7; word-break: break-all;">${evaluateUrl}</a></p>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático del sistema Mesa de Ayuda.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const cc = ticket.tecnico_correo ? [ticket.tecnico_correo] : undefined;

    await this.sendEmail({
      to: ticket.usuario_correo,
      subject,
      html,
      cc
    });
  }

  /**
   * Envía correo al técnico destino cuando un ticket es escalado
   */
  async sendEscalationNotificationToAdmin({ ticket, admin, technician, employee, reason, reassignedTechnician }) {
    const baseUrl = this.getFrontendUrl();
    const ticketsUrl = `${baseUrl}/tickets/escalados`;

    // Correo al técnico destino (el que fue seleccionado para dar seguimiento)
    const technicianSubject = `Ticket #${ticket.id} ESCALADO - Requiere tu atención`;
    const technicianHtml = `
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
            <p>Hola <strong>${admin.nombre}</strong>,</p>
            <p>El siguiente ticket ha sido escalado y requiere tu atención.</p>
            <div class="ticket-info">
              <h3>Detalles del Ticket</h3>
              <p><strong>ID:</strong> #${ticket.id}</p>
              <p><strong>Categoría:</strong> ${ticket.categoria || 'N/A'}</p>
              ${ticket.subcategoria ? `<p><strong>Subcategoría:</strong> ${ticket.subcategoria}</p>` : ''}
              <p><strong>Descripción del problema:</strong> ${ticket.descripcion || 'No disponible'}</p>
              <p><strong>Prioridad:</strong> ${ticket.prioridad || 'Media'}</p>
              <p><strong>Fecha de creación:</strong> ${ticket.fecha_creacion ? new Date(ticket.fecha_creacion).toLocaleString('es-ES') : 'N/A'}</p>
              <hr style="margin: 15px 0; border: none; border-top: 1px solid #ddd;">
              <p><strong>Solicitante:</strong> ${employee?.nombre || 'No disponible'} ${employee?.email ? `(${employee.email})` : ''}</p>
              <p><strong>Técnico original:</strong> ${technician?.nombre || 'No disponible'} ${technician?.email ? `(${technician.email})` : ''}</p>
              <hr style="margin: 15px 0; border: none; border-top: 1px solid #ddd;">
              <p><strong>Motivo de escalamiento:</strong></p>
              <p style="background: #fff3cd; padding: 10px; border-left: 3px solid #ff6b35; margin: 10px 0;">${reason}</p>
              <p><strong>Fecha de escalamiento:</strong> ${new Date().toLocaleString('es-ES')}</p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${ticketsUrl}" style="background-color: #ff6b35; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Ver Tickets Escalados</a>
            </div>
            <p style="text-align: center; font-size: 14px;">O copia y pega este enlace:<br><a href="${ticketsUrl}" style="color: #ff6b35; word-break: break-all;">${ticketsUrl}</a></p>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático del sistema Mesa de Ayuda.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Correo simple al usuario informando que su ticket fue escalado
    const userSubject = `Tu ticket #${ticket.id} ha sido escalado`;
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
            <p>Hola <strong>${employee?.nombre || 'Usuario'}</strong>,</p>
            <p>Te informamos que tu ticket <strong>#${ticket.id}</strong> ha sido escalado para darle seguimiento.</p>
            <div class="ticket-info">
              <h3>Detalles del Ticket</h3>
              <p><strong>ID:</strong> #${ticket.id}</p>
              <p><strong>Categoría:</strong> ${ticket.categoria || 'N/A'}</p>
              ${ticket.subcategoria ? `<p><strong>Subcategoría:</strong> ${ticket.subcategoria}</p>` : ''}
              <p><strong>Descripción:</strong> ${ticket.descripcion || 'No disponible'}</p>
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

    try {
      console.log('📧 sendEscalationNotificationToAdmin - Iniciando envío...');

      // Enviar correo al técnico destino
      if (admin.correo) {
        console.log('📧 Enviando correo al técnico destino:', admin.correo);
        const technicianResult = await this.sendEmail({
          to: admin.correo,
          subject: technicianSubject,
          html: technicianHtml
        });
        console.log(`✅ Notificación de escalamiento enviada al técnico destino para ticket #${ticket.id}`);
        console.log('📧 Resultado del envío:', technicianResult.messageId);
      } else {
        console.warn('⚠️ No hay correo del técnico destino configurado');
      }

      // Enviar correo simple al usuario
      if (employee?.email) {
        console.log('📧 Enviando correo al usuario:', employee.email);
        const userResult = await this.sendEmail({
          to: employee.email,
          subject: userSubject,
          html: userHtml
        });
        console.log(`✅ Notificación de escalamiento enviada al usuario para ticket #${ticket.id}`);
        console.log('📧 Resultado del envío:', userResult.messageId);
      } else {
        console.warn('⚠️ No hay correo del usuario configurado');
      }

      return true;
    } catch (error) {
      console.error('❌ Error enviando notificaciones de escalamiento:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        response: error.response
      });
      if (error.stack) {
        console.error('❌ Stack trace:', error.stack);
      }
      return false;
    }
  }

  /**
   * Método genérico para enviar correos
   */
  async sendEmail({ to, subject, html, text, cc }) {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'Mesa de Ayuda <noreply@mesadeayuda.com>',
      to: to,
      subject: subject,
      html: html,
      text: text || html.replace(/<[^>]*>/g, '') // Convertir HTML a texto plano
    };

    if (cc && Array.isArray(cc)) {
      const filtered = cc.filter(Boolean);
      if (filtered.length > 0) {
        mailOptions.cc = filtered.join(',');
      }
    }

    try {
      console.log('📧 sendEmail - Configuración:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        hasCC: !!mailOptions.cc,
        cc: mailOptions.cc || 'N/A'
      });

      console.log('📧 [CORREOS] Enviando correo a:', mailOptions.to);
      console.log('📧 [CORREOS] Asunto:', mailOptions.subject);
      console.log('📧 [CORREOS] Remitente:', mailOptions.from);
      
      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ [CORREOS] Correo enviado exitosamente a:', mailOptions.to);
      console.log('✅ [CORREOS] Message ID:', result.messageId);
      console.log('📧 [CORREOS] Respuesta del servidor SMTP:', result.response);
      return result;
    } catch (error) {
      console.error('❌ [CORREOS] Error enviando correo a:', mailOptions.to);
      console.error('❌ [CORREOS] Código de error:', error.code);
      console.error('❌ [CORREOS] Mensaje:', error.message);
      console.error('❌ [CORREOS] Stack:', error.stack);
      if (error.response) {
        console.error('❌ [CORREOS] Respuesta del servidor:', error.response);
      }
      if (error.command) {
        console.error('❌ [CORREOS] Comando fallido:', error.command);
      }
      // Verificar configuración SMTP
      if (error.code === 'EAUTH' || error.code === 'EENVELOPE') {
        console.error('❌ [CORREOS] ERROR DE AUTENTICACIÓN SMTP - Verificar SMTP_USER y SMTP_PASS en .env');
      }
      throw error;
    }
  }

  /**
   * Genera el HTML para el correo de ticket asignado (técnico)
   */
  generateTicketAssignedEmail(ticket, technician, employee) {
    const baseUrl = this.getFrontendUrl();
    const ticketsUrl = `${baseUrl}/tickets/assigned`;
    return `
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
            <p>Hola <strong>${technician.nombre}</strong>,</p>
            <p>Se te ha asignado un nuevo ticket que requiere tu atención.</p>

            <div class="ticket-info">
              <h3>Detalles del Ticket</h3>
              <p><strong>ID:</strong> #${ticket.id}</p>
              <p><strong>Título:</strong> ${ticket.titulo}</p>
              <p><strong>Descripción:</strong> ${ticket.descripcion}</p>
              <p><strong>Prioridad:</strong> ${ticket.prioridad}</p>
              <p><strong>Solicitante:</strong> ${employee.nombre} (${employee.email})</p>
              <p><strong>Fecha de creación:</strong> ${new Date(ticket.fecha_creacion).toLocaleString('es-ES')}</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${ticketsUrl}" style="background-color: #2196F3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Ver Tickets Asignados</a>
            </div>
            <p style="text-align: center; font-size: 14px;">O copia y pega este enlace:<br><a href="${ticketsUrl}" style="color: #2196F3; word-break: break-all;">${ticketsUrl}</a></p>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático del sistema Mesa de Ayuda.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Genera el HTML para el correo de ticket asignado (empleado)
   */
  generateTicketAssignedEmployeeEmail(ticket, technician, employee) {
    const baseUrl = this.getFrontendUrl();
    const trackingUrl = `${baseUrl}/tickets/tracking?ticketId=${ticket.id}`;
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Ticket Asignado</title>
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
            <h1>✅ Ticket Asignado</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${employee.nombre}</strong>,</p>
            <p>Tu ticket ha sido asignado y un técnico se encargará de resolverlo.</p>

            <div class="ticket-info">
              <h3>Detalles del Ticket</h3>
              <p><strong>ID:</strong> #${ticket.id}</p>
              <p><strong>Título:</strong> ${ticket.titulo}</p>
              <p><strong>Técnico asignado:</strong> ${technician.nombre}</p>
              <p><strong>Fecha de asignación:</strong> ${new Date().toLocaleString('es-ES')}</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingUrl}" style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Ver Seguimiento del Ticket</a>
            </div>
            <p style="text-align: center; font-size: 14px;">O copia y pega este enlace:<br><a href="${trackingUrl}" style="color: #4CAF50; word-break: break-all;">${trackingUrl}</a></p>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático del sistema Mesa de Ayuda.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Genera el HTML para el correo de cambio de estado
   */
  generateStatusChangeEmail(ticket, newStatus, technician, employee) {
    const baseUrl = this.getFrontendUrl();
    const trackingUrl = `${baseUrl}/tickets/tracking?ticketId=${ticket.id}`;
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Estado del Ticket Actualizado</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #FF9800; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .ticket-info { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #FF9800; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📝 Estado Actualizado</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${employee.nombre}</strong>,</p>
            <p>El estado de tu ticket ha sido actualizado.</p>

            <div class="ticket-info">
              <h3>Detalles del Ticket</h3>
              <p><strong>ID:</strong> #${ticket.id}</p>
              <p><strong>Título:</strong> ${ticket.titulo}</p>
              <p><strong>Nuevo estado:</strong> <span style="color: #FF9800; font-weight: bold;">${newStatus}</span></p>
              <p><strong>Técnico:</strong> ${technician.nombre}</p>
              <p><strong>Fecha de actualización:</strong> ${new Date().toLocaleString('es-ES')}</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingUrl}" style="background-color: #FF9800; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Ver Estado del Ticket</a>
            </div>
            <p style="text-align: center; font-size: 14px;">O copia y pega este enlace:<br><a href="${trackingUrl}" style="color: #FF9800; word-break: break-all;">${trackingUrl}</a></p>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático del sistema Mesa de Ayuda.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Genera el HTML para el correo de ticket completado
   */
  generateTicketCompletedEmail(ticket, technician, employee) {
    const baseUrl = this.getFrontendUrl();
    const trackingUrl = `${baseUrl}/tickets/tracking?ticketId=${ticket.id}`;
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Ticket Completado</title>
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
            <h1>🎉 Ticket Completado</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${employee.nombre}</strong>,</p>
            <p>¡Excelentes noticias! Tu ticket ha sido completado.</p>

            <div class="ticket-info">
              <h3>Detalles del Ticket</h3>
              <p><strong>ID:</strong> #${ticket.id}</p>
              <p><strong>Título:</strong> ${ticket.titulo}</p>
              <p><strong>Estado:</strong> <span style="color: #4CAF50; font-weight: bold;">Finalizado</span></p>
              <p><strong>Completado por:</strong> ${technician.nombre}</p>
              <p><strong>Fecha de finalización:</strong> ${new Date().toLocaleString('es-ES')}</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingUrl}" style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Ver y Evaluar Ticket</a>
            </div>
            <p style="text-align: center; font-size: 14px;">O copia y pega este enlace:<br><a href="${trackingUrl}" style="color: #4CAF50; word-break: break-all;">${trackingUrl}</a></p>
            <p>¡Gracias por usar nuestro sistema de Mesa de Ayuda!</p>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático del sistema Mesa de Ayuda.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Genera el HTML para el correo de comentario
   */
  generateCommentEmail(ticket, comment, author, recipient) {
    const baseUrl = this.getFrontendUrl();
    const trackingUrl = `${baseUrl}/tickets/tracking?ticketId=${ticket.id}`;
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Nuevo Comentario</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #9C27B0; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .ticket-info { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #9C27B0; }
          .comment-box { background: white; padding: 15px; margin: 15px 0; border: 1px solid #ddd; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💬 Nuevo Comentario</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${recipient.nombre}</strong>,</p>
            <p>Se ha agregado un nuevo comentario al ticket.</p>

            <div class="ticket-info">
              <h3>Ticket #${ticket.id}</h3>
              <p><strong>Título:</strong> ${ticket.titulo}</p>
            </div>

            <div class="comment-box">
              <h4>Comentario de ${author.nombre}:</h4>
              <p>${comment}</p>
              <small>Fecha: ${new Date().toLocaleString('es-ES')}</small>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingUrl}" style="background-color: #9C27B0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Ver Comentarios</a>
            </div>
            <p style="text-align: center; font-size: 14px;">O copia y pega este enlace:<br><a href="${trackingUrl}" style="color: #9C27B0; word-break: break-all;">${trackingUrl}</a></p>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático del sistema Mesa de Ayuda.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Genera el HTML del correo para el técnico cuando un ticket es reabierto
   */
  generateTicketReopenedTechnicianEmail(ticket, technician, employee, comment) {
    const baseUrl = this.getFrontendUrl();
    const ticketsUrl = `${baseUrl}/tickets/assigned`;
    const detail = comment
      ? comment.replace(/\n/g, '<br>')
      : 'El solicitante no proporcionó detalles adicionales.';

    return `
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
            <p>Hola <strong>${technician.nombre}</strong>,</p>
            <p>El solicitante ${employee?.nombre ? `<strong>${employee.nombre}</strong>` : ''} ha reabierto el ticket que atendiste. Por favor, revisa los detalles y da seguimiento cuanto antes.</p>

            <div class="ticket-info">
              <h3>Detalles del Ticket</h3>
              <p><strong>ID:</strong> #${ticket.id}</p>
              ${ticket.categoria ? `<p><strong>Categoría:</strong> ${ticket.categoria}</p>` : ''}
              ${ticket.subcategoria ? `<p><strong>Subcategoría:</strong> ${ticket.subcategoria}</p>` : ''}
              <p><strong>Prioridad:</strong> ${ticket.prioridad || 'Media'}</p>
              <p><strong>Descripción:</strong> ${ticket.descripcion || 'No disponible'}</p>
              <p><strong>Fecha de creación:</strong> ${ticket.fecha_creacion ? new Date(ticket.fecha_creacion).toLocaleString('es-ES') : 'N/D'}</p>
            </div>

            <div class="comment-box">
              <h4>Mensaje del solicitante:</h4>
              <p>${detail}</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${ticketsUrl}" style="background-color: #6c5ce7; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Revisar Tickets Asignados</a>
            </div>
            <p style="text-align: center; font-size: 14px;">O copia y pega este enlace:<br><a href="${ticketsUrl}" style="color: #6c5ce7; word-break: break-all;">${ticketsUrl}</a></p>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático del sistema Mesa de Ayuda.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Obtiene la URL del frontend desde las variables de entorno
   */
  getFrontendUrl() {
    return process.env.FRONTEND_URL || 'http://localhost:4200';
  }
}

module.exports = new EmailService();
