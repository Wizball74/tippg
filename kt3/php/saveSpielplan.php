<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
					***(saveSchedule.php)
 */

  	require_once('json.php');
	session_start();
	if ($_SESSION['user']['userlevel'] == 100)
	{
		if (isset($_POST['data']) && isset($_POST['trid']) && isset($_POST['md']))
		{
			require_once('../mysql.php');
			require_once('funcs.php');
			
			$data = $_POST['data'];
			$trid = $_POST['trid'];
			$md = $_POST['md'];

			foreach ($data as $d)
			{
				$sql = sprintf("update $TABLE[spielplan] set Datum='%s', Uhrzeit='%s', Ergebnis='%s' 
							where sid = %d", convertDate($d['Date']), $d['Time'], $d['Result'], $d['sid']);
				query($sql);
			}
			
			//  Liga berechnen
			if (checkDeadline($trid, $md)) calcLeague($trid, $md);
			
            jsonout(array('ok' => true, 'message'=>'Spielplan gespeichert!'));
            return;
		}
		jsonout(array('ok' => true));
		return;
	}
	
    jsonout(array('ok' => false, 'message'=>'Keine Berechtigung!'));
?>
