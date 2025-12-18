<?php
/**
 * Script para verificar si la tabla de notificaciones funciona correctamente
 * 
 * Uso: 
 * - Desde navegador: http://tu-servidor/backend/verificar-notificaciones-tabla.php
 * - Desde línea de comandos: php verificar-notificaciones-tabla.php
 */

header('Content-Type: text/html; charset=utf-8');

// Cargar autoloader
require_once __DIR__ . '/vendor/autoload.php';

// Cargar variables de entorno (.env) - igual que index.php
$envPaths = [
    __DIR__,  // backend/
    __DIR__ . '/api',  // backend/api/
    dirname(__DIR__) . '/api',  // api/ (si está al mismo nivel que backend)
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
    // Intentar cargar desde __DIR__ como fallback
    try {
        $dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
        $dotenv->safeLoad();
    } catch (\Exception $e) {
        // Si no hay .env, continuar con valores por defecto
    }
}

use App\Config\Database;

?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verificación de Notificaciones</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 20px auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        h1 {
            color: #333;
            border-bottom: 3px solid #007bff;
            padding-bottom: 10px;
        }
        h2 {
            color: #555;
            margin-top: 30px;
        }
        .success {
            background-color: #d4edda;
            color: #155724;
            padding: 15px;
            border-radius: 4px;
            border: 1px solid #c3e6cb;
            margin: 10px 0;
        }
        .error {
            background-color: #f8d7da;
            color: #721c24;
            padding: 15px;
            border-radius: 4px;
            border: 1px solid #f5c6cb;
            margin: 10px 0;
        }
        .warning {
            background-color: #fff3cd;
            color: #856404;
            padding: 15px;
            border-radius: 4px;
            border: 1px solid #ffeaa7;
            margin: 10px 0;
        }
        .info {
            background-color: #d1ecf1;
            color: #0c5460;
            padding: 15px;
            border-radius: 4px;
            border: 1px solid #bee5eb;
            margin: 10px 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        th {
            background-color: #007bff;
            color: white;
        }
        tr:nth-child(even) {
            background-color: #f2f2f2;
        }
        .btn {
            display: inline-block;
            padding: 10px 20px;
            background-color: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            margin: 10px 5px;
            border: none;
            cursor: pointer;
            font-size: 14px;
        }
        .btn:hover {
            background-color: #0056b3;
        }
        .btn-success {
            background-color: #28a745;
        }
        .btn-success:hover {
            background-color: #218838;
        }
        code {
            background-color: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }
        pre {
            background-color: #f4f4f4;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 Verificación de Tabla de Notificaciones</h1>
        
        <?php
        $errores = [];
        $exitos = [];
        
        try {
            $db = Database::getInstance();
            
            // 1. Verificar conexión a la base de datos
            echo '<h2>1. Conexión a la Base de Datos</h2>';
            try {
                $conn = $db->getConnection();
                echo '<div class="success">✅ Conexión a la base de datos exitosa</div>';
                $exitos[] = 'Conexión a BD';
            } catch (\Exception $e) {
                echo '<div class="error">❌ Error conectando a la base de datos: ' . htmlspecialchars($e->getMessage()) . '</div>';
                $errores[] = 'Conexión a BD';
                throw $e;
            }
            
            // 2. Verificar que la tabla existe
            echo '<h2>2. Verificación de Tabla</h2>';
            $tablaEncontrada = false;
            $nombreTablaFinal = null;
            $nombresTabla = ['notificaciones', 'Notificaciones', 'NOTIFICACIONES'];
            
            foreach ($nombresTabla as $nombreTabla) {
                try {
                    $stmt = $db->query("SHOW TABLES LIKE '$nombreTabla'");
                    $result = $stmt->fetch();
                    if ($result) {
                        $tablaEncontrada = true;
                        $nombreTablaFinal = $nombreTabla;
                        echo '<div class="success">✅ Tabla encontrada: <code>' . htmlspecialchars($nombreTabla) . '</code></div>';
                        $exitos[] = "Tabla $nombreTabla existe";
                        break;
                    }
                } catch (\Exception $e) {
                    continue;
                }
            }
            
            if (!$tablaEncontrada) {
                echo '<div class="error">❌ No se encontró ninguna tabla de notificaciones</div>';
                echo '<div class="warning">⚠️ Se intentaron los siguientes nombres: ' . implode(', ', $nombresTabla) . '</div>';
                $errores[] = 'Tabla no encontrada';
            } else {
                // 3. Verificar estructura de la tabla
                echo '<h2>3. Estructura de la Tabla</h2>';
                try {
                    $stmt = $db->query("DESCRIBE `$nombreTablaFinal`");
                    $columnas = $stmt->fetchAll();
                    
                    echo '<table>';
                    echo '<tr><th>Campo</th><th>Tipo</th><th>Nulo</th><th>Clave</th><th>Por Defecto</th></tr>';
                    foreach ($columnas as $col) {
                        echo '<tr>';
                        echo '<td><strong>' . htmlspecialchars($col['Field']) . '</strong></td>';
                        echo '<td>' . htmlspecialchars($col['Type']) . '</td>';
                        echo '<td>' . htmlspecialchars($col['Null']) . '</td>';
                        echo '<td>' . htmlspecialchars($col['Key']) . '</td>';
                        echo '<td>' . htmlspecialchars($col['Default'] ?? 'NULL') . '</td>';
                        echo '</tr>';
                    }
                    echo '</table>';
                    
                    // Verificar campos requeridos
                    $camposRequeridos = ['id_notificacion', 'id_usuario', 'mensaje', 'fecha_envio', 'leida'];
                    $camposEncontrados = array_column($columnas, 'Field');
                    $camposFaltantes = array_diff($camposRequeridos, $camposEncontrados);
                    
                    if (empty($camposFaltantes)) {
                        echo '<div class="success">✅ Todos los campos requeridos están presentes</div>';
                        $exitos[] = 'Estructura de tabla correcta';
                    } else {
                        echo '<div class="error">❌ Faltan campos requeridos: ' . implode(', ', $camposFaltantes) . '</div>';
                        $errores[] = 'Campos faltantes: ' . implode(', ', $camposFaltantes);
                    }
                } catch (\Exception $e) {
                    echo '<div class="error">❌ Error obteniendo estructura: ' . htmlspecialchars($e->getMessage()) . '</div>';
                    $errores[] = 'Error en estructura';
                }
                
                // 4. Estadísticas de notificaciones
                echo '<h2>4. Estadísticas de Notificaciones</h2>';
                try {
                    // Total de notificaciones
                    $stmt = $db->query("SELECT COUNT(*) as total FROM `$nombreTablaFinal`");
                    $total = $stmt->fetch()['total'];
                    
                    // Notificaciones no leídas
                    $stmt = $db->query("SELECT COUNT(*) as total FROM `$nombreTablaFinal` WHERE leida = 0");
                    $noLeidas = $stmt->fetch()['total'];
                    
                    // Notificaciones por usuario
                    $stmt = $db->query("SELECT COUNT(DISTINCT id_usuario) as total FROM `$nombreTablaFinal`");
                    $usuariosConNotificaciones = $stmt->fetch()['total'];
                    
                    echo '<div class="info">';
                    echo '<strong>📊 Estadísticas:</strong><br>';
                    echo 'Total de notificaciones: <strong>' . $total . '</strong><br>';
                    echo 'Notificaciones no leídas: <strong>' . $noLeidas . '</strong><br>';
                    echo 'Usuarios con notificaciones: <strong>' . $usuariosConNotificaciones . '</strong>';
                    echo '</div>';
                    
                    $exitos[] = 'Estadísticas obtenidas';
                } catch (\Exception $e) {
                    echo '<div class="error">❌ Error obteniendo estadísticas: ' . htmlspecialchars($e->getMessage()) . '</div>';
                    $errores[] = 'Error en estadísticas';
                }
                
                // 5. Probar inserción de notificación (si se proporciona usuario)
                echo '<h2>5. Prueba de Inserción</h2>';
                $testUsuarioId = $_GET['test_user_id'] ?? null;
                
                if ($testUsuarioId) {
                    try {
                        // Intentar obtener un ticket válido del usuario para la prueba
                        $ticketId = null;
                        try {
                            $stmt = $db->query(
                                "SELECT id_ticket FROM tickets WHERE id_usuario = ? ORDER BY id_ticket DESC LIMIT 1",
                                [$testUsuarioId]
                            );
                            $ticket = $stmt->fetch();
                            if ($ticket && isset($ticket['id_ticket'])) {
                                $ticketId = $ticket['id_ticket'];
                            }
                        } catch (\Exception $e) {
                            // Si no hay tickets, intentar con cualquier ticket
                            try {
                                $stmt = $db->query("SELECT id_ticket FROM tickets ORDER BY id_ticket DESC LIMIT 1");
                                $ticket = $stmt->fetch();
                                if ($ticket && isset($ticket['id_ticket'])) {
                                    $ticketId = $ticket['id_ticket'];
                                }
                            } catch (\Exception $e2) {
                                // No hay tickets en la BD
                            }
                        }
                        
                        // Si no hay tickets, crear uno de prueba temporal
                        if (!$ticketId) {
                            try {
                                // Insertar un ticket temporal para la prueba
                                $db->query(
                                    "INSERT INTO tickets (id_usuario, descripcion, estatus, fecha_creacion) VALUES (?, 'Ticket de prueba temporal', 'Pendiente', NOW())",
                                    [$testUsuarioId]
                                );
                                $ticketId = $db->getConnection()->lastInsertId();
                            } catch (\Exception $e) {
                                // Si no se puede crear ticket, usar 0 o intentar sin id_ticket
                                $ticketId = 0;
                            }
                        }
                        
                        $mensajePrueba = "Notificación de prueba creada el " . date('Y-m-d H:i:s');
                        
                        // Intentar inserción con id_ticket
                        try {
                            $sql = "INSERT INTO `$nombreTablaFinal` (id_usuario, mensaje, tipo, id_ticket, fecha_envio, leida) VALUES (?, ?, ?, ?, NOW(), 0)";
                            $db->query($sql, [$testUsuarioId, $mensajePrueba, 'Interna', $ticketId]);
                            $idInsertado = $db->getConnection()->lastInsertId();
                            
                            echo '<div class="success">✅ Notificación de prueba insertada exitosamente (ID: ' . $idInsertado . ', Ticket: ' . $ticketId . ')</div>';
                            $exitos[] = 'Inserción exitosa';
                            
                            // Eliminar la notificación de prueba
                            $db->query("DELETE FROM `$nombreTablaFinal` WHERE id_notificacion = ?", [$idInsertado]);
                            echo '<div class="info">ℹ️ Notificación de prueba eliminada automáticamente</div>';
                            
                            // Si creamos un ticket temporal, eliminarlo también
                            if (isset($ticketTemporal) && $ticketTemporal) {
                                try {
                                    $db->query("DELETE FROM tickets WHERE id_ticket = ?", [$ticketId]);
                                } catch (\Exception $e) {
                                    // Ignorar error al eliminar ticket temporal
                                }
                            }
                        } catch (\Exception $e) {
                            // Si falla con id_ticket, verificar si permite NULL
                            if (strpos($e->getMessage(), 'cannot be null') !== false || strpos($e->getMessage(), '1048') !== false) {
                                echo '<div class="error">❌ Error: La columna id_ticket no permite valores NULL</div>';
                                echo '<div class="info">ℹ️ Se intentó usar el ticket ID: ' . $ticketId . '</div>';
                                echo '<div class="warning">⚠️ Para que la prueba funcione, necesitas tener al menos un ticket creado en el sistema</div>';
                            } else {
                                echo '<div class="error">❌ Error insertando notificación de prueba: ' . htmlspecialchars($e->getMessage()) . '</div>';
                            }
                            $errores[] = 'Error en inserción';
                        }
                    } catch (\Exception $e) {
                        echo '<div class="error">❌ Error en la prueba de inserción: ' . htmlspecialchars($e->getMessage()) . '</div>';
                        $errores[] = 'Error en inserción';
                    }
                } else {
                    echo '<div class="warning">⚠️ Para probar la inserción, agrega <code>?test_user_id=ID_USUARIO</code> a la URL</div>';
                    echo '<div class="info">Ejemplo: <code>verificar-notificaciones-tabla.php?test_user_id=6</code></div>';
                }
                
                // 6. Mostrar últimas notificaciones
                echo '<h2>6. Últimas 10 Notificaciones</h2>';
                try {
                    $stmt = $db->query(
                        "SELECT id_notificacion, id_usuario, id_ticket, mensaje, tipo, fecha_envio, leida 
                         FROM `$nombreTablaFinal` 
                         ORDER BY fecha_envio DESC 
                         LIMIT 10"
                    );
                    $notificaciones = $stmt->fetchAll();
                    
                    if (empty($notificaciones)) {
                        echo '<div class="warning">⚠️ No hay notificaciones en la tabla</div>';
                    } else {
                        echo '<table>';
                        echo '<tr>';
                        echo '<th>ID</th><th>Usuario</th><th>Ticket</th><th>Mensaje</th><th>Tipo</th><th>Fecha</th><th>Leída</th>';
                        echo '</tr>';
                        foreach ($notificaciones as $notif) {
                            echo '<tr>';
                            echo '<td>' . htmlspecialchars($notif['id_notificacion']) . '</td>';
                            echo '<td>' . htmlspecialchars($notif['id_usuario']) . '</td>';
                            echo '<td>' . htmlspecialchars($notif['id_ticket'] ?? 'N/A') . '</td>';
                            echo '<td>' . htmlspecialchars(substr($notif['mensaje'], 0, 50)) . (strlen($notif['mensaje']) > 50 ? '...' : '') . '</td>';
                            echo '<td>' . htmlspecialchars($notif['tipo']) . '</td>';
                            echo '<td>' . htmlspecialchars($notif['fecha_envio']) . '</td>';
                            echo '<td>' . ($notif['leida'] ? '✅' : '❌') . '</td>';
                            echo '</tr>';
                        }
                        echo '</table>';
                        $exitos[] = 'Lectura de notificaciones exitosa';
                    }
                } catch (\Exception $e) {
                    echo '<div class="error">❌ Error leyendo notificaciones: ' . htmlspecialchars($e->getMessage()) . '</div>';
                    $errores[] = 'Error en lectura';
                }
                
                // 7. Verificar tickets recientes y sus notificaciones
                echo '<h2>7. Tickets Recientes y Sus Notificaciones</h2>';
                try {
                    $stmt = $db->query(
                        "SELECT id_ticket, id_usuario, descripcion, estatus, fecha_creacion 
                         FROM tickets 
                         ORDER BY fecha_creacion DESC 
                         LIMIT 5"
                    );
                    $tickets = $stmt->fetchAll();
                    
                    if (empty($tickets)) {
                        echo '<div class="warning">⚠️ No hay tickets en el sistema</div>';
                    } else {
                        echo '<table>';
                        echo '<tr><th>Ticket ID</th><th>Usuario ID</th><th>Estado</th><th>Fecha Creación</th><th>Notificaciones</th></tr>';
                        foreach ($tickets as $ticket) {
                            // Contar notificaciones para este ticket
                            $stmtNotif = $db->query(
                                "SELECT COUNT(*) as total FROM `$nombreTablaFinal` WHERE id_ticket = ?",
                                [$ticket['id_ticket']]
                            );
                            $notifCount = $stmtNotif->fetch()['total'];
                            
                            echo '<tr>';
                            echo '<td><strong>' . htmlspecialchars($ticket['id_ticket']) . '</strong></td>';
                            echo '<td>' . htmlspecialchars($ticket['id_usuario']) . '</td>';
                            echo '<td>' . htmlspecialchars($ticket['estatus']) . '</td>';
                            echo '<td>' . htmlspecialchars($ticket['fecha_creacion']) . '</td>';
                            if ($notifCount > 0) {
                                echo '<td><span style="color: green;">✅ ' . $notifCount . ' notificación(es)</span></td>';
                            } else {
                                echo '<td><span style="color: red;">❌ Sin notificaciones</span></td>';
                            }
                            echo '</tr>';
                        }
                        echo '</table>';
                        echo '<div class="info">ℹ️ Esta tabla muestra los últimos 5 tickets y si tienen notificaciones asociadas. Si un ticket no tiene notificaciones, significa que no se están creando automáticamente.</div>';
                    }
                } catch (\Exception $e) {
                    echo '<div class="error">❌ Error obteniendo tickets: ' . htmlspecialchars($e->getMessage()) . '</div>';
                }
                
                // 8. Listar usuarios disponibles para prueba
                echo '<h2>8. Usuarios Disponibles para Prueba</h2>';
                try {
                    $stmt = $db->query("SELECT id_usuario, nombre, correo FROM usuarios LIMIT 10");
                    $usuarios = $stmt->fetchAll();
                    
                    if (empty($usuarios)) {
                        echo '<div class="warning">⚠️ No hay usuarios en la base de datos</div>';
                    } else {
                        echo '<table>';
                        echo '<tr><th>ID</th><th>Nombre</th><th>Correo</th><th>Probar</th></tr>';
                        foreach ($usuarios as $usuario) {
                            echo '<tr>';
                            echo '<td>' . htmlspecialchars($usuario['id_usuario']) . '</td>';
                            echo '<td>' . htmlspecialchars($usuario['nombre']) . '</td>';
                            echo '<td>' . htmlspecialchars($usuario['correo']) . '</td>';
                            echo '<td><a href="?test_user_id=' . $usuario['id_usuario'] . '" class="btn btn-success">Probar</a></td>';
                            echo '</tr>';
                        }
                        echo '</table>';
                    }
                } catch (\Exception $e) {
                    echo '<div class="error">❌ Error obteniendo usuarios: ' . htmlspecialchars($e->getMessage()) . '</div>';
                }
            }
            
        } catch (\Exception $e) {
            echo '<div class="error">❌ Error fatal: ' . htmlspecialchars($e->getMessage()) . '</div>';
            echo '<pre>' . htmlspecialchars($e->getTraceAsString()) . '</pre>';
            $errores[] = 'Error fatal';
        }
        
        // Resumen final
        echo '<h2>📋 Resumen</h2>';
        if (empty($errores)) {
            echo '<div class="success">';
            echo '<strong>✅ Todos los chequeos pasaron exitosamente</strong><br>';
            echo 'La tabla de notificaciones está funcionando correctamente.';
            echo '</div>';
        } else {
            echo '<div class="error">';
            echo '<strong>❌ Se encontraron ' . count($errores) . ' error(es):</strong><br>';
            echo '<ul>';
            foreach ($errores as $error) {
                echo '<li>' . htmlspecialchars($error) . '</li>';
            }
            echo '</ul>';
            echo '</div>';
        }
        
        if (!empty($exitos)) {
            echo '<div class="info">';
            echo '<strong>✅ Operaciones exitosas:</strong><br>';
            echo '<ul>';
            foreach ($exitos as $exito) {
                echo '<li>' . htmlspecialchars($exito) . '</li>';
            }
            echo '</ul>';
            echo '</div>';
        }
        ?>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #ddd;">
            <a href="verificar-notificaciones-tabla.php" class="btn">🔄 Recargar Verificación</a>
        </div>
    </div>
</body>
</html>

