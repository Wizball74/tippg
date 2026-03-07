<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
					***(getLeagueSchedule.php)
 */

	require_once('getBaseData.php');
	require_once('json.php');
	
	$colModel = array();
	$rows = array();

	if (isset($_POST['trid']) && isset($_POST['md']))
	{		
		$trid = $_POST['trid'];
		$md = $_POST['md'];
		$league = $_POST['lnr'];
		$json = Array();
		$member = $_SESSION['member'];
		$rnd = $_SESSION['trrow']['STRND'][$md];

		$colModel[] = array('label' => "Spieler 1", 'width' => 180, 'name' => "M1");
		$colModel[] = array('label' => "Spieler 2", 'width' => 180, 'name' => "M2");
		$colModel[] = array('label' => "Ergebnis", 'width' => 90, 'name' => "Result", 'align' => 'center', 'classes' => 'Result');
		$colModel[] = array('name' => "id", 'key' => true, 'hidden' => true);
		$colModel[] = array('name' => "cls", 'hidden' => true);
		
		$sql = sprintf("select * from $TABLE[ligaergebnis] where trid=%d AND sptag=%d AND Liga=%d", $trid, $md, $league);
		$result = query($sql);
		unset($schedule);
		
		unset($cls);
		$tnid = $_SESSION['user']['tnid'];
		$cls[$tnid] = 'rowUser';

		$id =0;		
		while ($row=mysql_fetch_assoc($result))
		{
			$schedule[] = array(
				'trid' => $row['trid'],
				'md' => $row['sptag'],
				'League' => $row['Liga'],
				'M1' => $member[$rnd][$row['tnid1']]['name'],
				'M2' => $member[$rnd][$row['tnid2']]['name'],
				'Result' => $row['Ergebnis'],
				'cls' => $cls[$row['tnid1']].$cls[$row['tnid2']],
				'id' => $id++
			);
		}   
		
		$rows = $schedule;
		if (!isset($rows)) $rows = array();
	}
			
	// Ausgabe
	$data = array('Records' => count($rows), 'Rows' => $rows);
	$json = array('colModel' => $colModel, 'data' => $data);
	jsonout($json);
?>
