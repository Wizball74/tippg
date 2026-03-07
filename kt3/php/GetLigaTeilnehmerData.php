<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
					***(getLeagueMember.php)
 */
	require_once('getBaseData.php');
	require_once('json.php');

	$colModel = array();
	$rows = array();

	$colModel[] = array('label' => "Name", 'width' => 180, 'name' => "Name"); //, summaryType=> 'count' , summaryTpl=> 'Anzahl: {0}' );
	$colModel[] = array('label' => "tnid", 'width' => 20, 'name' => "tnid", 'key' => true, 'hidden' => true); 
	$colModel[] = array('label' => "Liga", 'width' => 40, 'name' => "League", 'sorttype' => 'int');
	$colModel[] = array('label' => "LNr", 'width' => 40, 'name' => "LNr", 'sorttype' => 'int', 
                    'editable' => true, 'editoptions' => array('size'=>2, 'maxlength'=>2,'class'=>'gradient'));
	$colModel[] = array('label' => " ", 'name' => "rnd", 'hidden' => true); 
		
	$rnd = $_POST['rnd'];
	if (!isset($rnd)) $rnd = 1;
 
	//if (isset($_POST['rnd']))
	{  
		require_once('../mysql.php');
		$trid = $_POST['trid'];
		$lnr = $_POST['lnr'];
	
		$sql = "select tn.tnid as tnid1, tn.name as name, tr.* " .
				"from $TABLE[teilnehmer] tn LEFT JOIN $TABLE[tr_teilnehmer] tr ON (tn.tnid=tr.tnid AND trid=$trid AND LRnd=$rnd) " .
				"where userlevel > 0 " .
				"and IFNULL(tr.Liga,0) = $lnr " .
				"order by tn.name";
	
		$result = query($sql);
		while ($row=mysql_fetch_assoc($result))
		{
			$member[] = array(
				'tnid' => $row['tnid1'],
				'Name' => utf8_encode($row['name']),
				'trid' => $trid,
				'League' => $row['Liga'],
				'LRnd' => $row['LRnd'],
				'LNr' => $row['LNr'],
				'editable' => true,
				'rnd' => $rnd
			);
		}    
		
		$rows = $member;
		if (!isset($rows)) $rows = array();
	}

	// Ausgabe
	$data = array('Records' => count($rows), 'Rows' => $rows);
	$json = array('colModel' => $colModel, 'data' => $data);
	jsonout($json);
?>
