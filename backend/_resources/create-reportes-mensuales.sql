-- Script para crear la tabla reportesmensuales
-- Esta tabla almacena los reportes mensuales generados automáticamente

CREATE TABLE IF NOT EXISTS reportesmensuales (
  id_reporte INT AUTO_INCREMENT PRIMARY KEY,
  fecha_inicio DATE NOT NULL COMMENT 'Fecha de inicio del período del reporte',
  fecha_fin DATE NOT NULL COMMENT 'Fecha de fin del período del reporte',
  datos_reporte JSON NOT NULL COMMENT 'Datos completos del reporte en formato JSON',
  id_usuario_generador INT NULL COMMENT 'ID del usuario que generó el reporte (NULL si fue automático)',
  fecha_generacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de generación del reporte',
  INDEX idx_fecha_inicio (fecha_inicio),
  INDEX idx_fecha_fin (fecha_fin),
  INDEX idx_fecha_generacion (fecha_generacion),
  FOREIGN KEY (id_usuario_generador) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tabla para almacenar reportes mensuales generados automáticamente';

