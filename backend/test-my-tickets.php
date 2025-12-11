<?php
/**
 * Script de prueba para verificar el endpoint getMyTickets
 * Uso: php test-my-tickets.php
 */

require_once __DIR__ . '/vendor/autoload.php';

// Cargar variables de entorno
$envFile = __DIR__ . '/api/.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            // Remover comillas si existen
            $value = trim($value, '"\'');
            $_ENV[$key] = $value;
        }
    }
}

use App\Config\Database;
use App\Routes\TicketRoutes;
use App\Middleware\AuthMiddleware;

// Simular autenticación (necesitarás un token válido)
echo "=== Test getMyTickets ===\n\n";

// Necesitas proporcionar un token JWT válido aquí
$token = $argv[1] ?? '';

if (empty($token)) {
    echo "ERROR: Necesitas proporcionar un token JWT como argumento\n";
    echo "Uso: php test-my-tickets.php <JWT_TOKEN>\n";
    echo "\nPara obtener un token, inicia sesión en el frontend y copia el token del localStorage\n";
    exit(1);
}

// Simular header Authorization
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $token;

try {
    // Intentar autenticar
    $user = AuthMiddleware::authenticate();
    echo "✓ Usuario autenticado: {$user['id_usuario']} ({$user['rol']})\n\n";
    
    // Crear instancia de TicketRoutes
    $router = new class {
        public function addRoute($method, $path, $handler) {}
    };
    
    $ticketRoutes = new TicketRoutes($router);
    
    // Llamar al método directamente (esto no funcionará porque usa AuthMiddleware::sendResponse que hace exit)
    // En su lugar, vamos a hacer la consulta directamente
    
    $db = Database::getInstance();
    
    if ($user['rol'] === 'tecnico' || $user['rol'] === 'administrador') {
        $stmt = $db->query(
            'SELECT 
                t.id_ticket as id, 
                s.categoria, 
                s.subcategoria, 
                t.descripcion, 
                s.tiempo_objetivo as tiempo_estimado,
                s.tiempo_maximo,
                t.estatus as estado, 
                t.prioridad,
                t.fecha_creacion,
                t.fecha_asignacion,
                u.nombre as usuario_nombre,
                u.correo as usuario_correo,
                u.departamento as usuario_departamento,
                t.id_tecnico as tecnico_id
             FROM tickets t
             JOIN servicios s ON t.id_servicio = s.id_servicio
             JOIN usuarios u ON t.id_usuario = u.id_usuario
             WHERE t.id_tecnico = ? AND t.estatus != "Escalado"
             ORDER BY t.fecha_creacion DESC
             LIMIT 5',
            [$user['id_usuario']]
        );
    } else {
        $stmt = $db->query(
            'SELECT 
                t.id_ticket as id, 
                s.categoria, 
                s.subcategoria, 
                t.descripcion, 
                s.tiempo_objetivo as tiempo_estimado,
                s.tiempo_maximo,
                t.estatus as estado, 
                t.prioridad,
                t.fecha_creacion,
                u_creador.nombre as usuario_nombre,
                u_creador.correo as usuario_correo,
                u_creador.departamento as usuario_departamento,
                u.nombre as tecnico_nombre,
                u.correo as tecnico_correo
             FROM tickets t
             JOIN servicios s ON t.id_servicio = s.id_servicio
             JOIN usuarios u_creador ON t.id_usuario = u_creador.id_usuario
             LEFT JOIN usuarios u ON t.id_tecnico = u.id_usuario
             WHERE t.id_usuario = ?
             ORDER BY t.fecha_creacion DESC
             LIMIT 5',
            [$user['id_usuario']]
        );
    }
    
    $tickets = $stmt->fetchAll();
    
    echo "Tickets encontrados: " . count($tickets) . "\n\n";
    
    if (empty($tickets)) {
        echo "No hay tickets para este usuario.\n";
    } else {
        echo "Primeros tickets:\n";
        foreach (array_slice($tickets, 0, 3) as $i => $ticket) {
            echo "\n--- Ticket " . ($i + 1) . " ---\n";
            echo "ID: " . $ticket['id'] . "\n";
            echo "Categoría: " . $ticket['categoria'] . " - " . $ticket['subcategoria'] . "\n";
            echo "Estado: " . $ticket['estado'] . "\n";
            echo "Prioridad: " . $ticket['prioridad'] . "\n";
            echo "Fecha creación: " . $ticket['fecha_creacion'] . "\n";
            echo "Usuario: " . ($ticket['usuario_nombre'] ?? 'N/A') . "\n";
            echo "Tiempo estimado: " . ($ticket['tiempo_estimado'] ?? 'N/A') . "\n";
        }
    }
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}

