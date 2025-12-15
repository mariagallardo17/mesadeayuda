const cron = require('node-cron');
const reportesController = require('../controllers/reportesController');

/**
 * Genera un reporte mensual para el mes anterior
 */
async function generarReporteMensual() {
  try {
    console.log('📅 Iniciando generación de reporte mensual automático...');

    // Obtener el primer día del mes anterior
    const ahora = new Date();
    const mesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    const ultimoDiaMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth(), 0);

    const fechaInicio = mesAnterior.toISOString().split('T')[0];
    const fechaFin = ultimoDiaMesAnterior.toISOString().split('T')[0];

    console.log(`📊 Generando reporte para el período: ${fechaInicio} a ${fechaFin}`);

    // Obtener todos los datos del reporte
    const datosReporte = await reportesController.obtenerReportesCompletos(fechaInicio, fechaFin);

    // Guardar el reporte en la base de datos
    const idReporte = await reportesController.guardarReporteMensual(
      datosReporte,
      fechaInicio,
      fechaFin,
      null // null porque es generado automáticamente
    );

    console.log(`✅ Reporte mensual generado exitosamente con ID: ${idReporte}`);
    console.log(`📊 Período: ${fechaInicio} a ${fechaFin}`);
    console.log(`📈 Tickets solicitados: ${datosReporte.ticketsSolicitados}`);
    console.log(`⭐ Satisfacción promedio: ${datosReporte.satisfaccionPromedio}`);

    return {
      success: true,
      idReporte,
      fechaInicio,
      fechaFin,
      datosReporte
    };
  } catch (error) {
    console.error('❌ Error generando reporte mensual automático:', error);
    console.error('❌ Stack trace:', error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Inicia el scheduler para generar reportes mensuales automáticamente
 * Se ejecuta el día 1 de cada mes a las 00:00
 */
function iniciarSchedulerReportesMensuales() {
  try {
    // Verificar que la tabla existe, si no, crearla
    reportesController.crearTablaReportesMensuales()
      .then(() => {
        console.log('✅ Tabla reportesmensuales verificada/creada');
      })
      .catch(error => {
        console.error('⚠️ Error verificando tabla reportesmensuales:', error.message);
      });

    // Programar la tarea para ejecutarse el día 1 de cada mes a las 00:00
    // Formato cron: minuto hora día mes día-semana
    // '0 0 1 * *' = día 1 de cada mes a las 00:00
    const tarea = cron.schedule('0 0 1 * *', async () => {
      console.log('⏰ Ejecutando tarea programada: Generación de reporte mensual');
      await generarReporteMensual();
    }, {
      scheduled: true,
      timezone: "America/Mexico_City" // Ajustar según tu zona horaria
    });

    console.log('✅ Scheduler de reportes mensuales iniciado');
    console.log('📅 Se generará un reporte automático el día 1 de cada mes a las 00:00');

    return tarea;
  } catch (error) {
    console.error('❌ Error iniciando scheduler de reportes mensuales:', error);
    throw error;
  }
}

/**
 * Genera un reporte mensual manualmente (útil para testing)
 */
async function generarReporteMensualManual(fechaInicio, fechaFin, idUsuario = null) {
  try {
    console.log(`📊 Generando reporte mensual manual para: ${fechaInicio} a ${fechaFin}`);

    const datosReporte = await reportesController.obtenerReportesCompletos(fechaInicio, fechaFin);
    const idReporte = await reportesController.guardarReporteMensual(
      datosReporte,
      fechaInicio,
      fechaFin,
      idUsuario
    );

    console.log(`✅ Reporte mensual manual generado con ID: ${idReporte}`);
    return {
      success: true,
      idReporte,
      fechaInicio,
      fechaFin,
      datosReporte
    };
  } catch (error) {
    console.error('❌ Error generando reporte mensual manual:', error);
    throw error;
  }
}

module.exports = {
  iniciarSchedulerReportesMensuales,
  generarReporteMensual,
  generarReporteMensualManual
};

