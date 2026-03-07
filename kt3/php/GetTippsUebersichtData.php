<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
					***(getTipOverview.php)
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
		$teams=$_SESSION['teams'];
		$member=$_SESSION['member'];

		// Datenmodell
		$colModel[] = array('label' => "Name", 'width' => 180, 'name' => "Name");              			
		$sql = "select s.* from $TABLE[spielplan] s where s.trid = $trid AND s.sptag = $md ORDER BY s.sid";			
		$result = query($sql);
		while ($row=mysql_fetch_assoc($result))
		{
			//$hdr = $teams[$row['tid1']]['kurz'].'<p class="hdrRes">'.$row['Ergebnis'].'</p>'.$teams[$row['tid2']]['kurz'];
            //$hdr = sprintf('%s<p class="logo l%s"></p><p class="hdrRes">%s</p><p class="logo l%s"></p>%s',
            //$hdr = sprintf('%s<div class="hdrRes"><p class="logo l%s"></p><p class="hdrRes">%s</p><p class="logo l%s"></p></div>%s',
            $hdr = sprintf('%s<p class="hdrRes">%s</p>%s',
                        $teams[$row['tid1']]['kurz'],
                        //$row['tid1'],
                        $row['Ergebnis'],
                        //$row['tid2'],
                        $teams[$row['tid2']]['kurz']
            );
            
            $ttip = sprintf("%s\r\n\t%s\r\n%s", 
                        //'<div class="logo"></div>',
                        $teams[$row['tid1']]['Name'], 
                        $row['Ergebnis'], 
                        $teams[$row['tid2']]['Name']
            );

			$colModel[] = array('label' => $hdr, 'width' => 50, 'name' => 't'.$row['sid'], 'align' => 'center', 'sortable' => false, 'resizable' => false,
                                'classes' => 'Tipps', 'hdrtooltip' =>  $ttip);
			$colModel[] = array('label' => ' ', 'width' => 20, 'name' => 'p'.$row['sid'], 'align' => 'center', 'sortable' => false,  'resizable' => false, 
                                'classes' => 'Pts1');
		}   
		
		$colModel[] = array('label' => "Pkt.", 'width' => 40, 'name' => "Pts", 'align' => 'right', 'sorttype' => 'int', 'classes' => 'Pts');
		$colModel[] = array('label' => "Prämie", 'width' => 80, 'name' => "Bonus", 'align' => 'right', 'formatter' => 'currency', 'sorttype' => 'currency',
							formatoptions => array("defaultValue"=>""), 'classes' => 'Bonus'); 
		$colModel[] = array('name' => "id", 'key' => true, 'hidden' => true);
		$colModel[] = array('name' => "cls", 'hidden' => true);
		
		// Daten
		$tnid = $_SESSION['user']['tnid'];
		$tnidop = getLeagueOpponent($trid,$md);

		unset($data);
		unset($pts);
		unset($cls);
		$cls[$tnid] = 'rowUser';
		$cls[$tnidop] = 'rowOpponent';

		$idx=0;

		$rnd = $_SESSION['trrow']['STRND'][$md];	
		$tips = matchdaySummary($trid, $md);
		unset($pts);
		if(is_array($tips))
		{
			foreach ($tips as $tnid=>$t)
			{
				if (isset($tips[$tnid]['Points'])) $pts[$tnid] = $tips[$tnid]['Points'];			
			}
			$bonus = getBonus($rnd,'-1',$pts);
		}
		foreach ($member[$rnd] as $m)
		{
			$data[$idx] = array(
				'Name' => $m['name'],
				'id' => $m['tnid'],
				'Pts' => $tips[$m['tnid']]['Points'],
				'Bonus' => isset($bonus[$m['tnid']]) ? sprintf("%3.2f",$bonus[$m['tnid']]) : '',
				'cls' => $cls[$m['tnid']]
				);
				
				if (is_array($tips[$m['tnid']]['Tips']))
					foreach($tips[$m['tnid']]['Tips'] as $sid => $t)
					{
						$data[$idx]["t$sid"] = $t['Tip'];
						$data[$idx]["p$sid"] = $t['Points'];
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
