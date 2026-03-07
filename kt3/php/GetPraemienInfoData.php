<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
					***(getBonusData.php)
 */

	require_once('getBaseData.php');
	require_once('json.php');

	$colModel = array();
	$rows = array();

	if (isset($_POST['trid']) && isset($_POST['md']))
	{
		$rnd = $_POST['rnd'];
		if (!isset($rnd)) $rnd = 1;

		$lcnt = $_SESSION['trrow']['Ligen'];

        $edit = ($_SESSION['user']['userlevel'] == 100) && ($_POST['edit']);

		// Datenmodell	
        $colModel[] = array('label' => " ", 'width' => 70, 'name' => "Desc", 'align' => 'left', 'sortable' => false);              			
        $colModel[] = array('name' => "idx", 'key' => true, 'hidden' => true);              			
		$colModel[] = array('label' => "Tageswertung", 'width' => 110, 'name' => "Match", 'align' => 'right', 'formatter' => 'currency', 
                            'sortable' => false, 'formatoptions' => array("defaultValue"=>""), 
                            'editable' => $edit, 'editoptions' => array('size'=>6, 'maxlength'=>6,'class'=>'gradient'));
		$colModel[] = array('label' => "Gesamtwertung", 'width' => 120, 'name' => "Total", 'align' => 'right', 'formatter' => 'currency', 
                            'sortable' => false, 'formatoptions' => array("defaultValue"=>"",'decimalSeparator'=>','), 
                            'editoptions' => array('delimiter'=>','), 
                            'editable' => $edit, 'editoptions' => array('size'=>6, 'maxlength'=>6,'class'=>'gradient'));

        for($i=1; $i<=$lcnt; $i++)
		    $colModel[] = array('label' => "Liga ".$i, 'width' => 80, 'name' => "L".$i, 'align' => 'right', 'formatter' => 'currency', 
                            'sortable' => false, 'formatoptions' => array("defaultValue"=>""), 
                            'editable' => $edit, 'editoptions' => array('size'=>6, 'maxlength'=>6,'class'=>'gradient'));

        // Daten
		$bon = $_SESSION['bonus'][$rnd];		
		
		$b = array(
			'idx' => 0, 
			'Desc' => 'Einsatz',
			'Match' => defValue($bon[-1][0]),
			'Total' => defValue($bon[0][0]),
            'editable' => $edit
		);
        for($i=1; $i<=$lcnt; $i++) $b['L'.$i] = defValue($bon[$i][0]);
        $bonus[] = $b;
		
		for ($i=1; $i<=20;$i++)
		{
			$b = array(
				'idx' => $i, 
				'Desc' => "Platz $i",
				'Match' => defValue($bon[-1][$i]),
				'Total' => defValue($bon[0][$i]),
                'editable' => $edit
			);			
            for($j=1; $j<=$lcnt; $j++) $b['L'.$j] = defValue($bon[$j][$i]);
            $bonus[] = $b;
		}	
		
        $ud = $_SESSION['_rnds'][$rnd];

		$rows = $bonus;
		if (!isset($rows)) $rows = array();
	}

	// Ausgabe
	$data = array('Records' => count($rows), 'Rows' => $rows);
	$json = array('colModel' => $colModel, 'data' => $data, 'userdata'=>  $ud); 
    //, 'sortname' => 'Sum', 'sortorder' => 'desc');
	jsonout($json);

?>
