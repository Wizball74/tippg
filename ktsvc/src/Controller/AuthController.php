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
        if (isset($_SESSION['username']) && isset($_SESSION['password'])) {
            $user = $_SESSION['username'];
            $password = $_SESSION['password'];
        }
        // Cookie-basierte Auth (Fallback)
        elseif (isset($_COOKIE['cookname']) && isset($_COOKIE['cookpass'])) {
            $user = $_COOKIE['cookname'];
            $password = $_COOKIE['cookpass'];
        }

        if (!$user || !$this->confirmUser($user, $password)) {
            $this->api->RespondNotAuthorized();
            return;
        }

        $this->gateway->updateLogin($user);

        $userdata = $this->getUser($user);
        unset($userdata['password']);

        $this->api->RespondOk($userdata);
    }
        
    /**
     * confirmUser
     *
     * @param  mixed $username
     * @param  mixed $password
     * @return bool
     */
    function confirmUser($username, $password) : bool
    {
        /* Verify that user is in database */
        $result = $this->getUser($username);
        if(!$result) { return false; } //Indicates username failure
        
        /* Validate that password is correct */
        $data = $result;
        if($password == $data['password']) { return true; } //Success! Username and password confirmed
        
        return false; //Indicates password failure
    }
    
    /**
     * logout
     *
     * @return bool
     */
    function logout() : bool
    {
        if(isset($_COOKIE['cookname'])
            && isset($_COOKIE['cookpass']))
        {
            $cookieOptions = ['expires' => time() - 3600, 'path' => '/', 'httponly' => true, 'samesite' => 'Strict'];
            setcookie("cookname", "", $cookieOptions);
            setcookie("cookpass", "", $cookieOptions);
        } // if

        /* Kill session variables */
        unset($_SESSION['username']);
        unset($_SESSION['password']);

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
        $md5pass = md5($this->api->params['loginPassword']);

        $result = $this->confirmUser($user, $md5pass);
        if(!$result)
        {
             $this->api->RespondNotAuthorized();
        }
        else
        {
            if(isset($this->api->params['remember']))
            {
                $cookieOptions = [
                    'expires'  => time() + 60 * 60 * 24 * 30,
                    'path'     => '/',
                    'httponly'  => true,
                    'samesite' => 'Strict',
                ];
                setcookie("cookname", $user, $cookieOptions);
                setcookie("cookpass", $md5pass, $cookieOptions);
            }

            $this->gateway->updateLogin($user);

            $userdata = $this->getUser($user);
            unset($userdata['password']);

            $this->api->RespondOk($userdata);
        }       
    }
}