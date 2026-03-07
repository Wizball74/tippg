<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
					***(getLeagueTable.php)
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
		$lnr = $_POST['lnr'];

		$json = Array();
		$rnd = $_SESSION['trrow']['STRND'][$md];
		$member = $_SESSION['member'][$rnd];

		unset ($league);
		
		if(is_array($member))
		{
			foreach($member as $m)
			{
				$league[$m['Liga']][] = array('tnid' => $m['tnid'], 'LNr' => $m['LNr'] );
			}

			$l = $league[$lnr];
			if (is_array($l))
			{
					$colModel[] = array('label' => "Platz", 'width' => 60, 'name' => "Pos", 'align' => 'right', 'sorttype' => 'int');
					$colModel[] = array('label' => "Name", 'width' => 180, 'name' => "Name");
					$colModel[] = array('label' => "Pkt", 'width' => 40, 'name' => "Pts", 'align' => 'right', 'sorttype' => 'int');

					if($l[0]['LNr'] > 0)
					{
						$colModel[] = array('label' => "Tore", 'width' => 80, 'name' => "Goals", 'align' => 'right');
						$colModel[] = array('label' => "Diff", 'width' => 60, 'name' => "Diff", 'align' => 'right', 'sorttype' => 'int');
						$colModel[] = array('label' => "Sp.", 'width' => 50, 'name' => "Matches", 'align' => 'right', 'sorttype' => 'int');
						$colModel[] = array('label' => "S", 'width' => 40, 'name' => "Win", 'align' => 'right', 'sorttype' => 'int');
						$colModel[] = array('label' => "U", 'width' => 40, 'name' => "Draw", 'align' => 'right', 'sorttype' => 'int');
						$colModel[] = array('label' => "N", 'width' => 40, 'name' => "Loss", 'align' => 'right', 'sorttype' => 'int');

						$result[$lnr] = createLeagueTable($league[$lnr],$trid,$rnd,$lnr);
					}
					else
					{
						$result[$lnr] = createSimpleTable($league[$lnr],$trid,$rnd);
					}
					
					$colModel[] = array('name' => "tnid", 'key' => true, 'hidden' => true);
					$colModel[] = array('name' => "cls", 'hidden' => true);
			}
		}

		$rows = $result[$lnr];
		if (!isset($rows)) $rows = array();
	}
	
	// Ausgabe
	$data = array('Records' => count($rows), 'Rows' => $rows);
	$json = array('colModel' => $colModel, 'data' => $data);
	jsonout($json);
?>
