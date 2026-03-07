<?php
	// Credentials aus .env laden (ktsvc/.env ist die zentrale Quelle)
	$envFile = __DIR__ . '/../ktsvc/.env';
	if (file_exists($envFile)) {
		$envVars = parse_ini_file($envFile);
		$userid   = $envVars['DB_USERNAME'] ?? '';
		$pw       = $envVars['DB_PASSWORD'] ?? '';
		$host     = $envVars['DB_HOST'] ?? 'localhost';
		$database = $envVars['DB_DATABASE'] ?? '';
	} else {
		error_log('FATAL: .env file not found at ' . $envFile);
		die('Konfigurationsfehler. Bitte Administrator kontaktieren.');
	}
?>