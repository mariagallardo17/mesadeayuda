const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

// Obtener notificaciones de un usuario
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🔍 Obteniendo notificaciones para usuario: ${userId}`);

    // Verificar si la columna 'leida' existe en la tabla
    const columnCheck = await query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'Notificaciones'
        AND COLUMN_NAME = 'leida'
    `);

    const hasLeidaColumn = columnCheck.length > 0;

    // Obtener notificaciones de la base de datos (incluyendo el campo leida si existe)
    const notifications = await query(`
      SELECT
        id_notificacion,
        id_ticket,
        id_usuario,
        tipo,
        mensaje,
        fecha_envio${hasLeidaColumn ? ', COALESCE(leida, false) as leida' : ', false as leida'}
      FROM Notificaciones
      WHERE id_usuario = ?
      ORDER BY fecha_envio DESC
      LIMIT 50
    `, [userId]);

    console.log(`📊 Notificaciones encontradas: ${notifications.length}`);

    res.json({
      success: true,
      notifications: notifications.map(notif => {
        // Determinar la URL de acción basada en el mensaje
        // Si el mensaje indica que el ticket está finalizado y listo para evaluar,
        // redirigir a la página de cerrar tickets
        const mensaje = notif.mensaje || '';
        const esTicketFinalizado = mensaje.includes('finalizado') &&
                                   (mensaje.includes('listo para que lo evalúes') ||
                                    mensaje.includes('Está listo para que lo evalúes'));

        const actionUrl = esTicketFinalizado
          ? `/tickets/close?ticketId=${notif.id_ticket}`
          : `/tickets/tracking?ticketId=${notif.id_ticket}`;

        return {
          id: notif.id_notificacion,
          userId: notif.id_usuario,
          type: notif.tipo, // 'Correo', 'WhatsApp', o 'Interna'
          title: 'Notificación', // Título genérico ya que no hay campo titulo
          message: notif.mensaje,
          ticketId: notif.id_ticket,
          actionUrl: actionUrl,
          timestamp: notif.fecha_envio,
          read: notif.leida === 1 || notif.leida === true // Convertir a boolean
        };
      })
    });
  } catch (error) {
    console.error('❌ Error obteniendo notificaciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Agregar notificación
router.post('/', async (req, res) => {
  try {
    const { userId, type, title, message, ticketId, actionUrl } = req.body;
    console.log('📧 Agregando notificación:', { userId, type, title, message, ticketId });

    // Insertar en la base de datos
    // Validar que el tipo sea uno de los valores permitidos: 'Correo', 'WhatsApp', 'Interna'
    const validTypes = ['Correo', 'WhatsApp', 'Interna'];
    const notificationType = validTypes.includes(type) ? type : 'Interna';

    const result = await query(`
      INSERT INTO Notificaciones (id_usuario, id_ticket, tipo, mensaje)
      VALUES (?, ?, ?, ?)
    `, [userId, ticketId, notificationType, message]);

    const notificationId = result.insertId;

    console.log('✅ Notificación agregada con ID:', notificationId);

    res.json({
      success: true,
      notification: {
        id: notificationId,
        userId: parseInt(userId),
        type: type || 'info',
        title,
        message,
        ticketId,
        actionUrl,
        timestamp: new Date().toISOString(),
        read: false
      }
    });
  } catch (error) {
    console.error('❌ Error agregando notificación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Marcar notificación como leída
router.put('/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id_usuario;
    
    console.log(`✅ [NOTIFICACIONES] Usuario ${userId} marcando notificación ${notificationId} como leída`);

    // CRÍTICO: Validar que la notificación pertenezca al usuario
    const notification = await query(`
      SELECT id_notificacion, id_usuario
      FROM Notificaciones
      WHERE id_notificacion = ?
    `, [notificationId]);

    if (notification.length === 0) {
      console.log(`⚠️ [NOTIFICACIONES] Notificación ${notificationId} no encontrada`);
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    if (notification[0].id_usuario !== userId) {
      console.log(`🚫 [NOTIFICACIONES] BLOQUEADO: Usuario ${userId} intentó marcar notificación ${notificationId} que pertenece a usuario ${notification[0].id_usuario}`);
      return res.status(403).json({ error: 'No tienes permisos para marcar esta notificación como leída' });
    }

    // Verificar si la columna 'leida' existe
    const columnCheck = await query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'Notificaciones'
        AND COLUMN_NAME = 'leida'
    `);

    if (columnCheck.length > 0) {
      // Si existe la columna, actualizarla
      await query(`
        UPDATE Notificaciones
        SET leida = true
        WHERE id_notificacion = ? AND id_usuario = ?
      `, [notificationId, userId]);
      console.log(`✅ [NOTIFICACIONES] Notificación ${notificationId} marcada como leída por usuario ${userId}`);
    } else {
      // Si no existe, crear la columna primero
      await query(`
        ALTER TABLE Notificaciones
        ADD COLUMN leida BOOLEAN DEFAULT FALSE
      `);
      // Luego actualizar
      await query(`
        UPDATE Notificaciones
        SET leida = true
        WHERE id_notificacion = ? AND id_usuario = ?
      `, [notificationId, userId]);
      console.log(`✅ [NOTIFICACIONES] Columna leida creada y notificación ${notificationId} marcada como leída por usuario ${userId}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ [NOTIFICACIONES] Error marcando notificación como leída:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar notificación
router.delete('/:notificationId', authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id_usuario;
    
    console.log(`🗑️ [NOTIFICACIONES] Usuario ${userId} intentando eliminar notificación ${notificationId}`);

    // CRÍTICO: Validar que la notificación pertenezca al usuario antes de eliminar
    const notification = await query(`
      SELECT id_notificacion, id_usuario
      FROM Notificaciones
      WHERE id_notificacion = ?
    `, [notificationId]);

    if (notification.length === 0) {
      console.log(`⚠️ [NOTIFICACIONES] Notificación ${notificationId} no encontrada`);
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    if (notification[0].id_usuario !== userId) {
      console.log(`🚫 [NOTIFICACIONES] BLOQUEADO: Usuario ${userId} intentó eliminar notificación ${notificationId} que pertenece a usuario ${notification[0].id_usuario}`);
      return res.status(403).json({ error: 'No tienes permisos para eliminar esta notificación' });
    }

    await query(`
      DELETE FROM Notificaciones
      WHERE id_notificacion = ? AND id_usuario = ?
    `, [notificationId, userId]);

    console.log(`✅ [NOTIFICACIONES] Notificación ${notificationId} eliminada por usuario ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ [NOTIFICACIONES] Error eliminando notificación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Agregar notificación de cambio de estado
router.post('/status-change', async (req, res) => {
  try {
    const { ticketId, newStatus, userId, details } = req.body;
    console.log(`📧 Agregando notificación de cambio de estado: ticket #${ticketId} a usuario ${userId}`);

    // Insertar en la base de datos
    // El tipo debe ser uno de: 'Correo', 'WhatsApp', 'Interna'
    const notificationMessage = details
      ? `El ticket #${ticketId} cambió de estado a '${newStatus}'. ${details}`
      : `El ticket #${ticketId} cambió de estado a '${newStatus}'`;

    const result = await query(`
      INSERT INTO Notificaciones (id_usuario, id_ticket, tipo, mensaje)
      VALUES (?, ?, ?, ?)
    `, [
      userId,
      ticketId,
      'Interna', // ENUM válido: 'Correo', 'WhatsApp', 'Interna'
      notificationMessage
    ]);

    const notificationId = result.insertId;

    console.log('✅ Notificación de cambio de estado agregada con ID:', notificationId);

    const message = details
      ? `El ticket #${ticketId} cambió de estado a '${newStatus}'. ${details}`
      : `El ticket #${ticketId} cambió de estado a '${newStatus}'`;

    res.json({
      success: true,
      notification: {
        id: notificationId,
        userId: parseInt(userId),
        type: 'info',
        title: 'Estado Actualizado',
        message,
        ticketId: parseInt(ticketId),
        actionUrl: `/tickets/tracking?ticketId=${ticketId}`,
        timestamp: new Date().toISOString(),
        read: false
      }
    });
  } catch (error) {
    console.error('❌ Error agregando notificación de cambio de estado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
