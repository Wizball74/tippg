<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
 */

	session_start();
	require_once('json.php');
    require_once('login_inc.php');
    
    checkLogin();

	if (isset($_SESSION['user']))
	{
        // MA 14.09.2012
        if (!isset($_SESSION['menu'])){
            $_SESSION['menu'] = 'Tipps';
            $_SESSION['action'] = 'Uebersicht';
        }
    
		$jsonPacket = array(
			'loggedIn'=>true, 
			'trid'=>$_SESSION['trid'], 
			'md'=>$_SESSION['md'], 
			'menu'=>$_SESSION['menu'], 
			'action'=>$_SESSION['action'],
			'username'=>utf8_encode($_SESSION['user']['name']),
			'ok'=>true
		);
	}
	else
	{
		$jsonPacket = array(
			'loggedIn'=>false, 
			//'trid'=>$_SESSION['trid'], 
			//'md'=>$_SESSION['md'], 
			//'menu'=>$_SESSION['menu'], 
			//'action'=>$_SESSION['action'], 
			'ok'=>true
		);	
	}
	
	jsonout($jsonPacket);
?>
