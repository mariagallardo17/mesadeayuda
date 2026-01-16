-- Script para crear tabla de evaluaciones de tickets reabiertos
-- Esta tabla permite rastrear evaluaciones específicas para cada reapertura de un ticket
-- Relaciona evaluaciones con ticketreaperturas en lugar de directamente con tickets

CREATE TABLE IF NOT EXISTS `evaluaciones_reaperturas` (
  `id_evaluacion_reapertura` int NOT NULL AUTO_INCREMENT,
  `id_reapertura` int NOT NULL COMMENT 'ID de la reapertura específica del ticket',
  `id_ticket` int NOT NULL COMMENT 'ID del ticket (para facilitar consultas)',
  `calificacion` int NOT NULL COMMENT 'Calificación de 1 a 5 estrellas',
  `comentario` text COMMENT 'Comentario opcional de la evaluación',
  `fecha_evaluacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de la evaluación',
  PRIMARY KEY (`id_evaluacion_reapertura`),
  UNIQUE KEY `idx_reapertura_unica` (`id_reapertura`) COMMENT 'Solo una evaluación por reapertura',
  KEY `idx_evaluaciones_reaperturas_ticket` (`id_ticket`),
  KEY `idx_evaluaciones_reaperturas_fecha` (`fecha_evaluacion`),
  CONSTRAINT `fk_evaluacion_reapertura` FOREIGN KEY (`id_reapertura`) REFERENCES `ticketreaperturas` (`id_reapertura`) ON DELETE CASCADE,
  CONSTRAINT `fk_evaluacion_reapertura_ticket` FOREIGN KEY (`id_ticket`) REFERENCES `tickets` (`id_ticket`) ON DELETE CASCADE,
  CONSTRAINT `chk_calificacion_reapertura` CHECK ((`calificacion` between 1 and 5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Evaluaciones específicas para tickets reabiertos, relacionadas con ticketreaperturas';
