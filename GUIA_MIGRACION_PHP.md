# Guía de Migración: Node.js a PHP

## 📋 Resumen

Tu base de datos MySQL **NO necesita cambiar**. Solo necesitas crear una API en PHP que reemplace tu backend de Node.js.

## 🛠️ Requisitos

### 1. Software Necesario
- **PHP 7.4 o superior** (recomendado PHP 8.0+)
- **MySQL/MariaDB** (ya lo tienes)
- **Servidor web** (Apache o Nginx)
- **Composer** (gestor de dependencias de PHP)

### 2. Extensiones PHP Requeridas
```bash
# Verificar extensiones instaladas
php -m | grep -E "pdo|mysqli|json|mbstring|openssl"
```

Extensiones necesarias:
- `pdo_mysql` o `mysqli` (conexión a MySQL)
- `json` (manejo de JSON)
- `mbstring` (manejo de caracteres)
- `openssl` (para JWT y seguridad)

## 📁 Estructura Recomendada

```
php-backend/
├── config/
│   ├── database.php          # Configuración de BD
│   └── config.php             # Configuración general
├── routes/
│   ├── auth.php               # Autenticación
│   ├── tickets.php            # Tickets
│   ├── services.php           # Servicios
│   ├── users.php              # Usuarios
│   ├── notifications.php      # Notificaciones
│   └── reports.php            # Reportes
├── models/
│   ├── User.php
│   ├── Ticket.php
│   └── Service.php
├── middleware/
│   ├── AuthMiddleware.php     # Verificación JWT
│   └── AdminMiddleware.php   # Verificación de admin
├── utils/
│   ├── JWT.php                # Manejo de JWT
│   └── Response.php           # Respuestas JSON
├── vendor/                     # Dependencias (Composer)
├── .htaccess                   # Configuración Apache
├── composer.json               # Dependencias
└── index.php                   # Punto de entrada
```

## 🔧 Opciones de Implementación

### Opción 1: PHP Puro (Recomendado para empezar)

**Ventajas:**
- Simple y directo
- Sin dependencias externas pesadas
- Fácil de entender

**Desventajas:**
- Más código manual
- Menos estructura

### Opción 2: Framework Laravel

**Ventajas:**
- Estructura robusta
- ORM (Eloquent)
- Muchas funcionalidades incluidas
- Comunidad grande

**Desventajas:**
- Curva de aprendizaje
- Más pesado

### Opción 3: Framework Slim

**Ventajas:**
- Ligero y rápido
- Ideal para APIs
- Fácil de aprender

**Desventajas:**
- Menos funcionalidades que Laravel

## 📝 Ejemplo de Implementación Básica

### 1. Configuración de Base de Datos (config/database.php)

```php
<?php
class Database {
    private $host;
    private $db_name;
    private $username;
    private $password;
    private $conn;

    public function __construct() {
        $this->host = $_ENV['DB_HOST'] ?? 'localhost';
        $this->db_name = $_ENV['DB_NAME'] ?? 'mesadeayuda';
        $this->username = $_ENV['DB_USER'] ?? 'root';
        $this->password = $_ENV['DB_PASSWORD'] ?? '';
    }

    public function getConnection() {
        $this->conn = null;
        
        try {
            $this->conn = new PDO(
                "mysql:host=" . $this->host . ";dbname=" . $this->db_name . ";charset=utf8mb4",
                $this->username,
                $this->password,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false
                ]
            );
        } catch(PDOException $e) {
            error_log("Error de conexión: " . $e->getMessage());
        }
        
        return $this->conn;
    }
}
?>
```

### 2. Manejo de JWT (utils/JWT.php)

Necesitarás instalar una librería para JWT:

```bash
composer require firebase/php-jwt
```

```php
<?php
require_once __DIR__ . '/../vendor/autoload.php';
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class JWTUtil {
    private static $secret = 'tu_secreto_jwt_aqui'; // Desde .env
    
    public static function generateToken($user) {
        $payload = [
            'id_usuario' => $user['id_usuario'],
            'correo' => $user['correo'],
            'rol' => $user['rol'],
            'iat' => time(),
            'exp' => time() + (24 * 60 * 60) // 24 horas
        ];
        
        return JWT::encode($payload, self::$secret, 'HS256');
    }
    
    public static function verifyToken($token) {
        try {
            $decoded = JWT::decode($token, new Key(self::$secret, 'HS256'));
            return (array) $decoded;
        } catch (Exception $e) {
            return null;
        }
    }
}
?>
```

### 3. Middleware de Autenticación (middleware/AuthMiddleware.php)

```php
<?php
require_once __DIR__ . '/../utils/JWT.php';

function authenticateToken($request) {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';
    
    if (empty($authHeader) || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(['error' => 'Token de acceso requerido']);
        exit;
    }
    
    $token = $matches[1];
    $user = JWTUtil::verifyToken($token);
    
    if (!$user) {
        http_response_code(403);
        echo json_encode(['error' => 'Token inválido']);
        exit;
    }
    
    return $user;
}
?>
```

### 4. Ejemplo de Ruta - Tickets (routes/tickets.php)

```php
<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$path = $_SERVER['PATH_INFO'] ?? '';

$db = new Database();
$conn = $db->getConnection();

// Obtener tickets del usuario
if ($method === 'GET' && $path === '/my-tickets') {
    $user = authenticateToken($_SERVER);
    
    $query = "
        SELECT
            t.id_ticket as id,
            s.categoria,
            s.subcategoria,
            t.descripcion,
            s.tiempo_objetivo as tiempo_estimado,
            t.estatus as estado,
            t.prioridad,
            t.fecha_creacion,
            t.fecha_cierre as fecha_finalizacion,
            u.nombre as usuario_nombre,
            u.correo as usuario_correo
        FROM Tickets t
        JOIN Servicios s ON t.id_servicio = s.id_servicio
        JOIN Usuarios u ON t.id_usuario = u.id_usuario
        WHERE t.id_usuario = ?
        ORDER BY t.fecha_creacion DESC
    ";
    
    $stmt = $conn->prepare($query);
    $stmt->execute([$user['id_usuario']]);
    $tickets = $stmt->fetchAll();
    
    echo json_encode($tickets);
    exit;
}

// Crear nuevo ticket
if ($method === 'POST' && $path === '') {
    $user = authenticateToken($_SERVER);
    $data = json_decode(file_get_contents('php://input'), true);
    
    $query = "
        INSERT INTO Tickets (id_usuario, id_servicio, descripcion, prioridad, estatus)
        VALUES (?, ?, ?, ?, 'Abierto')
    ";
    
    $stmt = $conn->prepare($query);
    $stmt->execute([
        $user['id_usuario'],
        $data['id_servicio'],
        $data['descripcion'],
        $data['prioridad']
    ]);
    
    $ticketId = $conn->lastInsertId();
    echo json_encode(['id' => $ticketId, 'message' => 'Ticket creado']);
    exit;
}
?>
```

## 📦 Dependencias Recomendadas (composer.json)

```json
{
    "require": {
        "php": ">=7.4",
        "firebase/php-jwt": "^6.0",
        "vlucas/phpdotenv": "^5.0"
    },
    "autoload": {
        "psr-4": {
            "App\\": "src/"
        }
    }
}
```

Instalar dependencias:
```bash
composer install
```

## 🔐 Variables de Entorno (.env)

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_contraseña
DB_NAME=mesadeayuda
JWT_SECRET=tu_secreto_jwt_muy_seguro
CORS_ORIGIN=http://localhost:4200
```

## 🌐 Configuración del Servidor

### Apache (.htaccess)

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.php?path=$1 [QSA,L]

# CORS
Header set Access-Control-Allow-Origin "*"
Header set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
Header set Access-Control-Allow-Headers "Content-Type, Authorization"
```

### Nginx

```nginx
location / {
    try_files $uri $uri/ /index.php?$query_string;
}
```

## 📊 Comparación de Funcionalidades

| Funcionalidad | Node.js (Actual) | PHP (Nuevo) |
|--------------|------------------|-------------|
| Conexión BD | mysql2/promise | PDO/mysqli |
| JWT | jsonwebtoken | firebase/php-jwt |
| Variables env | dotenv | vlucas/phpdotenv |
| Servidor | Express | Apache/Nginx |
| Async/Await | ✅ Nativo | ✅ PHP 7.1+ |

## 🚀 Pasos para Migrar

1. **Instalar PHP y Composer**
2. **Crear estructura de carpetas**
3. **Configurar conexión a base de datos**
4. **Implementar autenticación JWT**
5. **Migrar rutas una por una:**
   - auth.php (login, registro)
   - tickets.php
   - services.php
   - users.php
   - notifications.php
   - reports.php
6. **Probar cada endpoint**
7. **Actualizar frontend** (si cambian URLs)

## ⚠️ Consideraciones Importantes

1. **La base de datos NO cambia** - Solo cambia el código del backend
2. **Mismo esquema SQL** - Todas tus tablas siguen igual
3. **Mismas consultas** - Puedes copiar las queries SQL directamente
4. **JWT compatible** - Mismo secreto = mismos tokens válidos
5. **CORS** - Configurar correctamente para el frontend Angular

## 📚 Recursos Adicionales

- **PDO Documentation**: https://www.php.net/manual/es/book.pdo.php
- **PHP JWT Library**: https://github.com/firebase/php-jwt
- **Laravel Framework**: https://laravel.com (si eliges framework)
- **Slim Framework**: https://www.slimframework.com (si eliges framework ligero)

## 🎯 Recomendación

Para empezar rápido: **PHP Puro con PDO**
Para proyecto grande: **Laravel Framework**

¿Quieres que te ayude a crear algún archivo específico o tienes preguntas sobre alguna parte de la migración?

