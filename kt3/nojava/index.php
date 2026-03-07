<?php
  //**************************************************************************
  //** (C) 08/2008 M.Andreas  v2.0
  //** last change : 01.08.08
  //**************************************************************************

	session_start();
  	require_once("template.php");
	$template = new Template('templates');
  	require_once("funcs.php");
 	require_once("menu.php");
  	require_once("login.php");
  	

  	$logged_in = checkLogin();
  	$smenu = $_GET['smenu'];
  	$action = $_POST['action']; if ($action=='') $action = $_GET['action'];
	
	$trid = $_GET['trid'];
  	if ($trid =='') $trid=$_SESSION['trrow']['trid'];
  	if ($trid <> '') 
	{
		$_POST['trid'] = $trid;
		require_once('../php/getBaseData.php');
	}

  	$sptag = $_GET['sptag'];
  	$sort = $_GET['sort']; if ($sort <> '') $_SESSION['SORT'] = $sort;
  	//$print= $_GET['print'];

  	$QUERY_STRING = $_SERVER['QUERY_STRING'];

  	if ($action == 'logout') { unset ($action); $logged_in = logout(); }
	
	if ($logged_in)
	{
		$template->set_filenames(array('body' => 'index.tpl'));
		$template->assign_vars(array('USERNAME' => $_SESSION['user']['name']));
	}
	else
	{
		$template->set_filenames(array('body' => 'indexlogin.tpl','login' => 'login.tpl'));
		$template->assign_vars(array('H_TITLE' => $_title));
	} // if

  	if ($logged_in)
  	{

    	if ($action == 'login') unset ($action);

  //****************************************************************************************************************
  // Indexseite (Header, Menüs)
  //****************************************************************************************************************

	    // Standardmenü nach Anmeldung
	    if ($smenu=='')
	    {
	       $smenu='Tipps';
	       $action='Uebersicht';
	       $QUERY_STRING="smenu=$smenu&action=$action&trid=$trid&sptag=$sptag";
	    }

	    // Navigation
	    $template->assign_vars(array('smenu' => $smenu));
	    $template->assign_vars(array('action' => $action));
	
	    shownav($_tnid,$trid,$sptag,$_GET['sptagbtn']);
	
	    // Header
	    foreach ($link[main] as $i=>$l)
	    {
	      	if (ereg("smenu=".$smenu,$l)) $template->assign_vars(array('H_MENU' => $menu[main][$i]));
	    } // foreach
	    if (isset($action))
	    {
	      	if (isset($menu[$smenu]))
	      	foreach($menu[$smenu] as $i => $m)
	      	{
	        	if (ereg("action=".$action,$link[$smenu][$i]))
	          		$template->assign_vars(array('H_SUBMENU' => ' - ' . $menu[$smenu][$i]));
	      	} // foreach
	    } // if

	    // Main Menu
	    foreach($menu[main] as $i => $m)
	    {
	      	if (ereg("smenu=".$smenu,$link[main][$i])) $class='active'; else $class='';
	      	$template->assign_block_vars('main_menu', array(
	        	          'M_CLASS' => $class,
	            	      'M_LINK'  => "{$link[main][$i]}&trid=$trid&sptag=$sptag",
	                	  'M_LABEL' => $m,
	                      'M_TARGET'=> $target[main][$i]
	        ));
	
	      	// Sub Menu
	      	$template->unassign_block_vars('main_menu.sub_menu');
	
	      	if (($smenu) && ($menu[$smenu]) && (ereg("smenu=".$smenu,$link[main][$i])))
	      	{
	        	foreach($menu[$smenu] as $i => $m)
	        	{
	          		if (ereg("action=".$action,$link[$smenu][$i])) $class='active'; else $class='';
	
	          		if ((!isset($level[$smenu][$i])) or ($_SESSION['usrlvl']>=$level[$smenu][$i]))
	          		{
	            		$template->assign_block_vars('main_menu.sub_menu', array(
	                        'S_CLASS' => $class,
	                        'S_LINK' => "{$link[$smenu][$i]}&trid=$trid&sptag=$sptag",
	                        'S_LABEL' => $m
	                    ));
	          		} // if
	        	} // foreach
	      	} // if
		} // for
  	} // if ($logged_in)
  	else
  	{
		foreach($menu[login] as $i => $m)
    	{
      		$template->assign_block_vars('main_menu', array(
                  'M_LINK' => "{$link[login][$i]}",
                  'M_LABEL' => $m
            ));
    	} // for
  	} // if (!$logged_in)


	
  //****************************************************************************************************************
  // Actions
  //****************************************************************************************************************
  	if ($action == 'savetipps')
  	{
    	$_tipps = $_POST['Tipp'];
    	if (isset($_tipps)) savetipps($trid,$_SESSION['user']['tnid'],$_tipps);

    	$template->assign_vars(array(
               'REDIRECT' => "<script type=\"text/javascript\">window.location.href=\"index.php?$QUERY_STRING\";</script>"));
    	$template->pparse('body');
  	}
  	else
  //****************************************************************************************************************
  	if ($action == 'login')
  	{
    	if ($loginerror) $template->assign_vars(array('LOGINERROR' => $loginerror));
    	$template->assign_var_from_handle('LOGIN','login');
    	$template->pparse('body');
  	}
  	else
  //****************************************************************************************************************
  /*if ($action == 'saveprofil')
  {
    if ($_POST['password']<>'')
    {
      $md5pass = md5($_POST['password']);
      query("update $TABLE[teilnehmer] set password='$md5pass' where tnid=$_tnid");
      $_SESSION['password'] = $md5pass;
      if(isset($_COOKIE['cookpass'])) setcookie("cookpass", $_SESSION['password'], time()+60*60*24*100, "/");
    }
    $user  = $_POST['user'];
    $name  = $_POST['name'];
    $email = $_POST['email'];
    $_SESSION['username'] = $user;
    if(isset($_COOKIE['cookname'])) setcookie("cookname", $_SESSION['username'], time()+60*60*24*100, "/");
    query("update $TABLE[teilnehmer] set user='$user', email='$email', name='$name' where tnid=$_tnid");

    $template->assign_vars(array(
               'REDIRECT' => "<script type=\"text/javascript\">window.location.href=\"index.php?$QUERY_STRING\";</script>"));
    $template->pparse('body');
  }
  else*/
  //****************************************************************************************************************
  	{
    	$template->pparse('body');
    	// content
    	showcontent($smenu,$action,$trid,$sptag);
  	}

  //****************************************************************************************************************
  // Seitenfusszeile
  //****************************************************************************************************************

	include("pagefooter.php");
?>