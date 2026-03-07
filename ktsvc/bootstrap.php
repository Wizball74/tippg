<?php
require 'vendor/autoload.php';
use Dotenv\Dotenv;

use Src\System\DatabaseConnector;

// Sichere Session-Konfiguration
ini_set('session.cookie_httponly', 1);
ini_set('session.use_strict_mode', 1);
session_start();

$dotenv = new DotEnv(__DIR__);
$dotenv->load();

$dbConnector = new DatabaseConnector();
$dbConnection = ($dbConnector)->getConnection();
