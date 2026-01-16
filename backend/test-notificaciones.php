<?php
/**
 * Script de diagnóstico y prueba de notificaciones
 * Este script verifica que las notificaciones se creen correctamente
 */

require_once __DIR__ . '/vendor/autoload.php';
use App\Config\Database;

// Load environment variables
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->safeLoad();

// Set error reporting
error_reporting(E_ALL);
ini_set('display_errors', '1');

echo "<h1>Diagnóstico y Prueba de Notificaciones</h1>";

try {
    $db = Database::getInstance();
    echo "<h2>1. Conexión a la Base de Datos</h2>";
    echo "<p>✅ Conexión exitosa a la base de datos.</p>";

    echo "<h2>2. Verificar Estructura de la Tabla `notificaciones`</h2>";
    $stmt = $db->query("DESCRIBE notificaciones");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "<table border='1' cellpadding='5'>";
    echo "<tr><th>Campo</th><th>Tipo</th><th>Null</th><th>Key</th><th>Default</th></tr>";
    foreach ($columns as $col) {
        echo "<tr>";
        echo "<td>{$col['Field']}</td>";
        echo "<td>{$col['Type']}</td>";
        echo "<td>{$col['Null']}</td>";
        echo "<td>{$col['Key']}</td>";
        echo "<td>{$col['Default']}</td>";
        echo "</tr>";
    }
    echo "</table>";

    // Verificar si id_ticket es nullable
    $idTicketNullable = false;
    foreach ($columns as $col) {
        if ($col['Field'] === 'id_ticket' && $col['Null'] === 'YES') {
            $idTicketNullable = true;
            break;
        }
    }
    
    if ($idTicketNullable) {
        echo "<p>✅ La columna `id_ticket` es NULLABLE.</p>";
    } else {
        echo "<p style='color: orange;'>⚠️ La columna `id_ticket` es NOT NULL. Las notificaciones deben tener siempre un ticket asociado.</p>";
    }

    echo "<h2>3. Contar Notificaciones Existentes</h2>";
    $stmt = $db->query("SELECT COUNT(*) as total FROM notificaciones");
    $total = $stmt->fetch()['total'];
    echo "<p>Total de notificaciones en la BD: <strong>$total</strong></p>";

    echo "<h2>4. Últimas 10 Notificaciones Creadas</h2>";
    $stmt = $db->query("SELECT id_notificacion, id_usuario, id_ticket, mensaje, tipo, fecha_envio, leida FROM notificaciones ORDER BY fecha_envio DESC LIMIT 10");
    $recentNotifications = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($recentNotifications)) {
        echo "<p style='color: orange;'>⚠️ No hay notificaciones en la base de datos.</p>";
    } else {
        echo "<table border='1' cellpadding='5'>";
        echo "<tr><th>ID</th><th>Usuario</th><th>Ticket</th><th>Mensaje</th><th>Tipo</th><th>Fecha</th><th>Leída</th></tr>";
        foreach ($recentNotifications as $notif) {
            $leida = $notif['leida'] ? 'Sí' : 'No';
            echo "<tr>";
            echo "<td>{$notif['id_notificacion']}</td>";
            echo "<td>{$notif['id_usuario']}</td>";
            echo "<td>" . ($notif['id_ticket'] ?? 'NULL') . "</td>";
            echo "<td>" . htmlspecialchars(substr($notif['mensaje'], 0, 50)) . "...</td>";
            echo "<td>{$notif['tipo']}</td>";
            echo "<td>{$notif['fecha_envio']}</td>";
            echo "<td>$leida</td>";
            echo "</tr>";
        }
        echo "</table>";
    }

    echo "<h2>5. Usuarios de Prueba</h2>";
    $stmt = $db->query("SELECT id_usuario, nombre, correo, rol FROM usuarios WHERE rol IN ('empleado', 'tecnico', 'administrador') LIMIT 10");
    $testUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($testUsers)) {
        echo "<p style='color: red;'>❌ No hay usuarios de prueba en la base de datos.</p>";
    } else {
        echo "<table border='1' cellpadding='5'>";
        echo "<tr><th>ID</th><th>Nombre</th><th>Email</th><th>Rol</th></tr>";
        foreach ($testUsers as $user) {
            echo "<tr>";
            echo "<td>{$user['id_usuario']}</td>";
            echo "<td>{$user['nombre']}</td>";
            echo "<td>{$user['correo']}</td>";
            echo "<td>{$user['rol']}</td>";
            echo "</tr>";
        }
        echo "</table>";
    }

    echo "<h2>6. Tickets Recientes</h2>";
    $stmt = $db->query("SELECT id_ticket, id_usuario, id_tecnico, estatus, fecha_creacion FROM tickets ORDER BY fecha_creacion DESC LIMIT 5");
    $recentTickets = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($recentTickets)) {
        echo "<p style='color: orange;'>⚠️ No hay tickets en la base de datos.</p>";
    } else {
        echo "<table border='1' cellpadding='5'>";
        echo "<tr><th>ID Ticket</th><th>Empleado</th><th>Técnico</th><th>Estado</th><th>Fecha</th></tr>";
        foreach ($recentTickets as $ticket) {
            echo "<tr>";
            echo "<td>{$ticket['id_ticket']}</td>";
            echo "<td>{$ticket['id_usuario']}</td>";
            echo "<td>" . ($ticket['id_tecnico'] ?? 'NULL') . "</td>";
            echo "<td>{$ticket['estatus']}</td>";
            echo "<td>{$ticket['fecha_creacion']}</td>";
            echo "</tr>";
        }
        echo "</table>";
    }

    echo "<h2>7. Prueba de Creación de Notificación</h2>";
    $testUserId = $testUsers[0]['id_usuario'] ?? null;
    $testTicketId = $recentTickets[0]['id_ticket'] ?? null;
    
    if ($testUserId && $testTicketId) {
        echo "<p>Intentando crear una notificación de prueba...</p>";
        echo "<ul>";
        echo "<li>Usuario ID: $testUserId</li>";
        echo "<li>Ticket ID: $testTicketId</li>";
        echo "</ul>";
        
        try {
            $mensaje = "Mensaje de prueba de diagnóstico - " . date('Y-m-d H:i:s');
            $stmt = $db->query(
                'INSERT INTO notificaciones (id_usuario, mensaje, tipo, id_ticket, fecha_envio, leida) VALUES (?, ?, ?, ?, NOW(), 0)',
                [$testUserId, $mensaje, 'Interna', $testTicketId]
            );
            
            $newId = $db->lastInsertId();
            echo "<p style='color: green;'>✅ Notificación de prueba creada exitosamente! ID: $newId</p>";
            
            // Verificar que se creó
            $stmt = $db->query("SELECT * FROM notificaciones WHERE id_notificacion = ?", [$newId]);
            $createdNotif = $stmt->fetch();
            if ($createdNotif) {
                echo "<p>✅ Notificación verificada en la BD:</p>";
                echo "<ul>";
                echo "<li>ID: {$createdNotif['id_notificacion']}</li>";
                echo "<li>Usuario: {$createdNotif['id_usuario']}</li>";
                echo "<li>Ticket: {$createdNotif['id_ticket']}</li>";
                echo "<li>Mensaje: " . htmlspecialchars($createdNotif['mensaje']) . "</li>";
                echo "</ul>";
            }
            
        } catch (\Exception $e) {
            echo "<p style='color: red;'>❌ Error creando notificación de prueba: " . htmlspecialchars($e->getMessage()) . "</p>";
            echo "<pre>" . htmlspecialchars($e->getTraceAsString()) . "</pre>";
        }
    } else {
        echo "<p style='color: orange;'>⚠️ No se puede realizar la prueba: faltan usuarios o tickets en la BD.</p>";
    }

    echo "<h2>8. Verificar Notificaciones por Usuario</h2>";
    if ($testUserId) {
        $stmt = $db->query(
            'SELECT id_notificacion, id_ticket, mensaje, fecha_envio, leida 
             FROM notificaciones 
             WHERE id_usuario = ? 
             ORDER BY fecha_envio DESC 
             LIMIT 5',
            [$testUserId]
        );
        $userNotifications = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (empty($userNotifications)) {
            echo "<p style='color: orange;'>⚠️ No se encontraron notificaciones para el usuario ID: $testUserId</p>";
        } else {
            echo "<p>Notificaciones para usuario ID: $testUserId</p>";
            echo "<table border='1' cellpadding='5'>";
            echo "<tr><th>ID</th><th>Ticket</th><th>Mensaje</th><th>Fecha</th><th>Leída</th></tr>";
            foreach ($userNotifications as $notif) {
                $leida = $notif['leida'] ? 'Sí' : 'No';
                echo "<tr>";
                echo "<td>{$notif['id_notificacion']}</td>";
                echo "<td>" . ($notif['id_ticket'] ?? 'NULL') . "</td>";
                echo "<td>" . htmlspecialchars(substr($notif['mensaje'], 0, 60)) . "...</td>";
                echo "<td>{$notif['fecha_envio']}</td>";
                echo "<td>$leida</td>";
                echo "</tr>";
            }
            echo "</table>";
        }
    }

    echo "<h2>9. Verificar Logs de Error (últimas 20 líneas de error_log)</h2>";
    $errorLogPath = ini_get('error_log');
    if ($errorLogPath && file_exists($errorLogPath)) {
        $lines = file($errorLogPath);
        $recentLines = array_slice($lines, -20);
        echo "<pre style='background: #f0f0f0; padding: 10px; max-height: 400px; overflow-y: auto;'>";
        echo htmlspecialchars(implode('', $recentLines));
        echo "</pre>";
    } else {
        echo "<p>⚠️ No se encontró el archivo de log de errores o no está configurado.</p>";
        echo "<p>Ruta configurada: " . ($errorLogPath ?: 'No configurada') . "</p>";
    }

    echo "<h2>10. Recomendaciones</h2>";
    echo "<ul>";
    if (!$idTicketNullable) {
        echo "<li>⚠️ Si necesitas crear notificaciones sin ticket, considera hacer `id_ticket` NULLABLE en la BD.</li>";
    }
    if ($total == 0) {
        echo "<li>⚠️ No hay notificaciones en la BD. Verifica que el código de creación de notificaciones se esté ejecutando.</li>";
    }
    echo "<li>✅ Verifica los logs de error del servidor para ver mensajes de creación de notificaciones.</li>";
    echo "<li>✅ Asegúrate de que los cambios en TicketRoutes.php estén desplegados en el servidor.</li>";
    echo "</ul>";

} catch (\Exception $e) {
    echo "<h2 style='color: red;'>❌ Error en el diagnóstico:</h2>";
    echo "<p style='color: red;'>" . htmlspecialchars($e->getMessage()) . "</p>";
    echo "<pre style='color: red;'>" . htmlspecialchars($e->getTraceAsString()) . "</pre>";
}
?>

