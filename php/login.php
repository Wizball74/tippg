<?php
/*
 * KT
 * @author    M.Andreas
 * @copyright (c) 2017
 * @date      01/2017
 * @version   4.0
 */

	require_once('init.php');

	if(isset($_POST['loginUsername']) && isset($_POST['loginPassword']))
	{
		$user = trim($_POST['loginUsername']);
		$md5pass = md5($_POST['loginPassword']);

		$result = $kt->confirmUser($user, $md5pass);

		/* Check error codes */
		if($result == 1)
		{
			$kt->jsonout(array('message' => 'Benutzer unbekannt!'));
			return;
		}
		else if($result == 2)
		{
			$kt->jsonout(array('message' => 'Falsches Passwort!'));
			return;
		}
		else
		{
			/* Username and password correct, register session variables */
			$_SESSION['username'] = $user;
			$_SESSION['password'] = $md5pass;
			$kt->setUser($_SESSION['username']);

			if(isset($_POST['remember']))
			{
				$cookieOptions = [
					'expires'  => time() + 60 * 60 * 24 * 30,
					'path'     => '/',
					'httponly'  => true,
					'samesite' => 'Strict',
				];
				setcookie("cookname", $_SESSION['username'], $cookieOptions);
				setcookie("cookpass", $_SESSION['password'], $cookieOptions);
			}

			$kt->jsonout(array('ok' => true, 'username' => utf8_encode($kt->user['name'])));
			return;
		}
	}

	$kt->jsonout(array('message' => 'Bitte Benutzernahme und Kennwort angeben.'));
?>
