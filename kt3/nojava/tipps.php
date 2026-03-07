<?php
  //**************************************************************************
  //** (C) 08/2008 M.Andreas  v2.0
  //** last change : 01.08.2008
  //**************************************************************************

	require_once('../php/funcs.php');

  //**************************************************************************
  // Tippübersicht anzeigen
  //**************************************************************************
  	function showtippuebersicht($trid,$sptag)
  	{
    	global $TABLE;
    	global $template;
		$teams= $_SESSION['teams'];
		$rnd = $_SESSION['trrow']['STRND'][$sptag];
		$member= $_SESSION['member'][$rnd];
		//print_r($_SESSION['user']);
		//print_r($_SESSION['trrow']);

    	if (!isset($sptag)) $sptag = 1;

    	$template->set_filenames(array('tippuebersicht' => 'tippuebersicht.tpl','sort' => 'sel_list.tpl'));
    	$template->unassign_block_vars('l_header');
    	$template->unassign_block_vars('l_datarow');

    	// Sortierauswahl
    	//makesort($_sort,array('Sortierung nach Punkten' => 'punkte', 'Sortierung nach Namen' => 'name'));
    	//$template->assign_vars(array('F_NAME' => 'SORT', 'S_NAME' => 'sort', 'sptag' => $sptag));
    	//if (!$_SESSION['print']) $template->assign_var_from_handle('SORT','sort');
    	//makeprint();

    	// Header
    	$sql = "select sid, tid1, tid2, Ergebnis
            	from $TABLE[spielplan] sp
            	where sp.trid = $trid
            	and   sp.sptag= $sptag
            	order by sid";
		$result = query($sql);
    	while ($row=mysql_fetch_assoc($result))
    	{
      		$template->assign_block_vars('l_header', array('HTeam' => $teams[$row['tid1']]['kurz'], 'ATeam' => $teams[$row['tid2']]['kurz'], 'Erg' => $row['Ergebnis']));
      		$_sid[$row['sid']] = $row['sid'];
    	} // while

    	// Data
		unset($data);
		unset($pts);

		$idx=0;

		$tips = matchdaySummary($trid, $sptag);
		unset($pts);
		if(is_array($tips))
		{
			foreach ($tips as $tnid=>$t)
			{
				if (isset($tips[$tnid]['Points'])) $pts[$tnid] = $tips[$tnid]['Points'];			
			}
			$bonus = getBonus($rnd,'-1',$pts);
		}
		
		foreach ($member as $m)
		{
			
			$data[$idx] = array(
				'Name' => $m['name'],
				'Pts' => $tips[$m['tnid']]['Points'],
				'Bonus' => isset($bonus[$m['tnid']]) ? sprintf("%3.2f",$bonus[$m['tnid']]) : '',
				'tnid' => $m['tnid']
//				'tips' => $tips[$m['tnid']]['Tips']
			);			

			if (is_array($tips[$m['tnid']]['Tips']))
				foreach($tips[$m['tnid']]['Tips'] as $sid => $t)
				{
					$data[$idx]["t$sid"] = $t['Tip'];
					$data[$idx]["p$sid"] = $t['Points'];
				}
			$idx++;
		}

		$tnid = $_SESSION['user']['tnid'];
		$tnidop = getLeagueOpponent($trid,$sptag);		

    	foreach ($data as $idx=>$d)
    	{
    		//print_r($d);
        	if ($class == 'row1') $class = 'row2'; else $class = 'row1';
			
			//echo $d['tnid']."- $tnid - $tnidop";
			
        	if ($d['tnid'] == $tnid) $cl='row3'; else $cl=$class;
        	if ($d['tnid'] == $tnidop) $cl='row4';
        
        	$template->assign_block_vars('l_datarow', 
				array('CLASS' => $cl, 
					  'Tipper' => $d['Name'] ,
            		  'Punkte'=> $d['Pts'], 
					  'Praemie'=> $d['Bonus']));

        	if (is_array($_sid))
        	{
          		foreach ($_sid as $s)
          		{
          			$t = $d["t$s"];
					$p = $d["p$s"];					
          			//print_r($t);
            		$template->assign_block_vars('l_datarow.l_datacol', array('Tipp' => $t, 'Punkte' => $p));
          		} // foreach
        	} // if
    	} // foreach
    

    	$template->pparse('tippuebersicht');
  	}

  //**************************************************************************
  // Tippabgabe
  //**************************************************************************
  	function showtippabgabe($trid,$sptag)
  	{
    	global $TABLE;
    	global $template;
		$tnid = $_SESSION['user']['tnid'];
		$teams= $_SESSION['teams'];

    	$template->set_filenames(array('tippeingabe' => 'tippeingabe.tpl'));
    	$template->unassign_block_vars('l_header');
    	$template->unassign_block_vars('l_datarow');
    	$template->assign_vars(array('F_ACTION' => 'savetipps'));
    	$template->assign_vars(array('MESSAGE' => $_SESSION[message])); unset($_SESSION[message]);

    	$sql = "select s.sid as sid, Tipp
                from $TABLE[tipps] t inner join $TABLE[spielplan] s on t.sid = s.sid
                where trid=$trid
                and tnid=$tnid";

    	$result = query($sql);
    	while ($row=mysql_fetch_assoc($result))
    	{
            	$_tipps[$row['sid']]=$row[Tipp];
    	}
    	if (isset($_SESSION[tipps_tmp]))
    	{
      		foreach ($_SESSION[tipps_tmp] as $sid => $Tipp) $_tipps[$sid]=$Tipp;
      		unset ($_SESSION[tipps_tmp]);
    	}
	//    print_r($_tipps);

        $sql = "select sp.sid, sp.Datum, Uhrzeit, tid1, tid2
                from $TABLE[spielplan] sp 
                where sp.trid = $trid
      		    and   sp.sptag= $sptag";

    	$fields = array('HTeam','ATeam','Datum','Uhrzeit');
    	$align  = array('left','left','left','right');

    	// Header
    	$template->assign_block_vars('l_header', array('H_LABEL' => 'Heimteam'));
    	$template->assign_block_vars('l_header', array('H_LABEL' => 'Auswärtsteam'));
    	$template->assign_block_vars('l_header', array('H_LABEL' => 'Datum'));
    	$template->assign_block_vars('l_header', array('H_LABEL' => 'Uhrzeit'));
    	$template->assign_block_vars('l_header', array('H_LABEL' => 'Tipp'));

    	// Data
    	$result = query($sql);
    	while ($row=mysql_fetch_assoc($result))
    	{
     		if (checkDeadline($trid,$sptag)) $disabled = 'disabled'; else unset($disabled);
    		$row['HTeam'] = $teams[$row['tid1']]['Name'];
    		$row['ATeam'] = $teams[$row['tid2']]['Name'];
      		//$row['Datum'] = date('d.m.Y',$row['Datum']);
      		$row['Uhrzeit'] = substr($row[Uhrzeit],0,5);

      		if ($class == 'row1') $class = 'row2'; else $class = 'row1';
      		$sid=$row['sid'];

      		$template->assign_block_vars('l_datarow', array('CLASS' => $class));

      		foreach ($fields as $i => $f)
      		{
        		$template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => $row[$f], 'ALIGN' => $align[$i]));
      		}
      		
			$template->assign_block_vars('l_datarow.l_input', 
				array('NAME' => "Tipp[$sid]",
                	  'SIZE' => 5,
                      'VALUE' => $_tipps[$sid],
                      'CLASS' => $disabled.$class,
                      'DISABLED' => $disabled
            ));
    	} // while

		// Abgabedeadline
    	$template->assign_vars(array('DEADLINE' => date('d.m.Y H:i',getDeadline($trid,$sptag))));

    	$template->pparse('tippeingabe');
  	}

  //**************************************************************************
  // Gesamtwertung anzeigen
  //**************************************************************************
  	function showgesamtstand($trid,$sptag)
  	{
    	global $TABLE;
    	global $template;
		$teams= $_SESSION['teams'];
		$rnd = $_SESSION['trrow']['STRND'][$sptag];
		$member= $_SESSION['member'][$rnd];

    	$template->set_filenames(array('gesamtstand' => 'gesamtstand.tpl'));
    	$template->unassign_block_vars('l_header');
    	$template->unassign_block_vars('l_datarow');

    	//$range = showroundselect($rnd);

    	//makeprint();

    	unset($_sptag); unset($_tipper); unset($_gpunkte);

    	// Header
		$start = $_SESSION['trrow']['s'][$rnd];
		$end = $_SESSION['trrow']['e'][$rnd];

		for ($i = $start; $i<= $end; $i++)
		{
      		$template->assign_block_vars('l_header', array('SpTag' => $i));
			$_sptag[$i] = $i;
		}

		// Data
		unset($data);		
		unset($pts);
		foreach($member as $m)
		{
			$pts[$m['tnid']] = 0;	
		}
		
		for ($i = $start; $i<= $end; $i++)
		{
			$tips[$i] = matchdaySummary($trid, $i);		
								
			foreach($member as $m)
			{
				$pts[$m['tnid']] += $tips[$i][$m['tnid']]['Points'];	
			}
		}	
		
		arsort($pts);
	
		$bonus = getBonus($rnd,0,$pts);

		$idx=0;
		foreach ($pts as $tnid=>$p)
		{	
			$m = $member[$tnid];
			$data[$idx] = array(
				'Pos' => $idx+1,
				'Name' => $m['name'],
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
		
		$tnid = $_SESSION['user']['tnid']; 

    	if (isset($data))
   	 	{
   	 		foreach($data as $d)
			{
        		if ($class == 'row1') $class = 'row2'; else $class = 'row1';
        		if ($d['tnid'] == $tnid) $cl='row3'; else $cl=$class;				

        		$template->assign_block_vars('l_datarow', 
					array('CLASS' => $cl, 
							'Tipper' => $d['Name'], 
							'Punkte'=> $d['Pts'],
                        	'Platz' => $d['Pos'], 
							'Praemie' => $d['Bonus'] 
				));
			       
				if (isset($_sptag))
        		{
          			foreach ($_sptag as $sp)
          			{
            			$template->assign_block_vars('l_datarow.l_datacol', array('Punkte' => $d["s$sp"]));
          			} // foreach
				
        		} // if
 			}
    	} // if
    	$template->pparse('gesamtstand');
  	}
?>
