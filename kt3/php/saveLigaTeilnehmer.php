<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
					***(saveLeagueMember.php)
 */
 
  	require_once('json.php');
	session_start();
	
	if ($_SESSION['user']['userlevel'] == 100)
	{
		if (isset($_POST['data']))
		{
			require_once('../mysql.php');

            $data = $_POST['data'];
			$trid = $_POST['trid'];
            $rnd = $data[0]['rnd'];           

            if (!empty($rnd))
            {
                query("delete from $TABLE[tr_teilnehmer] where trid=$trid and LRnd=$rnd");
                foreach ($data as $d)
			    {
				    $nr = (isset($d['LNr']))? $d['LNr'] : 0;
				    $sql = sprintf("INSERT INTO $TABLE[tr_teilnehmer] (trid, tnid, Liga, LRnd, LNr)
					    			values(%d,%d,%d,%d,%d)",
								    $trid, $d['tnid'],$d['League'],$rnd, $nr);
				    query($sql);
			    }
            }
			
		    jsonout(array('ok' => true, 'message' => 'Daten gespeichert!'));
		    return;
		}

		jsonout(array('ok' => true));
		return;
	}

    jsonout(array('ok' => true));
?>
