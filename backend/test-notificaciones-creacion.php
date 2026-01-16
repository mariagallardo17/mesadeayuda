<?php
/**
 * Script de prueba para verificar si las notificaciones se están creando correctamente
 * 
 * Uso: php test-notificaciones-creacion.php
 */

require_once __DIR__ . '/vendor/autoload.php';

use App\Config\Database;

echo "🔍 TEST: Verificando creación de notificaciones\n";
echo "================================================\n\n";

try {
    $db = Database::getInstance();
    
    // 1. Verificar que la tabla existe
    echo "1. Verificando tabla de notificaciones...\n";
    try {
        $stmt = $db->query("SHOW TABLES LIKE 'notificaciones'");
        $result = $stmt->fetch();
        if ($result) {
            echo "   ✅ Tabla 'notificaciones' existe\n";
        } else {
            echo "   ❌ Tabla 'notificaciones' NO existe\n";
            exit(1);
        }
    } catch (\Exception $e) {
        echo "   ❌ Error verificando tabla: " . $e->getMessage() . "\n";
        exit(1);
    }
    
    // 2. Verificar estructura de la tabla
    echo "\n2. Verificando estructura de la tabla...\n";
    try {
        $stmt = $db->query("DESCRIBE notificaciones");
        $columns = $stmt->fetchAll();
        echo "   Columnas encontradas:\n";
        foreach ($columns as $col) {
            echo "   - {$col['Field']} ({$col['Type']})\n";
        }
    } catch (\Exception $e) {
        echo "   ❌ Error obteniendo estructura: " . $e->getMessage() . "\n";
    }
    
    // 3. Obtener un usuario de prueba
    echo "\n3. Obteniendo usuarios de prueba...\n";
    try {
        $stmt = $db->query("SELECT id_usuario, nombre, correo FROM usuarios LIMIT 5");
        $users = $stmt->fetchAll();
        if (empty($users)) {
            echo "   ❌ No hay usuarios en la base de datos\n";
            exit(1);
        }
        echo "   Usuarios encontrados:\n";
        foreach ($users as $user) {
            echo "   - ID: {$user['id_usuario']}, Nombre: {$user['nombre']}, Correo: {$user['correo']}\n";
        }
        $testUserId = (int)$users[0]['id_usuario'];
        echo "\n   Usando usuario de prueba: ID $testUserId\n";
    } catch (\Exception $e) {
        echo "   ❌ Error obteniendo usuarios: " . $e->getMessage() . "\n";
        exit(1);
    }
    
    // 4. Obtener un ticket de prueba
    echo "\n4. Obteniendo ticket de prueba...\n";
    try {
        $stmt = $db->query("SELECT id_ticket, id_usuario FROM tickets ORDER BY id_ticket DESC LIMIT 1");
        $ticket = $stmt->fetch();
        if (!$ticket) {
            echo "   ⚠️ No hay tickets en la base de datos\n";
            echo "   Creando ticket de prueba...\n";
            // Crear un ticket de prueba
            $db->query(
                "INSERT INTO tickets (id_usuario, id_servicio, descripcion, prioridad, estatus, fecha_creacion) 
                 VALUES (?, 1, 'Ticket de prueba', 'Media', 'Pendiente', NOW())",
                [$testUserId]
            );
            $testTicketId = $db->getConnection()->lastInsertId();
            echo "   ✅ Ticket de prueba creado: ID $testTicketId\n";
        } else {
            $testTicketId = (int)$ticket['id_ticket'];
            echo "   ✅ Ticket encontrado: ID $testTicketId\n";
        }
    } catch (\Exception $e) {
        echo "   ❌ Error obteniendo/creando ticket: " . $e->getMessage() . "\n";
        exit(1);
    }
    
    // 5. Crear una notificación de prueba usando el mismo método que el código
    echo "\n5. Creando notificación de prueba...\n";
    try {
        $mensaje = "Notificación de prueba creada el " . date('Y-m-d H:i:s');
        $sql = 'INSERT INTO notificaciones (id_usuario, mensaje, tipo, id_ticket, fecha_envio, leida) VALUES (?, ?, ?, ?, NOW(), 0)';
        $db->query($sql, [$testUserId, $mensaje, 'Interna', $testTicketId]);
        $notificationId = $db->getConnection()->lastInsertId();
        echo "   ✅ Notificación creada exitosamente: ID $notificationId\n";
        echo "   - Usuario: $testUserId\n";
        echo "   - Ticket: $testTicketId\n";
        echo "   - Mensaje: $mensaje\n";
    } catch (\Exception $e) {
        echo "   ❌ Error creando notificación: " . $e->getMessage() . "\n";
        echo "   Stack trace: " . $e->getTraceAsString() . "\n";
        exit(1);
    }
    
    // 6. Verificar que la notificación se puede leer
    echo "\n6. Verificando que la notificación se puede leer...\n";
    try {
        $stmt = $db->query(
            "SELECT id_notificacion, id_usuario, id_ticket, mensaje, fecha_envio, leida 
             FROM notificaciones 
             WHERE id_notificacion = ?",
            [$notificationId]
        );
        $notification = $stmt->fetch();
        if ($notification) {
            echo "   ✅ Notificación encontrada:\n";
            echo "   - ID: {$notification['id_notificacion']}\n";
            echo "   - Usuario: {$notification['id_usuario']}\n";
            echo "   - Ticket: {$notification['id_ticket']}\n";
            echo "   - Mensaje: {$notification['mensaje']}\n";
            echo "   - Fecha: {$notification['fecha_envio']}\n";
            echo "   - Leída: {$notification['leida']}\n";
        } else {
            echo "   ❌ No se pudo encontrar la notificación creada\n";
        }
    } catch (\Exception $e) {
        echo "   ❌ Error leyendo notificación: " . $e->getMessage() . "\n";
    }
    
    // 7. Contar notificaciones del usuario
    echo "\n7. Contando notificaciones del usuario $testUserId...\n";
    try {
        $stmt = $db->query(
            "SELECT COUNT(*) as total FROM notificaciones WHERE id_usuario = ?",
            [$testUserId]
        );
        $result = $stmt->fetch();
        echo "   ✅ Total de notificaciones para el usuario: {$result['total']}\n";
    } catch (\Exception $e) {
        echo "   ❌ Error contando notificaciones: " . $e->getMessage() . "\n";
    }
    
    echo "\n================================================\n";
    echo "✅ TEST COMPLETADO\n";
    echo "Si todos los pasos fueron exitosos, el backend está funcionando correctamente.\n";
    echo "Si las notificaciones no aparecen en el frontend, el problema está ahí.\n";
    
} catch (\Exception $e) {
    echo "\n❌ ERROR FATAL: " . $e->getMessage() . "\n";
    echo "Stack trace: " . $e->getTraceAsString() . "\n";
    exit(1);
}

