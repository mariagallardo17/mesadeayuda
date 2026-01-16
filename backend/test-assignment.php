<?php
/**
 * Script de diagnóstico para verificar asignación automática de tickets
 * Ejecutar desde línea de comandos: php test-assignment.php
 */

require_once __DIR__ . '/vendor/autoload.php';

use App\Config\Database;

// Cargar .env
$envPaths = [
    __DIR__,
    __DIR__ . '/api',
    dirname(__DIR__) . '/api',
];

$envLoaded = false;
foreach ($envPaths as $envPath) {
    $envFile = $envPath . '/.env';
    if (file_exists($envFile)) {
        $dotenv = Dotenv\Dotenv::createImmutable($envPath);
        $dotenv->safeLoad();
        $envLoaded = true;
        break;
    }
}

if (!$envLoaded) {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
    $dotenv->safeLoad();
}

echo "🔍 DIAGNÓSTICO DE ASIGNACIÓN AUTOMÁTICA\n";
echo "========================================\n\n";

try {
    $db = Database::getInstance();
    
    // 1. Verificar técnicos disponibles
    echo "1️⃣ TÉCNICOS DISPONIBLES:\n";
    $stmt = $db->query(
        'SELECT id_usuario, nombre, rol, estatus FROM usuarios 
         WHERE (LOWER(TRIM(rol)) = "tecnico" OR LOWER(TRIM(rol)) = "administrador") 
         AND estatus = "Activo"
         ORDER BY nombre'
    );
    $tecnicos = $stmt->fetchAll();
    
    if (count($tecnicos) === 0) {
        echo "   ❌ NO HAY TÉCNICOS DISPONIBLES\n";
    } else {
        echo "   ✅ Técnicos encontrados: " . count($tecnicos) . "\n";
        foreach ($tecnicos as $tec) {
            echo "      - ID: {$tec['id_usuario']}, Nombre: '{$tec['nombre']}', Rol: '{$tec['rol']}'\n";
        }
    }
    
    echo "\n";
    
    // 2. Verificar servicios con responsable_inicial
    echo "2️⃣ SERVICIOS CON RESPONSABLE_INICIAL:\n";
    $stmt = $db->query(
        'SELECT id_servicio, categoria, subcategoria, responsable_inicial 
         FROM servicios 
         WHERE responsable_inicial IS NOT NULL 
         AND responsable_inicial != "" 
         AND estatus = "Activo"
         LIMIT 10'
    );
    $servicios = $stmt->fetchAll();
    
    if (count($servicios) === 0) {
        echo "   ❌ NO HAY SERVICIOS CON RESPONSABLE_INICIAL CONFIGURADO\n";
    } else {
        echo "   ✅ Servicios con responsable_inicial: " . count($servicios) . " (mostrando primeros 10)\n";
        foreach ($servicios as $serv) {
            $responsable = $serv['responsable_inicial'];
            echo "      - ID: {$serv['id_servicio']}, {$serv['categoria']} - {$serv['subcategoria']}\n";
            echo "        Responsable: '$responsable'\n";
            
            // Intentar encontrar el técnico - mostrar proceso completo
            $responsableLimpio = strtoupper(trim($responsable));
            echo "        Buscando: '$responsableLimpio'\n";
            
            // Primero listar todos los técnicos
            $stmtAll = $db->query(
                'SELECT id_usuario, nombre, rol FROM usuarios 
                 WHERE (LOWER(TRIM(rol)) = "tecnico" OR LOWER(TRIM(rol)) = "administrador") 
                 AND estatus = "Activo"'
            );
            $allTecs = $stmtAll->fetchAll();
            echo "        Técnicos disponibles (" . count($allTecs) . "):\n";
            foreach ($allTecs as $tec) {
                $nombreUpper = strtoupper(trim($tec['nombre']));
                $match = ($nombreUpper === $responsableLimpio) ? " ✅ COINCIDE" : "";
                echo "          - '{$tec['nombre']}' (UPPER: '$nombreUpper')$match\n";
            }
            
            // Búsqueda exacta
            $stmtTec = $db->query(
                'SELECT id_usuario, nombre FROM usuarios 
                 WHERE (LOWER(TRIM(rol)) = "tecnico" OR LOWER(TRIM(rol)) = "administrador") 
                 AND estatus = "Activo" 
                 AND UPPER(TRIM(nombre)) = ?
                 LIMIT 1',
                [$responsableLimpio]
            );
            $tecnico = $stmtTec->fetch();
            
            if ($tecnico) {
                echo "        ✅ Técnico encontrado (exacto): ID {$tecnico['id_usuario']}, Nombre: '{$tecnico['nombre']}'\n";
            } else {
                // Intentar LIKE
                $stmtTec = $db->query(
                    'SELECT id_usuario, nombre FROM usuarios 
                     WHERE (LOWER(TRIM(rol)) = "tecnico" OR LOWER(TRIM(rol)) = "administrador") 
                     AND estatus = "Activo" 
                     AND UPPER(TRIM(nombre)) LIKE ?
                     LIMIT 1',
                    ["%$responsableLimpio%"]
                );
                $tecnico = $stmtTec->fetch();
                
                if ($tecnico) {
                    echo "        ✅ Técnico encontrado (LIKE): ID {$tecnico['id_usuario']}, Nombre: '{$tecnico['nombre']}'\n";
                } else {
                    echo "        ❌ Técnico NO encontrado para '$responsable'\n";
                }
            }
            echo "\n";
        }
    }
    
    echo "\n";
    
    // 3. Verificar tickets recientes
    echo "3️⃣ TICKETS RECIENTES (últimos 5):\n";
    $stmt = $db->query(
        'SELECT t.id_ticket, t.estatus, t.id_tecnico, u.nombre as tecnico_nombre, s.categoria, s.subcategoria, s.responsable_inicial
         FROM tickets t
         JOIN servicios s ON t.id_servicio = s.id_servicio
         LEFT JOIN usuarios u ON t.id_tecnico = u.id_usuario
         ORDER BY t.id_ticket DESC
         LIMIT 5'
    );
    $tickets = $stmt->fetchAll();
    
    if (count($tickets) === 0) {
        echo "   ⚠️ No hay tickets en la base de datos\n";
    } else {
        foreach ($tickets as $ticket) {
            echo "      - Ticket #{$ticket['id_ticket']}: {$ticket['categoria']} - {$ticket['subcategoria']}\n";
            echo "        Estado: {$ticket['estatus']}\n";
            echo "        Responsable inicial del servicio: '{$ticket['responsable_inicial']}'\n";
            if ($ticket['id_tecnico']) {
                echo "        ✅ Técnico asignado: ID {$ticket['id_tecnico']}, Nombre: '{$ticket['tecnico_nombre']}'\n";
            } else {
                echo "        ❌ NO tiene técnico asignado\n";
            }
            echo "\n";
        }
    }
    
    echo "\n✅ DIAGNÓSTICO COMPLETADO\n";
    
} catch (\Exception $e) {
    echo "❌ ERROR: " . $e->getMessage() . "\n";
    echo "Stack trace: " . $e->getTraceAsString() . "\n";
}

