<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
 */
	session_start();
	require_once('../mysql.php');
	// Session-Vars setzen
	if (isset($_POST['trid'])) 
	{
		if ($_SESSION['trid'] != $_POST['trid'])
		{
			$_SESSION['trid'] = $_POST['trid'];
			unset($_SESSION['trrow']);
		}
	}
	if (isset($_POST['md'])) $_SESSION['md'] = $_POST['md'];
	if (isset($_POST['menu'])) $_SESSION['menu'] = $_POST['menu'];
	if (isset($_POST['action'])) $_SESSION['action'] = $_POST['action'];
	//
	//unset($_SESSION['teams']); // TODO
	if (!isset($_SESSION['teams'])) loadTeams();
	if (!isset($_SESSION['trrow'])) 
	{
		loadTr($_SESSION['trid']);	
		loadMember($_SESSION['trid']);
		loadRnds();
	}
	
	function loadTeams()
	{
		global $TABLE; 
			
		unset($teams);
		
		$sql = "select * from $TABLE[teams]";
		$result = query($sql);
		while ($row=mysql_fetch_assoc($result))
		{
			$teams[$row['tid']]=$row;
		}    	
		
		foreach ($teams as $i=>$t)
		{
			$teams[$i]['Name'] = utf8_encode($t['Name']); 
			$teams[$i]['kurz'] = utf8_encode($t['kurz']); 
		}
		
		$_SESSION['teams'] = $teams;
	}

	function loadTr($trid)
	{
		global $TABLE; 
		unset($trrow);
		
		//**************************************************************************
		// split season in laps 
		//**************************************************************************
		function makeLaps(&$s,&$e, $trrow)
		{
			$rnd=$trrow['Runden'];
			$asp=$trrow['MaxST']/$trrow['Runden'];
	
			$et = 0;
			for ($i=1; $i <= $rnd; $i++)
			{
				$st = $et+1;
				$et = $st+$asp-1;
	
				$s[$i] = round($st);
				$e[$i] = round($et);
			} // for
		}
		
		$sql = "select * from $TABLE[tipprunde] where trid=$trid";
		$trrow = mysql_fetch_assoc(query($sql));	
		$anz = mysql_fetch_assoc(query("select max(sptag) as sptag from $TABLE[spielplan] where trid=$trid"));
		$trrow['MaxST'] = $anz['sptag'];
		
		// Wertungsrunden
		unset($s); $s[0]=0;
		unset($e); $e[0]=0;
		makeLaps($s,$e,$trrow); 
		$trrow['s'] = $s;
		$trrow['e'] = $e;
		foreach($s as $i => $x) $a[$i]=$e[$i]-$s[$i]+1;
		$trrow['a'] = $a;

		// aktueller Spieltag		
		$row=mysql_fetch_assoc(query("select IF(min(sptag), min(sptag), 34) as sptag
										from $TABLE[spielplan]
										where trid=$trid
										and Ergebnis='-:-'
										and  (Datum > curdate() - INTERVAL 3 day)"));
		$trrow['AktST'] = $row['sptag'];

		// aktuelle Wertungsrunde +
		// Anz. Spielttage +  aktuelle Wertungsrunde
		$row=mysql_fetch_assoc(query("select max(sptag) as sptag from $TABLE[spielplan] where trid=$trid"));
		$trrow['AnzST'] = $row['sptag'];
		if (!isset($trrow['AktST'])) $trrow['AktST'] = $trrow['AnzST'];
		
		unset($_rnd);
		for($j=1;$j<=$row['sptag'];$j++)
		{
			foreach ($s as $i => $d)
			{
				if (($s[$i] <= $j) && ($e[$i] >= $j)) $_rnd[$j] = $i;
			}
		} // for
		//$trrow['AktRnd'] = $_rnd[$trrow['AktST']];
		$trrow['STRND'] = $_rnd;
		
		
		// Prämien
		unset ($bonus);
		$sql="select * from $TABLE[praemien] where trid=$trid";
		$result=query($sql);
		while ($row=mysql_fetch_assoc($result))
		{
			$bonus[$row['LRnd']][$row['Liga']][$row['platz']] = $row['betrag'];
		} // while
		$_SESSION['bonus'] = $bonus;	
		$_SESSION['trrow'] = $trrow;
	}

	function loadMember($trid)
	{
		global $TABLE;
		unset($member);	
		
		$sql = "select tr.*, tn.name as name
				from $TABLE[teilnehmer] tn, $TABLE[tr_teilnehmer] tr
				where tr.trid = $trid
				and   tr.tnid=tn.tnid
                and tn.userlevel > 0
				order by tr.LRnd, tn.name";
		
		$result = query($sql);
		while ($row=mysql_fetch_assoc($result))
		{
			$member[$row['LRnd']][$row['tnid']] = $row;
			$member[$row['LRnd']][$row['tnid']]['name'] =  utf8_encode($row['name']); 
		}    
		// MA 26.09.2009 komplette Liste
		$sql = "select tnid, name 
				from $TABLE[teilnehmer]
				order by name";
		
		$result = query($sql);
		while ($row=mysql_fetch_assoc($result))
		{
			$member[-1][$row['tnid']] = $row;
			$member[-1][$row['tnid']]['name'] =  utf8_encode($row['name']); 
		}    
		// 
		$_SESSION['member'] = $member;
	}

	function loadRnds()
	{
		$trrow = $_SESSION['trrow'];
		$member = $_SESSION['member'];        
		$lcnt = $trrow['Ligen'];
		
		unset($results);
		for($i=1;$i<=$trrow['Runden'];$i++)
		{
			unset($lcount);
			
            //print_r($member[$i]);
			if (is_array($member[$i])) foreach($member[$i] as $m) { $lcount[$m['Liga']]++; }						
			
			$results[$i] = array(
				'trid' => $trrow['trid'],
				'rnd' => $i,
				'Name' => sprintf('Runde %d (Spieltag %d - %d)', $i, $trrow['s'][$i], $trrow['e'][$i]),
				'MemberCount' => count($member[$i]),
				'LMembers' => $lcount,
				'LCount' => count($lcount),
				'MDCount' => $trrow['a'][$i],
			);
		}

		$_SESSION['_rnds'] = $results;
	}

?>