<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
 */
	session_start();
	require_once('json.php');
	require_once('getBaseData.php');

	if (isset($_SESSION['user']))
	{	
		$trid = $_POST['trid'];
		$md = $_POST['md'];
		$rnd = $_SESSION['trrow']['STRND'][$md];	
		$member = $_SESSION['member'][$rnd];

		$data[]=array('tnid'=>0, 'Name'=>'Bitte wählen.');
		
		if(is_array($member))
			foreach($member as $m) $data[]=array('tnid'=>$m['tnid'], 'Name'=>$m['name']);

		$rows = $data;
		if (!isset($rows)) $rows = array();			
	}

	// Ausgabe
	$data = array('Records' => count($rows), 'Rows' => $rows);
	$json = array('ok' => true, 'data' => $data);
	jsonout($json);
?>