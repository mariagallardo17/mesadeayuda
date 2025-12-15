<?php
// Check if Composer dependencies are installed
if (!file_exists(__DIR__ . '/vendor/autoload.php')) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'error' => 'Dependencies not installed',
        'message' => 'Please run "composer install" in the backend directory to install PHP dependencies.',
        'instructions' => [
            '1. Install Composer from https://getcomposer.org/',
            '2. Run: cd backend',
            '3. Run: composer install',
            '4. Reload this page'
        ]
    ]);
    exit(1);
}

require_once __DIR__ . '/vendor/autoload.php';

use App\Config\Database;
use App\Router;

// Load environment variables
// Intentar cargar desde múltiples ubicaciones posibles
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
        error_log("✅ Archivo .env cargado desde: $envPath");
        $envLoaded = true;
        break;
    }
}

if (!$envLoaded) {
    error_log("⚠️ Advertencia: No se encontró archivo .env en ninguna de las ubicaciones esperadas");
    // Intentar cargar desde __DIR__ como fallback
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
    $dotenv->safeLoad();
}

// Set error reporting (desactivar en producción)
error_reporting(E_ALL);
ini_set('display_errors', $_ENV['DISPLAY_ERRORS'] ?? '0');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/error.log');

// Set headers for CORS
header('Access-Control-Allow-Origin: ' . ($_ENV['CORS_ORIGIN'] ?? 'http://localhost:4200'));
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Set content type
header('Content-Type: application/json');

try {
    // Test database connection
    $db = Database::getInstance();
    
    // Initialize router
    $router = new Router();
    
    // Get request method and URI
    $method = $_SERVER['REQUEST_METHOD'];
    $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    
    // Remove base path if exists
    $basePath = '/api';
    if (strpos($uri, $basePath) === 0) {
        $uri = substr($uri, strlen($basePath));
    }
    
    // Route the request
    $router->route($method, $uri);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Something went wrong!',
        'message' => $e->getMessage()
    ]);
}
