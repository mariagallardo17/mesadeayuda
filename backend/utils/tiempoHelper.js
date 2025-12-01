/**
 * Utilidades para el cálculo de tiempos de SLA
 */

/**
 * Convierte tiempoObjetivo a minutos
 * Soporta formatos:
 * - "HH:MM:SS" (ej: "01:30:00")
 * - "X días" (ej: "30 días")
 * - Número directo en minutos (si es numérico)
 * 
 * @param {string|number} tiempoObjetivo - Tiempo objetivo del servicio
 * @returns {number|null} Tiempo en minutos o null si no se puede convertir
 */
function tiempoObjetivoAMinutos(tiempoObjetivo) {
  if (!tiempoObjetivo) {
    return null;
  }

  // Si es numérico, asumir que ya está en minutos
  if (typeof tiempoObjetivo === 'number') {
    return tiempoObjetivo;
  }

  const tiempoStr = String(tiempoObjetivo).trim();

  // Formato "X días"
  if (tiempoStr.includes('días') || tiempoStr.includes('dias') || tiempoStr.includes('día') || tiempoStr.includes('dia')) {
    const diasMatch = tiempoStr.match(/(\d+)/);
    if (diasMatch) {
      const dias = parseInt(diasMatch[1], 10);
      return dias * 24 * 60; // Convertir días a minutos
    }
  }

  // Formato "HH:MM:SS" o "HH:MM"
  if (tiempoStr.includes(':')) {
    const partes = tiempoStr.split(':');
    if (partes.length >= 2) {
      const horas = parseInt(partes[0] || 0, 10);
      const minutos = parseInt(partes[1] || 0, 10);
      const segundos = partes.length > 2 ? parseInt(partes[2] || 0, 10) : 0;
      return (horas * 60) + minutos + (segundos / 60);
    }
  }

  // Intentar parsear como número (asumiendo minutos)
  const numero = parseFloat(tiempoStr);
  if (!isNaN(numero)) {
    return numero;
  }

  return null;
}

/**
 * Calcula si un ticket fue resuelto en tiempo basado en tiempoObjetivo
 * 
 * @param {string|Date} fechaCreacion - Fecha de creación del ticket
 * @param {string|Date|null} fechaCierre - Fecha de cierre del ticket (null si no está cerrado)
 * @param {string|number} tiempoObjetivo - Tiempo objetivo del servicio
 * @returns {boolean|null} true si está en tiempo, false si está fuera de tiempo, null si no se puede calcular
 */
function calcularEnTiempo(fechaCreacion, fechaCierre, tiempoObjetivo) {
  // Si no hay fecha de cierre, no se puede calcular
  if (!fechaCierre) {
    return null;
  }

  // Si no hay tiempo objetivo, no se puede calcular
  const tiempoObjetivoMinutos = tiempoObjetivoAMinutos(tiempoObjetivo);
  if (tiempoObjetivoMinutos === null) {
    return null;
  }

  try {
    const fechaCreacionDate = fechaCreacion instanceof Date ? fechaCreacion : new Date(fechaCreacion);
    const fechaCierreDate = fechaCierre instanceof Date ? fechaCierre : new Date(fechaCierre);

    // Calcular diferencia en minutos
    const diferenciaMs = fechaCierreDate.getTime() - fechaCreacionDate.getTime();
    const diferenciaMinutos = diferenciaMs / (1000 * 60);

    // Comparar con tiempo objetivo
    return diferenciaMinutos <= tiempoObjetivoMinutos;
  } catch (error) {
    console.error('Error calculando enTiempo:', error);
    return null;
  }
}

/**
 * Genera una expresión SQL para calcular enTiempo en una consulta
 * Compara TIMESTAMPDIFF(MINUTE, fecha_creacion, fecha_cierre) con tiempo_objetivo convertido a minutos
 * 
 * @returns {string} Expresión SQL CASE que retorna 1 si en tiempo, 0 si fuera de tiempo, NULL si no aplica
 */
function sqlCalcularEnTiempo() {
  return `
    CASE
      WHEN t.fecha_cierre IS NULL THEN NULL
      WHEN s.tiempo_objetivo IS NULL THEN NULL
      WHEN s.tiempo_objetivo LIKE '%días%' OR s.tiempo_objetivo LIKE '%dias%' OR s.tiempo_objetivo LIKE '%día%' OR s.tiempo_objetivo LIKE '%dia%' THEN
        CASE
          WHEN TIMESTAMPDIFF(MINUTE, t.fecha_creacion, t.fecha_cierre) <= (CAST(SUBSTRING_INDEX(s.tiempo_objetivo, ' ', 1) AS UNSIGNED) * 24 * 60)
          THEN 1
          ELSE 0
        END
      WHEN s.tiempo_objetivo LIKE '%:%' THEN
        CASE
          WHEN TIMESTAMPDIFF(MINUTE, t.fecha_creacion, t.fecha_cierre) <= 
            (TIME_TO_SEC(CAST(s.tiempo_objetivo AS TIME)) / 60)
          THEN 1
          ELSE 0
        END
      WHEN CAST(s.tiempo_objetivo AS UNSIGNED) > 0 THEN
        CASE
          WHEN TIMESTAMPDIFF(MINUTE, t.fecha_creacion, t.fecha_cierre) <= CAST(s.tiempo_objetivo AS UNSIGNED)
          THEN 1
          ELSE 0
        END
      ELSE NULL
    END as en_tiempo
  `;
}

/**
 * Genera una expresión SQL para filtrar tickets tardíos
 * 
 * @returns {string} Condición SQL WHERE para tickets tardíos
 */
function sqlCondicionTicketsTardios() {
  return `
    t.fecha_cierre IS NOT NULL
    AND t.estatus IN ('Finalizado', 'Cerrado')
    AND s.tiempo_objetivo IS NOT NULL
    AND (
      (s.tiempo_objetivo LIKE '%días%' OR s.tiempo_objetivo LIKE '%dias%' OR s.tiempo_objetivo LIKE '%día%' OR s.tiempo_objetivo LIKE '%dia%')
      AND TIMESTAMPDIFF(MINUTE, t.fecha_creacion, t.fecha_cierre) > (CAST(SUBSTRING_INDEX(s.tiempo_objetivo, ' ', 1) AS UNSIGNED) * 24 * 60)
      OR
      (s.tiempo_objetivo LIKE '%:%')
      AND TIMESTAMPDIFF(MINUTE, t.fecha_creacion, t.fecha_cierre) > (TIME_TO_SEC(CAST(s.tiempo_objetivo AS TIME)) / 60)
      OR
      (CAST(s.tiempo_objetivo AS UNSIGNED) > 0)
      AND TIMESTAMPDIFF(MINUTE, t.fecha_creacion, t.fecha_cierre) > CAST(s.tiempo_objetivo AS UNSIGNED)
    )
  `;
}

/**
 * Convierte tiempoObjetivo a segundos
 * Usa la misma lógica que tiempoObjetivoAMinutos pero retorna segundos
 * 
 * @param {string|number} tiempoObjetivo - Tiempo objetivo del servicio
 * @returns {number|null} Tiempo en segundos o null si no se puede convertir
 */
function tiempoObjetivoASegundos(tiempoObjetivo) {
  const minutos = tiempoObjetivoAMinutos(tiempoObjetivo);
  if (minutos === null) {
    return null;
  }
  return minutos * 60;
}

/**
 * Calcula tiempo_restante_finalizacion en segundos
 * Retorna los segundos restantes hasta la fecha límite (negativo si ya venció)
 * 
 * @param {string|Date} fechaCreacion - Fecha de creación del ticket
 * @param {string|number} tiempoObjetivo - Tiempo objetivo del servicio (se usa tiempo_maximo si está disponible)
 * @param {string|number} tiempoMaximo - Tiempo máximo del servicio (opcional, tiene prioridad sobre tiempoObjetivo)
 * @returns {number|null} Segundos restantes hasta la fecha límite, o null si no se puede calcular
 */
function calcularTiempoRestanteFinalizacion(fechaCreacion, tiempoObjetivo, tiempoMaximo = null) {
  // Usar tiempo_maximo si está disponible, sino usar tiempo_objetivo
  const tiempoASegundos = tiempoMaximo 
    ? tiempoObjetivoASegundos(tiempoMaximo) 
    : tiempoObjetivoASegundos(tiempoObjetivo);
  
  if (tiempoASegundos === null) {
    return null;
  }

  try {
    const fechaCreacionDate = fechaCreacion instanceof Date ? fechaCreacion : new Date(fechaCreacion);
    const fechaLimite = new Date(fechaCreacionDate.getTime() + (tiempoASegundos * 1000));
    const ahora = new Date();
    
    // Calcular diferencia en segundos (negativo si ya venció)
    const diferenciaSegundos = Math.floor((fechaLimite.getTime() - ahora.getTime()) / 1000);
    
    return diferenciaSegundos;
  } catch (error) {
    console.error('Error calculando tiempo restante:', error);
    return null;
  }
}

/**
 * Genera una expresión SQL para calcular tiempo_restante_finalizacion
 * Usa tiempo_maximo si está disponible, sino usa tiempo_objetivo
 * 
 * @returns {string} Expresión SQL que calcula segundos restantes hasta la fecha límite
 */
function sqlCalcularTiempoRestanteFinalizacion() {
  return `
    CASE
      WHEN s.tiempo_maximo IS NOT NULL THEN
        CASE
          WHEN s.tiempo_maximo LIKE '%días%' OR s.tiempo_maximo LIKE '%dias%' OR s.tiempo_maximo LIKE '%día%' OR s.tiempo_maximo LIKE '%dia%' THEN
            TIMESTAMPDIFF(SECOND, NOW(), DATE_ADD(t.fecha_creacion, INTERVAL CAST(SUBSTRING_INDEX(s.tiempo_maximo, ' ', 1) AS UNSIGNED) DAY))
          WHEN s.tiempo_maximo LIKE '%:%' THEN
            TIMESTAMPDIFF(SECOND, NOW(), DATE_ADD(t.fecha_creacion, INTERVAL TIME_TO_SEC(CAST(s.tiempo_maximo AS TIME)) SECOND))
          WHEN CAST(s.tiempo_maximo AS UNSIGNED) > 0 THEN
            TIMESTAMPDIFF(SECOND, NOW(), DATE_ADD(t.fecha_creacion, INTERVAL CAST(s.tiempo_maximo AS UNSIGNED) MINUTE))
          ELSE NULL
        END
      WHEN s.tiempo_objetivo IS NOT NULL THEN
        CASE
          WHEN s.tiempo_objetivo LIKE '%días%' OR s.tiempo_objetivo LIKE '%dias%' OR s.tiempo_objetivo LIKE '%día%' OR s.tiempo_objetivo LIKE '%dia%' THEN
            TIMESTAMPDIFF(SECOND, NOW(), DATE_ADD(t.fecha_creacion, INTERVAL CAST(SUBSTRING_INDEX(s.tiempo_objetivo, ' ', 1) AS UNSIGNED) DAY))
          WHEN s.tiempo_objetivo LIKE '%:%' THEN
            TIMESTAMPDIFF(SECOND, NOW(), DATE_ADD(t.fecha_creacion, INTERVAL TIME_TO_SEC(CAST(s.tiempo_objetivo AS TIME)) SECOND))
          WHEN CAST(s.tiempo_objetivo AS UNSIGNED) > 0 THEN
            TIMESTAMPDIFF(SECOND, NOW(), DATE_ADD(t.fecha_creacion, INTERVAL CAST(s.tiempo_objetivo AS UNSIGNED) MINUTE))
          ELSE NULL
        END
      ELSE NULL
    END as tiempo_restante_finalizacion
  `;
}

module.exports = {
  tiempoObjetivoAMinutos,
  tiempoObjetivoASegundos,
  calcularEnTiempo,
  calcularTiempoRestanteFinalizacion,
  sqlCalcularEnTiempo,
  sqlCalcularTiempoRestanteFinalizacion,
  sqlCondicionTicketsTardios
};

