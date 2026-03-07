<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      10/2014
 * @version   3.1
 * MA 02.10.2014 überarbeitet, Kicker-Spielplan statt DFB
 */
	
	require_once('json.php');
	require_once('SchedFuns.php');

	session_start();

	function parseResults($trid, $md)
	{
		global $TABLE; 
		
		$sched = parseSchedule($trid, $md);

		// Spieltage laden
		unset ($_sid);
		$sql = sprintf("select * from $TABLE[spielplan] where trid = %d AND sptag = %d", $trid, $md);
		$res = query($sql);
		while ($row=mysql_fetch_assoc($res))  { $_sid[$row['tid1']][$row['tid2']] = $row['sid']; }
		
		foreach ($sched[$md] as $s)
		{
			$erg = explode(chr(160), $s['Result']);
			$results[] = array(
				'T1' => $s['T1'],
				'T2' => $s['T2'],
				'Res' => $erg[0],
				'sid' => $_sid[$s['T1']][$s['T2']]
			);			
		}
	 
		return $results;
	}
	   
	$trid = $_POST['trid'];
	// if (!isset($trid)) $trid = 13;
	$md = $_POST['md'];
	// if (!isset($md)) $md = 1;
	$data = parseResults($trid,$md);
	
	$json = array('ok' => true, 'data' => $data);
	jsonout($json);
?>