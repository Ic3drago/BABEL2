<?php
declare(strict_types=1);

namespace App\Config;

use PDO;
use PDOException;

class Database
{
    private static ?PDO $connection = null;

    /**
     * Lee una variable de entorno intentando múltiples fuentes.
     */
    private static function env(string $key, ?string $default = null): ?string
    {
        // 1. getenv() — funciona con putenv() y vars del sistema
        $val = getenv($key);
        if ($val !== false && $val !== '') return $val;

        // 2. $_ENV — algunas configs de PHP las ponen aquí
        if (isset($_ENV[$key]) && $_ENV[$key] !== '') return $_ENV[$key];

        // 3. $_SERVER — Vercel a veces las pone aquí
        if (isset($_SERVER[$key]) && $_SERVER[$key] !== '') return $_SERVER[$key];

        return $default;
    }

    public static function connect(): PDO
    {
        if (self::$connection === null) {

            $host   = self::env('DB_HOST');
            $port   = self::env('DB_PORT', '5432');
            $dbname = self::env('DB_NAME', 'postgres');
            $user   = self::env('DB_USER');
            $pass   = self::env('DB_PASS');

            if (!$host || !$user || !$pass) {
                http_response_code(500);
                echo json_encode([
                    'error' => 'DB no configurada',
                    'debug' => [
                        'DB_HOST' => $host ? 'SET' : 'MISSING',
                        'DB_USER' => $user ? 'SET' : 'MISSING',
                        'DB_PASS' => $pass ? 'SET' : 'MISSING',
                    ]
                ]);
                exit;
            }

            $dsn = "pgsql:host=$host;port=$port;dbname=$dbname;sslmode=require";

            try {
                self::$connection = new PDO(
                    $dsn,
                    $user,
                    $pass,
                    [
                        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    ]
                );
            } catch (PDOException $e) {
                http_response_code(500);
                echo json_encode(['error' => 'Error de conexión DB: ' . $e->getMessage()]);
                exit;
            }
        }

        return self::$connection;
    }

    public static function getConnection(): PDO
    {
        return self::connect();
    }
}