<?php
/*
 * @author    M.Andreas
 * @copyright (c) 2021
 * @date      03/2021
 */

namespace Src\Controller;

use Src\TableGateways\TeilnehmerGateway;

class AuthController {

    private $api;

    private $gateway;

    public function __construct($api)
    {
        $this->api = $api;
        $this->gateway = new TeilnehmerGateway($api->db);
    }
     
    /**
     * getUser
     *
     * @param  mixed $userName
     * @return array
     */
    private function getUser($userName) : array
    {
        $result = $this->gateway->findByName($userName);
        return empty($result) ? $result : $result[0];
    }
  
    /**
     * checkLogin
     *
     * @return bool
     */
    function checkLogin()
    {
        $user = null;
        $password = null;

        // Token-basierte Auth (bevorzugt)
        if (!empty($this->api->user)) {
            $userdata = $this->api->user;
            unset($userdata['password']);
            $this->api->RespondOk($userdata);
            return;
        }

        // Session-basierte Auth
        if (isset($_SESSION['username'])) {
            $user = $_SESSION['username'];
            // Session ist bereits authentifiziert, kein Passwort-Check nötig
            $this->gateway->updateLogin($user);
            $userdata = $this->getUser($user);
            if ($userdata) {
                unset($userdata['password']);
                $this->api->RespondOk($userdata);
                return;
            }
        }
        // Cookie-basierte Auth (Fallback): Token statt Passwort
        if (isset($_COOKIE['cookname']) && isset($_COOKIE['cooktoken'])) {
            $user = $_COOKIE['cookname'];
            $tokenUser = $this->gateway->findByRememberToken($_COOKIE['cooktoken']);
            if ($tokenUser && $tokenUser['user'] === $user) {
                $_SESSION['username'] = $user;
                $this->gateway->updateLogin($user);
                $userdata = $this->getUser($user);
                unset($userdata['password']);
                $this->api->RespondOk($userdata);
                return;
            }
        }
        // Legacy Cookie-basierte Auth (alte cookpass Cookies)
        if (isset($_COOKIE['cookname']) && isset($_COOKIE['cookpass'])) {
            $user = $_COOKIE['cookname'];
            if ($this->confirmUser($user, $_COOKIE['cookpass'], true)) {
                $_SESSION['username'] = $user;
                $this->gateway->updateLogin($user);
                $userdata = $this->getUser($user);
                unset($userdata['password']);
                $this->api->RespondOk($userdata);
                return;
            }
        }

        // Kein Auth-Weg hat funktioniert
        $this->api->RespondNotAuthorized();
    }
        
    /**
     * confirmUser
     *
     * @param  mixed $username
     * @param  mixed $password
     * @return bool
     */
    function confirmUser($username, $password, $isHashed = false) : bool
    {
        /* Verify that user is in database */
        $result = $this->getUser($username);
        if(!$result) { return false; }

        $dbPassword = $result['password'];

        /* bcrypt hash in DB → password_verify mit Klartext */
        if (password_get_info($dbPassword)['algoName'] !== 'unknown') {
            if ($isHashed) { return false; }
            return password_verify($password, $dbPassword);
        }

        /* MD5 hash vergleichen */
        $md5 = $isHashed ? $password : md5($password);
        return ($md5 === $dbPassword);
    }
    
    /**
     * logout
     *
     * @return bool
     */
    function logout() : bool
    {
        // Remember-Token des aktuellen Geraets aus DB loeschen
        $token = $_COOKIE['cooktoken'] ?? $_COOKIE['remember_token'] ?? null;
        if ($token) {
            $this->gateway->deleteRememberToken($token);
        }

        $cookieOptions = ['expires' => time() - 3600, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax'];
        if(isset($_COOKIE['cookname'])) { setcookie("cookname", "", $cookieOptions); }
        if(isset($_COOKIE['cookpass'])) { setcookie("cookpass", "", $cookieOptions); }
        if(isset($_COOKIE['cooktoken'])) { setcookie("cooktoken", "", $cookieOptions); }
        if(isset($_COOKIE['remember_token'])) { setcookie("remember_token", "", $cookieOptions); }

        /* Kill session variables */
        unset($_SESSION['username']);

        $_SESSION = array(); // reset session array
        session_destroy();   // destroy session.
        $this->api->RespondOk(['loggedOut' => true]);
    }
        
    /**
     * login
     *
     * @param  mixed $request
     * @return void
     */
    function login() {
        $user = trim($this->api->params['loginUsername']);
        $plainpass = $this->api->params['loginPassword'];

        $result = $this->confirmUser($user, $plainpass);
        if(!$result)
        {
             $this->api->RespondNotAuthorized();
        }
        else
        {
            if(isset($this->api->params['remember']))
            {
                // Token-basiertes Remember: eigener Token pro Geraet
                $token = bin2hex(random_bytes(32));
                $this->gateway->insertRememberToken($user, $token);
                $cookieOptions = [
                    'expires'  => time() + 60 * 60 * 24 * 30,
                    'path'     => '/',
                    'httponly'  => true,
                    'samesite' => 'Lax',
                ];
                setcookie("cookname", $user, $cookieOptions);
                setcookie("cooktoken", $token, $cookieOptions);
            }

            $this->gateway->updateLogin($user);

            $userdata = $this->getUser($user);
            unset($userdata['password']);

            $this->api->RespondOk($userdata);
        }
    }
}