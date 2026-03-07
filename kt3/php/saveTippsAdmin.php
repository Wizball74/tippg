<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
                        ***(saveTipsAdmin.php)
 */
 
    require_once('json.php');
 
	session_start();
	if (isset($_POST['data']) && ($_SESSION['user']['userlevel'] == 100))
	{
		require_once('../mysql.php');
		require_once('funcs.php');
				
		$trid = $_POST['trid'];
		$md = $_POST['md'];

		$data = $_POST['data'];
		
		//print_r($data);
		
		foreach ($data as $d)
		{
			
			if ( $d['Tip'] != $d['Tip_old'])
			{
				$sql = sprintf("INSERT INTO $TABLE[adminlog] (uid, kommentar, sid, tnid, alt, neu)
								VALUES (%d,'%s',%d, %d, '%s','%s')",
								$_SESSION['user']['tnid'], $_POST['comment'], $d['sid'], $d['tnid'], $d['Tip_old'], $d['Tip']);
				//echo $sql;
				query($sql);
				$sql = "replace into $TABLE[tipps] (sid,tnid,Tipp) values ({$d['sid']},{$d['tnid']},'{$d['Tip']}')";
				query($sql);
				//echo $sql;
			}
		}
        jsonout(array('ok' => true, 'message'=>'Tipps gespeichert!'));
        return;
	}
	else
	{
		jsonout(array('ok' => true));
	}
?>