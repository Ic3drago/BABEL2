<?php
namespace App\Controllers;

use App\Config\JWT;

class AuthController {
    private $db;

    public function __construct($db) {
        $this->db = $db;
    }

    public function login() {
        $input = json_decode(file_get_contents('php://input'), true);
        $username = $input['username'] ?? '';
        $password = $input['password'] ?? '';

        if (empty($username) || empty($password)) {
            http_response_code(400);
            echo json_encode(['error' => 'Usuario y contraseña requeridos']);
            return;
        }

        $stmt = $this->db->prepare("SELECT * FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch(\PDO::FETCH_ASSOC);

        if ($user && hash('sha256', $password) === $user['password_hash']) {
            // Generar JWT
            $payload = [
                'sub' => $user['id'],
                'username' => $user['username'],
                'role' => $user['role'],
                'iat' => time(),
                'exp' => time() + (8 * 60 * 60) // Expira en 8 horas
            ];

            $token = JWT::encode($payload);

            echo json_encode([
                'token' => $token,
                'role' => $user['role']
            ]);
        } else {
            http_response_code(401);
            echo json_encode(['error' => 'Credenciales inválidas']);
        }
    }

    public function changePassword() {
        // Assume user is authenticated and token payload is handled in index.php
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        $token = str_replace('Bearer ', '', $authHeader);
        $payload = JWT::decode($token);

        if (!$payload) {
            http_response_code(401);
            echo json_encode(['error' => 'No autorizado']);
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        $old_pwd = $input['old_password'] ?? '';
        $new_pwd = $input['new_password'] ?? '';

        if (empty($old_pwd) || empty($new_pwd)) {
            http_response_code(400);
            echo json_encode(['error' => 'Ambas contraseñas son requeridas']);
            return;
        }

        $userId = $payload['sub'];
        $stmt = $this->db->prepare("SELECT password_hash FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(\PDO::FETCH_ASSOC);

        if ($user && hash('sha256', $old_pwd) === $user['password_hash']) {
            $newHash = hash('sha256', $new_pwd);
            $upd = $this->db->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
            if ($upd->execute([$newHash, $userId])) {
                echo json_encode(['success' => true]);
            } else {
                http_response_code(500);
                echo json_encode(['error' => 'Error al actualizar contraseña']);
            }
        } else {
            http_response_code(401);
            echo json_encode(['error' => 'La contraseña actual es incorrecta']);
        }
    }
}
