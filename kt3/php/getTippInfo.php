<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
						***(getTipInfo.php)
 */
	require_once('json.php');
			
	$html = '';

	if (isset($_POST['tidH']))
	{
		require_once('getBaseData.php');
		
		$tidH = $_POST['tidH'];
		$tidA = $_POST['tidA'];
		$teams = $_SESSION['teams'];
		$limit=6;
				
		$sql = "SELECT * FROM $TABLE[spielplan] WHERE (tid1=$tidH OR tid2=$tidH) AND Ergebnis <>'-:-'
				ORDER BY Datum DESC LIMIT $limit";			
		$html .= getTable($sql, 'letzte Spiele von <b>'.$teams[$tidH]['Name'].'</b>');

		$sql = "SELECT * FROM $TABLE[spielplan] WHERE (tid1=$tidA OR tid2=$tidA) AND Ergebnis <>'-:-'
				ORDER BY Datum DESC LIMIT $limit";
		$html .= getTable($sql, 'letzte Spiele von <b>'.$teams[$tidA]['Name'].'</b>');
		
		$sql = "SELECT * FROM $TABLE[spielplan] WHERE ((tid1=$tidH AND tid2=$tidA) OR (tid1=$tidA AND tid2=$tidH)) AND Ergebnis <>'-:-'
				ORDER BY Datum DESC LIMIT $limit";
		$html .= getTable($sql, 'letzte Spiele gegeneinander');
	}
	else
	{
		$html = 'Tippabgabe bitte wie folgt: 1:0, 2:1, 2:2, ...<br/><br/>'.
				'Markieren Sie eine beliebige Zelle innerhalb einer Spalte, um weitere Informationen über die betreffende Partie zu erhalten';
	}

	$json = array('ok' => true, 'html' => $html);
	jsonout($json);
	
	function format_Date($date)
	{
		$d = preg_split('/-/',$date);
		return $d[2].'.'.$d[1].'.'.$d[0];
	}
	
	function getTable($sql, $title='')
	{
		
		$teams = $_SESSION['teams'];
		
		$html = '<table class="kttable rounded shadow" style="width:650px;"><tr class="row3"><th colspan="4">'.$title.'</th></tr>';
		$res = query($sql);
		while ($row=mysql_fetch_assoc($res))
		{
			$r=preg_split('/:/',$row[Ergebnis]);
			if ($r[0] > $r[1]) { $styleH='font-weight:bold;'; $styleA=''; }
			else
			if ($r[0] < $r[1]) { $styleH=''; $styleA='font-weight:bold;'; }
			else
			{ $styleH=''; $styleA=''; }
			
			$cls = ($cls == 'row1') ? 'row2' : 'row1';
			$html .= '<tr class="'.$cls.'">';
			$html .= '<td style="width:100px;">'.format_Date($row['Datum']).'</td>';
			$html .= '<td style="width:250px;'.$styleH.'">'.$teams[$row['tid1']]['Name'].'</td>';
			$html .= '<td style="width:250px;'.$styleA.'">'.$teams[$row['tid2']]['Name'].'</td>';
			$html .= '<td style="width:50px;">'.$row['Ergebnis'].'</td>';
			$html .= '</tr></div>';
		}    
		$html .= '</table>';
		return $html;
	}
?>
