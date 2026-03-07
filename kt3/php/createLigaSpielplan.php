<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
					***(_createLeagueSchedule.php)
 */

	require_once('getBaseData.php');
    require_once('json.php');
        
	session_start();
	if ($_SESSION['user']['userlevel'] == 100)
	{
		if (isset($_POST['data'])  && isset($_POST['trid']) && isset($_POST['rnd']))
		{
			require_once('../mysql.php');
			
			$data = $_POST['data'];
			$trid = $_POST['trid'];
			$rnd = $_POST['rnd'];
			$start = $_SESSION['trrow']['s'][$rnd];
			$end = $_SESSION['trrow']['e'][$rnd];
			$league = $_POST['lnr'];           

			// Umsetzungstabelle Teamid => Teilnehmerid
			foreach($data as $d) $tnid[$d['LNr']] = $d['tnid'];
            //print_r($tnid);
            if (count($tnid) == 1)
            {
                unset($tnid);
                $i=1;
                foreach($data as $d) $tnid[$i++] = $d['tnid'];
            }
            //print_r($tnid);
			if (count($tnid) != 18)
			{
                jsonout(array('ok'=>false, 'message'=>'Fehler bei der Spielernumerierung.'));
				exit;
			}
			
			$sql= "select distinct tid1 from $TABLE[spielplan] where trid=$trid and sptag between $start and $end";
			$idx=1;
			$result=query($sql);
			while ($row=mysql_fetch_assoc($result))
			{
				$transform[$row['tid1']] = $tnid[$idx];
				$idx++;
			}
			
			if (count($transform) != 18)
			{
                jsonout(array('ok'=>false, 'message'=>'Fehler bei der Teamzuordnung. Spielplan richtig importiert?'));
				exit;
			}
			// Spielplan generieren			
			$sql= "select tid1, tid2, sptag from $TABLE[spielplan] where trid=$trid and sptag between $start and $end order by sptag,sid";

			$result=query($sql);
			while ($row=mysql_fetch_assoc($result))
			{
				$tn1 = $transform[$row['tid1']];
				$tn2 = $transform[$row['tid2']];
				
				query(sprintf("insert into $TABLE[ligaergebnis] (trid,sptag,Liga,tnid1,tnid2,Ergebnis) values(%d, %d, %d, %d, %d, '-:-')",
							   $trid, $row['sptag'], $league, $tn1, $tn2)); 	
			}
            jsonout(array('ok'=>true, 'message'=>'Spielplan erstellt!'));
            exit;
		}

        jsonout(array('ok'=>false, 'message'=>'Fehler bei der Datenübermittlung. Bitte noch mal versuchen.'));
		exit;
	}
    jsonout(array('ok'=>false, 'message'=>'Keine Berechtigung!'));
?>
