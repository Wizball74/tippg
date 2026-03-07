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

	if (isset($_SESSION['user']))
	{
		require_once('../mysql.php');
				
		// Tipprunde
		$sql = "SELECT t.*, IF(st.sptag,st.sptag,34) as curmd 
				FROM $TABLE[tipprunde] t LEFT JOIN ( select trid, min(sptag) as sptag
													 from $TABLE[spielplan]
													 where Ergebnis='-:-'
													 and  (Datum > curdate() - INTERVAL 3 day)
													 group by trid) st ON t.trid = st.trid";
		if ($_SESSION['user']['userlevel'] < 100) $sql = $sql." WHERE t.aktiv ='J'"; // TODO: nur wenn eingeloggter Benutzer Teilnehmer ist
		$sql = $sql . " ORDER BY t.trid DESC";
		
		$data = getData($sql);
		$rows = $data;
		if (!isset($rows)) $rows = array();	
	}

	// Ausgabe
	$data = array('Records' => count($rows), 'Rows' => $rows);
	$json = array('ok' => true, 'data' => $data);
	jsonout($json);
?>