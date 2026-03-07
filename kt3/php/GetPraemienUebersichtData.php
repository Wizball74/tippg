<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
					***(getBonus.php)
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
		$teams = $_SESSION['teams'];
		$member=$_SESSION['member'];
		$rnd = $_SESSION['trrow']['STRND'][$md];
		
		$start = $_SESSION['trrow']['s'][$rnd];
		$end = $_SESSION['trrow']['e'][$rnd];
		
		$bon = $_SESSION['bonus'][$rnd];	

		// Datenmodell
		$colModel[] = array('label' => "Name", 'width' => 180, 'name' => "Name", 'align' => 'left', 'classes'=>'Name');              			
		$colModel[] = array('label' => "Spieltage", 'width' => 100, 'name' => "Matches", 'align' => 'right', 'formatter' => 'currency', 'sorttype' => 'currency', formatoptions => array("defaultValue"=>"")); 		
		$colModel[] = array('label' => "Gesamtwertung", 'width' => 100, 'name' => "Total", 'align' => 'right', 'formatter' => 'currency', 'sorttype' => 'currency', formatoptions => array("defaultValue"=>"")); 		
		$colModel[] = array('label' => "Ligawertung", 'width' => 100, 'name' => "League", 'align' => 'right', 'formatter' => 'currency', 'sorttype' => 'currency', formatoptions => array("defaultValue"=>"")); 		
		$colModel[] = array('label' => "Einsatz", 'width' => 100, 'name' => "Stake", 'align' => 'right', 'formatter' => 'currency', 'sorttype' => 'currency', formatoptions => array("defaultValue"=>"")); 		
		$colModel[] = array('label' => "Ligaeinsatz", 'width' => 100, 'name' => "StakeLeague", 'align' => 'right', 'formatter' => 'currency', 'sorttype' => 'currency', formatoptions => array("defaultValue"=>"")); 		
		$colModel[] = array('label' => "Summe", 'width' => 100, 'name' => "Sum", 'align' => 'right', 'formatter' => 'currency', 'sorttype' => 'currency', formatoptions => array("defaultValue"=>""), 'classes' => 'Bonus'); 		
		$colModel[] = array('name' => "id", 'key' => true, 'hidden' => true);
		$colModel[] = array('name' => "cls", 'hidden' => true);
		
		// data
	
		unset($cls);
		$tnid = $_SESSION['user']['tnid']; 
		$cls[$tnid] = 'rowUser';

		// matches
		for ($i = $start; $i<= $end; $i++)
		{
			$tips[$i] = matchdaySummary($trid, $i);		
			//print_r($tips[$i]);
			//unset($pts);
			foreach($member[$rnd] as $m)
			{
				if (isset($tips[$i][$m['tnid']]['Points']))
				{
					$pts[$i][$m['tnid']] = $tips[$i][$m['tnid']]['Points'];	
					$pts[0][$m['tnid']] += $pts[$i][$m['tnid']]; //$tips[$i][$m['tnid']]['Points'];
				}	
			}
			//print_r($pts[$i]);
			$b[$i] = getBonus($rnd,'-1',$pts[$i]);
			//print_r($b[$i]);
			
			if(is_array($b[$i]))			
				foreach($b[$i] as $tnid => $bo)											
				{
					$matches[$tnid] += $bo;
				}
		}	
		
		// total
		$total = getBonus($rnd,0,$pts[0]);	
		
		// Ligawertungen 
		foreach($member[$rnd] as $m)
		{
			$leagues[$m['Liga']][] = array(
				'tnid' => $m['tnid'],
				'LNr' => $m['LNr'],
			);
		}

		if (is_array($leagues))
		{
			foreach ($leagues as $nr=>$l)
			{
				unset($b);
				if($l[0]['LNr'] > 0)
				{
					$result[$nr] = createLeagueTable($l,$trid,$rnd,$nr);
					if(is_array($result[$nr]))
					{
						unset($pts);
						foreach($result[$nr] as $r) $pts[$r['tnid']] = 100*$r['Pts']+$r['Diff'];
						$b = getBonus($rnd,$nr,$pts);
					}
				}
				else
				{
					$result[$nr] = createSimpleTable($l,$trid,$rnd);
					if(is_array($result[$nr]))
					{
						unset($pts);
						foreach($result[$nr] as $r) $pts[$r['tnid']] = $r['Pts'];
						$b = getBonus($rnd,$nr,$pts);
					}
				}
				
				if(is_array($b))			
					foreach($b as $tnid => $bo)	$league[$tnid] += $bo;
			}
		}	    

		foreach($member[$rnd] as $m)
		{
			// stakes
			$stakesLeague[$m['tnid']] = $bon[$m['Liga']][0];
			
			$bonus[] = array(
				'Name'  => $m['name'],
				'id' => $m['tnid'],
				'cls' => $cls[$m['tnid']],
				'Matches' => isset($matches[$m['tnid']]) ? sprintf("%3.2f",$matches[$m['tnid']]) : '', 
				'Total' => isset($total[$m['tnid']]) ? sprintf("%3.2f",$total[$m['tnid']]) : '', 
				'League' => isset($league[$m['tnid']]) ? sprintf("%3.2f",$league[$m['tnid']]) : '', 
				'Stake' => sprintf("-%3.2f",$bon[0][0]),
				'StakeLeague' => isset($stakesLeague[$m['tnid']]) ? sprintf("-%3.2f",$stakesLeague[$m['tnid']]) : '', 
				'Sum' => sprintf("%3.2f",$matches[$m['tnid']] + $total[$m['tnid']] + $league[$m['tnid']] 
										- $bon[0][0] - $stakesLeague[$m['tnid']])
			);
		}

		
		$rows = $bonus;
		if (!isset($rows)) $rows = array();
	}

	// Ausgabe
	$data = array('Records' => count($rows), 'Rows' => $rows);
	$json = array('colModel' => $colModel, 'data' => $data, 'sortname' => 'Sum', 'sortorder' => 'desc');
	jsonout($json);

?>
