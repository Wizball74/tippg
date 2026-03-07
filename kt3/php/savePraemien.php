<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
					***(saveBonusData.php)
 */

  	require_once('json.php');
	session_start();

    if ($_SESSION['user']['userlevel'] == 100){

	    if (isset($_POST['data']) && isset($_POST['trid']))
	    {
		    session_start();
		
		    require_once('../mysql.php');
		
		    $data = $_POST['data'];
		    $trid = $_POST['trid'];
		    $rnd = $_POST['rnd'];
		
		    unset ($result);
		    foreach ($data as $d)
		    {
			    $result[] = array(
				    'trid' => $trid,
				    'LRnd' => $rnd,
				    'Liga' => -1,
				    'Platz' => $d['idx'],
				    'betrag' => $d['Match']
			    );
			    $result[] = array(
				    'trid' => $trid,
				    'LRnd' => $rnd,
				    'Liga' => 0,
				    'Platz' => $d['idx'],
				    'betrag' => $d['Total']
			    );
			    $result[] = array(
				    'trid' => $trid,
				    'LRnd' => $rnd,
				    'Liga' => 1,
				    'Platz' => $d['idx'],
				    'betrag' => $d['L1']
			    );
			    $result[] = array(
				    'trid' => $trid,
				    'LRnd' => $rnd,
				    'Liga' => 2,
				    'Platz' => $d['idx'],
				    'betrag' => $d['L2']
			    );
		    }
		
		    foreach($result as $r)
		    {
			    if ($r['betrag'] > 0) 
				    $sql = sprintf("replace into $TABLE[praemien] (trid,LRnd,Liga,Platz,betrag) values (%d,%d,%d,%d,%01.2f)",
                           $r['trid'], $r['LRnd'], $r['Liga'], $r['Platz'],str_replace(',','.',$r['betrag']) );
			    else
				    $sql = sprintf("delete from $TABLE[praemien] where trid=%d AND LRnd=%d AND Liga=%d AND Platz=%d",
						   $r['trid'], $r['LRnd'], $r['Liga'], $r['Platz']);

			    query($sql);
		    }

		    // Prämien neu laden
    	    unset ($bonus);
    	    $sql="select * from $TABLE[praemien] where trid=$trid";
    	    $result=query($sql);
    	    while ($row=mysql_fetch_assoc($result))
    	    {
      		    $bonus[$row['LRnd']][$row['Liga']][$row['platz']] = $row['betrag'];
    	    } // while
    	    $_SESSION['bonus'] = $bonus;
		
            jsonout(array('ok' => true, 'message'=>'Daten gespeichert!'));
            return;
	    }
    
    }

    jsonout(array('ok' => false, 'message'=>'Keine Berechtigung!'));

?>