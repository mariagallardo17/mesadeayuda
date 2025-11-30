-- Script para eliminar el contenido de todas las tablas excepto Usuarios y Servicios
-- Este script deshabilita temporalmente las restricciones de claves foráneas
-- para poder eliminar los datos sin problemas de integridad referencial

-- =====================================================
-- PASO 1: Deshabilitar restricciones de claves foráneas
-- =====================================================

SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================
-- PASO 2: Eliminar contenido de todas las tablas (excepto Usuarios y Servicios)
-- =====================================================

-- Tabla de Tickets
DELETE FROM Tickets;

-- Tabla de Reaperturas de Tickets
DELETE FROM TicketReaperturas;

-- Tabla de Evaluaciones
DELETE FROM Evaluaciones;

-- Tabla de Escalamientos
DELETE FROM Escalamientos;

-- Tabla de Notificaciones
DELETE FROM Notificaciones;

-- Tabla de Asignaciones Automáticas
DELETE FROM asignaciones_automaticas;

-- Tabla de Especialidades de Técnicos
DELETE FROM tecnicos_especialidades;

-- Tabla de Asignaciones de Tickets (si existe)
DELETE FROM AsignacionesTickets;

-- Tabla de Historial de Tickets (si existe)
DELETE FROM Historial_Tickets;

-- Tabla de Reportes (si existe)
DELETE FROM REPORTES;

-- =====================================================
-- PASO 3: Reiniciar los auto_increment de las tablas
-- =====================================================

ALTER TABLE Tickets AUTO_INCREMENT = 1;
ALTER TABLE TicketReaperturas AUTO_INCREMENT = 1;
ALTER TABLE Evaluaciones AUTO_INCREMENT = 1;
ALTER TABLE Escalamientos AUTO_INCREMENT = 1;
ALTER TABLE Notificaciones AUTO_INCREMENT = 1;
ALTER TABLE asignaciones_automaticas AUTO_INCREMENT = 1;
ALTER TABLE tecnicos_especialidades AUTO_INCREMENT = 1;

-- =====================================================
-- PASO 4: Rehabilitar restricciones de claves foráneas
-- =====================================================

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- Mensaje de confirmación
-- =====================================================

SELECT '✅ Limpieza completada. Todas las tablas han sido vaciadas excepto Usuarios y Servicios.' AS resultado;

