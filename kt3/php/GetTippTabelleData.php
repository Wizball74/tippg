<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
						***(getStatTipTable.php)
 */

	require_once('getBaseData.php');
	require_once('json.php');

	$colModel = array();
	$rows = array();
	
	if (isset($_POST['trid']) && isset($_POST['md']))
	{
		// Datenmodell
		$colModel[] = array('label' => "Platz", 'width' => 60, 'name' => "Pos", 'align' => 'right', 'sorttype' => 'int');
        $colModel[] = array('label' => " ", 'width' => 20, 'name' => "Logo", 'formatter' => 'logo');
		$colModel[] = array('label' => "Mannschaft", 'width' => 200, 'name' => "Team");
		$colModel[] = array('label' => "Sp.", 'width' => 30, 'name' => "Matches", 'align' => 'right', 'sorttype' => 'int');
		$colModel[] = array('label' => "S", 'width' => 30, 'name' => "Win", 'align' => 'right', 'sorttype' => 'int');
		$colModel[] = array('label' => "U", 'width' => 30, 'name' => "Draw", 'align' => 'right', 'sorttype' => 'int');
		$colModel[] = array('label' => "N", 'width' => 30, 'name' => "Loss", 'align' => 'right', 'sorttype' => 'int');
		$colModel[] = array('label' => "Tore", 'width' => 60, 'name' => "Goals", 'align' => 'right');
		$colModel[] = array('label' => "Diff", 'width' => 40, 'name' => "Diff", 'align' => 'right', 'sorttype' => 'int');
		$colModel[] = array('label' => "Pkt", 'width' => 40, 'name' => "Pts", 'align' => 'right', 'sorttype' => 'int');
		
		// Daten
		$trid = $_POST['trid'];
		$md = $_POST['md'];
		$mode = $_POST['mode'];
		if (!isset($mode)) $mode = 't'; 
		$teams = $_SESSION['teams'];
		
		$tnid = $_SESSION['user']['tnid'];
		
		$sql = "select * from $TABLE[spielplan] s INNER JOIN $TABLE[tipps] t ON s.sid = t.sid 
				where trid = $trid and sptag <= $md AND tnid=$tnid";
		$result = query($sql);
		while ($row=mysql_fetch_assoc($result))
		{
			$schedule[$row['sptag']][$row['sid']] = $row;
		}    
		
		$data = array();  		
		for ($m=1; $m<=$md; $m++)
		{
			if (is_array($schedule[$m]))
			foreach ($schedule[$m] as $row)
			{
				$t1=$row['tid1']; $t2=$row['tid2']; $result=split(':',$row['Tipp']);
	
				if ($result[0]<>'-')
				{
					if (($mode == 't') || ($mode == 'h')) $data[$t1]['Matches']++;
					if (($mode == 't') || ($mode == 'a')) $data[$t2]['Matches']++;
					if (($mode == 't') || ($mode == 'h')) { $data[$t1]['gf'] += $result[0]; $data[$t1]['ga'] += $result[1]; }
					if (($mode == 't') || ($mode == 'a')) { $data[$t2]['gf'] += $result[1]; $data[$t2]['ga'] += $result[0]; }
	
					if ($result[0] > $result[1])
					{
						if (($mode == 't') || ($mode == 'h')) $data[$t1]['Win']++;
						if (($mode == 't') || ($mode == 'a')) $data[$t2]['Loss']++;
					}
					else
					if ($result[0] < $result[1])
					{
						if (($mode == 't') || ($mode == 'h')) $data[$t1]['Loss']++;
						if (($mode == 't') || ($mode == 'a')) $data[$t2]['Win']++;
					}
					else
					{
						if (($mode == 't') || ($mode == 'h')) $data[$t1]['Draw']++;
						if (($mode == 't') || ($mode == 'a')) $data[$t2]['Draw']++;
					}
				} // if
			} // foreach
		} // for

		if (is_array($data))
		{
			unset($_sort);
			foreach($data as $idx => $s)
			{
				$data[$idx]['Pts']   = 3 * $s['Win'] + $s['Draw'];
				$data[$idx]['Diff']  = $s['gf'] - $s['ga'];
				$data[$idx]['Goals'] = $s['gf'].':'.$s['ga'];
				$data[$idx]['Team']  = $teams[$idx]['Name'];
                $data[$idx]['Logo']  = $teams[$idx]['tid'];

				$_sort['idx'][$idx]  = $idx;
				$_sort['Pts'][$idx]  = $data[$idx]['Pts'];
				$_sort['Diff'][$idx] = $data[$idx]['Diff'];
				$_sort['Goals'][$idx] = $data[$idx]['Goals'];
			} // foreach

			if (is_array($_sort['Pts']))
				array_multisort ($_sort['Pts'],  SORT_DESC, SORT_NUMERIC,
								$_sort['Diff'], SORT_DESC, SORT_NUMERIC,
								$_sort['Goals'], SORT_DESC, SORT_STRING,
								$_sort['idx']);
		} // if

		if (isset($_sort['idx']))
		{
			$_nr=0;
			foreach($_sort['idx'] as $idx)
			{
				$table[$_nr] = $data[$idx];
				$table[$_nr]['Pos'] = $_nr+1;
				$_nr++;
			} // foreach
		} // if

		$rows = $table;
		if (!isset($rows)) $rows = array();
	}

	// Ausgabe
	$data = array('Records' => count($rows), 'Rows' => $rows);
	$json = array('colModel' => $colModel, 'data' => $data);
	jsonout($json);

?>
