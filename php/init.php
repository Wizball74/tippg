<?php

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once('class.KT.php');

session_start();

if (!($_SESSION['_KT_'] ?? null) instanceof KT)
	$_SESSION['_KT_'] = new KT();

$kt = $_SESSION['_KT_'];
$kt->initData();
if (!$kt->user && isset($_SESSION['username'])) $kt->setUser($_SESSION['username']);
	 	//print_r($kt);
?>