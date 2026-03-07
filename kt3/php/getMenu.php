<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
 */
	session_start();
	require_once('../menudef.php');
	require_once('json.php');

	jsonout(array('menu'=> $menu));
?>
