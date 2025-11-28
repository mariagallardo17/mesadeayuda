const express = require('express');
const { query } = require('../config/database');
const jwt = require('jsonwebtoken');
const assignmentService = require('../services/assignmentService');

const router = express.Router();

// Middleware para verificar autenticación
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

// Middleware para verificar rol de administrador
const requireAdmin = (req, res, next) => {
  if (req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador' });
  }
  next();
};

// =====================================================
// RUTAS PARA ESPECIALIDADES DE TÉCNICOS
// =====================================================

// Obtener todas las especialidades
router.get('/specialties', authenticateToken, async (req, res) => {
  try {
    const specialties = await query(`
      SELECT
        te.*,
        u.nombre as tecnico_nombre,
        u.correo as tecnico_correo
      FROM tecnicos_especialidades te
      JOIN Usuarios u ON te.usuario_id = u.id_usuario
      WHERE te.activo = 1
      ORDER BY u.nombre, te.area_especialidad
    `);

    res.json(specialties);
  } catch (error) {
    console.error('Error obteniendo especialidades:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear nueva especialidad
router.post('/specialties', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { usuario_id, area_especialidad, nivel_expertise } = req.body;

    if (!usuario_id || !area_especialidad || !nivel_expertise) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    // Verificar que el usuario existe y es técnico
    const usuarios = await query(`
      SELECT id_usuario, nombre, rol
      FROM Usuarios
      WHERE id_usuario = ? AND rol = 'tecnico' AND activo = 1
    `, [usuario_id]);

    if (usuarios.length === 0) {
      return res.status(400).json({ error: 'Usuario no encontrado o no es técnico' });
    }

    // Verificar que no existe ya esta especialidad para este técnico
    const existing = await query(`
      SELECT id FROM tecnicos_especialidades
      WHERE usuario_id = ? AND area_especialidad = ?
    `, [usuario_id, area_especialidad]);

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Esta especialidad ya está asignada al técnico' });
    }

    // Crear especialidad
    const result = await query(`
      INSERT INTO tecnicos_especialidades (usuario_id, area_especialidad, nivel_expertise)
      VALUES (?, ?, ?)
    `, [usuario_id, area_especialidad, nivel_expertise]);

    // Obtener la especialidad creada
    const newSpecialty = await query(`
      SELECT
        te.*,
        u.nombre as tecnico_nombre,
        u.correo as tecnico_correo
      FROM tecnicos_especialidades te
      JOIN Usuarios u ON te.usuario_id = u.id_usuario
      WHERE te.id = ?
    `, [result.insertId]);

    res.status(201).json({
      message: 'Especialidad creada exitosamente',
      specialty: newSpecialty[0]
    });

  } catch (error) {
    console.error('Error creando especialidad:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar especialidad
router.put('/specialties/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nivel_expertise, activo } = req.body;

    // Verificar que la especialidad existe
    const existing = await query(`
      SELECT id FROM tecnicos_especialidades WHERE id = ?
    `, [id]);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Especialidad no encontrada' });
    }

    // Actualizar
    const updateFields = [];
    const updateValues = [];

    if (nivel_expertise !== undefined) {
      updateFields.push('nivel_expertise = ?');
      updateValues.push(nivel_expertise);
    }
    if (activo !== undefined) {
      updateFields.push('activo = ?');
      updateValues.push(activo);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    updateFields.push('fecha_modificacion = NOW()');
    updateValues.push(id);

    await query(`
      UPDATE tecnicos_especialidades
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, updateValues);

    // Obtener la especialidad actualizada
    const updatedSpecialty = await query(`
      SELECT
        te.*,
        u.nombre as tecnico_nombre,
        u.correo as tecnico_correo
      FROM tecnicos_especialidades te
      JOIN Usuarios u ON te.usuario_id = u.id_usuario
      WHERE te.id = ?
    `, [id]);

    res.json(updatedSpecialty[0]);

  } catch (error) {
    console.error('Error actualizando especialidad:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// =====================================================
// RUTAS PARA REGLAS DE ASIGNACIÓN
// =====================================================

// Obtener todas las reglas de asignación
router.get('/rules', authenticateToken, async (req, res) => {
  try {
    const rules = await query(`
      SELECT
        aa.*,
        s.categoria,
        s.subcategoria,
        tp.nombre as tecnico_principal_nombre,
        ts.nombre as tecnico_secundario_nombre,
        tso.nombre as tecnico_soporte_nombre
      FROM asignaciones_automaticas aa
      JOIN Servicios s ON aa.servicio_id = s.id_servicio
      LEFT JOIN Usuarios tp ON aa.tecnico_principal_id = tp.id_usuario
      LEFT JOIN Usuarios ts ON aa.tecnico_secundario_id = ts.id_usuario
      LEFT JOIN Usuarios tso ON aa.tecnico_soporte_id = tso.id_usuario
      WHERE aa.activo = 1
      ORDER BY aa.area_servicio, aa.prioridad_ticket
    `);

    res.json(rules);
  } catch (error) {
    console.error('Error obteniendo reglas de asignación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear nueva regla de asignación
router.post('/rules', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      servicio_id,
      area_servicio,
      prioridad_ticket,
      tecnico_principal_id,
      tecnico_secundario_id,
      tecnico_soporte_id,
      regla_asignacion,
      carga_maxima
    } = req.body;

    if (!servicio_id || !area_servicio || !prioridad_ticket) {
      return res.status(400).json({ error: 'Servicio, área y prioridad son obligatorios' });
    }

    // Verificar que el servicio existe
    const servicios = await query(`
      SELECT id_servicio FROM Servicios WHERE id_servicio = ?
    `, [servicio_id]);

    if (servicios.length === 0) {
      return res.status(400).json({ error: 'Servicio no encontrado' });
    }

    // Crear regla
    const result = await query(`
      INSERT INTO asignaciones_automaticas (
        servicio_id, area_servicio, prioridad_ticket,
        tecnico_principal_id, tecnico_secundario_id, tecnico_soporte_id,
        regla_asignacion, carga_maxima
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      servicio_id, area_servicio, prioridad_ticket,
      tecnico_principal_id, tecnico_secundario_id, tecnico_soporte_id,
      regla_asignacion ? JSON.stringify(regla_asignacion) : null,
      carga_maxima || 5
    ]);

    // Obtener la regla creada
    const newRule = await query(`
      SELECT
        aa.*,
        s.categoria,
        s.subcategoria,
        tp.nombre as tecnico_principal_nombre,
        ts.nombre as tecnico_secundario_nombre,
        tso.nombre as tecnico_soporte_nombre
      FROM asignaciones_automaticas aa
      JOIN Servicios s ON aa.servicio_id = s.id_servicio
      LEFT JOIN Usuarios tp ON aa.tecnico_principal_id = tp.id_usuario
      LEFT JOIN Usuarios ts ON aa.tecnico_secundario_id = ts.id_usuario
      LEFT JOIN Usuarios tso ON aa.tecnico_soporte_id = tso.id_usuario
      WHERE aa.id = ?
    `, [result.insertId]);

    res.status(201).json({
      message: 'Regla de asignación creada exitosamente',
      rule: newRule[0]
    });

  } catch (error) {
    console.error('Error creando regla de asignación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar regla de asignación
router.put('/rules/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tecnico_principal_id,
      tecnico_secundario_id,
      tecnico_soporte_id,
      regla_asignacion,
      carga_maxima,
      activo
    } = req.body;

    // Verificar que la regla existe
    const existing = await query(`
      SELECT id FROM asignaciones_automaticas WHERE id = ?
    `, [id]);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Regla de asignación no encontrada' });
    }

    // Actualizar
    const updateFields = [];
    const updateValues = [];

    if (tecnico_principal_id !== undefined) {
      updateFields.push('tecnico_principal_id = ?');
      updateValues.push(tecnico_principal_id);
    }
    if (tecnico_secundario_id !== undefined) {
      updateFields.push('tecnico_secundario_id = ?');
      updateValues.push(tecnico_secundario_id);
    }
    if (tecnico_soporte_id !== undefined) {
      updateFields.push('tecnico_soporte_id = ?');
      updateValues.push(tecnico_soporte_id);
    }
    if (regla_asignacion !== undefined) {
      updateFields.push('regla_asignacion = ?');
      updateValues.push(JSON.stringify(regla_asignacion));
    }
    if (carga_maxima !== undefined) {
      updateFields.push('carga_maxima = ?');
      updateValues.push(carga_maxima);
    }
    if (activo !== undefined) {
      updateFields.push('activo = ?');
      updateValues.push(activo);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    updateFields.push('fecha_modificacion = NOW()');
    updateValues.push(id);

    await query(`
      UPDATE asignaciones_automaticas
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, updateValues);

    res.json({ message: 'Regla de asignación actualizada exitosamente' });

  } catch (error) {
    console.error('Error actualizando regla de asignación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// =====================================================
// RUTAS PARA ESTADÍSTICAS Y MONITOREO
// =====================================================

// Obtener estadísticas de asignaciones
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await assignmentService.getAssignmentStats();
    res.json(stats);
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener carga de trabajo de técnicos
router.get('/workload', authenticateToken, async (req, res) => {
  try {
    const workload = await assignmentService.getTechnicianWorkload();
    res.json(workload);
  } catch (error) {
    console.error('Error obteniendo carga de trabajo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Probar asignación automática (solo para administradores)
router.post('/test-assignment', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { servicio_id, prioridad = 'media' } = req.body;

    if (!servicio_id) {
      return res.status(400).json({ error: 'ID del servicio es requerido' });
    }

    const result = await assignmentService.assignTicketAutomatically(servicio_id, prioridad);
    res.json(result);

  } catch (error) {
    console.error('Error probando asignación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
