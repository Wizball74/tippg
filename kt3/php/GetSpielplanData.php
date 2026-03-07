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
		$edit = ($_SESSION['user']['userlevel'] == 100) && ($_POST['edit']);

		// Datenmodell
        $colModel[] = array('label' => " ", 'width' => 20, 'name' => "HLogo", 'formatter' => 'logo');
		$colModel[] = array('label' => "Heimteam", 'width' => 200, 'name' => "HTeam", 'formatter' => 'html');
        $colModel[] = array('label' => " ", 'width' => 20, 'name' => "ALogo", 'formatter' => 'logo');
		$colModel[] = array('label' => "Auswärtsteam", 'width' => 200, 'index' => "ATeam", 'name' => "ATeam", 'formatter' => 'html');
		$colModel[] = array('label' => "Datum", 'width' => 90, 'name' => "Date", 'align' => 'right', 'formatter' => 'date',
						'editable' => $edit, 'editoptions' => array('size'=>10, 'maxlength'=>10,'class'=>'gradient'));
		$colModel[] = array('label' => "Uhrzeit", 'width' => 90, 'name' => "Time", 'align' => 'center', 'formatter' => 'date',
							'formatoptions' => array('srcformat' => 'H:i:s', 'newformat' => 'H:i' ), 
							'editable' => $edit, 'editoptions' => array('size'=>5, 'maxlength'=>5,'class'=>'gradient'));
		$colModel[] = array('label' => "Ergebnis", 'width' => 90, 'name' => "Result", 'align' => 'center', 'classes' => "Result", 
							'editable' => $edit, 'editoptions' => array('size'=>5, 'maxlength'=>5,'class'=>'gradient'));
		$colModel[] = array('name' => "sid", 'hidden' => true, 'key' => true);
		
		// Daten

		$sql = "select *, DATE_FORMAT(Datum, '%d.%m.%Y') AS DatumF from $TABLE[spielplan] where trid = " .$_POST['trid'].
				" AND sptag = ".$_POST['md'].
				" ORDER BY Datum, Uhrzeit";
		$result = query($sql);
		unset($schedule);
		$teams=$_SESSION['teams'];
		while ($row=mysql_fetch_assoc($result))
		{
			$schedule[] = array(
				'sid' => $row['sid'],
				'HTeam' => $teams[$row['tid1']]['Name'],
				'ATeam' => $teams[$row['tid2']]['Name'],
				'HLogo' => $row['tid1'],
				'ALogo' => $row['tid2'],
				'Date' => $row['Datum'],
				'Time' => $row['Uhrzeit'],
				'Result' => $row['Ergebnis'],
				'editable' => $edit
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
