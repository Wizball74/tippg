<?php
/*
 * KT
 * @author    M.Andreas
 * @copyright (c) 2017
 * @date      01/2017
 * @version   4.0
 */
require_once('init.php');

$kt->checkLogin();

if ($kt->user)
{
	if (!$kt->menu)
	{
		$kt->menu = 'Tipps';
		$kt->action = 'Uebersicht';
	}

	$jsonPacket = array(
		'loggedIn'	=> true,
		'trid'		=> $kt->trid,
		'md'		=> $kt->md,
		'menu'		=> $kt->menu,
		'action'	=> $kt->action,
		'username'	=> utf8_encode($kt->user['name']),
		'ok'		=> true
	);
}
else
{
	$jsonPacket = array(
		'loggedIn'	=> false,
		'ok'		=> true
	);
}

$kt->jsonout($jsonPacket);
?>
