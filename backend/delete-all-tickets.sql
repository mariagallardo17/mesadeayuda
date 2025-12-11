-- Script para eliminar TODOS los tickets de la base de datos
-- ⚠️ ADVERTENCIA: Esta operación es IRREVERSIBLE
-- Ejecutar con precaución

-- Desactivar verificación de claves foráneas temporalmente
SET FOREIGN_KEY_CHECKS = 0;

-- Eliminar registros relacionados primero (para evitar errores de claves foráneas)
DELETE FROM evaluaciones;
DELETE FROM escalamientos;
DELETE FROM notificaciones;
DELETE FROM ticketreaperturas;

-- Eliminar todos los tickets
DELETE FROM tickets;

-- Reactivar verificación de claves foráneas
SET FOREIGN_KEY_CHECKS = 1;

-- Verificar que se eliminaron
SELECT COUNT(*) as tickets_restantes FROM tickets;
SELECT COUNT(*) as evaluaciones_restantes FROM evaluaciones;
SELECT COUNT(*) as escalamientos_restantes FROM escalamientos;
SELECT COUNT(*) as notificaciones_restantes FROM notificaciones;
SELECT COUNT(*) as reaperturas_restantes FROM ticketreaperturas;

