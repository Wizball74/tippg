<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
 */
	session_start();	
	require_once('login_inc.php');
	require_once('json.php');
	logout();
	jsonout(array('ok' => true));
?>
