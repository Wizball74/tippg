<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
					***(getTipSummary.php)
 */

	require_once('getBaseData.php');
	require_once('json.php');

	$colModel = array();
	$rows = array();

	if (isset($_POST['trid']) && isset($_POST['md']))
	{
		require_once('funcs.php');

		$trid = $_POST['trid'];
		$md = $_POST['md'];
		$json = Array();
		$member=$_SESSION['member'];
		$rnd = $_SESSION['trrow']['STRND'][$md];
		$start = $_SESSION['trrow']['s'][$rnd];
		$end = $_SESSION['trrow']['e'][$rnd];

		// Datenmodell
		$colModel[] = array('label' => "#", 'width' => 25, 'name' => "Pos", 'align' => 'right', 'sorttype' => 'int', 'classes'=>'Pos');              			
		$colModel[] = array('label' => "Name", 'width' => 180, 'name' => "Name", 'align' => 'left', 'classes'=>'Name');              			
		$colModel[] = array('label' => "Pkt.", 'width' => 40, 'name' => "Pts", 'align' => 'right', 'sorttype' => 'int', 'classes'=>'Pts');              			
		for ($i = $start; $i<= $end; $i++)
		{
			$colModel[] = array('label' => $i, 'width' => 25, 'name' => 's'.$i, 'align' => 'right', 'sortable' => false , 'classes' => '');
		}

		$colModel[] = array('label' => "Prämie", 'width' => 60, 'name' => "Bonus", 'align' => 'right', 'formatter' => 'currency', 'sorttype' => 'currency',
							formatoptions => array("defaultValue"=>""), 'classes' => 'Bonus'); 
		$colModel[] = array('name' => "id", 'key' => true, 'hidden' => true);
		$colModel[] = array('name' => "cls", 'hidden' => true);

		// Daten
		unset($data);
		
		unset($cls);
		$tnid = $_SESSION['user']['tnid']; 
		$cls[$tnid] = 'rowUser';
		
		unset($pts);
		foreach($member[$rnd] as $m)
		{
			$pts[$m['tnid']] = 0;	
		}
		
		for ($i = $start; $i<= $end; $i++)
		{
			$tips[$i] = matchdaySummary($trid, $i);		
								
			foreach($member[$rnd] as $m)
			{
				$pts[$m['tnid']] += $tips[$i][$m['tnid']]['Points'];	
			}
		}	
		
		arsort($pts);
	
		$bonus = getBonus($rnd,0,$pts);

		$idx=0;
		foreach ($pts as $tnid=>$p)
		{	
			$m = $member[$rnd][$tnid];
			$data[$idx] = array(
				'Pos' => $idx+1,
				'Name' => $m['name'],
				'id' => $m['tnid'],
				'Pts' => $p, 
				'Bonus' => isset($bonus[$tnid]) ? sprintf("%3.2f",$bonus[$tnid]) : '',
				'cls' => $cls[$m['tnid']]
				);
				for ($i = $start; $i<= $end; $i++)
				{
					$data[$idx]["s$i"] = $tips[$i][$tnid]['Points'];				
				}
				$idx++;
		}
		
		$rows = $data;
		if (!isset($rows)) $rows = array();
	}

	// Ausgabe
	$data = array('Records' => count($rows), 'Rows' => $rows);
	$json = array('colModel' => $colModel, 'data' => $data, 'sortname' => 'Pts', 'sortorder' => 'desc');
	jsonout($json);
	
?>
