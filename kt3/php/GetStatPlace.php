<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
					***(getStatPlace.php)
 */
	require_once('getBaseData.php');
    require_once('json.php');

    $out = '';

	if (isset($_POST['trid']) && isset($_POST['md']))
	{
		require_once('funcs.php');
		
		$trid = $_POST['trid'];
		$md = $_POST['md'];

		$member=$_SESSION['member'];
		$rnd = $_SESSION['trrow']['STRND'][$md];
		
		//print_r($_SESSION['trrow']);	
		$start = $_SESSION['trrow']['s'][$rnd];
		$end = $_SESSION['trrow']['e'][$rnd];

		//echo count($member[$rnd]);
		
		// Data
		unset($data);
		
		$tnid = $_SESSION['user']['tnid']; 
		
		unset($pts);
		
		for ($i = $start; $i<= $end; $i++)
		{
			$tips[$i] = matchdaySummary($trid, $i);		
			//echo"<b>S$i</b><hr>";
			//print_r($tips[$i]);
			$calc = true;
            if (is_array($tips[$i]))
			    foreach($tips[$i] as $x=>$y)
			    {
				    //echo "$x $y[DL]<br>";
				    //print_r($y);echo"<br>";
				    if (isset($y[DL])) $calc = false;
			    }
			
			if ($calc)
			{
				foreach($member[$rnd] as $m)
				{
				//echo $$tips[$i][$m['tnid']]['DL'];
				//if($tips[$i][$m['tnid']]['DL'] <> '1') //echo "X";
					$pt1[$i][$m['tnid']] = $tips[$i][$m['tnid']]['Points'];
					$pts[$i][$m['tnid']] = $pt1[$i][$m['tnid']] + $pts[$i-1][$m['tnid']];	
				}
				if (is_array($pts[$i])) arsort($pts[$i]);
			}
		}	
		//echo"<pre>";
		//print_r($pts);
		//exit();
		unset($place);
		foreach($pts as $s=>$data)
		{
			//echo $s;
			$pl = 0;
			foreach($data as $m=>$_pt)
			{
				$pl++;
				//if ($m == $tnid)
				$place[$m][$s] = $pl; 	
			}
		}
		//print_r($place);
		
		$out = "<chart caption='eigene Tabellenplatzenwicklung'
			subcaption='(Gesamtstand)' 
			PYAxisName='Punkte' SYAxisName='Platz' xAxisName='Spieltag'
			SYAxisMinValue='-".count($member[$rnd])."' SYAxisMaxValue='-1'
			formatNumberScale='0'>";
		$out .= "<categories>";
		foreach($place[$tnid] as $s=>$pl)
			$out .= sprintf("<category label='%d' />",$s);	
		$out .= "</categories>";
		
		$out .= "<dataset seriesName='Punkte'>";
		foreach($place[$tnid] as $s=>$pl)
			$out .= sprintf("<set value='%d' />",$pt1[$s][$tnid]);	
		$out .= "</dataset>";
		
		
		$out .= "<dataset seriesName='Platz' parentYAxis='S'>";
		foreach($place[$tnid] as $s=>$pl)
			$out .= sprintf("<set value='-%d' />",$pl);	
		$out .= "</dataset>";
				
		$out .= "<styles>
      			<definition>
         			<style name='CanvasAnim' type='animation' param='_xScale' start='0' duration='1' />
      			</definition>

      			<application>
         			<apply toObject='Canvas' styles='CanvasAnim' />
      			</application>   
			</styles>";
		$out .= "</chart>";
        
	}
    
    jsonout(array('ok' => true, 'chart' => $out));
?>