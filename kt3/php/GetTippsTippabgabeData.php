<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
					***(getSchedule.php)
 */

	require_once('getBaseData.php');
	require_once('json.php');

	$colModel = array();
	$rows = array();

	if (isset($_POST['trid']) && isset($_POST['md']))
	{
		require_once('funcs.php');

		// Datenmodell
		$colModel[] = array('label' => " ", 'width' => 20, 'name' => "HLogo", 'formatter' => 'logo');
		$colModel[] = array('label' => "Heimteam", 'width' => 200, 'name' => "HTeam", 'formatter' => 'html');
		$colModel[] = array('label' => " ", 'width' => 20, 'name' => "ALogo", 'formatter' => 'logo');
		$colModel[] = array('label' => "Auswärtsteam", 'width' => 200, 'index' => "ATeam", 'name' => "ATeam", 'formatter' => 'html');
		$colModel[] = array('label' => "Datum", 'width' => 90, 'name' => "Date", 'align' => 'right', 'formatter' => 'date');
		$colModel[] = array('label' => "Uhrzeit", 'width' => 90, 'name' => "Time", 'align' => 'center', 'formatter' => 'date',
							formatoptions => array('srcformat' => 'H:i:s', 'newformat' => 'H:i' ));
		$colModel[] = array('label' => "Tipp", 'width' => 90, 'name' => "Tip", 'align' => 'center', 'classes' => "Result", 
							'editable' => true, 'editoptions' => array('size'=>5, 'maxlength' => 5, 'class'=>'gradient'));

		$colModel[] = array('width' => 90, 'name' => "editable", 'hidden' => true);
		$colModel[] = array('width' => 90, 'name' => "sid", 'key' => true, 'hidden' => true);
		$colModel[] = array('width' => 90, 'name' => "id", 'key' => true, 'hidden' => true);
		$colModel[] = array('width' => 90, 'name' => "tnid", 'hidden' => true);
		$colModel[] = array('width' => 90, 'name' => "deadline", 'hidden' => true);
		$colModel[] = array('width' => 90, 'name' => "tidH", 'hidden' => true);
		$colModel[] = array('width' => 90, 'name' => "tidA", 'hidden' => true);
		
		// Daten
		$userid = $_SESSION['user']['tnid'];
		$trid = $_POST['trid'];
		$md = $_POST['md'];
		
		$sql = "select s.*, t.Tipp, $userid as tnid from $TABLE[spielplan] s left join $TABLE[tipps] t on s.sid = t.sid AND (t.tnid = $userid OR t.tnid IS NULL)
				where s.trid = $trid AND s.sptag = $md".
				" ORDER BY Datum, Uhrzeit";
				
		$result = query($sql);
		unset($tips);
		$teams=$_SESSION['teams'];
		
		$ed = !checkDeadline($trid, $md);
		$dl = date('d.m.Y H:i', getDeadline($trid, $md));
		while ($row=mysql_fetch_assoc($result))
		{
			$tips[] = array(
				'sid' => $row['sid'],
				'id' => $row['sid'],
				'HTeam' => $teams[$row['tid1']]['Name'],
				'ATeam' => $teams[$row['tid2']]['Name'],
				'HLogo' => $row['tid1'],
				'ALogo' => $row['tid2'],
				'Date' => $row['Datum'],
				'Time' => $row['Uhrzeit'],
				'Tip' => $row['Tipp'],
				'editable' => $ed,		
				'deadline' => $dl,
				'tnid' => $row['tnid'],
				'tidH' => $row['tid1'],
				'tidA' => $row['tid2']				
			);
		}   
        //'<div class="logo"></div>'.

		$rows = $tips;
		if (!isset($rows)) $rows = array();
	}

	// Ausgabe
	$data = array('Records' => count($rows), 'Rows' => $rows);
	$json = array('colModel' => $colModel, 'data' => $data);
	jsonout($json);
	
?>
