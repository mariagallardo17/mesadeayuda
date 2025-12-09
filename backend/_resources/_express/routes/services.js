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
  const userRol = req.user.rol || '';
  const rolLower = userRol.toLowerCase();

  if (rolLower !== 'administrador' && rolLower !== 'tecnico') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador o técnico' });
  }
  next();
};

router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/services - Usuario autenticado:', req.user.correo);

    const services = await query(`
      SELECT
        id_servicio as id,
        requerimiento,
        categoria,
        subcategoria,
        tiempo_objetivo,
        tiempo_maximo,
        prioridad,
        responsable_inicial,
        escalamiento,
        motivo_escalamiento,
        sla,
        estatus,
        requiere_aprobacion,
        fecha_creacion,
        fecha_actualizacion
      FROM Servicios
      ORDER BY id_servicio ASC
    `);

    console.log('📊 Servicios encontrados en BD:', services.length);

    const formattedServices = services.map(service => ({
      id: service.id,
      requerimiento: service.requerimiento,
      categoria: service.categoria,
      subcategoria: service.subcategoria,
      tiempoObjetivo: service.tiempo_objetivo,
      tiempoMaximo: service.tiempo_maximo,
      prioridad: service.prioridad,
      responsableInicial: service.responsable_inicial,
      escalamiento: service.escalamiento,
      motivoEscalamiento: service.motivo_escalamiento,
      sla: service.sla,
      activo: service.estatus === 'Activo',
      requiere_aprobacion: service.requiere_aprobacion || false,
      fechaCreacion: service.fecha_creacion,
      fechaActualizacion: service.fecha_actualizacion
    }));

    // Log para servicios de DESARROLLO DE SOFTWARE
    const devServices = formattedServices.filter(s => s.categoria === 'DESARROLLO DE SOFTWARE');
    console.log('💻 Servicios de DESARROLLO DE SOFTWARE:', devServices.length);
    devServices.forEach(service => {
      console.log(`  - ${service.subcategoria} (ID: ${service.id})`);
    });

    console.log('✅ Enviando', formattedServices.length, 'servicios al frontend');
    res.json(formattedServices);

  } catch (error) {
    console.error('Error obteniendo servicios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener servicio por ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const services = await query(`
      SELECT
        id_servicio as id,
        requerimiento,
        categoria,
        subcategoria,
        tiempo_objetivo,
        tiempo_maximo,
        prioridad,
        responsable_inicial,
        escalamiento,
        motivo_escalamiento,
        sla,
        estatus,
        requiere_aprobacion,
        fecha_creacion,
        fecha_actualizacion
      FROM Servicios
      WHERE id_servicio = ?
    `, [id]);

    if (services.length === 0) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }

    const service = services[0];
    const formattedService = {
      id: service.id,
      requerimiento: service.requerimiento,
      categoria: service.categoria,
      subcategoria: service.subcategoria,
      tiempoObjetivo: service.tiempo_objetivo,
      tiempoMaximo: service.tiempo_maximo,
      prioridad: service.prioridad,
      responsableInicial: service.responsable_inicial,
      escalamiento: service.escalamiento,
      motivoEscalamiento: service.motivo_escalamiento,
      sla: service.sla,
      activo: service.estatus === 'Activo',
      requiere_aprobacion: service.requiere_aprobacion || false,
      fechaCreacion: service.fecha_creacion,
      fechaActualizacion: service.fecha_actualizacion
    };

    res.json(formattedService);

  } catch (error) {
    console.error('Error obteniendo servicio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear nuevo servicio (administradores y técnicos)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      categoria,
      subcategoria,
      tiempoObjetivo,
      tiempoMaximo,
      prioridad,
      responsableInicial,
      escalamiento,
      motivoEscalamiento,
      nivelServicio,
      activo = true
    } = req.body;

    const tiempoObjetivoFinal = tiempoObjetivo;

    // Validar y normalizar nivelServicio (sla)
    // Si el valor no es válido o está vacío, usar null
    // Nota: La columna sla puede tener un ENUM restrictivo, por lo que
    // si el valor no coincide, se establece como null para evitar errores
    let slaValue = null;
    if (nivelServicio) {
      // Normalizar a mayúsculas y eliminar espacios
      const normalizedSLA = nivelServicio.toString().toUpperCase().trim();
      // Solo usar el valor si no está vacío después de normalizar
      if (normalizedSLA.length > 0) {
        // Intentar usar el valor normalizado
        // Si la BD rechaza el valor, el error se manejará en el catch
        slaValue = normalizedSLA;
      }
    }

    // Validaciones
    if (!categoria || !subcategoria || !escalamiento) {
      return res.status(400).json({ error: 'Todos los campos obligatorios deben ser completados' });
    }

    // Verificar que no existe un servicio con la misma categoría y subcategoría
    const existingServices = await query(
      'SELECT id_servicio FROM Servicios WHERE categoria = ? AND subcategoria = ?',
      [categoria, subcategoria]
    );

    if (existingServices.length > 0) {
      return res.status(400).json({ error: 'Ya existe un servicio con esta categoría y subcategoría' });
    }

    // Generar requerimiento basado en categoría y subcategoría
    const requerimiento = `Servicio de ${categoria} - ${subcategoria}`;

    // Insertar servicio
    // Si hay un error con sla, intentar de nuevo con null
    let result;
    try {
      result = await query(`
        INSERT INTO Servicios (
          requerimiento,
          categoria,
          subcategoria,
          tiempo_objetivo,
          tiempo_maximo,
          prioridad,
          responsable_inicial,
          escalamiento,
          motivo_escalamiento,
          sla,
          estatus
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        requerimiento,
        categoria,
        subcategoria,
        tiempoObjetivoFinal || null,
        tiempoMaximo || null,
        prioridad || null,
        responsableInicial || null,
        escalamiento,
        motivoEscalamiento || null,
        slaValue,
        activo ? 'Activo' : 'Inactivo'
      ]);
    } catch (slaError) {
      // Si el error es por la columna sla, intentar de nuevo con null
      if (slaError.code === 'WARN_DATA_TRUNCATED' && slaError.sqlMessage && slaError.sqlMessage.includes('sla')) {
        console.log('⚠️ Valor de SLA no válido, insertando con NULL...');
        result = await query(`
          INSERT INTO Servicios (
            requerimiento,
            categoria,
            subcategoria,
            tiempo_objetivo,
            tiempo_maximo,
            prioridad,
            responsable_inicial,
            escalamiento,
            motivo_escalamiento,
            sla,
            estatus
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          requerimiento,
          categoria,
          subcategoria,
          tiempoObjetivoFinal || null,
          tiempoMaximo || null,
          prioridad || null,
          responsableInicial || null,
          escalamiento,
          motivoEscalamiento || null,
          null, // sla como null
          activo ? 'Activo' : 'Inactivo'
        ]);
      } else {
        // Si es otro error, lanzarlo
        throw slaError;
      }
    }

    const serviceId = result.insertId;

    // Obtener el servicio creado
    const services = await query(`
      SELECT
        id_servicio as id,
        categoria,
        subcategoria,
        tiempo_objetivo,
        tiempo_maximo,
        prioridad,
        responsable_inicial,
        escalamiento,
        motivo_escalamiento,
        sla,
        estatus,
        fecha_creacion,
        fecha_actualizacion
      FROM Servicios
      WHERE id_servicio = ?
    `, [serviceId]);

    const service = services[0];
    const formattedService = {
      id: service.id,
      categoria: service.categoria,
      subcategoria: service.subcategoria,
      tiempoObjetivo: service.tiempo_objetivo,
      tiempoMaximo: service.tiempo_maximo,
      prioridad: service.prioridad,
      responsableInicial: service.responsable_inicial,
      escalamiento: service.escalamiento,
      motivoEscalamiento: service.motivo_escalamiento,
      sla: service.sla,
      activo: service.estatus === 'Activo',
      fechaCreacion: service.fecha_creacion,
      fechaActualizacion: service.fecha_actualizacion
    };

    res.status(201).json({
      message: 'Servicio creado exitosamente',
      service: formattedService
    });

  } catch (error) {
    console.error('Error creando servicio:', error);
    // Si es un error de truncamiento de datos, dar un mensaje más específico
    if (error.code === 'WARN_DATA_TRUNCATED' && error.sqlMessage && error.sqlMessage.includes('sla')) {
      return res.status(400).json({
        error: 'El valor del nivel de servicio no es válido. Por favor, verifica el valor ingresado o déjalo vacío.'
      });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar servicio (administradores y técnicos)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      categoria,
      subcategoria,
      tiempoObjetivo,
      tiempoMaximo,
      prioridad,
      responsableInicial,
      escalamiento,
      motivoEscalamiento,
      nivelServicio,
      activo
    } = req.body;

    const tiempoObjetivoFinal = tiempoObjetivo;

    // Validar y normalizar nivelServicio (sla)
    let slaValue = undefined; // undefined significa no actualizar
    if (nivelServicio !== undefined) {
      if (nivelServicio && nivelServicio.toString().trim().length > 0) {
        // Normalizar a mayúsculas para consistencia
        slaValue = nivelServicio.toString().toUpperCase().trim();
      } else {
        slaValue = null; // Si está vacío, establecer a null
      }
    }

    // Verificar que el servicio existe
    const existingServices = await query(
      'SELECT id_servicio FROM Servicios WHERE id_servicio = ?',
      [id]
    );

    if (existingServices.length === 0) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }

    // Verificar que la combinación categoría-subcategoría no exista en otro servicio
    if (categoria && subcategoria) {
      const comboExists = await query(
        'SELECT id_servicio FROM Servicios WHERE categoria = ? AND subcategoria = ? AND id_servicio != ?',
        [categoria, subcategoria, id]
      );

      if (comboExists.length > 0) {
        return res.status(400).json({ error: 'Ya existe un servicio con esta categoría y subcategoría' });
      }
    }

    // Construir query de actualización
    const updateFields = [];
    const updateValues = [];

    if (categoria !== undefined) {
      updateFields.push('categoria = ?');
      updateValues.push(categoria);
    }
    if (subcategoria !== undefined) {
      updateFields.push('subcategoria = ?');
      updateValues.push(subcategoria);
    }
    if (tiempoObjetivoFinal !== undefined) {
      updateFields.push('tiempo_objetivo = ?');
      updateValues.push(tiempoObjetivoFinal);
    }
    if (tiempoMaximo !== undefined) {
      updateFields.push('tiempo_maximo = ?');
      updateValues.push(tiempoMaximo);
    }
    if (prioridad !== undefined) {
      updateFields.push('prioridad = ?');
      updateValues.push(prioridad);
    }
    if (responsableInicial !== undefined) {
      updateFields.push('responsable_inicial = ?');
      updateValues.push(responsableInicial);
    }
    if (escalamiento !== undefined) {
      updateFields.push('escalamiento = ?');
      updateValues.push(escalamiento);
    }
    if (motivoEscalamiento !== undefined) {
      updateFields.push('motivo_escalamiento = ?');
      updateValues.push(motivoEscalamiento);
    }
    if (slaValue !== undefined) {
      updateFields.push('sla = ?');
      updateValues.push(slaValue);
    }
    if (activo !== undefined) {
      updateFields.push('estatus = ?');
      updateValues.push(activo ? 'Activo' : 'Inactivo');
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    updateFields.push('fecha_actualizacion = NOW()'); // Actualizar fecha de actualización
    updateValues.push(id);

    await query(
      `UPDATE Servicios SET ${updateFields.join(', ')} WHERE id_servicio = ?`,
      updateValues
    );

    // Obtener el servicio actualizado para devolverlo
    const updatedServiceResult = await query(`
      SELECT
        id_servicio as id,
        categoria,
        subcategoria,
        tiempo_objetivo,
        tiempo_maximo,
        prioridad,
        responsable_inicial,
        escalamiento,
        motivo_escalamiento,
        sla,
        estatus,
        fecha_creacion,
        fecha_actualizacion
      FROM Servicios
      WHERE id_servicio = ?
    `, [id]);

    const updatedServiceFormatted = {
      id: updatedServiceResult[0].id,
      categoria: updatedServiceResult[0].categoria,
      subcategoria: updatedServiceResult[0].subcategoria,
      tiempoObjetivo: updatedServiceResult[0].tiempo_objetivo,
      tiempoMaximo: updatedServiceResult[0].tiempo_maximo,
      prioridad: updatedServiceResult[0].prioridad,
      responsableInicial: updatedServiceResult[0].responsable_inicial,
      escalamiento: updatedServiceResult[0].escalamiento,
      motivoEscalamiento: updatedServiceResult[0].motivo_escalamiento,
      sla: updatedServiceResult[0].sla,
      activo: updatedServiceResult[0].estatus === 'Activo',
      fechaCreacion: updatedServiceResult[0].fecha_creacion,
      fechaActualizacion: updatedServiceResult[0].fecha_actualizacion
    };

    res.json(updatedServiceFormatted);

  } catch (error) {
    console.error('Error actualizando servicio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar servicio (administradores y técnicos)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el servicio existe
    const existingServices = await query(
      'SELECT id_servicio FROM Servicios WHERE id_servicio = ?',
      [id]
    );

    if (existingServices.length === 0) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }

    // Verificar si hay tickets asociados a este servicio
    const ticketsWithService = await query(
      'SELECT COUNT(*) as count FROM Tickets WHERE id_servicio = ?',
      [id]
    );

    if (ticketsWithService[0].count > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar el servicio porque tiene tickets asociados'
      });
    }

    // Eliminar servicio
    await query('DELETE FROM Servicios WHERE id_servicio = ?', [id]);

    res.json({ message: 'Servicio eliminado exitosamente' });

  } catch (error) {
    console.error('Error eliminando servicio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
