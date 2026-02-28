<?php
declare(strict_types=1);
namespace App\Middleware;

class AuthMiddleware {
    public static function check(): void {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        $validToken = getenv('API_SECRET_TOKEN') ?: 'token_secreto_bar_123';

        if (strpos($authHeader, 'Bearer ') !== 0 || substr($authHeader, 7) !== $validToken) {
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }
    }
}