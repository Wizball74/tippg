<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
                    ***(getStatTippAnzahl.php)
 */

    require_once('getBaseData.php');
    require_once('json.php');	
	
    $colModel[] = array('label' => "Tipp", 'width' => 120, 'name' => "Tipp");
    $colModel[] = array('label' => "Anzahl", 'width' => 120, 'name' => "Anzahl", 'align' => 'right', 'sorttype' => 'int');    
    $colModel[] = array('label' => "%", 'width' => 120, 'name' => "Prozent", 'align' => 'right', 'sorttype' => 'float',
                    'formatter' => 'number', 'formatoptions'=> array('decimalSeparator'=>','));
    $rows = array();
    
    $trid = $_POST['trid_s'];
    if (!isset($trid)) $trid = $_POST['trid'];
    
	if (isset($trid))
	{
		$json = Array();
			
	  	$sql = "select t.Tipp from $TABLE[tipps] t INNER JOIN $TABLE[spielplan] s ON t.sid = s.sid
	  	 		where s.trid = $trid AND s.Datum <= '" . date("Y-m-d") . "'";

	  	$result = query($sql);
	  	$anz = mysql_num_rows($result);
	  	unset($tipps);
	  	while ($row=mysql_fetch_assoc($result))
	    {	
	    	$tipps[$row['Tipp']]++;
	    }

		unset($data);

		if (is_array($tipps)) 
		{
			arsort($tipps);
	  		//print_r($tipps);
	  	
			$idx=0;
			foreach ($tipps as $t=>$a)
			{			
				$data[$idx] = array(
					'Tipp' => $t,
					'Anzahl' => $a,
					'Prozent' => sprintf("%.2f", 100*$a/$anz)
					);
					
				$idx++;
			}
		}
		
        $rows = $data;
        if (!isset($rows)) $rows = array();
	}
    
	// Ausgabe
	$data = array('Records' => count($rows), 'Rows' => $rows);
	$json = array('colModel' => $colModel, 'data' => $data, 'sortname' => 'Prozent', 'sortorder' => 'desc');
	jsonout($json);
?>