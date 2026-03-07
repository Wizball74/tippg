<?php
	require_once('../mysql.php');
	
	function confirmUser($username, $password)
	{
		global $TABLE;
		/* Add slashes if necessary (for query) */
		if(!get_magic_quotes_gpc()) { $username = addslashes($username); }
	
		/* Verify that user is in database */
		$result = query("select password from $TABLE[teilnehmer] where user = '$username'");
		if(!$result || (mysql_numrows($result) < 1)) { return 1; } //Indicates username failure
	
		/* Retrieve password from result, strip slashes */
		$dbarray = mysql_fetch_array($result);
		$dbarray['password']  = stripslashes($dbarray['password']);
		$password = stripslashes($password);
	
		/* Validate that password is correct */
		if($password == $dbarray['password']) { return 0; } //Success! Username and password confirmed
		else { return 2; } //Indicates password failure
	}
	
	function setLoginSessionVars($username)
	{
		global $TABLE;
		// Userdaten laden  		
		$_SESSION['user'] = mysql_fetch_assoc(query("select tnid, name, userlevel from $TABLE[teilnehmer] where user ='$username'"));
		query ("update $TABLE[teilnehmer] set lastLogin2=CURRENT_TIMESTAMP where tnid=".$_SESSION['user']['tnid']);		
	}
	
	function checkLogin()
	{
		global $TABLE;
		
		/* Check if user has been remembered */
		
		if(isset($_COOKIE['cookname']) && isset($_COOKIE['cookpass']))
		{
			$_SESSION['username'] = $_COOKIE['cookname'];
			$_SESSION['password'] = $_COOKIE['cookpass'];
		}
		

		/* Username and password have been set */
		if(isset($_SESSION['username']) && isset($_SESSION['password']))
		{
			/* Confirm that username and password are valid */
			if(confirmUser($_SESSION['username'], $_SESSION['password']) != 0)
			{
				/* Variables are incorrect, user not logged in */
				unset($_SESSION['username']);
				unset($_SESSION['password']);
				unset($_SESSION['user']);
				return false;
			}
			//
			query ("update $TABLE[teilnehmer] set lastLogin='".date("YmdHis")."' where user='".$_SESSION['username']."'");
			
			setLoginSessionVars($_SESSION['username']);
			return true;
		}
		/* User not logged in */
		else
		{
			return false;
		}
	}
		
	function logout()
	{		
		if(isset($_COOKIE['cookname']) && isset($_COOKIE['cookpass']))
		{
			setcookie("cookname", "", time()-60*60*24*100, "/");
			setcookie("cookpass", "", time()-60*60*24*100, "/");
		} // if
		/* Kill session variables */
		unset($_SESSION['username']);
		unset($_SESSION['password']);
		unset($_SESSION['user']);
		$_SESSION = array(); // reset session array
		session_destroy();   // destroy session.
		return false;
	}
?>
