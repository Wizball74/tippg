<?php
/*
 * @author    M.Andreas
 * @copyright (c) 2021
 * @date      03/2021
 */

namespace Src\Controller;

use Src\Controller\AuthController;
use Src\TableGateways\TeilnehmerGateway;

class ApiController
{

    public $db;
    private $auth;

    private $request;
    public $requestmethod;
    public $method;
    public $params;
    public $user;

    public function __construct($db)
    {
        $this->db = $db;
        $this->auth = new AuthController($this);
    }

    /**
     * checkLogin
     *
     * @return void
     */
    function checkLogin()
    {
        // authenticate the request
        if (!$this->auth->checkLogin()) {
            header("HTTP/1.1 401 Unauthorized");
            exit('Unauthorized');
        }
    }

    /**
     * prepareRequest
     *
     * @param  mixed $userRequired
     * @return void
     */
    function prepareRequest($userRequired = true): bool
    {
        $this->request = $this->getRequest();
        $this->requestmethod = $this->request['requestmethod'];
        $this->method = $this->request['method'];
        $this->user = $this->request['user'];

        switch ($this->requestmethod) {
            case 'POST':
                $this->params = $this->request['jsoninput'];
                break;
            case 'GET':
                $this->params = $this->request['params']; // TODO
                break;
        }

        if ($userRequired && !$this->user) {
            $this->RespondNotAuthorized();
            return false;
        }

        return true;
    }

    /**
     * getRequest
     *
     * @return array
     */
    function getRequest(): array
    {
        $filter = function ($v) {
            if (empty($v)) return false;
            if (strpos($v, "public") !== false) return false;
            if (strpos($v, "index") !== false) return false;
            return true;
        };

        $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        $uri = explode('/', $uri);
        $uri = array_filter($uri, $filter);
        $requestMethod = $_SERVER["REQUEST_METHOD"];

        array_shift($uri); // Basisname entfernen
        $svc = array_shift($uri);
        $method = array_shift($uri);

        $raw = file_get_contents('php://input');
        $input = (array) json_decode($raw, TRUE);

        $result['requestmethod'] = $requestMethod;
        $result['method'] = $method;
        $result['service'] = $svc;
        $result['params'] = $uri;
        $result['rawinput'] = $raw;
        $result['jsoninput'] = $input;

        if (array_key_exists("token", $input)) {
            // MA 07.03.2021 TODO Token in tnid verwandeln
            $gw = new TeilnehmerGateway($this->db);
            $user = $gw->findByToken($input['token']);
            $result["user"] = empty($user) ? $user : $user[0];
        } else {
            $result["user"] = null;
        }

        return $result;
    }

    /**
     * Response
     *
     * @param  mixed $response
     * @return void
     */
    function Respond($response)
    {

        if ($response == null) $response = $this->notFoundResponse(); // Fallback TODO?

        header($response['status_code_header']);
        if ($response['body']) {
            echo $response['body'];
        }
    }

    function RespondNotAuthorized()
    {
        $this->Respond($this->notAuthorizedResponse());
    }

    function RespondNotFound()
    {
        $this->Respond($this->notFoundResponse());
    }

    function RespondOk($data)
    {
        $response['status_code_header'] = 'HTTP/1.1 200 OK';
        $response['body'] = json_encode($data);
        $this->Respond($response);
    }

    private function notFoundResponse()
    {
        $response['status_code_header'] = 'HTTP/1.1 404 Not Found';
        $response['body'] = null;
        return $response;
    }

    private function notAuthorizedResponse()
    {
        $response['status_code_header'] = 'HTTP/1.1 401 Unauthorized';
        $response['body'] = null;
        return $response;
    }
}
