<?php
  //**************************************************************************
  //** (C) 08/2008 M.Andreas  v2.0
  //** last change : 01.08.08
  //**************************************************************************

require_once("../php/login_inc.php");

if(isset($_POST['sublogin']))
{
  /* Check that all fields were typed in */
  if(!$_POST['user'] || !$_POST['pass'])
  {
//      die('You didn\'t fill in a required field.');
      $loginerror = 'Bitte alle Felder ausf&uuml;llen !';
      return;
  }
  /* Spruce up username, check length */
  $_POST['user'] = trim($_POST['user']);
  if(strlen($_POST['user']) > 30)
  {
    //die("Sorry, the username is longer than 30 characters, please shorten it.");
      $loginerror = 'Der Benutzername ist zu lang (max. 30 Zeichen) !';
      return;
  }

  /* Checks that username is in database and password is correct */
  $md5pass = md5($_POST['pass']);
  $result = confirmUser($_POST['user'], $md5pass);

  /* Check error codes */
  if($result == 1)
  {
//    die('That username doesn\'t exist in our database.');
      $loginerror = 'Benutzer unbekannt !';
      return;
  }
  else if($result == 2)
  {
//    die('Incorrect password, please try again.');
      $loginerror = 'Falsches Passwort !';
      return;
  }

  /* Username and password correct, register session variables */
  $_POST['user'] = stripslashes($_POST['user']);
  $_SESSION['username'] = $_POST['user'];
  $_SESSION['password'] = $md5pass;

  /**
   * This is the cool part: the user has requested that we remember that
   * he's logged in, so we set two cookies. One to hold his username,
   * and one to hold his md5 encrypted password. We set them both to
   * expire in 100 days. Now, next time he comes to our site, we will
   * log him in automatically.
   */
  if(isset($_POST['remember']))
  {
    setcookie("cookname", $_SESSION['username'], time()+60*60*24*100, "/");
    setcookie("cookpass", $_SESSION['password'], time()+60*60*24*100, "/");
  }

  /* Quick self-redirect to avoid resending data on refresh */
  echo "<meta http-equiv=\"Refresh\" content=\"0;url=$HTTP_SERVER_VARS[PHP_SELF]\">";
  return;
}

/* Sets the value of the logged_in variable, which can be used in your code */
$logged_in = checkLogin();

?>