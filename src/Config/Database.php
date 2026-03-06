<?php
declare(strict_types=1);

namespace App\Config;

use PDO;
use PDOException;

class Database
{
    private static ?PDO $connection = null;

    public static function connect(): PDO
    {
        if (self::$connection === null) {

            $host   = getenv('DB_HOST');
            $port   = getenv('DB_PORT')   ?: '5432';
            $dbname = getenv('DB_NAME')   ?: 'postgres';
            $user   = getenv('DB_USER');
            $pass   = getenv('DB_PASS');

            if (!$host || !$user || !$pass) {
                http_response_code(500);
                echo json_encode(['error' => 'Configuración de base de datos incompleta. Verificar variables de entorno.']);
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
                echo json_encode(['error' => 'Error de conexión a la base de datos']);
                exit;
            }
        }

        return self::$connection;
    }

    /**
     * Alias de connect() — usado por todos los controllers.
     */
    public static function getConnection(): PDO
    {
        return self::connect();
    }
}