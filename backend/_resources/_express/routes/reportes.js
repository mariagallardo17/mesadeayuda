const express = require('express');
const { query } = require('../config/database');
const jwt = require('jsonwebtoken');
const reportesController = require('../controllers/reportesController');

const router = express.Router();

// Middleware de autenticación
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

// Middleware para requerir administrador
const requireAdmin = (req, res, next) => {
  if (req.user.rol !== 'administrador') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador' });
  }
  next();
};

// Función helper para normalizar fechas
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
      return fecha;
    }
    // Convertir DD/MM/YYYY o DD-MM-YYYY a YYYY-MM-DD
    const dia = partes[0].padStart(2, '0');
    const mes = partes[1].padStart(2, '0');
    const anio = partes[2];
    return `${anio}-${mes}-${dia}`;
  }

  return fecha;
}

/**
 * GET /api/reportes/gestion-servicios
 * Obtiene todos los KPIs de reportes de gestión de servicios
 * Query params: fechaInicio (YYYY-MM-DD), fechaFin (YYYY-MM-DD)
 */
router.get('/gestion-servicios', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let { fechaInicio, fechaFin } = req.query;

    console.log('📊 Generando reporte de gestión de servicios...');
    console.log('👤 Usuario:', req.user.nombre);
    console.log('📅 Fecha inicio (original):', fechaInicio);
    console.log('📅 Fecha fin (original):', fechaFin);

    // Normalizar fechas
    if (!fechaInicio || fechaInicio.trim() === '' || fechaInicio === 'undefined') {
      fechaInicio = null;
    } else {
      fechaInicio = normalizarFecha(fechaInicio);
    }

    if (!fechaFin || fechaFin.trim() === '' || fechaFin === 'undefined') {
      fechaFin = null;
    } else {
      fechaFin = normalizarFecha(fechaFin);
    }

    console.log('📅 Fecha inicio (normalizada):', fechaInicio);
    console.log('📅 Fecha fin (normalizada):', fechaFin);

    // Obtener todos los reportes completos
    const reportes = await reportesController.obtenerReportesCompletos(fechaInicio, fechaFin);

    console.log('✅ Reporte generado exitosamente');
    res.json(reportes);

  } catch (error) {
    console.error('❌ Error generando reporte de gestión de servicios:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      error: 'Error interno del servidor al generar reportes',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/reportes/mensuales
 * Obtiene los reportes mensuales guardados
 */
router.get('/mensuales', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const reportes = await reportesController.obtenerReportesMensualesGuardados(limit, offset);
    res.json(reportes);
  } catch (error) {
    console.error('❌ Error obteniendo reportes mensuales:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/reportes/mensuales/:id
 * Obtiene un reporte mensual específico por ID
 */
router.get('/mensuales/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const reportes = await query(
      'SELECT * FROM reportesmensuales WHERE id_reporte = ?',
      [id]
    );

    if (reportes.length === 0) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }

    res.json(reportes[0]);
  } catch (error) {
    console.error('❌ Error obteniendo reporte mensual:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;

