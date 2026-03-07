<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
                     ***(getLeagueTableComplete.php)
 */

    require_once('getBaseData.php');
    require_once('json.php');
	
	{		
		require_once('funcs.php');	              
        
         $lnr = $_POST['lnr'];       
        
        $colModel[] = array('label' => "Platz", 'width' => 60, 'name' => "Pos", 'align' => 'right', 'sorttype' => 'int');
        $colModel[] = array('label' => "Name", 'width' => 180, 'name' => "Name");
        $colModel[] = array('label' => "Pkt", 'width' => 40, 'name' => "Pts", 'align' => 'right', 'sorttype' => 'int');

        $colModel[] = array('label' => "Tore", 'width' => 80, 'name' => "Goals", 'align' => 'right');
        $colModel[] = array('label' => "Diff", 'width' => 60, 'name' => "Diff", 'align' => 'right', 'sorttype' => 'int');
        $colModel[] = array('label' => "Sp.", 'width' => 50, 'name' => "Matches", 'align' => 'right', 'sorttype' => 'int');
        $colModel[] = array('label' => "S", 'width' => 40, 'name' => "Win", 'align' => 'right', 'sorttype' => 'int');
        $colModel[] = array('label' => "U", 'width' => 40, 'name' => "Draw", 'align' => 'right', 'sorttype' => 'int');
        $colModel[] = array('label' => "N", 'width' => 40, 'name' => "Loss", 'align' => 'right', 'sorttype' => 'int');

        $colModel[] = array('name' => "tnid", 'key' => true, 'hidden' => true);
        $colModel[] = array('name' => "cls", 'hidden' => true);
        
		$result[$lnr] = createLeagueTableComplete($lnr);	
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
					}
			}
		}
        
        $rows = $league;
		if (!isset($rows)) $rows = array();
	}
	
	// Ausgabe
	$data = array('Records' => count($rows), 'Rows' => $rows);
	$json = array('colModel' => $colModel, 'data' => $data);
	jsonout($json);

?>
