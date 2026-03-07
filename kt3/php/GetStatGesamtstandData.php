<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
					***(getStatPoints.php)
 */
	require_once('getBaseData.php');
	require_once('json.php');	
	require_once('funcs.php');
    
    //$colModel[] = array('label' => "Platz", 'width' => 60, 'name' => "Pos", 'align' => 'right', 'sorttype' => 'int');
    $colModel[] = array('label' => "Name", 'width' => 200, 'name' => "Name");
    $colModel[] = array('label' => "Pkt", 'width' => 50, 'name' => "Pts", 'align' => 'right', 'sorttype' => 'int');
    
    $colModel[] = array('label' => "3er", 'width' => 50, 'name' => "3er", 'align' => 'right', 'sorttype' => 'int');
    $colModel[] = array('label' => "2er", 'width' => 50, 'name' => "2er", 'align' => 'right', 'sorttype' => 'int');
    $colModel[] = array('label' => "Runden", 'width' => 70, 'name' => "Runden", 'align' => 'right', 'sorttype' => 'int');
    $colModel[] = array('label' => "Pkt/Runde", 'width' => 90, 'name' => "PPR", 'align' => 'right', 'sorttype' => 'float',
                    'formatter' => 'number', 'formatoptions'=> array('decimalSeparator'=>','));
    
    $colModel[] = array('name' => "tnid", 'key' => true, 'hidden' => true);
    $colModel[] = array('name' => "cls", 'hidden' => true);
   
		
	unset($cls);
	$tnid = $_SESSION['user']['tnid'];
	$cls[$tnid] = 'rowUser';
	
	$sql= "SELECT s.sid, s.Ergebnis, t.Tipp, t.tnid, s.trid
			FROM $TABLE[spielplan] s INNER JOIN $TABLE[tipps] t ON s.sid = t.sid
			WHERE s.Datum < '".date("Y-m-d")."' AND s.Ergebnis <> '-:-'
			AND s.trid IN (SELECT trid FROM $TABLE[tipprunde] WHERE Aktiv='J')
			ORDER BY t.tnid, s.sid";
			
	$result = query($sql);
	//echo $sql;	
	unset($pts);
	unset($cnt);
	while ($row=mysql_fetch_assoc($result))
	{
		//print_r($row);
		//echo "<br>".$row['Tipp'].'#'.$row['Ergebnis'].'#'.evaluateTip($row['Tipp'],$row['Ergebnis']);
		$e = evaluateTip($row['Tipp'],$row['Ergebnis']);
		$pts[$row['tnid']][$e]++;
		$pts[$row['tnid']]['sum'] += $e;
		$cnt[$row['tnid']][$row['trid']] ++;
	}
	
	$member=$_SESSION['member'][-1];

	$sql="select trid, Runden from $TABLE[tipprunde] where Aktiv='J'";
	$result = query($sql);
	unset($sprnd);
	while ($row=mysql_fetch_assoc($result)) $sprnd[$row['trid']] = 306/$row['Runden']; // 306 = (18/2)*(18-1)*2
	
	foreach($cnt as $m=>$x)
	{
		foreach ($x as $s=>$c)
		{
			$cnt[$m][$s] /= $sprnd[$s];
			$cnt[$m][$s] = ceil($cnt[$m][$s]);
			$cnt[$m]['sum'] += $cnt[$m][$s];
		}
	}
	//echo"<pre>";
	//print_r($member);
	//print_r($cnt);
	//echo $userid;
	//exit();
	unset($data);
    $pos=1;
	foreach ($pts as $m=>$d)
	{
		$data[] = array(
            //'Pos' => $pos++,
			'tnid' => $m,
			'Name' => $member[$m]['name'],
			'Pts' => $pts[$m]['sum'],
			'Runden' => $cnt[$m]['sum'],
			'3er' => $pts[$m][3],
			'2er' => $pts[$m][2],
			'PPR' => sprintf("%.2f", $pts[$m]['sum'] / $cnt[$m]['sum']),
			'cls' => $cls[$m]
		);
	}   
	//print_r($data);
		
	$rows = $data;
	if (!isset($rows)) $rows = array();
	
	// Ausgabe
	$data = array('Records' => count($rows), 'Rows' => $rows);
	$json = array('colModel' => $colModel, 'data' => $data, 'sortname' => 'Pts', 'sortorder' => 'desc');
	jsonout($json);
?>
	