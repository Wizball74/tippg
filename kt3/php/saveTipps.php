<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
					    ***(saveTips.php)
 */

	require_once('json.php');

	if (isset($_POST['data']))
	{
		require_once('../mysql.php');
		require_once('funcs.php');
				
		$trid = $_POST['trid'];
		$md = $_POST['md'];

		$editable = !checkDeadline($trid, $md);
		$pat = '/^\d{1,2}\:\d{1,2}$/';
		
		if ($editable)
		{
			//print_r($_POST['data']);
			//$data = json_decode(stripslashes($_POST['data']),true);
			$data = $_POST['data'];           
            //print_r($data);
            
            // MA 09.02.2015
            unset ($t);
    	    foreach ($data as $d) $t[$d['Tip']]++;
            unset($t['']);
            foreach($t as $cnt) 
            {
                if ($cnt >= 5)
                {
                	jsonout(array('ok' => false, 'message'=>'Es sind maximal 4 gleiche Tipps erlaubt!'));
			        return;
                }
            }
            
			foreach ($data as $d)
			{
				// Eingabe prüfen
				$valid = false;
				$tip = $d['Tip'];
				if ($tip == '') $valid = true;
				else {
					$valid = preg_match($pat, $tip);
				}

				if ($valid){
					$sql = "replace into $TABLE[tipps] (sid,tnid,Tipp) values ({$d['sid']},{$d['tnid']},'{$d['Tip']}')";
					//echo $sql."<br>"; 
					query($sql);
				}
			}

			jsonout(array('ok' => true, 'message'=>'Tipps gespeichert!'));
			return;
		}
		else
		{
			jsonout(array('ok' => false, 'message'=>'Abgabefrist überschritten!'));
			return;
		}
	}
	else
	{
		jsonout(array('ok' => true));
	}

?>