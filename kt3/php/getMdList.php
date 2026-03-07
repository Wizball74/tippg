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

	$rows = array();	
	
	if (isset($_SESSION['user']) && isset($_POST['trid']))
	{
		require_once('../mysql.php');
		
		// Spieltag
		$trid = $_POST['trid'];
		$sql = "SELECT *, DATE_FORMAT(Datum, '%d.%m.%Y') AS DatumF 
				FROM $TABLE[spielplan] WHERE trid = $trid ORDER BY sptag";
		$data = getData($sql);	
		unset ($sptaglist);
		foreach($data as $idx=>$d)
		{
			if ($d['Ergebnis'] <> '-:-') $_sptaglist[$d['sptag']] = 1; else $_sptaglist[$d['sptag']] = 0;
			if (!isset($_sptagdatum[$d['sptag']])) $_sptagdatum[$d['sptag']] = $d['DatumF'];
		}
					
		if (isset($_sptaglist))
		{
			foreach ($_sptaglist as $_sptag => $_komplett)
			{
				$sptaglist[]= array(
					'sptag' => $_sptag,
					'Anzeige' => sprintf("%02u. Spieltag (%s)",$_sptag,$_sptagdatum[$_sptag])
				);
			} // foreach
		} // if 
			
		$rows = $sptaglist;
		if (!isset($rows)) $rows = array();	
	}

	// Ausgabe
	$data = array('Records' => count($rows), 'Rows' => $rows);
	$json = array('ok' => true, 'data' => $data);
	jsonout($json);
?>