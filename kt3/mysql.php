<?php
	require_once('php/json.php');

	// Tabellen
	$prefix = 'kt3_';
	
	$TABLE['teilnehmer']          = $prefix.'teilnehmer';
	$TABLE['tipprunde']           = $prefix.'tipprunde';
	$TABLE['spielplan']           = $prefix.'spielplan'; 
	$TABLE['teams']               = $prefix.'teams';
	$TABLE['tipps']               = $prefix.'tipps';
	$TABLE['tr_teilnehmer']       = $prefix.'tr_teilnehmer'; 	
	$TABLE['ligaergebnis']        = $prefix.'ligaergebnis';
	$TABLE['praemien']            = $prefix.'praemien'; 
	
	
	// Credentials aus .env laden
	$envFile = __DIR__ . '/../ktsvc/.env';
	if (file_exists($envFile)) {
		$envVars = parse_ini_file($envFile);
		$userid   = $envVars['DB_USERNAME'] ?? '';
		$pw       = $envVars['DB_PASSWORD'] ?? '';
		$host     = $envVars['DB_HOST'] ?? 'localhost';
		$database = $envVars['DB_DATABASE'] ?? '';
	} else {
		error_log('FATAL: .env file not found at ' . $envFile);
		die('Konfigurationsfehler.');
	}


	session_start();
	// zur DB verbinden
	$conn_id = $_SESSION['_DB_'];
	if (!$conn_id){
		$conn_id = mysql_pconnect($host,$userid,$pw);
		$_SESSION['_DB_'] = $conn_id;
	}
	mysql_select_db($database,$conn_id);

	function Query($sql)
	{  		
		global $conn_id;
		global $debug;
		//global $jsonPacket;
		//      $debug=1;
		if ($erg = mysql_query($sql,$conn_id))
		{
			if ($debug) echo '<i>Erfolg : '.$sql.'</i><br>';         	
		}
		else
		{			
			error_log("DB Error: " . mysql_error() . " | SQL: " . $sql);
			jsonout(array('message' => 'Ein Datenbankfehler ist aufgetreten.'));
		}
		return $erg;
	}
	
	function getData($sql)   
	{
		$result = Query($sql);
		$data = array();
		
		while ($row = mysql_fetch_assoc($result))
		{
			$data[] = $row;
		}
		
		return $data;
	}
	
	function defValue($val, $default = '')
	{
		return (isset($val)) ? $val : $default;
	}
?>