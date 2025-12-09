-- Script para agregar campos de tiempo de atención a la tabla Tickets
-- Este script agrega:
-- 1. fecha_inicio_atencion: Fecha cuando el técnico abre el ticket (estado "En Progreso")
-- 2. tiempo_atencion_segundos: Tiempo total en segundos cuando se finaliza el ticket
--
-- Nota: Este script debe ejecutarse con el script Node.js que verifica si las columnas ya existen
-- antes de intentar agregarlas, ya que MySQL no soporta IF NOT EXISTS para ALTER TABLE

-- Agregar columna fecha_inicio_atencion
ALTER TABLE Tickets
ADD COLUMN fecha_inicio_atencion DATETIME NULL
COMMENT 'Fecha cuando el técnico abre el ticket (estado En Progreso por primera vez)';

-- Agregar columna tiempo_atencion_segundos
ALTER TABLE Tickets
ADD COLUMN tiempo_atencion_segundos INT NULL
COMMENT 'Tiempo total de atención en segundos cuando el ticket fue finalizado';

