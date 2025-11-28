-- Script para recrear la tabla Servicios con la estructura definitiva
-- Sin columnas descripcion y tiempo_solucion
-- Este script elimina la tabla existente y crea una nueva con todos los servicios

-- =====================================================
-- PASO 1: Eliminar la tabla Servicios si existe
-- =====================================================

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS servicios;
DROP TABLE IF EXISTS Servicios;
SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- PASO 2: Crear la tabla Servicios con la estructura definitiva
-- Sin descripcion y tiempo_solucion
-- =====================================================

CREATE TABLE Servicios (
    id_servicio INT AUTO_INCREMENT PRIMARY KEY,
    requerimiento VARCHAR(100) DEFAULT NULL,
    categoria VARCHAR(100) DEFAULT NULL,
    subcategoria VARCHAR(200) DEFAULT NULL,
    tiempo_objetivo VARCHAR(20) DEFAULT NULL,
    tiempo_maximo VARCHAR(20) DEFAULT NULL,
    prioridad VARCHAR(20) DEFAULT NULL,
    responsable_inicial VARCHAR(50) DEFAULT NULL,
    escalamiento VARCHAR(100) DEFAULT NULL,
    motivo_escalamiento VARCHAR(300) DEFAULT NULL,
    nivel_servicio VARCHAR(50) DEFAULT NULL,
    sla VARCHAR(50) DEFAULT NULL,
    estatus ENUM('Activo', 'Inactivo') DEFAULT 'Activo',
    requiere_aprobacion TINYINT(1) DEFAULT 0,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- PASO 3: Insertar todos los servicios del catálogo definitivo
-- =====================================================

INSERT INTO Servicios
(requerimiento, categoria, subcategoria, tiempo_objetivo, tiempo_maximo, prioridad, responsable_inicial, escalamiento, motivo_escalamiento, estatus) VALUES

-- CONECTIVIDAD - INTERNET
('Conectividad', 'Internet', 'Falta de conexión', '00:45:00', '00:56:15', 'Alta', 'RITO', 'Especialista externo / proveedor', 'Incidencia crítica o falla persistente', 'Activo'),
('Conectividad', 'Internet', 'Acceso a internet', '00:30:00', '00:36:00', 'Media', 'RITO', 'RITO', 'Problema no resuelto en tiempo objetivo', 'Activo'),
('Conectividad', 'Internet', 'Acceso a página o aplicación', '00:40:00', '00:50:00', 'Media', 'RITO', 'RITO', 'Requiere permisos especiales o diagnóstico profundo', 'Activo'),
('Conectividad', 'Internet', 'Descargas de software', '01:00:00', '01:12:00', 'Media', 'RITO', 'RITO', 'Configuración especial o solicitud administrativa', 'Activo'),
('Conectividad', 'Internet', 'Solicitud de red', '01:00:00', '01:12:00', 'Media', 'OSCAR', 'RITO', 'Configuración especial o solicitud administrativa', 'Activo'),

-- TELEFONÍA - TELEFONÍA IP
('Telefonía', 'Telefonía IP', 'Instalación de teléfono IP', '01:00:00', '01:12:00', 'Alta', 'OSCAR', 'RITO', 'Configuración avanzada o falla técnica compleja', 'Activo'),
('Telefonía', 'Telefonía IP', 'Creación de extensión', '00:30:00', '00:36:00', 'Media', 'OSCAR', 'RITO', 'Configuración especial o falla no resuelta', 'Activo'),
('Telefonía', 'Telefonía IP', 'Caída de conexión', '01:30:00', '01:52:30', 'Alta', 'OSCAR', 'RITO', 'Incidencia crítica o falla grave', 'Activo'),

-- HARDWARE - EQUIPO DE CÓMPUTO
('Hardware', 'Equipo de cómputo', 'Mantenimiento preventivo', '01:00:00', '01:12:00', 'Media', 'OSCAR', 'RITO', 'Falla detectada durante mantenimiento', 'Activo'),
('Hardware', 'Equipo de cómputo', 'Mantenimiento correctivo', '01:30:00', '01:52:30', 'Alta', 'OSCAR', 'RITO', 'Problema persistente o falla no resuelta', 'Activo'),
('Hardware', 'Equipo de cómputo', 'Instalación de nuevo equipo', '01:00:00', '01:12:00', 'Media', 'OSCAR', 'RITO', 'Configuración especial o instalación compleja', 'Activo'),
('Hardware', 'Equipo de cómputo', 'Falla de software', '00:30:00', '00:37:30', 'Alta', 'OSCAR', 'RITO', 'Problema complejo o interdependencia con otros sistemas', 'Activo'),
('Hardware', 'Equipo de cómputo', 'Reemplazo de equipo', '01:00:00', '01:12:00', 'Media', 'OSCAR', 'RITO', 'Daño persistente o problema recurrente', 'Activo'),

-- HARDWARE - PROYECTORES
('Hardware', 'Proyectores', 'No enciende', '00:30:00', '00:36:00', 'Media', 'OSCAR', 'RITO', 'Falla técnica mayor', 'Activo'),
('Hardware', 'Proyectores', 'Cambio de cable', '00:30:00', '00:36:00', 'Media', 'OSCAR', 'RITO', 'Falla técnica mayor', 'Activo'),
('Hardware', 'Proyectores', 'Mantenimieniento preventivo', '00:30:00', '00:36:00', 'Media', 'OSCAR', 'RITO', 'Falla técnica mayor', 'Activo'),
('Hardware', 'Proyectores', 'Mantenimieniento correctivo', '00:30:00', '00:36:00', 'Media', 'OSCAR', 'RITO', 'Falla técnica mayor', 'Activo'),
('Hardware', 'Proyectores', 'Instalación de nuevo proyector', '01:00:00', '01:12:00', 'Media', 'OSCAR', 'RITO', 'Integración con red o configuración compleja', 'Activo'),

-- HARDWARE - IMPRESORAS
('Hardware', 'Impresoras', 'Falla de conexión', '00:45:00', '00:54:00', 'Media', 'OSCAR', 'RITO', 'Problema persistente o falla técnica', 'Activo'),
('Hardware', 'Impresoras', 'Papel atorado', '00:45:00', '00:54:00', 'Media', 'OSCAR', 'RITO', 'Problema persistente o falla técnica', 'Activo'),
('Hardware', 'Impresoras', 'Mantenimiento preventivo', '00:45:00', '00:54:00', 'Media', 'OSCAR', 'RITO', 'Falla recurrente o daño grave', 'Activo'),
('Hardware', 'Impresoras', 'Mantenimiento correctivo', '00:45:00', '00:54:00', 'Media', 'OSCAR', 'RITO', 'Falla recurrente o daño grave', 'Activo'),
('Hardware', 'Impresoras', 'Configuración', '01:00:00', '01:12:00', 'Media', 'OSCAR', 'RITO', 'Configuración especial o permisos administrativos', 'Activo'),
('Hardware', 'Impresoras', 'Instalación', '01:00:00', '01:12:00', 'Media', 'OSCAR', 'RITO', 'Configuración especial o permisos administrativos', 'Activo'),
('Hardware', 'Impresoras', 'Reemplazo de tóner', '00:30:00', '00:36:00', 'Baja', 'OSCAR', 'RITO', 'Falta repetitiva o problema técnico', 'Activo'),

-- HARDWARE - COPIADORA
('Hardware', 'Copiadora', 'Falta de papel', '00:20:00', '00:24:00', 'Baja', 'OSCAR', 'RITO', 'Falta recurrente o daño mecánico', 'Activo'),
('Hardware', 'Copiadora', 'Falta de tóner', '00:20:00', '00:24:00', 'Baja', 'OSCAR', 'RITO', 'Falta recurrente o daño mecánico', 'Activo'),
('Hardware', 'Copiadora', 'Mantenimiento preventivo', '01:00:00', '01:12:00', 'Media', 'OSCAR', 'RITO', 'Problema persistente o falla grave', 'Activo'),
('Hardware', 'Copiadora', 'Mantenimiento correctivo', '01:00:00', '01:12:00', 'Media', 'OSCAR', 'RITO', 'Problema persistente o falla grave', 'Activo'),

-- CORREO
('Correo', 'Correo', 'Creación de correo', '00:40:00', '00:48:00', 'Media', 'RITO', 'Especialista externo / proveedor', 'Configuración compleja o integración con otros sistemas', 'Activo'),
('Correo', 'Correo', 'Actualización de correo', '00:40:00', '00:48:00', 'Media', 'RITO', 'Especialista externo / proveedor', 'Configuración compleja o integración con otros sistemas', 'Activo'),
('Correo', 'Correo', 'Mantenimiento', '01:00:00', '01:15:00', 'Alta', 'RITO', 'Especialista externo / proveedor', 'Falla crítica del servidor o incidencia prolongada', 'Activo'),
('Correo', 'Correo', 'Sin acceso', '01:00:00', '01:15:00', 'Alta', 'RITO', 'Especialista externo / proveedor', 'Falla crítica del servidor o incidencia prolongada', 'Activo'),
('Correo', 'Correo', 'Caída', '01:00:00', '01:15:00', 'Alta', 'RITO', 'Especialista externo / proveedor', 'Falla crítica del servidor o incidencia prolongada', 'Activo'),

-- SOFTWARE - CONNECT
('Software', 'Connect', 'Consulta de información', '00:30:00', '00:36:00', 'Baja', 'ADRIAN', 'RITO', 'Problema técnico complejo', 'Activo'),
('Software', 'Connect', 'Captura calificaciones', '01:00:00', '01:15:00', 'Media', 'ADRIAN', 'RITO', 'Falla persistente o incidencia crítica', 'Activo'),
('Software', 'Connect', 'Caída del sistema', '02:00:00', '02:36:00', 'Crítica', 'RITO', 'Especialista externo / proveedor', 'Falla grave de infraestructura', 'Activo'),

-- SOFTWARE - TEAMS
('Software', 'Teams', 'Modificaciones', '00:30:00', '00:36:00', 'Media', 'ADRIAN', 'RITO', 'Configuración compleja o fallo persistente', 'Activo'),
('Software', 'Teams', 'Actualización de datos', '00:30:00', '00:36:00', 'Media', 'ADRIAN', 'RITO', 'Configuración compleja o fallo persistente', 'Activo'),
('Software', 'Teams', 'Creación de cuentas', '01:00:00', '01:15:00', 'Alta', 'ADRIAN', 'RITO', 'Autorizaciones especiales o fallas de integración', 'Activo'),
('Software', 'Teams', 'Creación de grupos', '01:00:00', '01:15:00', 'Alta', 'RITO', 'RITO', 'Autorizaciones especiales o fallas de integración', 'Activo'),

-- SOFTWARE - OUTLOOK
('Software', 'Outlook', 'Instalación', '01:30:00', '01:52:30', 'Media', 'ADRIAN', 'RITO', 'Problema técnico mayor', 'Activo'),
('Software', 'Outlook', 'Respaldo', '01:30:00', '01:52:30', 'Media', 'ADRIAN', 'RITO', 'Problema técnico mayor', 'Activo'),
('Software', 'Outlook', 'Sincronización', '01:30:00', '01:52:30', 'Media', 'ADRIAN', 'RITO', 'Problema técnico mayor', 'Activo'),

-- SOFTWARE - CONTROL ESCOLAR
('Software', 'Control Escolar', 'Bloqueo de pagos', '00:30:00', '00:36:00', 'Media', 'ADRIAN', 'RITO', 'Problema persistente o solicitud administrativa especial', 'Activo'),
('Software', 'Control Escolar', 'Desbloqueo de pagos', '00:30:00', '00:36:00', 'Media', 'ADRIAN', 'RITO', 'Problema persistente o solicitud administrativa especial', 'Activo'),

-- SOFTWARE - PUNTOS DH
('Software', 'Puntos DH', 'Caída', '01:30:00', '01:52:30', 'Alta', 'ADRIAN', 'RITO', 'Falla grave del sistema', 'Activo'),
('Software', 'Puntos DH', 'Respaldo de datos', '01:30:00', '01:52:30', 'Alta', 'ADRIAN', 'RITO', 'Falla grave del sistema', 'Activo'),

-- SOFTWARE - OFFICE
('Software', 'Office', 'Instalación', '01:00:00', '01:15:00', 'Media', 'ADRIAN', 'RITO', 'Configuración compleja o fallo persistente', 'Activo'),
('Software', 'Office', 'Errores', '01:00:00', '01:15:00', 'Media', 'ADRIAN', 'RITO', 'Configuración compleja o fallo persistente', 'Activo'),

-- SOFTWARE - ONEDRIVE
('Software', 'OneDrive', 'Respaldo', '01:00:00', '01:15:00', 'Media', 'ADRIAN', 'RITO', 'Configuración avanzada o fallo persistente', 'Activo'),
('Software', 'OneDrive', 'Sincronización', '01:00:00', '01:15:00', 'Media', 'ADRIAN', 'RITO', 'Configuración avanzada o fallo persistente', 'Activo'),
('Software', 'OneDrive', 'Cuenta', '01:00:00', '01:15:00', 'Media', 'ADRIAN', 'RITO', 'Configuración avanzada o fallo persistente', 'Activo'),

-- SOFTWARE - DESARROLLO DE SOFTWARE
('Software', 'Desarrollo de software', 'Nuevo sistema', '30 días', '39 días', 'Crítica', 'ADRIAN', 'Especialista externo / proveedor', 'Proyecto complejo o integración avanzada', 'Activo'),

-- SOFTWARE - AGENDATEC
('Software', 'Agendatec', 'Mantenimiento', '01:00:00', '01:15:00', 'Media', 'ADRIAN', 'RITO', 'Error crítico o actualización mayor', 'Activo'),
('Software', 'Agendatec', 'Errores en el sistema', '01:00:00', '01:15:00', 'Media', 'ADRIAN', 'RITO', 'Error crítico o actualización mayor', 'Activo'),

-- AYUDA
('Ayuda', 'Ayuda Soporte general', 'Apoyo de información', '00:30:00', '00:36:00', 'Baja', 'ADRIAN', 'RITO', 'Solicitud fuera de alcance o recurrente', 'Activo'),

-- RED
('Red', 'Red interna', 'Acceso', '01:30:00', '01:52:30', 'Alta', 'OSCAR', 'RITO', 'Problema crítico de infraestructura', 'Activo'),
('Red', 'Red interna', 'Caída', '01:30:00', '01:52:30', 'Alta', 'OSCAR', 'RITO', 'Problema crítico de infraestructura', 'Activo'),
('Red', 'Red interna', 'Configuración', '01:30:00', '01:52:30', 'Alta', 'OSCAR', 'RITO', 'Problema crítico de infraestructura', 'Activo'),
('Red', 'Red interna', 'Nodo', '01:30:00', '01:52:30', 'Alta', 'OSCAR', 'RITO', 'Problema crítico de infraestructura', 'Activo'),
('Red', 'Red interna', 'Servidor', '01:30:00', '01:52:30', 'Alta', 'OSCAR', 'RITO', 'Problema crítico de infraestructura', 'Activo');

-- =====================================================
-- PASO 4: Verificar la inserción
-- =====================================================

SELECT COUNT(*) as total_servicios FROM Servicios;

SELECT
    requerimiento,
    categoria,
    COUNT(*) as total
FROM Servicios
GROUP BY requerimiento, categoria
ORDER BY requerimiento, categoria;

