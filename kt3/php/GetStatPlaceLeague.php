<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
					***(getStatPlaceLeague.php)
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
		
		$start = $_SESSION['trrow']['s'][$rnd];
		$end = $_SESSION['trrow']['e'][$rnd];

		$tnid = $_SESSION['user']['tnid']; 
		
		
		if ($member[$rnd][$tnid]['Liga'] == '1')
		{
			$sql = "select * from $TABLE[ligaergebnis] sp
                	where sp.trid = $trid
                	and Liga=1 and sptag between $start and $end";
			$result = query($sql);

			unset($_sp);
			unset($_diff);
	        while ($row=mysql_fetch_assoc($result))
	        {
				$t1=$row['tnid1']; $t2=$row['tnid2']; $res=split(':',$row[Ergebnis]);
				$sp=$row['sptag'];
	          	if ($res[0]<>'-')
	          	{
	            	{ 
					  $_sp[$sp][$t1]['gf'] = $_sp[$sp-1][$t1]['gf'] + $res[0]; 
					  $_sp[$sp][$t1]['ga'] = $_sp[$sp-1][$t1]['ga'] + $res[1]; 
					  $_diff[$sp][$t1] = $res[0]-$res[1];
					}
	            	{ 
					  $_sp[$sp][$t2]['gf'] = $_sp[$sp-1][$t2]['gf'] + $res[1]; 
					  $_sp[$sp][$t2]['ga'] = $_sp[$sp-1][$t2]['ga'] + $res[0]; 
					  $_diff[$sp][$t2] = $res[1]-$res[0];
					}
	            	
					if ($res[0] > $res[1]) 
					{ 
						$_sp[$sp][$t1]['Pts'] = $_sp[$sp-1][$t1]['Pts'] + 3; 
						$_sp[$sp][$t2]['Pts'] = $_sp[$sp-1][$t2]['Pts'] + 0; 
					}
	            	else
	            	if ($res[0] < $res[1]) 
					{ 
						$_sp[$sp][$t1]['Pts'] = $_sp[$sp-1][$t1]['Pts'] + 0; 
						$_sp[$sp][$t2]['Pts'] = $_sp[$sp-1][$t2]['Pts'] + 3; 
					}
	            	else
					{				
						$_sp[$sp][$t1]['Pts'] = $_sp[$sp-1][$t1]['Pts'] + 1; 
						$_sp[$sp][$t2]['Pts'] = $_sp[$sp-1][$t2]['Pts'] + 1; 
					}
					$_sp[$sp][$t1]['Diff']  = $_sp[$sp][$t1]['gf'] - $_sp[$sp][$t1]['ga'];
					$_sp[$sp][$t2]['Diff']  = $_sp[$sp][$t2]['gf'] - $_sp[$sp][$t2]['ga'];					
	          } // if
	        } // while
			
			unset($_place);
            if (is_array($_sp))
			    foreach ($_sp as $s=>$dat) 
			    {
				    if (isset($dat))
		            {
		         	    unset($_sort);
		          	    foreach($dat as $idx => $x)
		          	    {
		            	    $_sort['idx'][$idx]  = $idx;
		            	    $_sort['Pts'][$idx]  = $dat[$idx]['Pts'];
		            	    $_sort['Diff'][$idx] = $dat[$idx]['Diff'];
		            	    $_sort['gf'][$idx]   = $dat[$idx]['gf'];
		         	    } // foreach
		
		          	    array_multisort ($_sort['Pts'],  SORT_DESC, SORT_NUMERIC,
		                           	     $_sort['Diff'], SORT_DESC, SORT_NUMERIC,
		                           	     $_sort['gf'],   SORT_DESC, SORT_NUMERIC,
		                           	     $_sort['idx']);

					    foreach ($_sort['idx'] as $pl=>$id)
					    {
						    if ($id == $tnid) $_place[$s] = $pl+1;
					    }
					
		            } // if	
			    }
						
			$out = "<chart caption='eigene Tabellenplatzenwicklung'
				subcaption='(Liga 1)' 
				PYAxisName='Tordiff.' SYAxisName='Platz' xAxisName='Spieltag'
				SYAxisMinValue='-18' SYAxisMaxValue='-1'
				formatNumberScale='0'>";
			$out .= "<categories>";
            
            if (is_array($_place))
			    foreach($_place as $s=>$pl) $out .= sprintf("<category label='%d' />",$s);	
			$out .= "</categories>";

			$out .= "<dataset seriesName='Tordiff.'>";
			if (is_array($_place))
                foreach($_place as $s=>$pl) $out .= sprintf("<set value='%d' />",$_diff[$s][$tnid]);	
			$out .= "</dataset>";
			
			$out .= "<dataset seriesName='Platz' parentYAxis='S'>";
			if (is_array($_place)) 
                foreach($_place as $s=>$pl) $out .= sprintf("<set value='-%d' />",$pl);	
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
            jsonout(array('ok' => true, 'chart' => $out));
            return;
		}

        jsonout(array('ok' => true, 'chart' => ''));
        return;
	}
    jsonout(array('ok' => true, 'chart' => ''));

	/*else
	{
		$out .= "<chart></chart>";
	}
    */
?>