<?php
declare(strict_types=1);
namespace App\Middleware;

/**
 * Rate Limiter simple basado en archivos temporales.
 * Compatible con Vercel serverless (usa /tmp/).
 * 
 * Limita intentos por IP para prevenir ataques de fuerza bruta.
 */
class RateLimiter {
    
    /**
     * Verifica si la IP actual ha excedido el límite de intentos.
     * 
     * @param string $action  Nombre de la acción (ej: 'login')
     * @param int $maxAttempts Máximo de intentos permitidos
     * @param int $windowSeconds Ventana de tiempo en segundos
     */
    public static function check(string $action, int $maxAttempts = 5, int $windowSeconds = 900): void {
        $ip = self::getClientIp();
        $key = md5($action . '_' . $ip);
        $file = sys_get_temp_dir() . '/babel_rate_' . $key . '.json';
        
        $now = time();
        $attempts = [];
        
        // Leer intentos existentes
        if (file_exists($file)) {
            $data = json_decode(file_get_contents($file), true);
            if (is_array($data)) {
                // Filtrar solo intentos dentro de la ventana de tiempo
                $attempts = array_filter($data, function($timestamp) use ($now, $windowSeconds) {
                    return ($now - $timestamp) < $windowSeconds;
                });
            }
        }
        
        // Verificar si se excedió el límite
        if (count($attempts) >= $maxAttempts) {
            $oldestAttempt = min($attempts);
            $retryAfter = $windowSeconds - ($now - $oldestAttempt);
            
            http_response_code(429);
            header('Retry-After: ' . $retryAfter);
            echo json_encode([
                'error' => 'Demasiados intentos. Intenta de nuevo en ' . ceil($retryAfter / 60) . ' minutos.',
                'retry_after' => $retryAfter
            ]);
            exit;
        }
        
        // Registrar este intento
        $attempts[] = $now;
        file_put_contents($file, json_encode(array_values($attempts)));
    }
    
    /**
     * Limpiar los intentos después de un login exitoso.
     */
    public static function reset(string $action): void {
        $ip = self::getClientIp();
        $key = md5($action . '_' . $ip);
        $file = sys_get_temp_dir() . '/babel_rate_' . $key . '.json';
        
        if (file_exists($file)) {
            unlink($file);
        }
    }
    
    /**
     * Obtener la IP del cliente, considerando proxies.
     */
    private static function getClientIp(): string {
        // Vercel pone la IP real en X-Forwarded-For
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
            return trim($ips[0]);
        }
        
        if (!empty($_SERVER['HTTP_X_REAL_IP'])) {
            return $_SERVER['HTTP_X_REAL_IP'];
        }
        
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }
}
