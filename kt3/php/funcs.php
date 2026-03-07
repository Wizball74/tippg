<?php

	//**************************************************************************
	// checks, if deadline for this matchday is reached (complete matchday)
	//**************************************************************************
	function checkDeadline($trid, $matchday)
	{
		return (getDeadline($trid, $matchday) < time());  
	}
		
	function getDeadline($trid, $matchday)
	{
		global $TABLE;

		$row = mysql_fetch_assoc(query("select *, DATE_FORMAT(Datum, '%d.%m.%Y') AS DatumF from $TABLE[spielplan] 
										where trid=$trid and sptag=$matchday 
										order by Datum, Uhrzeit"));
		$d=preg_split('/\./',$row['DatumF']);
		$z=preg_split('/:/',$row['Uhrzeit']);
		
		return mktime($z[0]-$_SESSION['trrow']['deadline'],$z[1],0,$d[1],$d[0],$d[2]); // Deadline für Tippabgabe
	}
		
	//**************************************************************************
	// evaluates a tip against the actual result of the match
	//**************************************************************************
	function evaluateTip($tip,$result)
	{
		$trrow = $_SESSION['trrow'];
		$P1 = $trrow['P1'];
		$P2 = $trrow['P2'];
		$P3 = $trrow['P3'];

		$pts = 0;

		if (($result <> '-:-') && ($tip <> '-:-') && (!empty($tip)))
		{
			if ($result == $tip) $pts = $P1;
			else
			{
				$_t = preg_split('/:/', $tip);
				$_r = preg_split('/:/', $result);

				$t=$_t[0] - $_t[1];
				$r=$_r[0] - $_r[1];

				if ($t == $r) $pts = $P2;
				else
				if ($t * $r > 0) $pts = $P3;
			} // if
		} // if

		return $pts;
	}

	//**************************************************************************
	// creates summary for a matchday (evaluating tips)
	//**************************************************************************  	
	function matchdaySummary($trid, $matchday)
	{
		global $TABLE;

		unset ($ret);

		$sql = "select sp.sid as sid, Ergebnis, Tipp, t.tnid as tnid, sp.Datum as Datum, sp.Uhrzeit
						from $TABLE[spielplan] sp, $TABLE[tipps] t
						where sp.trid = $trid
						and   sp.sptag= $matchday
						and   sp.sid=t.sid
						order by t.tnid, sp.sid";

		$deadline = checkDeadline($trid,$matchday);
		
		$result = query($sql);   	
		while ($row=mysql_fetch_assoc($result))
		{
			if($deadline)
			{	      			
				$ret[$row['tnid']]['Tips'][$row['sid']]['Tip'] = $row['Tipp']; 
				if ($row['Ergebnis'] <> '-:-')
				{
					$ret[$row['tnid']]['Tips'][$row['sid']]['Points'] =  evaluateTip($row['Tipp'],$row['Ergebnis']);
					$ret[$row['tnid']]['Points'] += $ret[$row['tnid']]['Tips'][$row['sid']]['Points'];
				} // if
			}
			else
			{
				$ret[$row['tnid']]['Tips'][$row['sid']]['Tip'] = '-:-';
				$ret[$row['tnid']]['Tips'][$row['sid']]['Points'] = '?';
				$ret[$row['tnid']]['DL'] = 1;
			}
		} // while
		
		return $ret;
	}
	
	//**************************************************************************
	// calculates bonus
	//**************************************************************************  	
	function getBonus($rnd,$league,$pts)
	{
		unset($bonus);
		unset($pts[0]);
		//print_r($pts);
		if (sizeof($pts) > 0)
		{
			$b = $_SESSION['bonus'];
			//print_r($b);
			$b = $b[$rnd][$league];
			
			unset($b[0]);
			if (isset($b)) ksort($b);
			$anz = sizeof($b);
			unset($tmp);
			
			foreach($pts as $tnid => $p) $tmp[$p][]=$tnid;
			unset($tmp[0]); // keine Präme für 0 Punkte
			krsort($tmp);
			$pl=1;
			while (($anz > 0) && (sizeof($tmp) >0))
			{
				$t=array_shift($tmp); $st=sizeof($t);
				$anz=$anz-$st;
				$betrag=0; for($i=$pl;$i<$pl+$st;$i++) $betrag=$betrag+$b[$i];
				for($i=0;$i<$st;$i++) $bonus[$t[$i]] = $betrag/$st;
				$pl=$pl+$st;
			} // while
		} // if
		return $bonus;
	}

	//**************************************************************************
	// get league opponent
	//**************************************************************************  	
	function getLeagueOpponent($trid, $matchday)
	{
		global $TABLE;
		// 	Gegner Ligasystem
		$tnid = $_SESSION['user']['tnid'];
		if ($tnid > 0)
		{
			$sql="select * from $TABLE[ligaergebnis]
					where trid=$trid
					and sptag=$matchday
					and ((tnid1=$tnid) or (tnid2=$tnid))";
					//echo $sql;
					//print_r($_SESSION['user']);
			$row=mysql_fetch_assoc(query($sql));
			if ($row['tnid1'] == $tnid) $result=$row['tnid2']; else $result=$row['tnid1'];
		}
		else
			$result=0;
		//echo $tnid.$result;
		return $result;  		
	}

	//**************************************************************************
	// create table for player league
	//**************************************************************************  	
	function createLeagueTable($league,$trid,$rnd,$leaguenr)
	{
		global $TABLE;
	
		$start = $_SESSION['trrow']['s'][$rnd];
		$end = $_SESSION['trrow']['e'][$rnd];
		$member = $_SESSION['member'][$rnd];
		
		unset($cls);
		$tnid = $_SESSION['user']['tnid']; 
		$cls[$tnid] = 'rowUser';

		$sql = "select * from $TABLE[ligaergebnis] sp
				where sp.trid = $trid
				and Liga=$leaguenr and sptag between $start and $end";
		$result = query($sql);
		//unset($data);
		unset($_sp);
		while ($row=mysql_fetch_assoc($result))
		{
			$t1=$row['tnid1']; $t2=$row['tnid2']; $res=preg_split('/:/',$row[Ergebnis]);
			if (!isset($_sp[$t1]['Matches'])) $_sp[$t1]['Matches'] = 0;
			if (!isset($_sp[$t2]['Matches'])) $_sp[$t2]['Matches'] = 0;
			if ($res[0]<>'-')
			{
				$_sp[$t1]['Matches']++; $_sp[$t2]['Matches']++;
				{ $_sp[$t1]['gf'] += $res[0]; $_sp[$t1]['ga'] += $res[1]; }
				{ $_sp[$t2]['gf'] += $res[1]; $_sp[$t2]['ga'] += $res[0]; }
				
				if ($res[0] > $res[1]) { $_sp[$t1]['Win']++; $_sp[$t2]['Loss']++; }
				else
				if ($res[0] < $res[1]) { $_sp[$t1]['Loss']++; $_sp[$t2]['Win']++; }
				else
				{ $_sp[$t1]['Draw']++; $_sp[$t2]['Draw']++; }
		  } // if
		} // while
		
		if (isset($_sp))
		{
			unset($_sort);
			foreach($_sp as $idx => $s)
			{
				//$_sp[$idx][Name]  = $_spname[$idx];
				$_sp[$idx]['tnid'] = $idx;
				$_sp[$idx]['Pts']   = 3 * $s['Win'] + $s['Draw'];
				$_sp[$idx]['Diff']  = $s['gf'] - $s['ga'];
				$_sp[$idx]['Goals']  = $s['gf'].':'.$s['ga'];

				$_sort['idx'][$idx]  = $idx;
				$_sort['Pts'][$idx]  = $_sp[$idx]['Pts'];
				$_sort['Diff'][$idx] = $_sp[$idx]['Diff'];
				$_sort['Tore'][$idx] = $_sp[$idx]['Tore'];
			} // foreach

			array_multisort ($_sort['Pts'],  SORT_DESC, SORT_NUMERIC,
							 $_sort['Diff'], SORT_DESC, SORT_NUMERIC,
							 $_sort['Tore'], SORT_DESC, SORT_STRING,
							 $_sort['idx']);
		} // if
		
		unset($data);
		if (isset($_sort[idx]))
		{
			$idx=0;
			foreach($_sort[idx] as $i)
			{
				$s = $_sp[$i];
				//$s[Platz] = $_nr++;
				$m = $member[$s['tnid']];
				
				$data[$idx] = array(
					'Pos' => $idx+1,
					'Name' => $m['name'],
					'Pts' => $s['Pts'], 
					'Diff' => $s['Diff'], 
					'Goals' => $s['Goals'], 
					'Matches' => $s['Matches'], 
					'Win' => $s['Win'], 
					'Draw' => $s['Draw'], 
					'Loss' => $s['Loss'], 
					'tnid' => $s['tnid'], 
					'cls' => $cls[$s['tnid']]					
				);
				$idx++;
			} // foreach
		}
		return $data;
	}
				
	//**************************************************************************
	// create table for simple player league
	//**************************************************************************  	
	function createSimpleTable($league,$trid,$rnd)
	{
		$start = $_SESSION['trrow']['s'][$rnd];
		$end = $_SESSION['trrow']['e'][$rnd];
		$member = $_SESSION['member'][$rnd];
		
		unset($cls);
		$tnid = $_SESSION['user']['tnid']; 
		$cls[$tnid] = 'rowUser';

		unset($pts);
		foreach($league as $l) $pts[$l['tnid']] = 0;	
		
		for ($i = $start; $i<= $end; $i++)
		{
			$tips[$i] = matchdaySummary($trid, $i);		
								
			foreach($league as $l)
			{
				$pts[$l['tnid']] += $tips[$i][$l['tnid']]['Points'];	
			}
		}	
		
		arsort($pts);
		
		unset($data);
		$idx=0;
		foreach ($pts as $tnid=>$p)
		{	
			$m = $member[$tnid];
			$data[$idx] = array(
				'Pos' => $idx+1,
				'Name' => $m['name'],
				'Pts' => $p, 
				'tnid' => $tnid, 
				'cls' => $cls[$m['tnid']]
			);
			$idx++;
		}

		return($data);
	}
	
	//**************************************************************************
	// calculate player league matchdays
	//**************************************************************************  	
	function calcLeague($trid, $matchday)
	{
		global $TABLE;

		$tips = matchdaySummary($trid, $matchday);
		if(is_array($tips))
		{
			foreach($tips as $tnid=>$t)	
			{
				$pts[$tnid]=$t['Points'];
			}
		}
		$sql = "select * from $TABLE[ligaergebnis] where trid=$trid and sptag=$matchday";
		$res = query($sql);
		while ($row=mysql_fetch_assoc($res))
		{
			$tn1=$row['tnid1']; $tn2=$row['tnid2'];
			$p1=isset($pts[$tn1])? $pts[$tn1] : 0;
			$p2=isset($pts[$tn2])? $pts[$tn2] : 0;

			$sql = sprintf("replace into $TABLE[ligaergebnis] (trid,sptag,liga,tnid1,tnid2,Ergebnis)
							values(%d,%d,%d,%d,%d,'%s')",
							$trid, $matchday, $row['Liga'], $tn1, $tn2, $p1.':'.$p2);
							
			query($sql);
		}
		
	}
	
	//**************************************************************************
	// create complete table for player league MA 26.09.2009
	//**************************************************************************  	
	function createLeagueTableComplete($leaguenr)
	{
		global $TABLE;
	
		$member = $_SESSION['member'][-1];
		unset($cls);
		$tnid = $_SESSION['user']['tnid']; 
		$cls[$tnid] = 'rowUser';

		$sql = "select * from $TABLE[ligaergebnis] sp where Liga=$leaguenr 
			AND trid IN (SELECT trid FROM $TABLE[tipprunde] WHERE Aktiv='J')";
		$result = query($sql);
		
		unset($_sp);
		while ($row=mysql_fetch_assoc($result))
		{
			$t1=$row['tnid1']; $t2=$row['tnid2']; $res=preg_split('/:/',$row[Ergebnis]);
			if (!isset($_sp[$t1]['Matches'])) $_sp[$t1]['Matches'] = 0;
			if (!isset($_sp[$t2]['Matches'])) $_sp[$t2]['Matches'] = 0;
			if ($res[0]<>'-')
			{
				$_sp[$t1]['Matches']++; $_sp[$t2]['Matches']++;
				{ $_sp[$t1]['gf'] += $res[0]; $_sp[$t1]['ga'] += $res[1]; }
				{ $_sp[$t2]['gf'] += $res[1]; $_sp[$t2]['ga'] += $res[0]; }
				
				if ($res[0] > $res[1]) { $_sp[$t1]['Win']++; $_sp[$t2]['Loss']++; }
				else
				if ($res[0] < $res[1]) { $_sp[$t1]['Loss']++; $_sp[$t2]['Win']++; }
				else
				{ $_sp[$t1]['Draw']++; $_sp[$t2]['Draw']++; }
		  } // if
		} // while
		
		if (isset($_sp))
		{
			unset($_sort);
			foreach($_sp as $idx => $s)
			{
				//$_sp[$idx][Name]  = $_spname[$idx];
				$_sp[$idx]['tnid'] = $idx;
				$_sp[$idx]['Pts']   = 3 * $s['Win'] + $s['Draw'];
				$_sp[$idx]['Diff']  = $s['gf'] - $s['ga'];
				$_sp[$idx]['Goals']  = $s['gf'].':'.$s['ga'];

				$_sort['idx'][$idx]  = $idx;
				$_sort['Pts'][$idx]  = $_sp[$idx]['Pts'];
				$_sort['Diff'][$idx] = $_sp[$idx]['Diff'];
				$_sort['Tore'][$idx] = $_sp[$idx]['Tore'];
			} // foreach

			array_multisort ($_sort['Pts'],  SORT_DESC, SORT_NUMERIC,
							 $_sort['Diff'], SORT_DESC, SORT_NUMERIC,
							 $_sort['Tore'], SORT_DESC, SORT_STRING,
							 $_sort['idx']);
		} // if
		
		unset($data);
		if (isset($_sort[idx]))
		{
			$idx=0;
			foreach($_sort[idx] as $i)
			{
				$s = $_sp[$i];
				//$s[Platz] = $_nr++;
				$m = $member[$s['tnid']];
				
				$data[$idx] = array(
					'Pos' => $idx+1,
					'Name' => $m['name'],
					'Pts' => $s['Pts'], 
					'Diff' => $s['Diff'], 
					'Goals' => $s['Goals'], 
					'Matches' => $s['Matches'], 
					'Win' => $s['Win'], 
					'Draw' => $s['Draw'], 
					'Loss' => $s['Loss'], 
					'tnid' => $s['tnid'], 
					'cls' => $cls[$s['tnid']]					
				);
				$idx++;
			} // foreach
		}
		return $data;
	}

	/*
	 * MA 13.08.2012
	*/
	function convertDate($date)
	{
		$d = strtotime($date);
		if ($d) return date('Y-m-d', $d);
		return $date;
	}
	   
	/*
	 * HTML-Dokument laden (von URL)
	 * MA 02.10.2014
	 */
	function file_get_contents_curl($url, $curlopt = array())
	{
		$ch = curl_init();
		$default_curlopt = array(
			CURLOPT_TIMEOUT => 30,
			CURLOPT_CONNECTTIMEOUT => 0,
			CURLOPT_RETURNTRANSFER => 1,
			CURLOPT_FOLLOWLOCATION => 1,
			CURLOPT_USERAGENT => "Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US; rv:1.9.2.13) Gecko/20101203 AlexaToolbar/alxf-1.54 Firefox/3.6.13 GTB7.1"
		);

		$curlopt = array(CURLOPT_URL => $url) + $curlopt + $default_curlopt;
		curl_setopt_array($ch, $curlopt);
		$response = curl_exec($ch);
		if($response === false) trigger_error(curl_error($ch));
		curl_close($ch);
		return $response;
	}

?>
