<?php
  //**************************************************************************
  //** (C) 08/2008 M.Andreas  v2.0
  //** last change : 01.08.08
  //**************************************************************************

  require_once("../mysql.php");
  require_once("liga.php");
  //require_once("admin.php");
  require_once("tipps.php");
  //require_once("ergebnisse.php");

  //**************************************************************************
  // Schalter zum Drucken einblenden
  //**************************************************************************
  function makeprint()
  {
      global $template;
      global $PHP_SELF, $QUERY_STRING;

      if (!$_SESSION['print'])
      {
        $template->set_filenames(array('print' => 'print.tpl'));

        $template->assign_vars(array('VALUE' => 'Drucken','URL' => $PHP_SELF."?".$QUERY_STRING."&print=1"));

        $template->pparse('print');
      } // if
  }

  //**************************************************************************
  // Contentbereich darstellen
  //**************************************************************************
	function showcontent($smenu,$action,$trid,$sptag)
  	{
    	if ($smenu == 'Tipps')
    	{
      		if ($action == 'Uebersicht') { showtippuebersicht($trid,$sptag); } // if
	      	else
	      	if ($action == 'Tippabgabe') { showtippabgabe($trid,$sptag); } // if
	      	else
	      	if ($action == 'Gesamtstand') { showgesamtstand($trid,$sptag); } // if
   		} // if
	    else
	    if ($smenu == 'Liga')
	    {
	      	if ($action == 'Spielplan') { showligaplan($trid,$sptag); } // if
	      	else
	      	if ($action == 'Tabellen') { showligastand($trid,$sptag/*,$tnid,$rnd*/); } // if
	    } // if
	    else
	    if ($smenu == 'Praemien')
	    {
	      	if ($action == '�bersicht') { showpraemien($trid/*,$rnd,$tnid*/); } // if
	      	else
	      	if ($action == 'Info') { showpraemieninfo($trid/*,$rnd*/); } // if
	    } // if
	    else
	    if ($smenu == 'Admin')
	    {
	      if ($action == 'Profil') { editprofil(/*$tnid*/); } // if
	    } // if
  	}

  //**************************************************************************
  // Navigationsleiste (Tipprunde, Spieltag)
  //**************************************************************************
  	function shownav($tnid,&$trid,&$sptag,$_btn)
  	{
    	global $TABLE;
      	global $template;

    	// Tipprunde
    	$sql = "select * from $TABLE[tipprunde]";
    	if ($_SESSION['user']['userlevel'] < 100) $sql=$sql." where aktiv ='J'";
    	$sql = $sql . " order by trid desc";
    	$result = query ($sql);
    	while ($row = mysql_fetch_assoc($result))
    	{
    		//echo $trid.'-'.$_SESSION['trrow']['trid'].'<br>';
      		if ($trid == '') $trid = $row[trid];
    		//echo $trid.'-'.$_SESSION['trrow']['trid'].'<br>';
      		if ($trid <> $_SESSION['trrow']['trid']) 
			{
				//setsessionvars($trid); // ** TODO
				unset($_SESSION['trrow']);
				$_POST['trid'] = $trid;
				require_once('../php/getBaseData.php');
				//print_r($_SESSION);
			}
      		if ($row[trid] == $trid) $sel = "SELECTED"; else $sel ="";
      		$template->assign_block_vars('tr_list', array(
                  'trid' => $row[trid],
                  'name' => $row[Name],
                  'selected' => $sel
            ));
    	} // while
    	// Spieltag
    	if (($_btn=='-') && ($sptag > 1)) $sptag--;
    	else
    	if (($_btn=='+') && ($sptag < $_SESSION['trrow']['AnzST'])) $sptag++;
    	else
    	if ($_btn=='Akt.') $sptag = $_SESSION['trrow']['AktST'];
    
		$result = query ("select * from $TABLE[spielplan] where trid = $trid order by sptag");
    	while ($row = mysql_fetch_assoc($result))
    	{
      		if ($row[Ergebnis] <> '-:-') $_sptaglist[$row[sptag]] = 1; else $_sptaglist[$row[sptag]] = 0;
      		if (!isset($_sptagdatum[$row[sptag]])) $_sptagdatum[$row[sptag]] = $row[Datum];
    	} // while
    	if (isset($_sptaglist))
    	{
      		foreach ($_sptaglist as $_sptag => $_komplett)
      		{
        		if ($sptag == '') $sptag=$_SESSION['trrow']['AktST'];
        		if ($_sptag == $sptag) $sel = "SELECTED"; else $sel ="";
        		$template->assign_block_vars('sptag_list', array(
                    'sptag' => $_sptag,
                    'name' => sprintf("%02u. Spieltag (%s)",$_sptag,$_sptagdatum[$_sptag]),
                    'selected' => $sel
                ));

      		} // foreach
    	} // if
  	}
	 
  //**************************************************************************
  //**************************************************************************

  //**************************************************************************
  /*
  function showpraemien($trid,$rnd,$tnid)
  {
    global $TABLE;
    global $template;

    $template->set_filenames(array('praemien' => 'praemien.tpl'));
    $template->unassign_block_vars('l_header');
    $template->unassign_block_vars('l_datarow');

    if ($rnd==0) $rnd=$_SESSION['ARND'];
    $range = showroundselect($rnd);

    makeprint();

    unset($_sptag); unset($_tipper); unset($_gpunkte); unset($_liga); unset($_ligen);
    $sql = "select distinct sptag from $TABLE[spielplan] where trid = $trid $range order by sptag";
    $result = query($sql);
    while ($row=mysql_fetch_assoc($result))
    {
//      $template->assign_block_vars('l_header', array('SpTag' => $row[sptag]));
      $_sptag[$row[sptag]] = $row[sptag];
    } // while

    // Header

    $template->assign_block_vars('l_header', array('TEXT' => 'Name'));
    $template->assign_block_vars('l_header', array('TEXT' => 'Spieltage'));
    $template->assign_block_vars('l_header', array('TEXT' => 'Gesamtwertung'));
    $template->assign_block_vars('l_header', array('TEXT' => 'Ligawertung'));
    $template->assign_block_vars('l_header', array('TEXT' => 'Einsatz'));
    $template->assign_block_vars('l_header', array('TEXT' => 'Ligaeinsatz'));
    $template->assign_block_vars('l_header', array('TEXT' => 'Summe'));

    // Data
    $sql = "select tn.tnid as tnid, tn.name as name, liga, LNr
                        from $TABLE[teilnehmer] tn, $TABLE[tr_teilnehmer] tr
                        where tr.trid = $trid
                        and   tr.tnid=tn.tnid
                        and   tr.LRnd=$rnd
                        order by tn.name";
    $result = query($sql);
    while ($row=mysql_fetch_assoc($result))
    {
      $_tipper[$row[tnid]] = $row[name];
      $_liga[$row[tnid]] = $row[liga];
      $_ligen[$row[liga]] += $row[LNr];
      $_gpunkte[$row[tnid]] = 0;
      $_gpraemie[$row[tnid]] = 0;
    }

    if (isset($_sptag))
    foreach ($_sptag as $sp)
    {
      unset($_sppunkte); $_sppunkte[0] = 0;
      AuswertungSpieltag($trid,$sp,$_dummy1,$_dummy2,$_sppunkte);
      if(isset($_sppunkte))
      {
          $_sppraemie = praemien($rnd,'-1',$_sppunkte);
        foreach ($_sppunkte as $_tnid=> $p)
        {
          $_gpunkte[$_tnid] += $p;
          $_punkte[$sp][$_tnid] = $p;
          $_praemie[$sp][$_tnid] = $_sppraemie[$_tnid];
          $_gsppraemie[$_tnid] += $_sppraemie[$_tnid];
        } // foreach
      } // if
    } // foreach
    unset($_gpunkte[0]);

    // Ligawertungen
    unset($_lpraemie);
    if (isset($_ligen))
    foreach ($_ligen as $l => $x)
    {
//        echo $l." - $x<br>";
//        if($l==3)
        if ($x > 0)
        {
            $_lplatz  = ligatable_A($trid,$l,$range,$dummy,$tnid);
            unset($_lpunkte);
            if (isset($_lplatz[idx]))
              foreach($_lplatz[idx] as $i=>$_tnid ) $_lpunkte[$_tnid] = $_lplatz[Pkt][$i]*100+$_lplatz[Diff][$i];
            $_tlpraemie = praemien($rnd,$l,$_lpunkte);
            if (isset($_tlpraemie)) foreach($_tlpraemie as $_tnid => $p) $_lpraemie[$_tnid] += $p;
//             print_r($_lpraemie);
        }
        else
        {
             $_lpunkte = ligatable_B($trid,$l,$rnd,$range,$dummy,$tnid);
//             print_r($_lpunkte);
//            print_r($_SESSION['PRAEMIEN'][$rnd]["$l"]);

            $_tlpraemie = praemien($rnd,$l,$_lpunkte);
            if (isset($_tlpraemie)) foreach($_tlpraemie as $_tnid => $p) $_lpraemie[$_tnid] += $p;
//             print_r($_lpraemie);
        } // if
        echo "<br>";
    } // foreach

//    print_r($_lpraemie);

    // Einsatz
    $pr=$_SESSION['PRAEMIEN'][$rnd];

    if (isset($_gpunkte))
    {
      //arsort($_gpunkte);
         $_gesamtpraemie = praemien($rnd,0,$_gpunkte);
         foreach ($_gpunkte as $_tnid => $p) $_gpraemie[$_tnid] = $_gsppraemie[$_tnid]
                                                                  + $_gesamtpraemie[$_tnid]
                                                                  + $_lpraemie[$_tnid]
                                                                  - $pr[0][0]
                                                                  - $pr[$_liga[$_tnid]][0];

         foreach ($_gpunkte as $_tnid => $p)
      {
        if ($class == 'row1') $class = 'row2'; else $class = 'row1';
        if ($_tnid == $tnid) $cl='row3'; else $cl=$class;

        $template->assign_block_vars('l_datarow', array('CLASS' => $cl, 'Tipper' => $_tipper[$_tnid] ,
                                                        'Gesamtpraemie'=> sprintf("%3.2f",$_gpraemie[$_tnid])));

        $template->assign_block_vars('l_datarow.l_datacol', array('Praemie' => sprintf("%3.2f",$_gsppraemie[$_tnid])));
        $fpr=$_gesamtpraemie[$_tnid]; if ($fpr <> '') $fpr = sprintf("%3.2f",$fpr);
        $template->assign_block_vars('l_datarow.l_datacol', array('Praemie' => $fpr));
        $fpr=$_lpraemie[$_tnid]; if ($fpr <> '') $fpr = sprintf("%3.2f",$fpr);
        $template->assign_block_vars('l_datarow.l_datacol', array('Praemie' => $fpr));
        $template->assign_block_vars('l_datarow.l_datacol', array('Praemie' => '-'.sprintf("%3.2f",$pr[0][0])));
        $fpr=$pr[$_liga[$_tnid]][0]; if (($fpr <> '') && ($fpr <> 0)) $fpr = sprintf("-%3.2f",$fpr); else $fpr='';
        $template->assign_block_vars('l_datarow.l_datacol', array('Praemie' => $fpr));
//        $template->assign_block_vars('l_datarow.l_datacol', array('Praemie' => sprintf("%3.2f",$_gpraemie[$_tnid])));
      } // foreach
    } // if

    $template->pparse('praemien');
  }
  */
  //**************************************************************************
  /*
  function showpraemieninfo($trid,$rnd)
  {
    global $TABLE;
    global $template;

    $template->set_filenames(array('praemieneingabe' => 'praemieneingabe.tpl', 'edit' => 'list.tpl', 'error' => 'error.tpl', 'list' => 'list.tpl'));

    {
      if ($rnd==0) $rnd=$_SESSION['ARND'];
      showroundselect($rnd);
      $_anzliga = $_SESSION['Ligen'];

      $template->unassign_block_vars('l_header');
      $template->unassign_block_vars('l_datarow');

      // Header
      $template->assign_block_vars('l_header', array('H_LABEL' => ''));
      $template->assign_block_vars('l_header', array('H_LABEL' => 'Tageswertung'));
      $template->assign_block_vars('l_header', array('H_LABEL' => 'Gesamtwertung'));
      for ($i=1;$i<=$_anzliga;$i++) $template->assign_block_vars('l_header', array('H_LABEL' => "Liga $i"));

      // Daten
  /* Pr�mien :
    Liga = 0, Platz = 0                    : Grundbetrag f�r alle
    Liga = x, Platz = 0                    : Zusatzbetrag f�r Liga x
    Liga = x, Platz = y                    : Pr�mie Liga x Platz y
    Liga = 0, Platz = y                    : Pr�mie Gesamtwertung Platz y
    Liga =-1, Platz = y                    : Pr�mie Tageswertung Platz y
  * /
      unset ($_praemien);
      $sql="select * from $TABLE[praemien] where trid=$trid and LRnd=$rnd";
      $result=query($sql);
      while ($row=mysql_fetch_assoc($result))
      {
        $_praemien[$row[Liga]][$row[platz]] = $row[betrag];
      } // while
      // Einsatz
      if ($class == 'row1') $class = 'row2'; else $class = 'row1';
      $template->assign_block_vars('l_datarow', array('CLASS'  => $class));
      $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => 'Einsatz',
                                                                'ALIGN'  => 'LEFT'));
      for ($i=-1;$i<=$_anzliga;$i++)
      {
        $_p =  $_praemien[$i][0];
        if ($_p > 0) $_p = sprintf("%3.2f &euro;", $_p);
        $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => $_p,
                                                                  'ALIGN'  => 'RIGHT'));
      }
      // Pr�mien
      for ($j=1;$j<=20;$j++)
      {
        if ($class == 'row1') $class = 'row2'; else $class = 'row1';
        $template->assign_block_vars('l_datarow', array('CLASS'  => $class));
        $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => "Platz $j",
                                                                  'ALIGN'  => 'LEFT'));
        for ($i=-1;$i<=$_anzliga;$i++)
        {
          $_p = $_praemien["$i"][$j];
          if ($_p > 0) $_p = sprintf("%3.2f &euro;", $_p);
          $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => $_p,
                                                                    'ALIGN'  => 'RIGHT'));
        }
      } // for

      if ($class == 'row1') $class = 'row2'; else $class = 'row1';

      $template->assign_var_from_handle('INPUTFORM','edit');

      // �bersicht Einnahmen/Ausgaben
      $template->unassign_block_vars('l_header');
      $template->unassign_block_vars('l_datarow');
      $template->assign_vars(array('HEADER' => '�bersicht'));

      $result = query("select liga, count(*) as anz from $TABLE[tr_teilnehmer] where trid=$trid and LRnd=$rnd group by liga");
      while ($row=mysql_fetch_assoc($result))
      {
          $_liga[$row[liga]] = $row[anz];
      }
//      print_r($_SESSION['PRAEMIE']
      $pr = $_SESSION['PRAEMIEN'][$rnd];
//      print_r($pr); echo $pr[0][0];
      if (isset($_liga)) $_anzt  = array_sum($_liga);
      $_anzst = $_SESSION['a'][$rnd];
      $grbetrag = $_anzt * $pr[0][0];

      // Einnahmen
      $summeein = $grbetrag;
      $class = 'row1';
      $template->assign_block_vars('l_datarow', array('CLASS'  => $class));
      $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => 'Grundbetrag'));
      $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => "$_anzt * ".sprintf("%3.2f &euro;",$pr[0][0])));
      $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => sprintf("%3.2f &euro;",$grbetrag),'ALIGN' => 'right'));
      for($i=1;$i<=$_anzliga;$i++)
      {
        $ligabetrag[$i] = $_liga[$i] * $pr[$i][0];

        if ($class == 'row1') $class = 'row2'; else $class = 'row1';
        $template->assign_block_vars('l_datarow', array('CLASS'  => $class));
        $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => "Liga $i"));
        $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => "$_liga[$i] * ".sprintf("%3.2f &euro;",$pr[$i][0])));
        $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => sprintf("%3.2f &euro;",$ligabetrag[$i]),'ALIGN' => 'right'));
        $summeein += $ligabetrag[$i];
      }
      if ($class == 'row1') $class = 'row2'; else $class = 'row1';
      $template->assign_block_vars('l_datarow', array('CLASS'  => $class));
      $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => "<B>Summe Einnahmen</B>"));
      $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => ''));
      $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => sprintf("<B>%3.2f &euro;</B>",$summeein),'ALIGN' => 'right'));
      // Ausgaben
      $gwbetrag=0;
      for ($i=1; $i<=sizeof($pr[0]);$i++) $gwbetrag+= $pr[0][$i];
      $summeaus=$gwbetrag;

      $twbetrag=0;
      for ($i=1; $i<=sizeof($pr['-1']);$i++) $twbetrag+= $pr['-1'][$i];
      $summeaus+= $_anzst * $twbetrag;

      if ($class == 'row1') $class = 'row2'; else $class = 'row1';
      $template->assign_block_vars('l_datarow', array('CLASS'  => $class));
      $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => "Tageswertung"));
      $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => "$_anzst * ".sprintf("%3.2f &euro;",$twbetrag)));
      $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => sprintf("%3.2f &euro;",$_anzst * $twbetrag),'ALIGN' => 'right'));

      if ($class == 'row1') $class = 'row2'; else $class = 'row1';
      $template->assign_block_vars('l_datarow', array('CLASS'  => $class));
      $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => "Gesamtwertung"));
      $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => ''));
      $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => sprintf("%3.2f &euro;",$gwbetrag),'ALIGN' => 'right'));

      for($i=1;$i<=$_anzliga;$i++)
      {
          $ligabetrag[$i] = 0;
        for ($j=1; $j<=sizeof($pr[$i]);$j++) $ligabetrag[$i]+= $pr[$i][$j];

          if ($class == 'row1') $class = 'row2'; else $class = 'row1';
        $template->assign_block_vars('l_datarow', array('CLASS'  => $class));
        $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => "Liga $i"));
        $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => ''));
        $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => sprintf("%3.2f &euro;",$ligabetrag[$i]),'ALIGN' => 'right'));
        $summeaus += $ligabetrag[$i];
      }


      if ($class == 'row1') $class = 'row2'; else $class = 'row1';
      $template->assign_block_vars('l_datarow', array('CLASS'  => $class));
      $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => "<B>Summe Ausgaben</B>"));
      $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => ''));
      $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => sprintf("<B>%3.2f &euro;</B>",$summeaus),'ALIGN' => 'right'));


      if ($class == 'row1') $class = 'row2'; else $class = 'row1';
      $template->assign_block_vars('l_datarow', array('CLASS'  => $class));
      $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => "<B>Differenz</B>"));
      $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => ''));
      $val=$summeein-$summeaus;
      if($val>=0) $val = sprintf("<font color=green><B>%3.2f &euro;</B></font>",$val);
      else        $val = sprintf("<font color=red><B>%3.2f &euro;</B></font>",$val);
      $template->assign_block_vars('l_datarow.l_datacol', array('VALUE' => $val,'ALIGN' => 'right'));


      $template->assign_var_from_handle('INFOBOX','list');

      $template->pparse('praemieneingabe');
    } // if ($admin)
  }
*/

  //**************************************************************************
  	function savetipps($trid,$tnid,$tipps)
  	{
    	global $TABLE;
    	$count=0;

    	unset ($t);
    	foreach ($tipps as $sid => $Tipp) $t[$Tipp]++;

    	$valid=true;
    	foreach($t as $cnt) if ($cnt >= 5) $valid=false;

    	if ($valid)
    	{
      		foreach ($tipps as $sid => $Tipp)
      		{
        		$row=mysql_fetch_assoc(query("select datum, uhrzeit, sptag from $TABLE[spielplan] where sid=$sid"));
        		if (!checkDeadline($trid,$row['sptag'])) query ("replace into $TABLE[tipps] (sid,tnid,Tipp) values ($sid,$tnid,'$Tipp')");
        		else $count++;
      		} // foreach

      		if ($count) $_SESSION[message]= $count.' Tipps nicht gespeichert, weil Abgabefrist überschritten wurde.';
      		else        $_SESSION[message]= 'Tipps gespeichert.';

      		unset($_SESSION[tipps_tmp]);
    	} // if $valid
    	else
    	{
      		$_SESSION[message]= 'Tipps <b>nicht</b> gespeichert, weil zu viele gleiche Ergebnisse getippt wurden!<br>Erlaubt sind maximal x gleiche Tipps.';
      		$_SESSION[tipps_tmp] = $tipps;
    	}
  	}
  //**************************************************************************
?>
