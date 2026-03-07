<?php

require_once('class.KT.php');

session_start();

if (!$_SESSION['_KT_'] instanceof KT)
	$_SESSION['_KT_'] = new KT();

$kt = $_SESSION['_KT_'];
$kt->initData();
	 	//print_r($kt);
?>