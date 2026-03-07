<?php
  //**************************************************************************
  //** (C) 08/2008 M.Andreas  v2.0
  //** last change : 01.08.08
  //**************************************************************************

  //**************************************************************************
  	function showligaplan($trid,$sptag)
  	{
    	global $TABLE;
    	global $template;

    	$template->set_filenames(array('liga_plan' => 'liga_plan.tpl'));

   	 	// makeprint();

		$rnd = $_SESSION['trrow']['STRND'][$sptag];
		$member = $_SESSION['member'][$rnd];

	  	$sql = sprintf("select * from $TABLE[ligaergebnis] where trid=%d AND sptag=%d AND Liga=%d",
					$trid, $sptag, 1);

		$result = query($sql);
		unset($schedule);
		$tnid = $_SESSION['user']['tnid'];	

      	$template->assign_vars(array('HEADER' => "Spielplan Liga 1"));
      	$template->unassign_block_vars('l_header');
      	$template->unassign_block_vars('l_datarow');
      	$template->assign_block_vars('l_header', array('H_LABEL' => 'Spieler 1', 'WIDTH' => 175));
      	$template->assign_block_vars('l_header', array('H_LABEL' => 'Spieler 2', 'WIDTH' => 175));
      	$template->assign_block_vars('l_header', array('H_LABEL' => 'Ergebnis', 'WIDTH' => 70));
		
	    while ($row=mysql_fetch_assoc($result))
	    {
        	if ($class == 'row1') $class = 'row2'; else $class = 'row1';
        	
			if (($row['tnid1'] == $tnid) or ($row['tnid2'] == $tnid))
          		$template->assign_block_vars('l_datarow', array('CLASS' => 'row3'));
        	else
          		$template->assign_block_vars('l_datarow', array('CLASS' => $class));
       
	   		$template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => $member[$row['tnid1']]['name'],'ALIGN' => 'left'));
        	$template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => $member[$row['tnid2']]['name'],'ALIGN' => 'left'));
        	$template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => $row['Ergebnis'],'ALIGN' => 'center'));   	
	    } 
	
        $template->pparse('liga_plan');
  	}
  //**************************************************************************

  //**************************************************************************
  // Liga System A (Spieler gegeneinander)
  //**************************************************************************
  	function ligatable_A($data)
  	{
	    global $template;
		
		$tnid = $_SESSION['user']['tnid'];	

        // Header
        $fields = array('Pos','Name','Pts','Goals','Diff','Matches','Win','Draw','Loss');
        $template->assign_block_vars('l_header', array('H_LABEL' => 'Platz'));
        $template->assign_block_vars('l_header', array('H_LABEL' => 'Name'));
        $template->assign_block_vars('l_header', array('H_LABEL' => 'Pkt'));
        $template->assign_block_vars('l_header', array('H_LABEL' => 'Tore'));
        $template->assign_block_vars('l_header', array('H_LABEL' => 'Diff'));
        $template->assign_block_vars('l_header', array('H_LABEL' => 'Sp.'));
        $template->assign_block_vars('l_header', array('H_LABEL' => 'S'));
        $template->assign_block_vars('l_header', array('H_LABEL' => 'U'));
        $template->assign_block_vars('l_header', array('H_LABEL' => 'N'));

        if (isset($data))
		{
        	foreach($data as $d)
        	{
          		if ($class == 'row1') $class = 'row2'; else $class = 'row1';
               	if ($d['tnid'] == $tnid) $cl='row3'; else $cl=$class;
				if ($d['Goals'] == ':') $d['Goals'] = '';
          		$template->assign_block_vars('l_datarow', array('CLASS' => $cl));
          		foreach ($fields as $f)
          		{
            		$template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => $d[$f]));
          		} // foreach
        	} // foreach
        }

    return $_sort;
  }
  //**************************************************************************

  //**************************************************************************
  // Liga System B (einfache Gesamtwertung)
  //**************************************************************************
  	function ligatable_B($data)
  	{
    	global $template;

		$tnid = $_SESSION['user']['tnid'];	

        // Header
    	if (isset($_spname))
    	{
	        $template->assign_block_vars('l_header', array('H_LABEL' => 'Platz'));
        	$template->assign_block_vars('l_header', array('H_LABEL' => 'Name'));
        	$template->assign_block_vars('l_header', array('H_LABEL' => 'Pkt'));
    	} // if

        if (isset($data))
        {
          	foreach ($data as $d)
          	{
              	if ($class == 'row1') $class = 'row2'; else $class = 'row1';
              	if ($d['tnid'] == $tnid) $cl='row3'; else $cl=$class;

              	$template->assign_block_vars('l_datarow', array('CLASS' => $cl));
              	$template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => $d['Pos']));
              	$template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => $d['Name']));
              	$template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => $d['Pts']));
          	} // foreach
        } // if
	}
  //**************************************************************************

  //**************************************************************************
  	function showligastand($trid,$sptag)
  	{
    	global $TABLE;
    	global $template;

    	$template->set_filenames(array('liga_a' => 'liga_a.tpl',
                                   	   'liga_b' => 'liga_b.tpl'));

    	//	makeprint();
		
		$rnd = $_SESSION['trrow']['STRND'][$sptag];
		$member = $_SESSION['member'][$rnd];

		unset ($league);
		
		if(is_array($member))
		{
			foreach($member as $m)
			{
				$league[$m['Liga']][] = array(
					'tnid' => $m['tnid'],
					'LNr' => $m['LNr'],
				);
			}
			
			if (is_array($league))
			{
				foreach ($league as $nr=>$l)
				{
					if($l[0]['LNr'] > 0)
						$result[$nr] = createLeagueTable($league[$nr],$trid,$rnd,$nr);
					else
						$result[$nr] = createSimpleTable($league[$nr],$trid,$rnd);
				}
			}
		}

		//print_r($result);	
		
		/*
		unset ($league);
		if (is_array($result))
		{
			$idx=0;
			foreach($result as $lnr => $data)
			{
				if(is_array($data))
					foreach($data as $d)
					{
						$league[$idx] = $d;
						$league[$idx]['League'] = $lnr;
						$idx++;
						//$leagues[$lnr] = $lnr;
					}
			}
		}*/


    	if (isset($result))
		{
			ksort($result);
    		foreach ($result as $lnr => $l)
    		{
    			//print_r($l[0]);
	      		$template->unassign_block_vars('l_header');
	      		$template->unassign_block_vars('l_datarow');
	      		$template->assign_vars(array('HEADER' => "Tabelle Liga $lnr"));
	
			    if (isset($l[0]['Matches']))
			    {
			        // Liga System A
			        ligatable_A($l);
			        $template->pparse('liga_a');
			    }
			    else //***************************************************************************************************************************************
			    {
			    	// Liga System B
			        ligatable_B($l);
			        $template->pparse('liga_b');
			    }
    		} // foreach
    	}
  	}
  //**************************************************************************

?>
