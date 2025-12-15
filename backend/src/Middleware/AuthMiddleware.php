<?php

namespace App\Middleware;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Exception;

class AuthMiddleware
{
    public static function authenticate()
    {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        
        if (empty($authHeader)) {
            http_response_code(401);
            echo json_encode(['error' => 'Token de acceso requerido']);
            exit;
        }
        
        // Extract token from "Bearer <token>"
        $parts = explode(' ', $authHeader);
        if (count($parts) !== 2 || $parts[0] !== 'Bearer') {
            http_response_code(401);
            echo json_encode(['error' => 'Formato de token inválido']);
            exit;
        }
        
        $token = $parts[1];
        
        try {
            $secret = $_ENV['JWT_SECRET'] ?? 'fallback_secret';
            $decoded = JWT::decode($token, new Key($secret, 'HS256'));
            
            // Convert to array
            $user = (array) $decoded;
            
            // Ensure id_usuario is set
            if (!isset($user['id_usuario']) && isset($user['id'])) {
                $user['id_usuario'] = $user['id'];
            }
            
            return $user;
            
        } catch (Exception $e) {
            http_response_code(403);
            echo json_encode(['error' => 'Token inválido']);
            exit;
        }
    }
    
    public static function getRequestBody()
    {
        $body = file_get_contents('php://input');
        return json_decode($body, true) ?? [];
    }
    
    public static function sendResponse($data, $statusCode = 200)
    {
        http_response_code($statusCode);
        echo json_encode($data);
        exit;
    }
    
    public static function sendError($message, $statusCode = 500)
    {
        http_response_code($statusCode);
        echo json_encode(['error' => $message]);
        exit;
    }
}
