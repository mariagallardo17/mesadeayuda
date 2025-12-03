<?php

namespace App\Config;

use PDO;
use PDOException;

class Database
{
    private static $instance = null;
    private $connection;
    
    private function __construct()
    {
        $host = $_ENV['DB_HOST'] ?? 'localhost';
        $port = $_ENV['DB_PORT'] ?? '3306';
        $dbname = $_ENV['DB_NAME'] ?? 'mesadeayuda';
        $username = $_ENV['DB_USER'] ?? 'root';
        $password = $_ENV['DB_PASSWORD'] ?? '';
        
        try {
            error_log("🔍 Intentando conectar a la base de datos...");
            error_log("📊 Configuración: host=$host, port=$port, user=$username, database=$dbname");
            
            $dsn = "mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4";
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ];
            
            $this->connection = new PDO($dsn, $username, $password, $options);
            
            error_log("✅ Conexión a MySQL establecida correctamente");
            
            // Test query
            $stmt = $this->connection->query('SELECT 1 as test');
            $result = $stmt->fetch();
            error_log("✅ Query de prueba exitosa");
            
        } catch (PDOException $e) {
            error_log("❌ Error al conectar con MySQL: " . $e->getMessage());
            error_log("   Código: " . $e->getCode());
            
            if ($e->getCode() == 2002) {
                error_log("   ⚠️  El servidor MySQL no está corriendo o no está accesible en $host:$port");
            } elseif ($e->getCode() == 1045) {
                error_log("   ⚠️  Credenciales incorrectas (usuario o contraseña)");
            } elseif ($e->getCode() == 1049) {
                error_log("   ⚠️  La base de datos '$dbname' no existe");
            }
            
            throw $e;
        }
    }
    
    public static function getInstance()
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        
        return self::$instance;
    }
    
    public function getConnection()
    {
        return $this->connection;
    }
    
    public function query($sql, $params = [])
    {
        try {
            $stmt = $this->connection->prepare($sql);
            $stmt->execute($params);
            return $stmt;
        } catch (PDOException $e) {
            error_log('Error ejecutando query: ' . $e->getMessage());
            throw $e;
        }
    }
    
    public function testConnection()
    {
        try {
            $stmt = $this->connection->query('SELECT 1');
            return $stmt !== false;
        } catch (PDOException $e) {
            return false;
        }
    }
}
