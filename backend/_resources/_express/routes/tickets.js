const express = require('express');
const { query } = require('../config/database');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const newAssignmentService = require('../services/newAssignmentService');
const notificationOrchestrator = require('../services/notification-orchestrator');
const { sqlCalcularEnTiempo, calcularEnTiempo, calcularTiempoRestanteFinalizacion } = require('../utils/tiempoHelper');

const router = express.Router();

let ticketReopenTableInitialized = false;

const initializeTicketReopenTable = async () => {
  if (ticketReopenTableInitialized) {
    return;
  }

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS TicketReaperturas (
        id_reapertura INT AUTO_INCREMENT PRIMARY KEY,
        id_ticket INT NOT NULL,
        usuario_id INT NOT NULL,
        tecnico_id INT NULL,
        observaciones_usuario TEXT NOT NULL,
        causa_tecnico TEXT NULL,
        fecha_reapertura DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        fecha_respuesta_tecnico DATETIME NULL,
        estado_reapertura VARCHAR(50) NULL COMMENT 'Estado del ticket al momento de la reapertura',
        CONSTRAINT fk_ticketreaperturas_ticket
          FOREIGN KEY (id_ticket) REFERENCES Tickets(id_ticket)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Verificar y agregar columna estado_reapertura si no existe (para tablas existentes)
    try {
      const columnExists = await query(`
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'TicketReaperturas'
          AND COLUMN_NAME = 'estado_reapertura'
        LIMIT 1
      `);

      if (columnExists.length === 0) {
        console.log('🔄 Agregando columna estado_reapertura a TicketReaperturas...');
        await query(`
          ALTER TABLE TicketReaperturas
          ADD COLUMN estado_reapertura VARCHAR(50) NULL COMMENT 'Estado del ticket al momento de la reapertura'
        `);
        console.log('✅ Columna estado_reapertura agregada exitosamente a TicketReaperturas');

        // Actualizar registros existentes con el estado actual del ticket
        try {
          const updateResult = await query(`
            UPDATE TicketReaperturas tr
            INNER JOIN Tickets t ON tr.id_ticket = t.id_ticket
            SET tr.estado_reapertura = t.estatus
            WHERE tr.estado_reapertura IS NULL
          `);
          console.log(`✅ Actualizados ${updateResult.affectedRows || 0} registros existentes con estado_reapertura`);
        } catch (updateError) {
          console.warn('⚠️ No se pudieron actualizar registros existentes:', updateError.message);
        }
      } else {
        console.log('ℹ️  Columna estado_reapertura ya existe en TicketReaperturas');
      }
    } catch (alterError) {
      console.error('❌ Error verificando/agregando columna estado_reapertura:', alterError.message);
      console.error('💡 Ejecuta manualmente el script: backend/scripts/add-estado-reapertura-column.sql');
    }

    const existingIndex = await query(`
      SELECT 1
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'TicketReaperturas'
        AND INDEX_NAME = 'idx_ticketreaperturas_ticket_fecha'
      LIMIT 1
    `);

    if (existingIndex.length === 0) {
      try {
        await query(`CREATE INDEX idx_ticketreaperturas_ticket_fecha ON TicketReaperturas (id_ticket, fecha_reapertura)`);
      } catch (indexError) {
        console.error('❌ Error creando índice para TicketReaperturas:', indexError.message);
      }
    }

    ticketReopenTableInitialized = true;
  } catch (error) {
    console.error('❌ Error inicializando tabla TicketReaperturas:', error);
  }
};

const ensureTicketReopenTable = async () => {
  if (!ticketReopenTableInitialized) {
    await initializeTicketReopenTable();
  }
};

const getLatestTicketReopening = async (ticketId) => {
  await ensureTicketReopenTable();
  const rows = await query(`
    SELECT
      tr.id_reapertura,
      tr.id_ticket,
      tr.usuario_id,
      tr.tecnico_id,
      tr.observaciones_usuario,
      tr.causa_tecnico,
      tr.fecha_reapertura,
      tr.fecha_respuesta_tecnico,
      tr.estado_reapertura
    FROM TicketReaperturas tr
    WHERE tr.id_ticket = ?
    ORDER BY tr.fecha_reapertura DESC, tr.id_reapertura DESC
    LIMIT 1
  `, [ticketId]);

  if (rows.length === 0) {
    return null;
  }

  const record = rows[0];
  return {
    id: record.id_reapertura,
    observacionesUsuario: record.observaciones_usuario,
    causaTecnico: record.causa_tecnico,
    fechaReapertura: record.fecha_reapertura,
    fechaRespuestaTecnico: record.fecha_respuesta_tecnico
  };
};

initializeTicketReopenTable().catch(error => {
  console.error('❌ Error al preparar TicketReaperturas en el arranque:', error);
});

router.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);
  next();
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E9);
    const userId = req.user?.id_usuario || 'unknown';
    cb(null, `${uniqueSuffix}_${userId}_${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos PDF'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB máximo
  }
});

const authenticateToken = (req, res, next) => {
  console.log('🔐 Verificando autenticación...');
  console.log('📨 Headers recibidos:', req.headers);

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log('🎫 Token extraído:', token ? 'SÍ' : 'NO');

  if (!token) {
    console.log('❌ No se encontró token de autorización');
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err, user) => {
    if (err) {
      console.log('❌ Token inválido:', err.message);
      return res.status(403).json({ error: 'Token inválido' });
    }
    console.log('✅ Token válido, usuario:', user);

    if (!user.id_usuario && user.id) {
      user.id_usuario = user.id;
    }

    req.user = user;
    next();
  });
};

router.get('/check-pending-evaluation', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Verificando tickets pendientes para usuario:', req.user.id_usuario);

    const pendientesEvaluacion = await query(`
      SELECT
        t.id_ticket,
        t.estatus,
        COALESCE(t.fecha_finalizacion, t.fecha_cierre) AS fecha_finalizacion,
        t.evaluacion_cierre_automatico
      FROM Tickets t
      LEFT JOIN Evaluaciones e ON e.id_ticket = t.id_ticket
      WHERE t.id_usuario = ?
        AND e.id_evaluacion IS NULL
        AND (
          t.estatus = 'Finalizado'
          OR (t.estatus = 'Cerrado' AND COALESCE(t.evaluacion_cierre_automatico, 0) = 1)
        )
        AND COALESCE(t.fecha_finalizacion, t.fecha_cierre) IS NOT NULL
    `, [req.user.id_usuario]);

    console.log('📋 Tickets pendientes encontrados:', pendientesEvaluacion.length);
    if (pendientesEvaluacion.length > 0) {
      console.log('📋 Detalles de tickets pendientes:', pendientesEvaluacion);
    }

    if (pendientesEvaluacion.length > 0) {
      return res.json({
        hasPending: true
      });
    }

    return res.json({
      hasPending: false
    });
  } catch (error) {
    console.error('❌ Error verificando tickets pendientes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear nuevo ticket
router.post('/', authenticateToken, upload.single('archivoAprobacion'), async (req, res) => {
  try {
    console.log('🎫 POST /api/tickets - Nueva petición recibida');
    console.log('👤 Usuario autenticado:', req.user);
    console.log('📋 Datos recibidos:', req.body);
    console.log('📎 Archivo recibido:', req.file ? 'SÍ' : 'NO');

    const {
      categoria,
      subcategoria,
      descripcion
    } = req.body;

    const archivoAprobacion = req.file;

    // Validar que el usuario esté autenticado y tenga ID
    if (!req.user || !req.user.id_usuario) {
      return res.status(401).json({ error: 'Usuario no autenticado o ID de usuario no válido' });
    }

    // Validaciones básicas
    if (!categoria || !subcategoria || !descripcion) {
      return res.status(400).json({ error: 'Todos los campos obligatorios deben ser completados' });
    }

    // Validar que los campos no estén vacíos después de trim
    const categoriaTrim = categoria.trim();
    const subcategoriaTrim = subcategoria.trim();
    const descripcionTrim = descripcion.trim();

    if (!categoriaTrim || !subcategoriaTrim || !descripcionTrim) {
      return res.status(400).json({ error: 'Todos los campos obligatorios deben ser completados' });
    }

    // Validar longitud mínima de descripción
    if (descripcionTrim.length < 10) {
      return res.status(400).json({ error: 'La descripción debe tener al menos 10 caracteres' });
    }

    // Validar que el usuario exista y esté activo
    try {
      const usuarioCheck = await query(`
        SELECT id_usuario, estatus
        FROM Usuarios
        WHERE id_usuario = ?
      `, [req.user.id_usuario]);

      if (usuarioCheck.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      if (usuarioCheck[0].estatus !== 'Activo') {
        return res.status(403).json({ error: 'Tu cuenta de usuario está inactiva. Contacta al administrador.' });
      }
    } catch (userError) {
      console.error('❌ Error verificando usuario:', userError);
      return res.status(500).json({ error: 'Error al verificar el usuario' });
    }

    // Verificar si el usuario tiene evaluaciones pendientes antes de permitir un nuevo ticket
    const pendientesEvaluacion = await query(`
      SELECT
        t.id_ticket,
        t.estatus,
        COALESCE(t.fecha_finalizacion, t.fecha_cierre) AS fecha_finalizacion,
        t.evaluacion_cierre_automatico
      FROM Tickets t
      LEFT JOIN Evaluaciones e ON e.id_ticket = t.id_ticket
      WHERE t.id_usuario = ?
        AND e.id_evaluacion IS NULL
        AND (
          t.estatus = 'Finalizado'
          OR (t.estatus = 'Cerrado' AND COALESCE(t.evaluacion_cierre_automatico, 0) = 1)
        )
        AND COALESCE(t.fecha_finalizacion, t.fecha_cierre) IS NOT NULL
    `, [req.user.id_usuario]);

      if (pendientesEvaluacion.length > 0) {
      return res.status(409).json({
        error: 'Tienes tickets pendientes de evaluación. Por favor, evalúa tus tickets en el menú "Cerrar Ticket" antes de crear uno nuevo.'
      });
    }

    // Obtener servicio del catálogo para obtener tiempo estimado y si requiere aprobación
    const servicios = await query(`
      SELECT id_servicio, tiempo_objetivo, tiempo_maximo, requiere_aprobacion, prioridad, estatus
      FROM Servicios
      WHERE categoria = ? AND subcategoria = ? AND estatus = 'Activo'
    `, [categoriaTrim, subcategoriaTrim]);

    if (servicios.length === 0) {
      return res.status(400).json({ error: 'Categoría y subcategoría no encontradas en el catálogo o el servicio está inactivo' });
    }

    const servicio = servicios[0];
    const tiempoEstimado = servicio.tiempo_objetivo;
    const tiempoMaximo = servicio.tiempo_maximo;
    // Manejar requiere_aprobacion como TINYINT(1) - puede ser 0, 1, true, false
    const requiereAprobacion = servicio.requiere_aprobacion === 1 || servicio.requiere_aprobacion === true || servicio.requiere_aprobacion === '1';

    if (requiereAprobacion && !archivoAprobacion) {
      return res.status(400).json({
        error: 'Este servicio requiere carta de aprobación. Por favor, adjunta el documento correspondiente.'
      });
    }

    // Función para mapear prioridades calculadas a valores permitidos en el ENUM de la BD
    const mapearPrioridadAEnum = (prioridadCalculada) => {
      const prioridadLower = prioridadCalculada.toLowerCase().trim();

      // El ENUM de la BD solo acepta: 'Alta', 'Media', 'Baja'
      if (prioridadLower === 'critica' || prioridadLower === 'crítica') {
        return 'Alta'; // Mapear "critica" a "Alta" (la más alta disponible)
      } else if (prioridadLower === 'alta') {
        return 'Alta';
      } else if (prioridadLower === 'media') {
        return 'Media';
      } else if (prioridadLower === 'baja') {
        return 'Baja';
      } else {
        // Por defecto, usar 'Media' si no se reconoce el valor
        console.warn(`⚠️ Prioridad no reconocida: "${prioridadCalculada}", usando "Media" por defecto`);
        return 'Media';
      }
    };

    // Obtener prioridad del servicio o usar 'Media' por defecto
    let prioridad = servicio.prioridad || 'Media';
    // Normalizar prioridad a formato esperado (primera letra mayúscula)
    prioridad = prioridad.charAt(0).toUpperCase() + prioridad.slice(1).toLowerCase();
    // Mapear a valores permitidos en el ENUM de la BD
    prioridad = mapearPrioridadAEnum(prioridad);

    let tecnicoAsignadoId = null;
    let asignacionInfo = null;

    try {
      console.log('🤖 Iniciando asignación automática...');
      console.log(`📋 Servicio ID: ${servicio.id_servicio}, Prioridad: ${prioridad}, Usuario ID: ${req.user.id_usuario}`);

      const asignacionPromise = newAssignmentService.assignTicketAutomatically(
        servicio.id_servicio,
        prioridad.toLowerCase(), // Pasar en minúsculas para consistencia
        req.user.id_usuario
      );

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout de asignación')), 5000) // Reducir timeout a 5 segundos (optimizado)
      );

      let asignacion;
      try {
        asignacion = await Promise.race([asignacionPromise, timeoutPromise]);
      } catch (raceError) {
        console.error(`❌ Error en Promise.race:`, raceError);
        asignacion = null;
      }

      console.log(`📊 Resultado de asignación:`, JSON.stringify(asignacion, null, 2));

      if (asignacion && asignacion.success === true) {
        tecnicoAsignadoId = asignacion.tecnico?.id || asignacion.tecnico?.id_usuario;
        asignacionInfo = asignacion;
        console.log(`✅ Asignación automática exitosa: ${asignacion.tecnico.nombre} (ID: ${tecnicoAsignadoId})`);
        console.log(`📊 Prioridad final: ${asignacion.prioridadFinal?.level} (Score: ${asignacion.prioridadFinal?.score})`);

        if (!tecnicoAsignadoId) {
          console.error(`❌ ERROR: asignacion.success es true pero tecnico.id es ${asignacion.tecnico?.id}`);
          console.error(`❌ Objeto técnico completo:`, JSON.stringify(asignacion.tecnico, null, 2));
        }

        // Actualizar prioridad si fue recalculada
        if (asignacion.prioridadFinal && asignacion.prioridadFinal.level) {
          // Mapear la prioridad calculada a valores permitidos en el ENUM de la BD
          prioridad = mapearPrioridadAEnum(asignacion.prioridadFinal.level);
          console.log(`🔄 Prioridad actualizada después de asignación: ${prioridad}`);
        }
      } else {
        const errorMessage = asignacion?.message || 'Razón desconocida';
        console.error(`❌ Asignación automática falló: ${errorMessage}`);
        console.error(`❌ Respuesta completa de asignación:`, JSON.stringify(asignacion, null, 2));
        console.error(`⚠️ Ticket se creará sin asignar técnico`);

        // Intentar asignación manual como fallback si hay responsable_inicial
        try {
          const servicioInfo = await query(`
            SELECT responsable_inicial
            FROM Servicios
            WHERE id_servicio = ?
          `, [servicio.id_servicio]);

          if (servicioInfo.length > 0 && servicioInfo[0].responsable_inicial) {
            console.log(`🔄 Intentando asignación manual de fallback para: ${servicioInfo[0].responsable_inicial}`);
            const tecnicoFallback = await query(`
              SELECT id_usuario, nombre
              FROM Usuarios
              WHERE (rol = 'tecnico' OR rol = 'administrador')
              AND estatus = 'Activo'
              AND UPPER(TRIM(nombre)) LIKE ?
              LIMIT 1
            `, [`%${servicioInfo[0].responsable_inicial.toUpperCase()}%`]);

            if (tecnicoFallback.length > 0) {
              tecnicoAsignadoId = tecnicoFallback[0].id_usuario;
              console.log(`✅ Asignación de fallback exitosa: ${tecnicoFallback[0].nombre} (ID: ${tecnicoAsignadoId})`);
            }
          }
        } catch (fallbackError) {
          console.error(`❌ Error en asignación de fallback:`, fallbackError);
        }
      }
    } catch (error) {
      console.error('❌ Error en asignación automática (timeout o error):', error.message);
      console.error('❌ Stack trace:', error.stack);
      console.error('❌ Error completo:', error);
      // Continuar con la creación del ticket sin asignar
    }

    // Asegurar que la prioridad esté mapeada correctamente antes de insertar
    const prioridadFinal = mapearPrioridadAEnum(prioridad || 'Media');

    // Calcular tiempo_restante_finalizacion basado en tiempo_objetivo o tiempo_maximo del servicio
    const fechaCreacion = new Date();
    let tiempoRestanteFinalizacion = null;
    
    try {
      tiempoRestanteFinalizacion = calcularTiempoRestanteFinalizacion(
        fechaCreacion,
        servicio.tiempo_objetivo,
        servicio.tiempo_maximo
      );
    } catch (error) {
      console.error('⚠️ Error calculando tiempo_restante_finalizacion:', error);
      console.error('⚠️ Continuando sin tiempo_restante_finalizacion');
      tiempoRestanteFinalizacion = null;
    }

    console.log('⏱️ Tiempo de solución calculado:');
    console.log(`   Tiempo objetivo: ${servicio.tiempo_objetivo || 'N/A'}`);
    console.log(`   Tiempo máximo: ${servicio.tiempo_maximo || 'N/A'}`);
    console.log(`   Tiempo restante (segundos): ${tiempoRestanteFinalizacion !== null ? tiempoRestanteFinalizacion : 'N/A'}`);

    const parametros = [
      req.user.id_usuario,
      servicio.id_servicio,
      descripcionTrim,
      prioridadFinal,
      'Pendiente',
      tecnicoAsignadoId || null,
      archivoAprobacion ? archivoAprobacion.filename : null,
      tiempoRestanteFinalizacion
    ];

    console.log('📊 Parámetros para inserción:', {
      'req.user.id_usuario': req.user.id_usuario,
      'servicio.id_servicio': servicio.id_servicio,
      'descripcion': descripcionTrim,
      'prioridad': prioridadFinal,
      'estatus': 'Pendiente',
      'tecnicoAsignadoId': tecnicoAsignadoId || null,
      'archivoAprobacion': archivoAprobacion ? archivoAprobacion.filename : null,
      'tiempoRestanteFinalizacion': tiempoRestanteFinalizacion
    });
    console.log('📊 Array de parámetros completo:', parametros);

    if (tecnicoAsignadoId) {
      console.log(`✅ Insertando ticket CON técnico asignado (ID: ${tecnicoAsignadoId})`);
    } else {
      console.error(`⚠️ Insertando ticket SIN técnico asignado`);
      console.error(`⚠️ Revisar logs anteriores para ver por qué falló la asignación`);
    }

    // Si hay técnico asignado, establecer fecha_asignacion
    // Construir la consulta dinámicamente para manejar fecha_asignacion de forma segura
    let sqlQuery;
    if (tecnicoAsignadoId) {
      sqlQuery = `
        INSERT INTO Tickets (
          id_usuario,
          id_servicio,
          descripcion,
          prioridad,
          estatus,
          id_tecnico,
          fecha_creacion,
          fecha_asignacion,
          archivo_aprobacion,
          tiempo_restante_finalizacion
        ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?)
      `;
    } else {
      sqlQuery = `
        INSERT INTO Tickets (
          id_usuario,
          id_servicio,
          descripcion,
          prioridad,
          estatus,
          id_tecnico,
          fecha_creacion,
          fecha_asignacion,
          archivo_aprobacion,
          tiempo_restante_finalizacion
        ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NULL, ?, ?)
      `;
    }

    console.log('📝 Ejecutando consulta SQL de inserción...');
    console.log('📝 SQL Query:', sqlQuery.replace(/\s+/g, ' ').trim());
    console.log('📝 Parámetros:', parametros);
    console.log('📝 Número de parámetros:', parametros.length);
    console.log('📝 Número de placeholders en SQL:', (sqlQuery.match(/\?/g) || []).length);

    let result;
    try {
      result = await query(sqlQuery, parametros);
      console.log('✅ Consulta SQL ejecutada exitosamente');
      console.log('✅ Resultado:', result);
      console.log('✅ Insert ID:', result.insertId);
    } catch (sqlError) {
      console.error('❌ ERROR en consulta SQL:', sqlError);
      console.error('❌ Mensaje SQL:', sqlError.message);
      console.error('❌ Código SQL:', sqlError.code);
      console.error('❌ SQL State:', sqlError.sqlState);
      console.error('❌ SQL Query:', sqlQuery);
      console.error('❌ Parámetros:', parametros);
      console.error('❌ Stack trace:', sqlError.stack);
      throw sqlError; // Re-lanzar el error para que sea capturado por el catch principal
    }

    const ticketId = result.insertId;

    if (!ticketId) {
      console.error('❌ ERROR: No se pudo obtener el ID del ticket insertado');
      console.error('❌ Resultado de inserción:', result);
      throw new Error('No se pudo crear el ticket. No se obtuvo un ID válido.');
    }

    console.log(`✅ Ticket insertado con ID: ${ticketId}`);
    console.log(`📊 Técnico asignado en BD: ${tecnicoAsignadoId || 'NINGUNO'}`);

    // Verificar que el ticket se insertó correctamente con el técnico
    if (tecnicoAsignadoId) {
      const verificacion = await query(`
        SELECT id_ticket, id_tecnico, fecha_asignacion
        FROM Tickets
        WHERE id_ticket = ?
      `, [ticketId]);

      if (verificacion.length > 0) {
        console.log(`✅ Verificación: Ticket ${ticketId} tiene técnico ID: ${verificacion[0].id_tecnico}`);
        if (verificacion[0].id_tecnico !== tecnicoAsignadoId) {
          console.error(`❌ ERROR: El técnico no se guardó correctamente. Esperado: ${tecnicoAsignadoId}, Obtenido: ${verificacion[0].id_tecnico}`);
        } else {
          console.log(`✅ Confirmado: El técnico se guardó correctamente en la BD`);
        }
      }
    }

    // Obtener el ticket creado con información del servicio y técnico asignado
    let tickets;
    try {
      tickets = await query(`
        SELECT
          t.id_ticket,
          t.descripcion,
          t.prioridad,
          t.estatus,
          t.fecha_creacion,
          t.fecha_cierre,
          t.fecha_asignacion,
          t.fecha_inicio_atencion,
          t.tiempo_atencion_segundos,
          t.tiempo_restante_finalizacion,
          t.pendiente_motivo,
          t.pendiente_tiempo_estimado,
          t.pendiente_actualizado_en,
          t.id_usuario,
          t.id_tecnico,
          s.categoria,
          s.subcategoria,
          s.tiempo_objetivo,
          s.tiempo_maximo,
          u.nombre,
          u.correo,
          tec.nombre as tecnico_nombre,
          tec.correo as tecnico_correo,
          ${sqlCalcularEnTiempo()}
        FROM Tickets t
        JOIN Servicios s ON t.id_servicio = s.id_servicio
        JOIN Usuarios u ON t.id_usuario = u.id_usuario
        LEFT JOIN Usuarios tec ON t.id_tecnico = tec.id_usuario
        WHERE t.id_ticket = ?
      `, [ticketId]);
    } catch (queryError) {
      console.error('❌ ERROR en consulta SELECT del ticket:', queryError);
      console.error('❌ Mensaje:', queryError.message);
      console.error('❌ Stack:', queryError.stack);
      // Intentar obtener el ticket sin el cálculo de enTiempo como fallback
      console.log('🔄 Intentando obtener ticket sin cálculo de enTiempo...');
      tickets = await query(`
        SELECT
          t.id_ticket,
          t.descripcion,
          t.prioridad,
          t.estatus,
          t.fecha_creacion,
          t.fecha_cierre,
          t.fecha_asignacion,
          t.fecha_inicio_atencion,
          t.tiempo_atencion_segundos,
          t.tiempo_restante_finalizacion,
          t.pendiente_motivo,
          t.pendiente_tiempo_estimado,
          t.pendiente_actualizado_en,
          t.id_usuario,
          t.id_tecnico,
          s.categoria,
          s.subcategoria,
          s.tiempo_objetivo,
          s.tiempo_maximo,
          u.nombre,
          u.correo,
          tec.nombre as tecnico_nombre,
          tec.correo as tecnico_correo
        FROM Tickets t
        JOIN Servicios s ON t.id_servicio = s.id_servicio
        JOIN Usuarios u ON t.id_usuario = u.id_usuario
        LEFT JOIN Usuarios tec ON t.id_tecnico = tec.id_usuario
        WHERE t.id_ticket = ?
      `, [ticketId]);
    }

    if (!tickets || tickets.length === 0) {
      console.error('❌ ERROR: No se pudo obtener el ticket recién creado');
      console.error('❌ Ticket ID:', ticketId);
      throw new Error('No se pudo obtener la información del ticket creado.');
    }

    const ticket = tickets[0];
    // Calcular enTiempo si no viene del SQL (fallback)
    // Para tickets recién creados, enTiempo siempre será null porque no tienen fecha_cierre
    let enTiempo = null;
    if (ticket.en_tiempo !== null && ticket.en_tiempo !== undefined) {
      enTiempo = ticket.en_tiempo === 1;
    } else if (ticket.fecha_cierre) {
      // Solo calcular si hay fecha_cierre
      enTiempo = calcularEnTiempo(ticket.fecha_creacion, ticket.fecha_cierre, ticket.tiempo_objetivo);
    }

    // Usar tiempo_maximo si está disponible, sino usar tiempo_objetivo para el countdown
    const tiempoParaCountdown = ticket.tiempo_maximo || ticket.tiempo_objetivo;

    const formattedTicket = {
      id: ticket.id_ticket,
      categoria: ticket.categoria,
      subcategoria: ticket.subcategoria,
      descripcion: ticket.descripcion,
      tiempoEstimado: tiempoParaCountdown, // Usar tiempo_maximo si existe, sino tiempo_objetivo
      tiempoObjetivo: ticket.tiempo_objetivo, // Mantener tiempo_objetivo original
      tiempoMaximo: ticket.tiempo_maximo,
      tiempoRestanteFinalizacion: ticket.tiempo_restante_finalizacion, // Tiempo restante calculado en segundos
      estado: ticket.estatus,
      prioridad: ticket.prioridad,
      fechaCreacion: ticket.fecha_creacion,
      fechaCierre: ticket.fecha_cierre,
      fechaAsignacion: ticket.fecha_asignacion,
      fechaInicioAtencion: ticket.fecha_inicio_atencion,
      tiempoAtencionSegundos: ticket.tiempo_atencion_segundos,
      pendienteMotivo: ticket.pendiente_motivo || null,
      pendienteTiempoEstimado: ticket.pendiente_tiempo_estimado || null,
      pendienteActualizadoEn: ticket.pendiente_actualizado_en || null,
      enTiempo: enTiempo,
      tecnicoAsignado: ticket.tecnico_nombre ? {
        nombre: ticket.tecnico_nombre,
        correo: ticket.tecnico_correo
      } : null,
      usuario: {
        nombre: ticket.nombre,
        correo: ticket.correo
      }
    };

    const response = {
      message: 'Ticket creado exitosamente',
      ticket: formattedTicket
    };

    // Agregar información de asignación si fue exitosa
    if (asignacionInfo && asignacionInfo.success) {
      response.asignacionAutomatica = {
        exitosa: true,
        tecnico: asignacionInfo.tecnico.nombre,
        area: asignacionInfo.tecnico.area || asignacionInfo.servicio.categoria,
        nivel: asignacionInfo.tecnico.nivel,
        fallback: asignacionInfo.fallback || false,
        prioridadFinal: {
          nivel: asignacionInfo.prioridadFinal.level,
          score: asignacionInfo.prioridadFinal.score,
          nivelTecnico: prioridadFinal
        }
      };
    }

    // Enviar notificaciones por correo siempre (al usuario y técnico si está asignado)
    console.log('🔍 Verificando envío de correos...');
    console.log('   Técnico asignado:', ticket.tecnico_nombre);
    console.log('   Email técnico:', ticket.tecnico_correo);
    console.log('   Email empleado:', ticket.correo);

    try {
      await notificationOrchestrator.notifyTicketAssignment({ ticket });
      console.log('✅ Notificaciones enviadas exitosamente');
    } catch (notifError) {
      console.error('❌ Error enviando notificaciones (no crítico):', notifError.message);
      console.error('❌ Stack trace de notificaciones:', notifError.stack);
      // No lanzar el error, solo loguearlo - el ticket ya fue creado exitosamente
    }

    res.status(201).json(response);

  } catch (error) {
    console.error('❌ Error creando ticket:', error);
    console.error('❌ Mensaje de error:', error.message);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Código de error:', error.code);
    console.error('❌ SQL State:', error.sqlState);

    // Enviar mensaje de error más descriptivo en desarrollo
    const errorMessage = process.env.NODE_ENV === 'development'
      ? `Error interno del servidor: ${error.message}`
      : 'Error interno del servidor';

    res.status(500).json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        code: error.code,
        sqlState: error.sqlState
      } : undefined
    });
  }
});

// Obtener tickets del usuario
router.get('/my-tickets', authenticateToken, async (req, res) => {
  try {
    console.log('🎫 GET /api/tickets/my-tickets - Usuario:', req.user);
    console.log('🔍 Rol del usuario:', req.user.rol);
    console.log('🆔 ID del usuario:', req.user.id_usuario);

    let tickets;

    if (req.user.rol === 'tecnico' || req.user.rol === 'administrador') {
      tickets = await query(`
        SELECT
          t.id_ticket as id,
          s.categoria,
          s.subcategoria,
          t.descripcion,
          s.tiempo_objetivo as tiempo_estimado,
          s.tiempo_maximo,
          t.estatus as estado,
          t.prioridad,
          t.fecha_creacion,
          t.fecha_cierre as fecha_finalizacion,
          t.fecha_cierre,
          t.fecha_asignacion,
          t.fecha_inicio_atencion,
          t.tiempo_atencion_segundos,
          t.tiempo_restante_finalizacion,
          t.archivo_aprobacion as archivoAprobacion,
          t.pendiente_motivo as pendienteMotivo,
          t.pendiente_tiempo_estimado as pendienteTiempoEstimado,
          t.pendiente_actualizado_en as pendienteActualizadoEn,
          t.evaluacion_ultimo_recordatorio,
          t.evaluacion_recordatorio_contador,
          t.evaluacion_cierre_automatico,
          t.comentario_admin_tecnico,
          u.nombre as usuario_nombre,
          u.correo as usuario_correo,
          tec.nombre as tecnico_nombre,
          e.calificacion,
          e.comentario as comentario_evaluacion,
          e.fecha_evaluacion,
          tr.id_reapertura as reapertura_id,
          tr.observaciones_usuario as reapertura_observaciones_usuario,
          tr.causa_tecnico as reapertura_causa_tecnico,
          tr.fecha_reapertura as reapertura_fecha_reapertura,
          tr.fecha_respuesta_tecnico as reapertura_fecha_respuesta_tecnico,
          tr.tecnico_id as reapertura_tecnico_id,
          ${sqlCalcularEnTiempo()}
        FROM Tickets t
        JOIN Servicios s ON t.id_servicio = s.id_servicio
        JOIN Usuarios u ON t.id_usuario = u.id_usuario
        LEFT JOIN Usuarios tec ON t.id_tecnico = tec.id_usuario
        LEFT JOIN Evaluaciones e ON t.id_ticket = e.id_ticket
        LEFT JOIN (
          SELECT tr.*
          FROM TicketReaperturas tr
          INNER JOIN (
            SELECT id_ticket, MAX(fecha_reapertura) AS max_fecha
            FROM TicketReaperturas
            GROUP BY id_ticket
          ) latest ON latest.id_ticket = tr.id_ticket AND latest.max_fecha = tr.fecha_reapertura
        ) tr ON tr.id_ticket = t.id_ticket
        WHERE (t.id_tecnico = ? OR t.id_usuario = ?) 
        AND t.estatus != 'Escalado'
        AND t.estatus != 'Cerrado'
        ORDER BY t.fecha_creacion DESC
      `, [req.user.id_usuario, req.user.id_usuario]);
    } else {
      tickets = await query(`
        SELECT
          t.id_ticket as id,
          s.categoria,
          s.subcategoria,
          t.descripcion,
          s.tiempo_objetivo as tiempo_estimado,
          s.tiempo_maximo,
          t.estatus as estado,
          t.prioridad,
          t.fecha_creacion,
          t.fecha_cierre as fecha_finalizacion,
          t.fecha_cierre,
          t.fecha_asignacion,
          t.fecha_inicio_atencion,
          t.tiempo_atencion_segundos,
          t.tiempo_restante_finalizacion,
          t.archivo_aprobacion as archivoAprobacion,
          t.pendiente_motivo as pendienteMotivo,
          t.pendiente_tiempo_estimado as pendienteTiempoEstimado,
          t.pendiente_actualizado_en as pendienteActualizadoEn,
          t.evaluacion_ultimo_recordatorio,
          t.evaluacion_recordatorio_contador,
          t.evaluacion_cierre_automatico,
          u.nombre as usuario_nombre,
          u.correo as usuario_correo,
          tec.nombre as tecnico_nombre,
          e.calificacion,
          e.comentario as comentario_evaluacion,
          e.fecha_evaluacion,
          tr.id_reapertura as reapertura_id,
          tr.observaciones_usuario as reapertura_observaciones_usuario,
          tr.causa_tecnico as reapertura_causa_tecnico,
          tr.fecha_reapertura as reapertura_fecha_reapertura,
          tr.fecha_respuesta_tecnico as reapertura_fecha_respuesta_tecnico,
          tr.tecnico_id as reapertura_tecnico_id,
          ${sqlCalcularEnTiempo()}
        FROM Tickets t
        JOIN Servicios s ON t.id_servicio = s.id_servicio
        JOIN Usuarios u ON t.id_usuario = u.id_usuario
        LEFT JOIN Usuarios tec ON t.id_tecnico = tec.id_usuario
        LEFT JOIN Evaluaciones e ON t.id_ticket = e.id_ticket
        LEFT JOIN (
          SELECT tr.*
          FROM TicketReaperturas tr
          INNER JOIN (
            SELECT id_ticket, MAX(fecha_reapertura) AS max_fecha
            FROM TicketReaperturas
            GROUP BY id_ticket
          ) latest ON latest.id_ticket = tr.id_ticket AND latest.max_fecha = tr.fecha_reapertura
        ) tr ON tr.id_ticket = t.id_ticket
        WHERE t.id_usuario = ?
        AND t.estatus != 'Cerrado'
        ORDER BY t.fecha_creacion DESC
      `, [req.user.id_usuario]);
    }

    console.log('📊 Tickets encontrados:', tickets.length);

    // Obtener parámetros de paginación
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100); // Entre 1 y 100
    const offset = (page - 1) * limit;

    // Calcular información de paginación
    const total = tickets.length;
    const totalPages = Math.ceil(total / limit);
    const startItem = total > 0 ? offset + 1 : 0;
    const endItem = Math.min(offset + limit, total);

    // Aplicar paginación a los tickets (slice)
    const paginatedTickets = tickets.slice(offset, offset + limit);

    const formattedTickets = paginatedTickets.map(ticket => {
      // Calcular enTiempo si no viene del SQL (fallback)
      const enTiempo = ticket.en_tiempo !== null && ticket.en_tiempo !== undefined 
        ? ticket.en_tiempo === 1 
        : calcularEnTiempo(ticket.fecha_creacion, ticket.fecha_cierre, ticket.tiempo_estimado);

      // Usar tiempo_maximo si está disponible, sino usar tiempo_objetivo para el countdown
      const tiempoParaCountdown = ticket.tiempo_maximo || ticket.tiempo_estimado;

      return {
        id: ticket.id,
        categoria: ticket.categoria,
        subcategoria: ticket.subcategoria,
        descripcion: ticket.descripcion,
        tiempoEstimado: tiempoParaCountdown, // Usar tiempo_maximo si existe, sino tiempo_objetivo
        tiempoObjetivo: ticket.tiempo_estimado, // Mantener tiempo_objetivo original
        tiempoMaximo: ticket.tiempo_maximo,
        tiempoRestanteFinalizacion: ticket.tiempo_restante_finalizacion, // Tiempo restante calculado en segundos
        estado: ticket.estado,
        prioridad: ticket.prioridad,
        fechaCreacion: ticket.fecha_creacion,
        fechaFinalizacion: ticket.fecha_finalizacion,
        fechaCierre: ticket.fecha_cierre,
        fechaAsignacion: ticket.fecha_asignacion,
        fechaInicioAtencion: ticket.fecha_inicio_atencion,
        tiempoAtencionSegundos: ticket.tiempo_atencion_segundos,
        archivoAprobacion: ticket.archivoAprobacion,
        pendienteMotivo: ticket.pendienteMotivo,
        pendienteTiempoEstimado: ticket.pendienteTiempoEstimado,
        pendienteActualizadoEn: ticket.pendienteActualizadoEn,
        evaluacionUltimoRecordatorio: ticket.evaluacion_ultimo_recordatorio,
        evaluacionRecordatorioContador: ticket.evaluacion_recordatorio_contador,
        evaluacionCierreAutomatico: ticket.evaluacion_cierre_automatico === 1,
        tecnicoAsignado: ticket.tecnico_nombre || null,
        comentarioAdminTecnico: ticket.comentario_admin_tecnico || null,
        enTiempo: enTiempo,
        evaluacion: ticket.calificacion ? {
          calificacion: ticket.calificacion,
          comentario: ticket.comentario_evaluacion,
          fechaEvaluacion: ticket.fecha_evaluacion
        } : null,
        reapertura: ticket.reapertura_id ? {
          id: ticket.reapertura_id,
          observacionesUsuario: ticket.reapertura_observaciones_usuario,
          causaTecnico: ticket.reapertura_causa_tecnico,
          fechaReapertura: ticket.reapertura_fecha_reapertura,
          fechaRespuestaTecnico: ticket.reapertura_fecha_respuesta_tecnico
        } : null,
        mostrarEstadoReabierto: !!ticket.reapertura_id,
        usuario: {
          nombre: ticket.usuario_nombre,
          correo: ticket.usuario_correo
        }
      };
    });

    // Devolver respuesta con paginación (formato consistente con PHP)
    res.json({
      tickets: formattedTickets,
      pagination: {
        total: total,
        page: page,
        limit: limit,
        totalPages: totalPages,
        startItem: startItem,
        endItem: endItem,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

    } catch (error) {
      console.error('Error obteniendo tickets:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  router.put('/:id/status', authenticateToken, async (req, res) => {
    try {
      console.log('🔄 PUT /api/tickets/:id/status - Actualizando estado del ticket');
      console.log('🎫 ID del ticket:', req.params.id);
      console.log('📋 Body recibido:', req.body);
      console.log('👤 Usuario:', req.user);

      const { id } = req.params;
      const estatus = req.body.estatus || req.body.nuevoEstado;
      const { comentarios, pendienteTiempoEstimado } = req.body;

      if (req.user.rol === 'administrador' && req.body.nuevoEstado && !req.body.estatus) {
        console.log('🔄 Administrador usando nuevoEstado - usando lógica de administradores');

        const nuevoEstado = req.body.nuevoEstado;
        if (!nuevoEstado || (typeof nuevoEstado === 'string' && nuevoEstado.trim() === '')) {
          return res.status(400).json({ error: 'El nuevo estado es requerido' });
        }

        const estadoFinal = String(nuevoEstado).trim();
        const estadosValidos = ['Abierto', 'Pendiente', 'En Progreso', 'Finalizado', 'Cerrado'];
        if (!estadosValidos.includes(estadoFinal)) {
          return res.status(400).json({ error: `Estado no válido: ${estadoFinal}. Estados válidos: ${estadosValidos.join(', ')}` });
        }

        const tickets = await query(`
          SELECT
            t.id_ticket,
            t.estatus,
            t.id_tecnico,
            t.descripcion,
            t.prioridad,
            t.fecha_creacion,
            u.nombre as tecnico_nombre,
            u.correo as tecnico_correo,
            emp.nombre as usuario_nombre,
            emp.correo as usuario_correo,
            s.categoria,
            s.subcategoria
          FROM Tickets t
          LEFT JOIN Usuarios u ON t.id_tecnico = u.id_usuario
          LEFT JOIN Usuarios emp ON t.id_usuario = emp.id_usuario
          LEFT JOIN Servicios s ON t.id_servicio = s.id_servicio
          WHERE t.id_ticket = ?
        `, [id]);

        if (tickets.length === 0) {
          return res.status(404).json({ error: 'Ticket no encontrado' });
        }

        const ticket = tickets[0];
        const estadoAnterior = ticket.estatus;

        // Actualizar el estado
        const updateResult = await query(`
          UPDATE Tickets
          SET estatus = ?
          WHERE id_ticket = ?
        `, [estadoFinal, id]);

        if (updateResult.affectedRows === 0) {
          return res.status(404).json({ error: 'No se pudo actualizar el ticket. Verifica que el ticket existe.' });
        }

        // Registrar fechas
        try {
          // Guardar fecha_inicio_atencion cuando se cambia a "En Progreso" por primera vez
          if (estadoFinal === 'En Progreso') {
            await query(`
              UPDATE Tickets
              SET fecha_inicio_atencion = COALESCE(fecha_inicio_atencion, NOW())
              WHERE id_ticket = ? AND fecha_inicio_atencion IS NULL
            `, [id]);
          }

          if (estadoFinal === 'Finalizado') {
            // Calcular tiempo total de atención desde fecha_inicio_atencion hasta ahora
            // El tiempo incluye todos los períodos (incluso cuando estaba en pendiente)
            const ticketWithDates = await query(`
              SELECT fecha_inicio_atencion, tiempo_atencion_segundos
              FROM Tickets
              WHERE id_ticket = ?
            `, [id]);

            let tiempoAtencionSegundos = null;
            if (ticketWithDates.length > 0 && ticketWithDates[0].fecha_inicio_atencion) {
              const fechaInicio = new Date(ticketWithDates[0].fecha_inicio_atencion);
              const fechaFin = new Date();
              tiempoAtencionSegundos = Math.floor((fechaFin.getTime() - fechaInicio.getTime()) / 1000);

              console.log(`✅ Calculando tiempo total de atención al finalizar (admin):`);
              console.log(`   Fecha inicio: ${fechaInicio.toISOString()}`);
              console.log(`   Fecha fin: ${fechaFin.toISOString()}`);
              console.log(`   Tiempo total: ${tiempoAtencionSegundos} segundos (incluye períodos en pendiente)`);
            }

            await query(`
              UPDATE Tickets
              SET
                fecha_finalizacion = COALESCE(fecha_finalizacion, NOW()),
                fecha_cierre = COALESCE(fecha_cierre, NOW()),
                evaluacion_ultimo_recordatorio = NULL,
                evaluacion_recordatorio_contador = 0,
                evaluacion_cierre_automatico = 0,
                tiempo_atencion_segundos = COALESCE(?, tiempo_atencion_segundos)
              WHERE id_ticket = ?
            `, [tiempoAtencionSegundos, id]);
          }
          if (estadoFinal === 'Cerrado') {
            await query(`UPDATE Tickets SET fecha_cierre = COALESCE(fecha_cierre, NOW()) WHERE id_ticket = ?`, [id]);
          }
        } catch (adErr) {
          console.warn('⚠️ No se pudieron registrar fechas (admin):', adErr.message);
        }

        if (estadoAnterior === 'Escalado' && estadoFinal === 'En Progreso') {
          if (comentarios && comentarios.trim() && ticket.id_tecnico) {
            try {
              await query(`
                UPDATE Tickets
                SET comentario_admin_tecnico = ?
                WHERE id_ticket = ?
              `, [comentarios.trim(), id]);
              console.log(`✅ Comentario técnico guardado para ticket #${id}`);
            } catch (comentarioError) {
              console.error(`❌ Error guardando comentario técnico (ticket #${id}):`, comentarioError.message);
            }
          }

          // Enviar correo al técnico
          if (ticket.id_tecnico && ticket.tecnico_correo) {
            try {
              const emailService = require('../services/emailService');
              const baseUrl = emailService.getFrontendUrl();

              let emailSubject = `🔄 Ticket #${ticket.id_ticket} asignado nuevamente`;
              let emailBody = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; padding: 20px; text-align: center;">
                    <h1>🔄 Ticket Asignado Nuevamente</h1>
                  </div>
                  <div style="padding: 20px; background: #f9f9f9;">
                    <p>Hola <strong>${ticket.tecnico_nombre}</strong>,</p>
                    <p>El administrador ha regresado el ticket #${ticket.id_ticket} a tu bandeja de trabajo en estado <strong>En Progreso</strong>.</p>
                    <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #007bff;">
                      <h3>Ticket #${ticket.id_ticket}</h3>
                      <p><strong>Categoría:</strong> ${ticket.categoria} - ${ticket.subcategoria}</p>
                      <p><strong>Descripción:</strong> ${ticket.descripcion || 'N/A'}</p>
                      <p><strong>Prioridad:</strong> ${ticket.prioridad}</p>
                    </div>
              `;

              if (comentarios && comentarios.trim()) {
                emailSubject += ' - Comentario del administrador';
                emailBody += `
                    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ffc107;">
                      <h4 style="color: #856404; margin-top: 0;">💬 Comentario privado del administrador (solo visible para ti):</h4>
                      <p style="color: #856404; margin: 0; white-space: pre-wrap;">${comentarios.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
                    </div>
                `;
              }

              emailBody += `
                    <p>El ticket ha sido asignado nuevamente a ti. Por favor, retoma el trabajo en este ticket.</p>
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${baseUrl}/tickets/assigned" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Ver Tickets Asignados</a>
                    </div>
                  </div>
                  <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
                    <p>Este es un mensaje automático del sistema Mesa de Ayuda.</p>
                  </div>
                </div>
              `;

              await emailService.sendEmail({
                to: ticket.tecnico_correo,
                subject: emailSubject,
                html: emailBody
              });
            } catch (emailError) {
              console.error(`❌ Error enviando correo al técnico (ticket #${id}):`, emailError.message);
            }
          }
        }

        // Enviar notificación de cambio de estado al empleado (solo si no es regreso a técnico)
        if (!(estadoAnterior === 'Escalado' && estadoFinal === 'En Progreso')) {
          try {
            await notificationOrchestrator.notifyStatusChange({
              ticketId: id,
              estatus: estadoFinal,
              estadoAnterior: estadoAnterior,
              isEmployeeReopening: false,
              cleanedComentarios: comentarios || null,
              cleanedPendienteTiempo: null
            });
          } catch (notifError) {
            console.error(`❌ Error enviando notificación de cambio de estado (ticket #${id}):`, notifError.message);
          }
        }

        return res.json({
          message: `Estado del ticket #${id} actualizado a ${estadoFinal}`,
          ticketId: id,
          nuevoEstado: estadoFinal,
          tecnicoAsignado: ticket.tecnico_nombre
        });
      }

      if (!estatus) {
        console.error('❌ No se encontró estatus ni nuevoEstado en el body');
        console.error('Body completo:', req.body);
        return res.status(400).json({ error: 'Estado es requerido' });
      }

      // Validar permisos según el rol
      if (req.user.rol === 'tecnico' && estatus === 'Cerrado') {
        return res.status(403).json({
          error: 'Los técnicos no pueden cerrar tickets. Solo pueden finalizarlos.'
        });
      }

      // Los administradores que también son técnicos no pueden cerrar tickets
      if (req.user.rol === 'administrador' && estatus === 'Cerrado') {
        // Verificar si el usuario tiene múltiples roles o es solo administrador
        // Por ahora, asumimos que si es administrador también es técnico
        return res.status(403).json({
          error: 'Los administradores-técnicos no pueden cerrar tickets. Solo pueden finalizarlos.'
        });
      }

      // Verificar que el ticket existe y pertenece al usuario
      let tickets;
      console.log('🔍 Verificando ticket para usuario:', req.user.rol);
      console.log('🆔 ID del usuario:', req.user.id_usuario);

      if (req.user.rol === 'tecnico' || req.user.rol === 'administrador') {
        // Para técnicos y administradores: verificar que el ticket está asignado a ellos
        console.log('🔍 Buscando ticket asignado a técnico/administrador...');
        tickets = await query(`
          SELECT
            id_ticket,
            id_usuario,
            id_tecnico,
            estatus,
            pendiente_motivo,
            pendiente_tiempo_estimado,
            pendiente_actualizado_en
          FROM Tickets
          WHERE id_ticket = ? AND id_tecnico = ?
        `, [id, req.user.id_usuario]);
        console.log('📊 Tickets encontrados para técnico/administrador:', tickets);
      } else if (req.user.rol === 'empleado') {
        console.log('👤 Empleado solicitando cambio de estado');
        const allowedEmployeeStatuses = ['Pendiente'];
        if (!allowedEmployeeStatuses.includes(estatus)) {
          console.log('❌ Estado no permitido para empleado:', estatus);
          return res.status(403).json({
            error: 'Solo se permite reabrir un ticket cerrado y pasarlo a Pendiente.'
          });
        }

        tickets = await query(`
          SELECT
            id_ticket,
            id_usuario,
            id_tecnico,
            estatus,
            pendiente_motivo,
            pendiente_tiempo_estimado,
            pendiente_actualizado_en
          FROM Tickets
          WHERE id_ticket = ? AND id_usuario = ?
        `, [id, req.user.id_usuario]);
        console.log('📊 Tickets encontrados para empleado:', tickets);
      } else {
        console.log('❌ Rol no reconocido:', req.user.rol);
        return res.status(403).json({
          error: 'Rol de usuario no válido para cambiar el estado de tickets.'
        });
      }

      if (tickets.length === 0) {
        console.log('❌ No se encontró el ticket');
        return res.status(404).json({ error: 'Ticket no encontrado' });
      }

      const ticket = tickets[0];
      const estadoAnterior = ticket.estatus; // Guardar estado anterior antes de actualizar

      const isTechnician = req.user.rol === 'tecnico';
      const trimmedComentarios = typeof comentarios === 'string' ? comentarios.trim() : comentarios;
      const trimmedPendienteTiempo = typeof pendienteTiempoEstimado === 'string'
        ? pendienteTiempoEstimado.trim()
        : pendienteTiempoEstimado;

      if (estatus === 'Pendiente' && isTechnician) {
        if (!trimmedComentarios) {
          return res.status(400).json({
            error: 'Debes especificar el motivo por el que el ticket queda en pendiente.'
          });
        }

        if (!trimmedPendienteTiempo) {
          return res.status(400).json({
            error: 'Debes indicar el tiempo estimado para retomar el ticket.'
          });
        }
      }

      const isEmployeeReopening = ticket.estatus === 'Cerrado'
        && estatus === 'Pendiente'
        && req.user.rol === 'empleado';

      // Verificar que el ticket no esté cerrado salvo reapertura permitida
      if (ticket.estatus === 'Cerrado' && !isEmployeeReopening) {
        console.log('❌ Ticket ya está cerrado, no se puede modificar');
        return res.status(403).json({
          error: 'No se puede modificar un ticket que ya está cerrado. Los tickets cerrados no pueden cambiar de estado.'
        });
      }

      const cleanedComentarios = typeof trimmedComentarios === 'string'
        ? trimmedComentarios
        : (trimmedComentarios ?? null);

      let observacionesReapertura = cleanedComentarios;
      if (isEmployeeReopening && (!observacionesReapertura || observacionesReapertura.length === 0)) {
        observacionesReapertura = 'El solicitante no proporcionó observaciones.';
      }

      const cleanedPendienteTiempo = trimmedPendienteTiempo == null
        ? null
        : trimmedPendienteTiempo.toString().trim();

      // Actualizar el estado
      console.log('🔄 Actualizando estado del ticket...');
      console.log('📊 Nuevo estado:', estatus);
      console.log('🎫 ID del ticket:', id);
      try {
        if (isEmployeeReopening) {
          console.log('♻️ Reapertura solicitada por empleado');

          // Actualizar solo el estado
          // NO eliminamos fecha_cierre ni pendiente_motivo porque esa información se guarda en TicketReaperturas
          // NO eliminamos evaluaciones porque se pueden tener múltiples evaluaciones (una por cada cierre)
          await query(`
            UPDATE Tickets
            SET estatus = ?
            WHERE id_ticket = ?
          `, [estatus, id]);
        } else if (estatus === 'Pendiente') {
          // El tiempo NO se detiene, sigue corriendo normalmente
          // Solo actualizamos el estado y los comentarios del técnico
          await query(`
            UPDATE Tickets
            SET
              estatus = ?,
              pendiente_motivo = ?,
              pendiente_tiempo_estimado = ?,
              pendiente_actualizado_en = NOW(),
              pendiente_actualizado_por = ?
            WHERE id_ticket = ?
          `, [
            estatus,
            cleanedComentarios,
            cleanedPendienteTiempo,
            req.user.id_usuario,
            id
          ]);

          ticket.pendiente_motivo = cleanedComentarios;
          ticket.pendiente_tiempo_estimado = cleanedPendienteTiempo;
          ticket.pendiente_actualizado_en = new Date();

          console.log(`⏸️ Ticket marcado como pendiente - El tiempo de atención continúa corriendo`);
        } else {
          // Construir la consulta dinámicamente para incluir fecha_asignacion si aplica
          let updateFields = [
            'estatus = ?',
            'pendiente_motivo = NULL',
            'pendiente_tiempo_estimado = NULL',
            'pendiente_actualizado_en = NULL',
            'pendiente_actualizado_por = NULL'
          ];
          let updateParams = [estatus];

          // Si el estado cambia a "En Progreso" y hay técnico, establecer fecha_asignacion
          if (estatus === 'En Progreso' && ticket.id_tecnico) {
            updateFields.push('fecha_asignacion = COALESCE(fecha_asignacion, NOW())');
            // Guardar fecha_inicio_atencion solo si no existe (primera vez que se abre)
            // El tiempo sigue corriendo desde fecha_inicio_atencion original, no se reinicia
            updateFields.push('fecha_inicio_atencion = COALESCE(fecha_inicio_atencion, NOW())');
          }

          updateParams.push(id);

          await query(`
            UPDATE Tickets
            SET ${updateFields.join(', ')}
            WHERE id_ticket = ?
          `, updateParams);

          ticket.pendiente_motivo = null;
          ticket.pendiente_tiempo_estimado = null;
          ticket.pendiente_actualizado_en = null;
        }
      } catch (updateError) {
        if (isEmployeeReopening) {
          console.warn('⚠️ Error actualizando ticket, reintentando solo con estatus:', updateError.message);
          await query(`
            UPDATE Tickets
            SET estatus = ?
            WHERE id_ticket = ?
          `, [estatus, id]);
        } else {
          throw updateError;
        }
      }

      let reaperturaData = null;
      if (isEmployeeReopening) {
        try {
          await ensureTicketReopenTable();

          // Obtener el estado actual del ticket antes de reabrir
          const estadoAnterior = ticket.estatus;

          // Registrar la reapertura en TicketReaperturas
          // La información de reapertura se guarda completamente en esta tabla
          // Incluimos el estado del ticket al momento de la reapertura
          await query(`
            INSERT INTO TicketReaperturas (
              id_ticket,
              usuario_id,
              tecnico_id,
              observaciones_usuario,
              fecha_reapertura,
              estado_reapertura
            ) VALUES (?, ?, ?, ?, NOW(), ?)
          `, [
            id,
            req.user.id_usuario,
            ticket.id_tecnico || null,
            observacionesReapertura || 'Reapertura solicitada sin comentarios',
            estadoAnterior
          ]);

          console.log(`✅ Reapertura registrada en TicketReaperturas (estado anterior: ${estadoAnterior})`);
        } catch (reopenInsertError) {
          console.error('❌ Error registrando reapertura:', reopenInsertError.message);
        }
      }

      ticket.estatus = estatus;

      try {
        if (estatus === 'Finalizado') {
          // Calcular tiempo total de atención desde fecha_inicio_atencion hasta ahora
          // El tiempo incluye todos los períodos (incluso cuando estaba en pendiente)
          const ticketWithDates = await query(`
            SELECT fecha_inicio_atencion, tiempo_atencion_segundos
            FROM Tickets
            WHERE id_ticket = ?
          `, [id]);

          let tiempoAtencionSegundos = null;
          if (ticketWithDates.length > 0 && ticketWithDates[0].fecha_inicio_atencion) {
            const fechaInicio = new Date(ticketWithDates[0].fecha_inicio_atencion);
            const fechaFin = new Date();
            tiempoAtencionSegundos = Math.floor((fechaFin.getTime() - fechaInicio.getTime()) / 1000);

            console.log(`✅ Calculando tiempo total de atención al finalizar:`);
            console.log(`   Fecha inicio: ${fechaInicio.toISOString()}`);
            console.log(`   Fecha fin: ${fechaFin.toISOString()}`);
            console.log(`   Tiempo total: ${tiempoAtencionSegundos} segundos (incluye períodos en pendiente)`);
          }

          await query(`
            UPDATE Tickets
            SET
              fecha_finalizacion = COALESCE(fecha_finalizacion, NOW()),
              fecha_cierre = COALESCE(fecha_cierre, NOW()),
              evaluacion_ultimo_recordatorio = NULL,
              evaluacion_recordatorio_contador = 0,
              evaluacion_cierre_automatico = 0,
              tiempo_atencion_segundos = COALESCE(?, tiempo_atencion_segundos)
            WHERE id_ticket = ?
          `, [tiempoAtencionSegundos, id]);
        }
        if (estatus === 'Cerrado') {
          await query(`UPDATE Tickets SET fecha_cierre = COALESCE(fecha_cierre, NOW()) WHERE id_ticket = ?`, [id]);
        }
      } catch (datesErr) {
        console.warn('⚠️ No se pudieron registrar fechas/tiempos de estado:', datesErr.message);
      }

      console.log('✅ Estado actualizado exitosamente');

      try {
        console.log('📧 Creando notificación de cambio de estado...');
        console.log('📧 Datos:', {
          ticketId: id,
          estatus: estatus,
          estadoAnterior: ticket.estatus,
          userId: ticket.id_usuario,
          isEmployeeReopening: isEmployeeReopening
        });

        await notificationOrchestrator.notifyStatusChange({
          ticketId: id,
          estatus,
          estadoAnterior: estadoAnterior, // Usar el estado anterior guardado
          isEmployeeReopening,
          cleanedComentarios,
          cleanedPendienteTiempo
        });

        console.log('✅ Notificación de cambio de estado creada exitosamente');
      } catch (notifError) {
        console.error('❌ Error creando notificación:', notifError.message);
        console.error('❌ Detalles del error:', notifError);
        // No fallar la actualización por error en notificación
      }

      const pendienteActualizadoEnIso = ticket.pendiente_actualizado_en
        ? new Date(ticket.pendiente_actualizado_en).toISOString()
        : null;

      if (!reaperturaData) {
        try {
          reaperturaData = await getLatestTicketReopening(id);
        } catch (reaperturaError) {
          console.error('❌ Error obteniendo información de reapertura:', reaperturaError.message);
        }
      }

      res.json({
        message: 'Estado del ticket actualizado exitosamente',
        estatus,
        pendienteMotivo: ticket.pendiente_motivo || null,
        pendienteTiempoEstimado: ticket.pendiente_tiempo_estimado || null,
        pendienteActualizadoEn: pendienteActualizadoEnIso,
        reapertura: reaperturaData
      });

    } catch (error) {
      console.error('Error actualizando estado del ticket:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // Escalar un ticket
  router.get('/reopened', authenticateToken, async (req, res) => {
    try {
      await ensureTicketReopenTable();

      let reopenedTicketsRaw = [];

      const baseQuery = `
        SELECT
          t.id_ticket,
          s.categoria,
          s.subcategoria,
          t.descripcion,
          s.tiempo_objetivo as tiempo_estimado,
          t.estatus as estado,
          t.prioridad,
          t.fecha_creacion,
          t.fecha_cierre,
          t.fecha_asignacion,
          t.pendiente_motivo as pendienteMotivo,
          t.pendiente_tiempo_estimado as pendienteTiempoEstimado,
          t.pendiente_actualizado_en as pendienteActualizadoEn,
          u.nombre as usuario_nombre,
          u.correo as usuario_correo,
          tec.nombre as tecnico_nombre,
          tr.id_reapertura,
          tr.usuario_id as reapertura_usuario_id,
          tr.tecnico_id as reapertura_tecnico_id,
          tr.observaciones_usuario,
          tr.causa_tecnico,
          tr.fecha_reapertura,
          tr.fecha_respuesta_tecnico
        FROM (
          SELECT tr.*
          FROM TicketReaperturas tr
          INNER JOIN (
            SELECT id_ticket, MAX(fecha_reapertura) AS max_fecha
            FROM TicketReaperturas
            GROUP BY id_ticket
          ) latest ON latest.id_ticket = tr.id_ticket AND latest.max_fecha = tr.fecha_reapertura
        ) tr
        JOIN Tickets t ON tr.id_ticket = t.id_ticket
        JOIN Servicios s ON t.id_servicio = s.id_servicio
        JOIN Usuarios u ON t.id_usuario = u.id_usuario
        LEFT JOIN Usuarios tec ON t.id_tecnico = tec.id_usuario
      `;

      if (req.user.rol === 'empleado') {
        reopenedTicketsRaw = await query(`
          ${baseQuery}
          WHERE tr.usuario_id = ?
          ORDER BY tr.fecha_reapertura DESC
        `, [req.user.id_usuario]);
      } else if (req.user.rol === 'tecnico' || req.user.rol === 'administrador') {
        reopenedTicketsRaw = await query(`
          ${baseQuery}
          WHERE (t.id_tecnico = ? OR tr.tecnico_id = ?)
          ORDER BY tr.fecha_reapertura DESC
        `, [req.user.id_usuario, req.user.id_usuario]);
      } else {
        return res.status(403).json({ error: 'Rol de usuario no autorizado para ver tickets reabiertos.' });
      }

      const reopenedTickets = reopenedTicketsRaw.map(ticket => ({
        id: ticket.id_ticket,
        categoria: ticket.categoria,
        subcategoria: ticket.subcategoria,
        descripcion: ticket.descripcion,
        tiempoEstimado: ticket.tiempo_estimado,
        estado: ticket.estado,
        prioridad: ticket.prioridad,
        fechaCreacion: ticket.fecha_creacion,
        fechaCierre: ticket.fecha_cierre,
        fechaAsignacion: ticket.fecha_asignacion,
        pendienteMotivo: ticket.pendienteMotivo,
        pendienteTiempoEstimado: ticket.pendienteTiempoEstimado,
        pendienteActualizadoEn: ticket.pendienteActualizadoEn,
        tecnicoAsignado: ticket.tecnico_nombre || null,
        reapertura: {
          id: ticket.id_reapertura,
          observacionesUsuario: ticket.observaciones_usuario,
          causaTecnico: ticket.causa_tecnico,
          fechaReapertura: ticket.fecha_reapertura,
          fechaRespuestaTecnico: ticket.fecha_respuesta_tecnico
        },
        mostrarEstadoReabierto: true,
        usuario: {
          nombre: ticket.usuario_nombre,
          correo: ticket.usuario_correo
        }
      }));

      res.json(reopenedTickets);
    } catch (error) {
      console.error('❌ Error obteniendo tickets reabiertos:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  router.put('/:id/reopen/technician-comment', authenticateToken, async (req, res) => {
    try {
      if (!(req.user.rol === 'tecnico' || req.user.rol === 'administrador')) {
        return res.status(403).json({ error: 'Solo los técnicos pueden registrar la causa de reapertura.' });
      }

      const { id } = req.params;
      const { causa } = req.body;

      if (!causa || !causa.toString().trim()) {
        return res.status(400).json({ error: 'La causa es obligatoria.' });
      }

      await ensureTicketReopenTable();

      const latestReopeningRows = await query(`
        SELECT
          tr.id_reapertura,
          tr.id_ticket,
          tr.usuario_id,
          tr.tecnico_id,
          t.id_tecnico as ticket_tecnico_id
        FROM TicketReaperturas tr
        JOIN Tickets t ON tr.id_ticket = t.id_ticket
        WHERE tr.id_ticket = ?
        ORDER BY tr.fecha_reapertura DESC, tr.id_reapertura DESC
        LIMIT 1
      `, [id]);

      if (latestReopeningRows.length === 0) {
        return res.status(404).json({ error: 'No se encontró información de reapertura para este ticket.' });
      }

      const latestReopening = latestReopeningRows[0];

      if (latestReopening.ticket_tecnico_id !== req.user.id_usuario && latestReopening.tecnico_id !== req.user.id_usuario && req.user.rol !== 'administrador') {
        return res.status(403).json({ error: 'No tienes permisos para actualizar la causa de este ticket.' });
      }

      await query(`
        UPDATE TicketReaperturas
        SET
          causa_tecnico = ?,
          tecnico_id = ?,
          fecha_respuesta_tecnico = NOW()
        WHERE id_reapertura = ?
      `, [causa.toString().trim(), req.user.id_usuario, latestReopening.id_reapertura]);

      const reaperturaActualizada = await getLatestTicketReopening(id);

      res.json({
        message: 'Causa de reapertura registrada correctamente.',
        reapertura: reaperturaActualizada
      });
    } catch (error) {
      console.error('❌ Error registrando causa de reapertura:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // Escalar un ticket
  router.post('/:id/escalate', authenticateToken, async (req, res) => {
    try {
      console.log('🔄 POST /api/tickets/:id/escalate - Iniciando escalamiento');
      console.log('🎫 ID del ticket:', req.params.id);
      console.log('👤 Usuario:', req.user);
      console.log('📋 Datos recibidos:', req.body);

      const { id } = req.params;
      const { tecnicoDestino, motivoEscalamiento } = req.body;

      if (!motivoEscalamiento) {
        console.log('❌ Motivo de escalamiento faltante');
        return res.status(400).json({ error: 'El motivo de escalamiento es requerido' });
      }

      if (!tecnicoDestino) {
        console.log('❌ Técnico destino faltante');
        return res.status(400).json({ error: 'Debes seleccionar un técnico destino para escalar el ticket' });
      }

      console.log('✅ Validaciones pasadas, continuando...');

      // Verificar que el técnico destino existe y es técnico o administrador
      // Los administradores también pueden recibir tickets escalados ya que tienen rol de técnico
      const tecnicoDestinoQuery = await query(`
        SELECT id_usuario, nombre, correo, rol
        FROM Usuarios
        WHERE id_usuario = ? AND rol IN ('tecnico', 'administrador')
      `, [tecnicoDestino]);

      if (tecnicoDestinoQuery.length === 0) {
        console.log('❌ Técnico destino no encontrado o no válido');
        return res.status(400).json({ error: 'El técnico seleccionado no existe o no es válido' });
      }

      const tecnicoDestinoInfo = tecnicoDestinoQuery[0];
      console.log('🔍 Técnico destino encontrado:', tecnicoDestinoInfo);

      // Verificar que no esté escalando a sí mismo
      if (tecnicoDestino === req.user.id_usuario) {
        return res.status(400).json({ error: 'No puedes escalar un ticket a ti mismo' });
      }

      // Verificar que el ticket existe y está asignado al técnico
      const ticketQuery = await query(`
        SELECT
          t.id_ticket,
          t.id_usuario,
          t.id_tecnico,
          t.estatus,
          t.id_servicio,
          t.descripcion,
          t.prioridad,
          t.fecha_creacion,
          s.categoria,
          s.subcategoria
        FROM Tickets t
        JOIN Servicios s ON t.id_servicio = s.id_servicio
        WHERE t.id_ticket = ? AND t.id_tecnico = ?
      `, [id, req.user.id_usuario]);

      if (ticketQuery.length === 0) {
        console.log('❌ Ticket no encontrado o sin permisos');
        return res.status(404).json({ error: 'Ticket no encontrado o no tienes permisos para escalarlo' });
      }

      const ticket = ticketQuery[0];
      console.log('✅ Ticket encontrado:', ticket);

      // Verificar que el ticket no esté cerrado
      if (ticket.estatus === 'Cerrado') {
        console.log('❌ Ticket ya está cerrado, no se puede escalar');
        return res.status(403).json({
          error: 'No se puede escalar un ticket que ya está cerrado. Los tickets cerrados no pueden ser modificados.'
        });
      }

      // Asignar el ticket al técnico destino seleccionado
      const nuevoTecnicoId = tecnicoDestino;
      console.log('🔄 Asignando ticket al técnico destino:', tecnicoDestinoInfo.nombre);

      // Actualizar el ticket - Cambiar a "ESCALADO" y asignar al técnico destino
      console.log('🔄 Actualizando ticket a estado ESCALADO y asignando al técnico destino...');
      const updateResult = await query(`
        UPDATE Tickets
        SET
          estatus = 'Escalado',
          id_tecnico = ?,
          fecha_asignacion = COALESCE(fecha_asignacion, NOW())
        WHERE id_ticket = ?
      `, [nuevoTecnicoId, id]);

      console.log('✅ Ticket escalado - Estado cambiado a ESCALADO y asignado al técnico destino. Resultado:', updateResult);

      // Guardar información del escalamiento
      console.log('🔄 Guardando información del escalamiento...');
      console.log('📊 Datos del escalamiento:', {
        id_ticket: id,
        tecnico_original_id: req.user.id_usuario,
        tecnico_nuevo_id: nuevoTecnicoId,
        motivo: motivoEscalamiento
      });

      const escalamientoResult = await query(`
        INSERT INTO Escalamientos (
          id_ticket,
          tecnico_original_id,
          tecnico_nuevo_id,
          nivel_escalamiento,
          persona_enviar,
          motivo_escalamiento,
          fecha_escalamiento
        ) VALUES (?, ?, ?, ?, ?, ?, NOW())
      `, [
        id,
        req.user.id_usuario,
        nuevoTecnicoId,
        'Manual', // Escalamiento manual al técnico seleccionado
        nuevoTecnicoId, // El técnico destino
        motivoEscalamiento
      ]);

      console.log('✅ Información del escalamiento guardada. Resultado:', escalamientoResult);

      const response = {
        message: `Ticket escalado exitosamente a ${tecnicoDestinoInfo.nombre}.`,
        ticketId: id,
        escalamiento: {
          tecnicoDestino: tecnicoDestinoInfo.nombre,
          motivo: motivoEscalamiento
        }
      };

      console.log('✅ Escalamiento completado exitosamente. Respuesta:', response);

      notificationOrchestrator.notifyEscalation({
        ticket,
        administrador: tecnicoDestinoInfo, // El técnico destino actúa como el receptor
        motivoEscalamiento,
        asignacionInfo: {
          success: true,
          tecnico: tecnicoDestinoInfo
        }
      });

      res.json(response);

    } catch (error) {
      console.error('❌ Error escalando ticket:', error);
      console.error('❌ Stack trace:', error.stack);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

// Obtener tickets escalados para técnicos y administradores
router.get('/escalados', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/tickets/escalados - Obteniendo tickets escalados');
    console.log('👤 Usuario:', req.user);

    // Verificar que el usuario es técnico o administrador
    if (req.user.rol !== 'tecnico' && req.user.rol !== 'administrador') {
      return res.status(403).json({ error: 'Solo los técnicos y administradores pueden ver tickets escalados' });
    }

    // Solo la persona que recibió el escalamiento (técnico destino) puede ver el ticket
    // Buscamos tickets escalados que están asignados al usuario actual
    // y que el escalamiento más reciente fue dirigido a este usuario
    // Incluimos TODOS los estados porque son tickets escalados históricamente
    // (Escalado, Finalizado, Cerrado, etc.) - solo cambia el estado, pero siguen siendo escalados
    tickets = await query(`
      SELECT
        t.id_ticket as id,
        t.descripcion,
        t.prioridad,
        t.fecha_creacion,
        t.fecha_inicio_atencion,
        t.tiempo_atencion_segundos,
        t.estatus,
        s.categoria,
        s.subcategoria,
        s.tiempo_objetivo,
        u.nombre as usuario_nombre,
        u.correo as usuario_correo,
        tec.nombre as tecnico_nombre,
        tec.correo as tecnico_correo,
        tec_orig.nombre as tecnico_original_nombre,
        e.motivo_escalamiento,
        e.fecha_escalamiento,
        e.nivel_escalamiento
      FROM Tickets t
      JOIN Servicios s ON t.id_servicio = s.id_servicio
      JOIN Usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN Usuarios tec ON t.id_tecnico = tec.id_usuario
      INNER JOIN Escalamientos e ON t.id_ticket = e.id_ticket
      LEFT JOIN Usuarios tec_orig ON e.tecnico_original_id = tec_orig.id_usuario
      WHERE t.id_tecnico = ?
        AND e.tecnico_nuevo_id = ?
        AND e.fecha_escalamiento = (
          SELECT MAX(fecha_escalamiento)
          FROM Escalamientos
          WHERE id_ticket = t.id_ticket
        )
      ORDER BY e.fecha_escalamiento DESC, t.fecha_creacion DESC
    `, [req.user.id_usuario, req.user.id_usuario]);

    console.log(`📊 Se encontraron ${tickets.length} tickets escalados`);

    const formattedTickets = tickets.map(ticket => ({
      id: ticket.id,
      descripcion: ticket.descripcion,
      prioridad: ticket.prioridad,
      fecha_creacion: ticket.fecha_creacion,
      fecha_inicio_atencion: ticket.fecha_inicio_atencion,
      tiempo_atencion_segundos: ticket.tiempo_atencion_segundos,
      estatus: ticket.estatus,
      categoria: ticket.categoria,
      subcategoria: ticket.subcategoria,
      tiempo_objetivo: ticket.tiempo_objetivo,
      usuario: {
        nombre: ticket.usuario_nombre,
        correo: ticket.usuario_correo
      },
      tecnico: ticket.tecnico_nombre ? {
        nombre: ticket.tecnico_nombre,
        correo: ticket.tecnico_correo
      } : null,
      tecnicoOriginal: ticket.tecnico_original_nombre ? {
        nombre: ticket.tecnico_original_nombre
      } : null,
      escalamiento: {
        motivo: ticket.motivo_escalamiento,
        fecha: ticket.fecha_escalamiento,
        nivel: ticket.nivel_escalamiento
      }
    }));

    res.json({
      tickets: formattedTickets,
      total: formattedTickets.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo tickets escalados:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
  });

// Obtener lista de técnicos para escalamiento - DEBE ESTAR ANTES DE RUTAS DINÁMICAS
router.get('/technicians', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/tickets/technicians - Obteniendo lista de técnicos');
    console.log('👤 Usuario:', req.user);

    // Verificar que el usuario es técnico o administrador (case-insensitive)
    const userRol = (req.user.rol || '').toLowerCase().trim();
    if (userRol !== 'tecnico' && userRol !== 'administrador') {
      return res.status(403).json({ error: 'Solo los técnicos y administradores pueden ver la lista de técnicos' });
    }

    // Obtener todos los técnicos y administradores
    // Los roles pueden estar en diferentes formatos, así que usamos LOWER para comparación case-insensitive
    const technicians = await query(`
      SELECT
        id_usuario as id,
        nombre,
        correo,
        rol
      FROM Usuarios
      WHERE LOWER(TRIM(rol)) IN ('tecnico', 'administrador')
      ORDER BY nombre ASC
    `);

    console.log(`📊 Se encontraron ${technicians.length} técnicos`);

    // Formatear la respuesta con nombre completo (el nombre ya viene completo de la BD)
    const formattedTechnicians = technicians.map(tech => ({
      id: tech.id,
      nombre: tech.nombre || 'Sin nombre',
      correo: tech.correo,
      rol: tech.rol
    }));

    res.json(formattedTechnicians);

  } catch (error) {
    console.error('❌ Error obteniendo lista de técnicos:', error);
    console.error('❌ Detalles del error:', error.message);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
});

// Obtener carta de aprobación por ticket con control de permisos
router.get('/:ticketId/approval-letter', authenticateToken, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const disposition = req.query.disposition === 'inline' ? 'inline' : 'attachment';

    const tickets = await query(`
      SELECT
        archivo_aprobacion,
        id_usuario,
        id_tecnico
      FROM Tickets
      WHERE id_ticket = ?
    `, [ticketId]);

    if (tickets.length === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    const ticket = tickets[0];

    if (!ticket.archivo_aprobacion) {
      return res.status(404).json({ error: 'El ticket no tiene carta de aprobación adjunta' });
    }

    const userId = req.user.id_usuario;
    const userRole = req.user.rol;
    const esCreador = ticket.id_usuario === userId;
    const esTecnicoAsignado = ticket.id_tecnico === userId;
    const esAdministrador = userRole === 'administrador';

    if (!esCreador && !esTecnicoAsignado && !esAdministrador) {
      return res.status(403).json({ error: 'No tienes permisos para acceder a esta carta de aprobación' });
    }

    const filePath = path.join(__dirname, '../uploads', ticket.archivo_aprobacion);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado en el servidor' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(ticket.archivo_aprobacion)}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.on('error', (streamErr) => {
      console.error('Error leyendo archivo de aprobación:', streamErr);
      res.status(500).json({ error: 'Error al leer el archivo de aprobación' });
    });

    fileStream.pipe(res);

  } catch (error) {
    console.error('Error obteniendo carta de aprobación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener ticket por ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/tickets/:id - Obteniendo detalles del ticket');
    console.log('🎫 ID del ticket:', req.params.id);
    console.log('👤 Usuario:', req.user);

    const { id } = req.params;

    const tickets = await query(`
      SELECT
        t.id_ticket as id,
        s.categoria,
        s.subcategoria,
        t.descripcion,
        s.tiempo_objetivo as tiempoEstimado,
        s.tiempo_maximo,
        t.tiempo_restante_finalizacion,
        t.estatus as estado,
        t.prioridad,
        t.fecha_creacion,
        t.fecha_cierre,
        t.fecha_asignacion,
        t.pendiente_motivo as pendienteMotivo,
        t.pendiente_tiempo_estimado as pendienteTiempoEstimado,
        t.pendiente_actualizado_en as pendienteActualizadoEn,
        t.comentario_admin_tecnico,
        t.id_tecnico,
        t.evaluacion_cierre_automatico,
        u.nombre as usuario_nombre,
        u.correo as usuario_correo,
        tec.nombre as tecnico_nombre,
        e.calificacion,
        e.comentario as comentario_evaluacion,
        e.fecha_evaluacion,
        ${sqlCalcularEnTiempo()}
      FROM Tickets t
      JOIN Servicios s ON t.id_servicio = s.id_servicio
      JOIN Usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN Usuarios tec ON t.id_tecnico = tec.id_usuario
      LEFT JOIN Evaluaciones e ON t.id_ticket = e.id_ticket
      WHERE t.id_ticket = ? AND (t.id_usuario = ? OR t.id_tecnico = ?)
    `, [id, req.user.id_usuario, req.user.id_usuario]);

    if (tickets.length === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado o no tienes permisos para verlo' });
    }

    console.log('📊 Ticket encontrado:', tickets[0]);

    const ticket = tickets[0];

    // El comentario técnico solo es visible para el técnico asignado
    const esTecnicoAsignado = ticket.id_tecnico === req.user.id_usuario;

    // Calcular enTiempo si no viene del SQL (fallback)
    let enTiempo = ticket.en_tiempo !== null && ticket.en_tiempo !== undefined 
      ? ticket.en_tiempo === 1 
      : calcularEnTiempo(ticket.fecha_creacion, ticket.fecha_cierre, ticket.tiempoEstimado);

    // Usar tiempo_maximo si está disponible, sino usar tiempo_objetivo para el countdown
    const tiempoParaCountdown = ticket.tiempo_maximo || ticket.tiempoEstimado;

    const formattedTicket = {
      id: ticket.id,
      categoria: ticket.categoria,
      subcategoria: ticket.subcategoria,
      descripcion: ticket.descripcion,
      tiempoEstimado: tiempoParaCountdown, // Usar tiempo_maximo si existe, sino tiempo_objetivo
      tiempoObjetivo: ticket.tiempoEstimado, // Mantener tiempo_objetivo original
      tiempoMaximo: ticket.tiempo_maximo,
      tiempoRestanteFinalizacion: ticket.tiempo_restante_finalizacion, // Tiempo restante calculado en segundos
      estado: ticket.estado,
      prioridad: ticket.prioridad,
      fechaCreacion: ticket.fecha_creacion,
      fechaCierre: ticket.fecha_cierre,
      fechaAsignacion: ticket.fecha_asignacion,
      pendienteMotivo: ticket.pendienteMotivo,
      pendienteTiempoEstimado: ticket.pendienteTiempoEstimado,
      pendienteActualizadoEn: ticket.pendienteActualizadoEn,
      tecnicoAsignado: ticket.tecnico_nombre,
      evaluacionCierreAutomatico: ticket.evaluacion_cierre_automatico === 1,
      comentarioAdminTecnico: esTecnicoAsignado ? ticket.comentario_admin_tecnico : null,
      enTiempo: enTiempo,
      evaluacion: ticket.calificacion ? {
        calificacion: ticket.calificacion,
        comentario: ticket.comentario_evaluacion,
        fechaEvaluacion: ticket.fecha_evaluacion
      } : null,
      usuario: {
        nombre: ticket.usuario_nombre,
        correo: ticket.usuario_correo
      }
    };

    res.json(formattedTicket);

  } catch (error) {
    console.error('Error obteniendo ticket:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/:id/close', authenticateToken, async (req, res) => {
  try {
    console.log('🔒 POST /api/tickets/:id/close - Cerrando ticket');
    console.log('🎫 ID del ticket:', req.params.id);
    console.log('👤 Usuario:', req.user);
    console.log('📊 Datos recibidos:', req.body);

    const { id } = req.params;
    const { rating, comentarios } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'La calificación debe ser entre 1 y 5 estrellas' });
    }

    const comentariosLimpios = comentarios && typeof comentarios === 'string' ? comentarios.trim() : null;

    const tickets = await query(`
      SELECT id_ticket, id_usuario, estatus, evaluacion_cierre_automatico
      FROM Tickets
      WHERE id_ticket = ? AND id_usuario = ?
    `, [id, req.user.id_usuario]);

    if (tickets.length === 0) {
      console.log('❌ Ticket no encontrado para el usuario');
      return res.status(404).json({ error: 'Ticket no encontrado o no tienes permisos para cerrarlo' });
    }

    const ticket = tickets[0];
    console.log('✅ Ticket encontrado:', ticket);
    console.log('📊 Estado del ticket:', ticket.estatus);
    console.log('📊 evaluacion_cierre_automatico:', ticket.evaluacion_cierre_automatico, 'tipo:', typeof ticket.evaluacion_cierre_automatico);

    // Permitir múltiples evaluaciones para el mismo ticket
    // Esto permite evaluar un ticket reabierto y cerrado nuevamente
    // Cada evaluación se guarda como un registro separado en la tabla Evaluaciones

    // Cerrar el ticket al evaluarlo (si está finalizado) o limpiar campos (si ya está cerrado automáticamente)
    if (ticket.estatus === 'Finalizado') {
      console.log('🔄 Actualizando ticket a cerrado...');
      await query(`
        UPDATE Tickets
        SET
          estatus = 'Cerrado',
          fecha_cierre = COALESCE(fecha_cierre, NOW()),
          evaluacion_ultimo_recordatorio = NULL,
          evaluacion_recordatorio_contador = 0,
          evaluacion_cierre_automatico = 0
        WHERE id_ticket = ?
      `, [id]);
      console.log('✅ Ticket actualizado a cerrado');
    } else {
      // Ticket ya está cerrado automáticamente, solo limpiar campos de evaluación
      console.log('🔄 Limpiando campos de evaluación...');
      await query(`
        UPDATE Tickets
        SET
          evaluacion_ultimo_recordatorio = NULL,
          evaluacion_recordatorio_contador = 0,
          evaluacion_cierre_automatico = 0
        WHERE id_ticket = ?
      `, [id]);
      console.log('✅ Campos de evaluación limpiados');
    }

    // Crear evaluación en la tabla Evaluaciones
    console.log('⭐ Creando evaluación...');
    await query(`
      INSERT INTO Evaluaciones (
        id_ticket,
        calificacion,
        comentario,
        fecha_evaluacion
      ) VALUES (?, ?, ?, NOW())
    `, [id, rating, comentariosLimpios || null]);
    console.log('✅ Evaluación creada exitosamente');

    // Enviar notificación (no bloquear si falla)
    try {
      await notificationOrchestrator.notifyTicketClosure({ ticketId: id, rating, comentarios });
      console.log('✅ Notificación de cierre enviada');
    } catch (notifError) {
      console.error('⚠️ Error enviando notificación de cierre (no crítico):', notifError.message);
      // No lanzar el error, solo loguearlo
    }

    res.json({ message: 'Ticket cerrado exitosamente' });

  } catch (error) {
    console.error('❌ Error cerrando ticket:', error);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Error message:', error.message);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Obtener lista de técnicos y administradores
router.get('/technicians', authenticateToken, async (req, res) => {
  try {
    console.log('👥 GET /api/tickets/technicians - Obteniendo lista de técnicos');

    const technicians = await query(`
      SELECT id_usuario as id, nombre, correo, rol
      FROM Usuarios
      WHERE rol IN ('tecnico', 'administrador')
      ORDER BY rol, nombre
    `);

    console.log(`✅ Técnicos encontrados: ${technicians.length}`);

    res.json(technicians);

  } catch (error) {
    console.error('Error obteniendo técnicos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/:id/evaluate', authenticateToken, async (req, res) => {
  try {
    console.log('⭐ POST /api/tickets/:id/evaluate - Evaluando ticket');
    console.log('🎫 ID del ticket:', req.params.id);
    console.log('👤 Usuario:', req.user);
    console.log('📊 Datos de evaluación:', req.body);

    const { id } = req.params;
    const { calificacion, comentario } = req.body;

    if (!calificacion || calificacion < 1 || calificacion > 5) {
      return res.status(400).json({ error: 'La calificación debe ser entre 1 y 5' });
    }

    // Verificar que el ticket existe y fue creado por el usuario
    const tickets = await query(`
      SELECT id_ticket, id_usuario, estatus, evaluacion_cierre_automatico
      FROM Tickets
      WHERE id_ticket = ? AND id_usuario = ?
    `, [id, req.user.id_usuario]);

    if (tickets.length === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado o no tienes permisos para evaluarlo' });
    }

    const ticket = tickets[0];

    const existingEval = await query(`
      SELECT id_evaluacion
      FROM Evaluaciones
      WHERE id_ticket = ?
    `, [id]);

    if (existingEval.length > 0) {
      return res.status(400).json({ error: 'Este ticket ya ha sido evaluado' });
    }

    // Si no tiene evaluación, se puede evaluar (ya sea finalizado o cerrado por sistema)

    // Crear la evaluación
    await query(`
      INSERT INTO Evaluaciones (id_ticket, calificacion, comentario, fecha_evaluacion)
      VALUES (?, ?, ?, NOW())
    `, [id, calificacion, comentario || null]);

    // Cerrar el ticket al evaluarlo (si está finalizado) o limpiar campos (si ya está cerrado automáticamente)
    if (ticket.estatus === 'Finalizado') {
      await query(`
        UPDATE Tickets
        SET
          estatus = 'Cerrado',
          fecha_cierre = COALESCE(fecha_cierre, NOW()),
          evaluacion_ultimo_recordatorio = NULL,
          evaluacion_recordatorio_contador = 0,
          evaluacion_cierre_automatico = 0
        WHERE id_ticket = ?
      `, [id]);
    } else {
      // Ticket ya está cerrado automáticamente, solo limpiar campos
      await query(`
        UPDATE Tickets
        SET
          evaluacion_ultimo_recordatorio = NULL,
          evaluacion_recordatorio_contador = 0,
          evaluacion_cierre_automatico = 0
        WHERE id_ticket = ?
      `, [id]);
    }

    console.log('✅ Evaluación creada exitosamente');
    res.json({ message: 'Evaluación registrada exitosamente' });

  } catch (error) {
    console.error('Error evaluando ticket:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener evaluación de un ticket
router.get('/:id/evaluation', authenticateToken, async (req, res) => {
  try {
    console.log('📊 GET /api/tickets/:id/evaluation - Obteniendo evaluación');
    console.log('🎫 ID del ticket:', req.params.id);

    const { id } = req.params;

    // Verificar que el ticket existe y pertenece al usuario
    const tickets = await query(`
      SELECT id_ticket, id_usuario
      FROM Tickets
      WHERE id_ticket = ? AND id_usuario = ?
    `, [id, req.user.id_usuario]);

    if (tickets.length === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    // Obtener la evaluación
    const evaluations = await query(`
      SELECT
        id_evaluacion,
        calificacion,
        comentario,
        fecha_evaluacion
      FROM Evaluaciones
      WHERE id_ticket = ?
    `, [id]);

    if (evaluations.length === 0) {
      return res.status(404).json({ error: 'No se encontró evaluación para este ticket' });
    }

    const evaluation = evaluations[0];
    console.log('✅ Evaluación encontrada:', evaluation);

    res.json({
      id: evaluation.id_evaluacion,
      calificacion: evaluation.calificacion,
      comentario: evaluation.comentario,
      fechaEvaluacion: evaluation.fecha_evaluacion
    });

  } catch (error) {
    console.error('Error obteniendo evaluación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint para descargar archivos de aprobación
router.get('/download/:filename', authenticateToken, (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../uploads', filename);

    // Verificar que el archivo existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    // Enviar el archivo
    res.download(filePath, filename);
  } catch (error) {
    console.error('Error descargando archivo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
  });

module.exports = router;
