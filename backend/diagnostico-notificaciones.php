<?php
/**
 * Script de diagnóstico de notificaciones
 * Ejecutar desde la línea de comandos para verificar el estado del sistema de notificaciones
 */

require_once __DIR__ . '/vendor/autoload.php';

use App\Config\Database;

$db = Database::getInstance();

echo "🔍 DIAGNÓSTICO DEL SISTEMA DE NOTIFICACIONES\n";
echo str_repeat("=", 60) . "\n\n";

// 1. Verificar estructura de la tabla
echo "1. Verificando estructura de la tabla 'notificaciones':\n";
try {
    $stmt = $db->query("DESCRIBE notificaciones");
    $columns = $stmt->fetchAll();
    
    echo "   ✅ Tabla 'notificaciones' existe\n";
    echo "   Columnas encontradas:\n";
    foreach ($columns as $col) {
        echo "      - {$col['Field']} ({$col['Type']})\n";
    }
    echo "\n";
} catch (Exception $e) {
    echo "   ❌ Error: " . $e->getMessage() . "\n\n";
    exit(1);
}

// 2. Verificar índices
echo "2. Verificando índices:\n";
try {
    $stmt = $db->query("SHOW INDEX FROM notificaciones");
    $indexes = $stmt->fetchAll();
    
    if (empty($indexes)) {
        echo "   ⚠️ No se encontraron índices. Se recomienda crear índices para mejor rendimiento.\n";
    } else {
        echo "   ✅ Índices encontrados:\n";
        $uniqueIndexes = [];
        foreach ($indexes as $idx) {
            $keyName = $idx['Key_name'];
            if (!in_array($keyName, $uniqueIndexes)) {
                $uniqueIndexes[] = $keyName;
                echo "      - {$keyName}\n";
            }
        }
    }
    echo "\n";
} catch (Exception $e) {
    echo "   ⚠️ No se pudieron verificar índices: " . $e->getMessage() . "\n\n";
}

// 3. Contar notificaciones por usuario
echo "3. Estadísticas de notificaciones:\n";
try {
    $stmt = $db->query("
        SELECT 
            id_usuario,
            COUNT(*) as total,
            SUM(CASE WHEN leida = 0 THEN 1 ELSE 0 END) as no_leidas,
            SUM(CASE WHEN leida = 1 THEN 1 ELSE 0 END) as leidas
        FROM notificaciones
        GROUP BY id_usuario
        ORDER BY total DESC
        LIMIT 10
    ");
    $stats = $stmt->fetchAll();
    
    if (empty($stats)) {
        echo "   ℹ️ No hay notificaciones en la base de datos\n";
    } else {
        echo "   Top 10 usuarios con más notificaciones:\n";
        foreach ($stats as $stat) {
            echo "      Usuario ID {$stat['id_usuario']}: Total={$stat['total']}, No leídas={$stat['no_leidas']}, Leídas={$stat['leidas']}\n";
        }
    }
    echo "\n";
} catch (Exception $e) {
    echo "   ❌ Error: " . $e->getMessage() . "\n\n";
}

// 4. Verificar notificaciones duplicadas o incorrectas
echo "4. Verificando problemas potenciales:\n";
try {
    // Notificaciones con usuarios inexistentes
    $stmt = $db->query("
        SELECT COUNT(*) as count
        FROM notificaciones n
        LEFT JOIN usuarios u ON n.id_usuario = u.id_usuario
        WHERE u.id_usuario IS NULL
    ");
    $orphan = $stmt->fetch();
    
    if ($orphan['count'] > 0) {
        echo "   ⚠️ Se encontraron {$orphan['count']} notificaciones con usuarios inexistentes\n";
    } else {
        echo "   ✅ Todas las notificaciones tienen usuarios válidos\n";
    }
    
    // Notificaciones sin id_usuario
    $stmt = $db->query("SELECT COUNT(*) as count FROM notificaciones WHERE id_usuario IS NULL OR id_usuario = 0");
    $nullUser = $stmt->fetch();
    
    if ($nullUser['count'] > 0) {
        echo "   ❌ Se encontraron {$nullUser['count']} notificaciones sin usuario asignado\n";
    } else {
        echo "   ✅ Todas las notificaciones tienen usuario asignado\n";
    }
    
    echo "\n";
} catch (Exception $e) {
    echo "   ❌ Error: " . $e->getMessage() . "\n\n";
}

// 5. Verificar últimas notificaciones creadas
echo "5. Últimas 5 notificaciones creadas:\n";
try {
    $stmt = $db->query("
        SELECT id_notificacion, id_usuario, id_ticket, mensaje, fecha_envio, leida
        FROM notificaciones
        ORDER BY fecha_envio DESC
        LIMIT 5
    ");
    $last = $stmt->fetchAll();
    
    if (empty($last)) {
        echo "   ℹ️ No hay notificaciones recientes\n";
    } else {
        foreach ($last as $notif) {
            $mensaje = substr($notif['mensaje'], 0, 50);
            $leida = $notif['leida'] ? 'Sí' : 'No';
            echo "      ID: {$notif['id_notificacion']}, Usuario: {$notif['id_usuario']}, Ticket: {$notif['id_ticket']}, Leída: {$leida}\n";
            echo "         Mensaje: {$mensaje}...\n";
            echo "         Fecha: {$notif['fecha_envio']}\n\n";
        }
    }
} catch (Exception $e) {
    echo "   ❌ Error: " . $e->getMessage() . "\n\n";
}

echo str_repeat("=", 60) . "\n";
echo "✅ Diagnóstico completado\n";

