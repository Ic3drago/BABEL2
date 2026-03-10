<?php
namespace App\Controllers;

use App\Config\JWT;
use App\Middleware\RateLimiter;

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

        // Sanitización: limitar longitud de inputs
        if (strlen($username) > 50 || strlen($password) > 255) {
            http_response_code(400);
            echo json_encode(['error' => 'Datos de entrada inválidos']);
            return;
        }
        $username = trim($username);

        $stmt = $this->db->prepare("SELECT * FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch(\PDO::FETCH_ASSOC);

        // Verificar contraseña: soporta bcrypt (nuevo) y SHA-256 (legacy)
        $passwordValid = false;
        $needsRehash = false;

        if ($user) {
            if (password_verify($password, $user['password_hash'])) {
                // Hash bcrypt válido
                $passwordValid = true;
                // Rehash si el costo ha cambiado
                if (password_needs_rehash($user['password_hash'], PASSWORD_BCRYPT, ['cost' => 12])) {
                    $needsRehash = true;
                }
            } elseif (hash('sha256', $password) === $user['password_hash']) {
                // Hash SHA-256 legacy — migrar a bcrypt
                $passwordValid = true;
                $needsRehash = true;
            }
        }

        if ($passwordValid) {
            // Migración gradual: actualizar hash viejo a bcrypt
            if ($needsRehash) {
                $newHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
                $upd = $this->db->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
                $upd->execute([$newHash, $user['id']]);
            }

            // Limpiar rate limiter tras login exitoso
            RateLimiter::reset('login');

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

        // Sanitización: limitar longitud
        if (strlen($old_pwd) > 255 || strlen($new_pwd) > 255) {
            http_response_code(400);
            echo json_encode(['error' => 'Contraseña demasiado larga']);
            return;
        }

        if (strlen($new_pwd) < 6) {
            http_response_code(400);
            echo json_encode(['error' => 'La nueva contraseña debe tener al menos 6 caracteres']);
            return;
        }

        $userId = $payload['sub'];
        $stmt = $this->db->prepare("SELECT password_hash FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(\PDO::FETCH_ASSOC);

        // Verificar contraseña actual: soporta bcrypt y SHA-256 legacy
        $oldPwdValid = false;
        if ($user) {
            if (password_verify($old_pwd, $user['password_hash'])) {
                $oldPwdValid = true;
            } elseif (hash('sha256', $old_pwd) === $user['password_hash']) {
                $oldPwdValid = true;
            }
        }

        if ($oldPwdValid) {
            // Siempre guardar con bcrypt
            $newHash = password_hash($new_pwd, PASSWORD_BCRYPT, ['cost' => 12]);
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
