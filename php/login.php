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
			/* Username correct, register session */
			$_SESSION['username'] = $user;
			$kt->setUser($user);

			if(isset($_POST['remember']))
			{
				$token = $kt->generateRememberToken($kt->user['tnid']);
				$cookieOptions = [
					'expires'  => time() + 60 * 60 * 24 * 30,
					'path'     => '/',
					'secure'   => true,
					'httponly'  => true,
					'samesite' => 'Strict',
				];
				setcookie("remember_token", $token, $cookieOptions);
			}

			$kt->jsonout(array('ok' => true, 'username' => utf8_encode($kt->user['name'])));
			return;
		}
	}

	$kt->jsonout(array('message' => 'Bitte Benutzernahme und Kennwort angeben.'));
?>
