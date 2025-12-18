-- Script de optimización de índices para mejorar el rendimiento del sistema
-- Ejecutar este script en la base de datos MySQL

-- Índice compuesto para consultas de tickets por técnico y estado
-- Mejora: getMyTickets() para técnicos
CREATE INDEX IF NOT EXISTS idx_tickets_id_tecnico_estatus 
ON tickets(id_tecnico, estatus);

-- Índice para consultas de tickets por usuario
-- Mejora: getMyTickets() para empleados
CREATE INDEX IF NOT EXISTS idx_tickets_id_usuario 
ON tickets(id_usuario);

-- Índice para ordenamiento por fecha de creación (más recientes primero)
-- Mejora: ORDER BY fecha_creacion DESC en listados
CREATE INDEX IF NOT EXISTS idx_tickets_fecha_creacion 
ON tickets(fecha_creacion DESC);

-- Índice compuesto para notificaciones por usuario y fecha
-- Mejora: getNotifications() - consulta y ordenamiento
CREATE INDEX IF NOT EXISTS idx_notificaciones_id_usuario_fecha 
ON notificaciones(id_usuario, fecha_envio DESC);

-- Índice para filtrar notificaciones no leídas
-- Mejora: Consultas de conteo de notificaciones no leídas
CREATE INDEX IF NOT EXISTS idx_notificaciones_leida 
ON notificaciones(leida);

-- Índice para búsqueda rápida de tickets por ID (ya debería existir como PRIMARY KEY, pero por si acaso)
-- Mejora: Consultas individuales de tickets
CREATE INDEX IF NOT EXISTS idx_tickets_id_ticket 
ON tickets(id_ticket);

-- Índice para escalamientos
CREATE INDEX IF NOT EXISTS idx_escalamientos_id_ticket 
ON escalamientos(id_ticket);

-- Índice para reaperturas
CREATE INDEX IF NOT EXISTS idx_ticketreaperturas_id_ticket 
ON ticketreaperturas(id_ticket);

-- Verificar índices creados
SHOW INDEX FROM tickets;
SHOW INDEX FROM notificaciones;
SHOW INDEX FROM escalamientos;
SHOW INDEX FROM ticketreaperturas;

