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

	if(isset($_POST['loginUsername']) && isset($_POST['loginPassword']))
	{
		require_once('login_inc.php');
		
		$user = trim($_POST['loginUsername']);
		$md5pass = md5($_POST['loginPassword']);
		
		$result = confirmUser($user, $md5pass);
		
		/* Check error codes */
		if($result == 1)
		{
			jsonout(array('message' => 'Benutzer unbekannt!'));
			return;
		}
		else if($result == 2)
		{
			jsonout(array('message' => 'Falsches Passwort!'));
			return;
		}
		else
		{
			/* Username and password correct, register session variables */
			$_SESSION['username'] = $user;
			$_SESSION['password'] = $md5pass;
			setLoginSessionVars($_SESSION['username']);
		
			
			if(isset($_POST['remember']))
			{
				setcookie("cookname", $_SESSION['username'], time()+60*60*24*100, "/");
				setcookie("cookpass", $_SESSION['password'], time()+60*60*24*100, "/");
			}
			
			jsonout(array('ok' => true, 'username' => utf8_encode($_SESSION['user']['name'])));
			return;
		}
	}

	jsonout(array('message' => 'Bitte Benutzernahme und Kennwort angeben.'));
?>
