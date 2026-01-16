-- Script para permitir múltiples evaluaciones por ticket
-- Elimina el UNIQUE KEY de id_ticket en la tabla evaluaciones
-- IMPORTANTE: El índice id_ticket está siendo usado por la foreign key evaluaciones_ibfk_1
-- Por lo tanto, necesitamos eliminar la foreign key primero, luego el índice, crear uno normal y recrear la foreign key

-- Paso 1: Eliminar la foreign key constraint
ALTER TABLE `evaluaciones` DROP FOREIGN KEY `evaluaciones_ibfk_1`;

-- Paso 2: Eliminar el UNIQUE KEY id_ticket
ALTER TABLE `evaluaciones` DROP INDEX `id_ticket`;

-- Paso 3: Crear un índice normal (no UNIQUE) para soportar la foreign key
ALTER TABLE `evaluaciones` ADD INDEX `idx_id_ticket` (`id_ticket`);

-- Paso 4: Recrear la foreign key constraint
ALTER TABLE `evaluaciones` ADD CONSTRAINT `evaluaciones_ibfk_1` FOREIGN KEY (`id_ticket`) REFERENCES `tickets` (`id_ticket`);

-- Verificar que la restricción fue eliminada
-- SELECT * FROM information_schema.table_constraints 
-- WHERE table_name = 'evaluaciones' AND constraint_type = 'UNIQUE';

-- Nota: Después de ejecutar este script, la tabla evaluaciones permitirá
-- múltiples registros para el mismo id_ticket, permitiendo evaluar
-- tickets reabiertos múltiples veces.
-- La foreign key seguirá funcionando porque usa el índice normal idx_id_ticket
