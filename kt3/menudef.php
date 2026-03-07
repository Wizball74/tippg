<?php
	//**************************************************************************
	//** (C) 08/2012 M.Andreas  v3.0
	//** last change : 18.08.2012
	//**************************************************************************
	   
	if (!($_SESSION['user']['tnid'] > 0))
	{
		$menu['main'][] =   array ('title' => 'Anmelden',           'smenu'=>'login',       'action' => 'login',    'cls'=>'full');
		$menu['login'][] =  array ('title' => 'Anmelden',           'smenu'=>'login',       'action' => 'login');
	}
	else
	{
		$menu['main'][] =   array('title' => 'Abmelden',            'smenu'=>'login',       'action'=>'logout' ,    'cls'=>'full'); 
		$menu['login'][] =  array('title' => 'Abmelden',            'smenu'=>'login',       'action'=>'logout'); 

	
		$menu['main'][] =   array('title' => 'Tipps',               'smenu'=>'Tipps', 	    'action'=>'Uebersicht', 'cls'=>'left');           
		$menu['main'][] =   array('title' => 'Ligasystem',          'smenu'=>'Liga',  	    'action'=>'Spielplan',  'cls'=>'right');  
		$menu['main'][] =   array('title' => 'Prämien',	            'smenu'=>'Praemien',    'action'=>'Uebersicht', 'cls'=>'left');			
		$menu['main'][] =   array('title' => 'Spielplan / Tabelle', 'smenu'=>'Spielplan',   'action'=>'Spielplan',  'cls'=>'right');
		$menu['main'][] =   array('title' => 'Statistiken',         'smenu'=>'Stat',        'action'=>'TippAnzahl', 'cls'=>'left');	
		$menu['main'][] =   array('title' => 'Admin',	            'smenu'=>'Admin',       'action'=>'Profil',     'cls'=>'right');        
		//$menu['main'][] = array('title' => 'Forum'; $link['main'][] = "http://www.foren.de/system/index.php?id=thomash";  $target['main'][]="_new";

		$menu['Tipps'][]=   array('title' => 'Übersicht',           'smenu'=>'Tipps',       'action'=>'Uebersicht');
		$menu['Tipps'][]=   array('title' => 'Tippabgabe',          'smenu'=>'Tipps',       'action'=>'Tippabgabe');
		$menu['Tipps'][]=   array('title' => 'Gesamtstand',         'smenu'=>'Tipps',       'action'=>'Gesamtstand');
		//$menu['Tipps'][]= array('title' => '* Torjäger',    'smenu'=>'Tipps', 'action'=>'Torjaeger');
		//$menu['Tipps'][]= array('title' => '* Regeln anzeigen',	 'smenu'=>'Tipps',    'action'=>'Regeln');

		$menu['Liga'][]=    array('title' => 'Spielplan',           'smenu'=>'Liga',        'action'=>'Spielplan');
		$menu['Liga'][]=    array('title' => 'Tabellen',            'smenu'=>'Liga',        'action'=>'Tabellen');

		$menu['Praemien'][]= array('title' => 'aktuell',            'smenu'=>'Praemien',    'action'=>'Uebersicht');
		$menu['Praemien'][]= array('title' => 'Information',        'smenu'=>'Praemien',    'action'=>'Info');

		$menu['Spielplan'][] = array('title' => 'Spielplan',        'smenu'=>'Spielplan',   'action'=>'Spielplan');
		$menu['Spielplan'][] = array('title' => 'Tabelle',          'smenu'=>'Spielplan',   'action'=>'Tabelle');
	
		// MA 24.09.2009
		$menu['Stat'][] =   array('title' => 'Tipphäufigkeit',      'smenu'=>'Stat',        'action'=>'TippAnzahl');
		$menu['Stat'][] =   array('title' => 'Tabellenplatz-Entwicklung', 'smenu'=>'Stat',  'action'=>'TabPlatz');
		$menu['Stat'][] =   array('title' => 'Ewige Ligatabelle',   'smenu'=>'Stat',        'action'=>'LigaEwig');
		$menu['Stat'][] =   array('title' => 'Ewiger Gesamtstand',  'smenu'=>'Stat',        'action'=>'TippEwig');
		$menu['Stat'][] =   array('title' => 'Tipp-Tabelle',        'smenu'=>'Stat',        'action'=>'TippTabelle');
		
		$menu['Admin'][]=   array('title' => 'Profil', 	   	        'smenu'=>'Admin',       'action'=>'Profil');
		if ($_SESSION['user']['userlevel'] == 100)
		{
			$menu['Admin'][]= array('title' => 'Spielplan/Ergebnisse',  'smenu'=>'Admin', 'action'=>'Spielplan',    'level'=> 100);
			$menu['Admin'][]= array('title' => 'Tipps ändern',          'smenu'=>'Admin', 'action'=>'Tipps',        'level'=> 100);
			$menu['Admin'][]= array('title' => 'Tipprunden',            'smenu'=>'Admin', 'action'=>'Tipprunden',   'level'=> 100);
			$menu['Admin'][]= array('title' => 'Benutzerverwaltung',    'smenu'=>'Admin', 'action'=>'Benutzer',     'level'=> 100);
			$menu['Admin'][]= array('title' => 'Ligasystem',            'smenu'=>'Admin', 'action'=>'Liga',         'level'=> 100);
			$menu['Admin'][]= array('title' => 'Prämien',   	        'smenu'=>'Admin', 'action'=>'Praemien',     'level'=> 100);
			$menu['Admin'][]= array('title' => 'Spielplan-Import',      'smenu'=>'Admin', 'action'=>'importSP',     'level'=> 100);
		}
	} 
?>