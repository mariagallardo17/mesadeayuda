-- =====================================================
-- Script para actualizar servicios que requieren carta de aprobación
-- =====================================================

-- Servicios que requieren aprobación según especificación:
-- 1. Descargas de software
-- 2. Solicitud de red
-- 3. Instalación de teléfono IP
-- 4. Creación de extensión
-- 5. Instalación de nuevo equipo de cómputo
-- 6. Reemplazo de equipo
-- 7. Reemplazo de componentes de equipo (Mantenimiento correctivo que implique componentes)
-- 8. Instalación de nuevo proyector
-- 9. Creación de cuenta de correo institucional
-- 10. Creación de cuentas externas o grupos en Teams
-- 11. Desarrollo de software (nuevo sistema)
-- 12. Instalación de nuevo nodo/punto de acceso de red
-- 13. Instalación de servidor

UPDATE Servicios
SET requiere_aprobacion = 1
WHERE (categoria = 'Internet' AND subcategoria = 'Descargas de software')
   OR (categoria = 'Internet' AND subcategoria = 'Solicitud de red')
   OR (categoria = 'Telefonía IP' AND subcategoria = 'Instalación de teléfono IP')
   OR (categoria = 'Telefonía IP' AND subcategoria = 'Creación de extensión')
   OR (categoria = 'Equipo de cómputo' AND subcategoria = 'Instalación de nuevo equipo')
   OR (categoria = 'Equipo de cómputo' AND subcategoria = 'Reemplazo de equipo')
   OR (categoria = 'Proyectores' AND subcategoria = 'Instalación de nuevo proyector')
   OR (categoria = 'Correo' AND subcategoria = 'Creación de correo')
   OR (categoria = 'Teams' AND subcategoria = 'Creación de grupos')
   OR (categoria = 'Desarrollo de software' AND subcategoria = 'Nuevo sistema')
   OR (categoria = 'Red interna' AND subcategoria = 'Nodo')
   OR (categoria = 'Red interna' AND subcategoria = 'Servidor');

-- Verificar los servicios actualizados
SELECT
    id_servicio,
    categoria,
    subcategoria,
    requiere_aprobacion,
    estatus
FROM Servicios
WHERE requiere_aprobacion = 1
ORDER BY categoria, subcategoria;

-- Mostrar el total de servicios que requieren aprobación
SELECT COUNT(*) as total_requieren_aprobacion
FROM Servicios
WHERE requiere_aprobacion = 1;


