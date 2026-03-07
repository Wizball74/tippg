<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
				***(getRounds.php)
 */

    require_once('getBaseData.php');
    require_once('json.php');

    $colModel = array();
    $rows = array();

	if (isset($_SESSION['user']))
	{
    
        $colModel[] = array('label' => "Name", 'width' => 200, 'name' => "Name", 
                        'editable' => true, 'editoptions' => array('size'=>50, 'maxlength'=>50,'class'=>'gradient'));
        $colModel[] = array('label' => "trid", 'name' => "trid", 'key' => true, 'hidden' => true); 
        $colModel[] = array('label' => "Start", 'width' => 90, 'name' => "Start", 'align' => 'right', 'formatter' => 'date', 
                        'editable' => true, 'editoptions' => array('size'=>10, 'maxlength'=>10,'class'=>'gradient'));
        $colModel[] = array('label' => "Ende", 'width' => 90, 'name' => "End", 'align' => 'right', 'formatter' => 'date', 
                        'editable' => true, 'editoptions' => array('size'=>10, 'maxlength'=>10,'class'=>'gradient'));
        $colModel[] = array('label' => "Pkt.<br/>exakt. Erg", 'width' => 80, 'name' => "P1", 'align' => 'right', 'sorttype' => 'int', 
                        'editable' => true, 'editoptions' => array('size'=>2, 'maxlength'=>2,'class'=>'gradient'));
        $colModel[] = array('label' => "Pkt.<br/>Tordiff.", 'width' => 80, 'name' => "P2", 'align' => 'right', 'sorttype' => 'int', 
                        'editable' => true, 'editoptions' => array('size'=>2, 'maxlength'=>2,'class'=>'gradient'));
        $colModel[] = array('label' => "Pkt.<br/>Tendenz", 'width' => 80, 'name' => "P3", 'align' => 'right', 'sorttype' => 'int', 
                        'editable' => true, 'editoptions' => array('size'=>2, 'maxlength'=>2,'class'=>'gradient'));
        $colModel[] = array('label' => "Abgabefrist<br/>(in h)", 'width' => 80, 'name' => "Deadline", 'align' => 'right', 'sorttype' => 'int', 
                        'editable' => true, 'editoptions' => array('size'=>3, 'maxlength'=>3,'class'=>'gradient'));
        $colModel[] = array('label' => "Wertungsrunden", 'width' => 120, 'name' => "Rounds", 'align' => 'right', 'sorttype' => 'int', 
                        'editable' => true, 'editoptions' => array('size'=>1, 'maxlength'=>1,'class'=>'gradient'));
        $colModel[] = array('label' => "Ligen", 'width' => 60, 'name' => "Leagues", 'align' => 'right', 'sorttype' => 'int', 
                        'editable' => true, 'editoptions' => array('size'=>1, 'maxlength'=>1,'class'=>'gradient'));
        $colModel[] = array('label' => "sichtbar", 'width' => 60, 'name' => "Active", 'align' => 'right', 
                        'edittype'=> 'checkbox', 'editoptions' => array ('value' => "J:N"), //'formatter' => 'checkbox', 'formatoptions' => array ('value' => "J:N", 'disabled'=>false),
                        'editable' => true);
    
		$user = $_SESSION['user'];
		
		unset($results);

		if ($user['userlevel'] == 100)
		{
			$sql = "select * from $TABLE[tipprunde] order by trid";			
			$result = query($sql);
			while ($row=mysql_fetch_assoc($result)) 
			{		
				$results[] = array(
					'trid' => $row['trid'],
					'Name' => $row['Name'],
					'Start' => $row['Beginn'],
					'End' => $row['Ende'],
					'Creator' => $row['Ersteller'],
					'Active' => $row['aktiv'],
					'P1' => $row['P1'],
					'P2' => $row['P2'],
					'P3' => $row['P3'],
					'Deadline' => $row['deadline'],
					'Rounds' => $row['Runden'],
					'Leagues' => $row['Ligen']
				);				
			}
		}
        $rows = $results;
		if (!isset($rows)) $rows = array();
	}
    
	// Ausgabe
	$data = array('Records' => count($rows), 'Rows' => $rows);
	$json = array('colModel' => $colModel, 'data' => $data);
	jsonout($json);
?>
