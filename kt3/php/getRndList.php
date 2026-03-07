<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
 */
	require_once('getBaseData.php');
	require_once('json.php');

	$rows = array();

	if (isset($_SESSION['_rnds']))
	{
		$rows = $_SESSION['_rnds'];
		if (!isset($rows)) $rows = array();
	}

	// Ausgabe
	$data = array('Records' => count($rows), 'Rows' => $rows);
	$json = array('ok' => true, 'data' => $data);
	jsonout($json);
?>
