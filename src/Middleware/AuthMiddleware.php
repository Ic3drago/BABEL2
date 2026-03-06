<?php
declare(strict_types=1);
namespace App\Middleware;

use App\Config\JWT;

class AuthMiddleware {
    public static function check(): array {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';

        if (strpos($authHeader, 'Bearer ') !== 0) {
            http_response_code(401);
            echo json_encode(['error' => 'Token no proporcionado']);
            exit;
        }

        $token = substr($authHeader, 7);
        $payload = JWT::decode($token);

        if (!$payload) {
            http_response_code(401);
            echo json_encode(['error' => 'Token inválido o expirado']);
            exit;
        }

        return $payload;
    }
}