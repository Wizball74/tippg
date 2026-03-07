<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
                        ***(getTipsAdmin.php)
 */

    require_once('getBaseData.php');
    require_once('json.php');

    $colModel = array();
    // Datenmodell
    $colModel[] = array('label' => "Heimteam", 'width' => 200, 'name' => "HTeam");
    $colModel[] = array('label' => "Auswärtsteam", 'width' => 200, 'index' => "ATeam", 'name' => "ATeam");
    $colModel[] = array('label' => "Datum", 'width' => 90, 'name' => "Date", 'align' => 'right', 'formatter' => 'date');
    $colModel[] = array('label' => "Uhrzeit", 'width' => 90, 'name' => "Time", 'align' => 'center', 'formatter' => 'date',
                        formatoptions => array('srcformat' => 'H:i:s', 'newformat' => 'H:i' ));
    $colModel[] = array('label' => "Tipp", 'width' => 90, 'name' => "Tip", 'align' => 'center', 'classes' => "Result", 
                        'editable' => true, 'editoptions' => array('size'=>5, 'maxlength' => 5, 'class'=>'gradient'));

    $colModel[] = array('name' => "editable", 'hidden' => true);
    $colModel[] = array('name' => "sid", 'key' => true, 'hidden' => true);
    $colModel[] = array('name' => "id", 'key' => true, 'hidden' => true);
    $colModel[] = array('name' => "tnid", 'hidden' => true);
    $colModel[] = array('name' => "Tip_old", 'hidden' => true);

    $rows = array();

	if (($_SESSION['user']['userlevel'] == 100) 
        && isset($_POST['trid']) && isset($_POST['md']) && isset($_POST['tnid']))
	{
		require_once('funcs.php');
	
        // Daten
		$userid = $_POST['tnid'];
		$trid = $_POST['trid'];
		$md = $_POST['md'];
		
		if ($userid > 0)
		{
		  	$sql = "select s.*, t.Tipp, $userid as tnid from $TABLE[spielplan] s left join $TABLE[tipps] t on s.sid = t.sid AND (t.tnid = $userid OR t.tnid IS NULL)
			        where s.trid = $trid AND s.sptag = $md";
					
			$result = query($sql);
			unset($tips);
			$teams=$_SESSION['teams'];
		    while ($row=mysql_fetch_assoc($result))
		    {
		    	$tips[] = array(
					'sid' => $row['sid'],
                    'id' => $row['sid'],
					'HTeam' => $teams[$row['tid1']]['Name'],
					'ATeam' => $teams[$row['tid2']]['Name'],
					'Date' => $row['Datum'],
					'Time' => $row['Uhrzeit'],
					'Tip' => $row['Tipp'],
					'Tip_old' => $row['Tipp'],
					'editable' => true,		
					'tnid' => $row['tnid']
				);
		    }   
		}
		$rows = $tips;
		if (!isset($rows)) $rows = array();
	}

	// Ausgabe
	$data = array('Records' => count($rows), 'Rows' => $rows);
	$json = array('colModel' => $colModel, 'data' => $data);
	jsonout($json);
?>
