<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      10/2014
 * @version   3.1
 * MA 02.10.2014 überarbeitet, Kicker-Spielplan statt DFB
 */

    require_once('json.php');
    require_once('SchedFuns.php');

	session_start();
        
    function output($trid, $mode)
    {       
        global $TABLE;
    
        $sched = parseSchedule($trid, -1);
		$result = '';
		switch ($mode)
		{
			case 'preview':
				$result = '<table class="kttable rounded shadow">';
				if (is_array($sched))
                {
					foreach($sched as $spid => $sptag)
					{
						$result .= sprintf('<tr><td colspan="5"><b>%d. Spieltag</b></td></tr>',$spid);
						foreach($sched[$spid] as $spnr=>$m)
						{
                            if (!isset($m['T1']))
                            {
                                $form = '<form action="php/createTeam.php" method="POST" target="_blank">';
                                $form .= sprintf('<input name="Name" value="%s" type="hidden">', $m['T1n']);
                                $form .= 'Kürzel: <input name="kurz" maxlength="8" size="8" type="text">';
                                $form .= '<input type="submit" value="Team anlegen">';
                                $form .= "<form>";
                                
                                $m['T1'] = $form;
                            }

                            if (!isset($m['T2']))
                            {
                                $form = '<form action="php/createTeam.php" method="POST" target="_blank">';
                                $form .= sprintf('<input name="Name" value="%s" type="hidden">', $m['T2n']);
                                $form .= 'Kürzel: <input name="kurz" maxlength="8" size="8" type="text">';
                                $form .= '<input type="submit" value="Team anlegen">';
                                $form .= "<form>";
                                
                                $m['T2'] = $form;
                            }

							$result .= sprintf("<tr><td><i>%d</i></td><td>%s</td><td>%s</td><td>%s(<b>%s</b>)</td><td>%s(<b>%s</b>)</td></tr>",
								$spnr, $m['D'], $m['Z'], $m['T1n'],$m['T1'], $m['T2n'],$m['T2']
							);
						}
					}
                }
                
				$result .= "</table>";
			break;

			case 'create':
				if (is_array($sched))
                {
                    // ggf. vorhandene Daten löschen // TODO !!
                    $sql = sprintf("DELETE FROM $TABLE[spielplan] WHERE trid=%d" ,$trid);
                    // *** query ($sql); 
                                            
					foreach($sched as $spid => $sptag)
					{
						$result .= sprintf('<b>%d. Spieltag</b>&nbsp;',$spid);
						foreach($sched[$spid] as $spnr=>$m)
						{
							$_datum = convertDate($m['D']);
							$sql = sprintf("INSERT INTO $TABLE[spielplan] (trid,sptag,tid1,tid2,Datum,Uhrzeit,Ergebnis)
											VALUES(%d,%d,%d,%d,'%s','%s','-:-')"
											,$trid, $spid, $m['T1'], $m['T2'], $_datum, $m['Z']);
					
                            
							// *** $result .= $sql."<br>";
                            query($sql);
							$result .= ".";
                            
						}
                        
						$result .= "<br/>";
					}
                }
				break;

			case 'update':
				$result = '<table class="kttable rounded shadow">';
				$result .= '<tr><th>SpTag</th><th>Team1</th><th>Team2</th><th>SID</th><th>Datum alt</th><th>Zeit alt</th><th>Datum neu</th><th>Zeit neu</th></tr>';
				$sql = sprintf("SELECT * FROM $TABLE[spielplan] WHERE trid=%d AND Ergebnis='-:-'", $trid);
				$res = query($sql);
				while ($row = mysql_fetch_assoc($res))
				{
					$s = findSched($row['sptag'],$row['tid1'],$row['tid2'], $sched);
					if (isset($s))
					{
						$_datum = convertDate($s['D']);
						$_zeit = $s['Z'].":00";
					
						if (($_datum <> $row['Datum']) || ($_zeit <> $row['Uhrzeit']))
						{
							$result .= sprintf('<tr><td>%d</td><td>%s</td><td>%s</td><td>%d</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>',
								$row['sptag'], $s['T1n'], $s['T2n'], $row['sid'], $row['Datum'], $row['Uhrzeit'], $_datum, $_zeit);
						
							$sql = sprintf("UPDATE $TABLE[spielplan] SET Datum='%s', Uhrzeit='%s' WHERE sid = %d",
							$_datum, $_zeit, $row['sid']);
							query($sql);
                            // *** $result .= "<tr><td>$sql</td></tr>";
						}
					}
					else
					{
						$result .= sprintf('<tr><td><b>%d</b></td><td colspan="2">Paarung nicht gefunden (%s|%s)</td><td>%d</td><td>%s</td><td>%s</td><td colspan="2"><b>Fehler</b></td></tr>',
							 $row['sptag'], $row['tid1'], $row['tid2'], $row['sid'], $row['Datum'], $row['Uhrzeit']);
					}
				}
                
				$result .= '</table>';
				break;
		}
        
		return $result;
	}

	$trid = $_POST['trid'];
    // if (!isset($trid)) $trid = 13;
	$mode = $_POST['mode'];
    // if (!isset($mode)) $mode = "preview";
       
	if (isset($mode))
		$html = output($trid, $mode);  
	else
		$html = getSchedule($trid, -1);
    
    $html = utf8_encode($html);
		
	$json = array('ok' => true, 'html' => $html);
	jsonout($json);
?>