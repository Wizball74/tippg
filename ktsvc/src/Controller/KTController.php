<?php
/*
 * @author    M.Andreas
 * @copyright (c) 2021
 * @date      03/2021
 */

namespace Src\Controller;

use Src\TableGateways\KTGateway;

class KTController
{

    private $api;

    private $gateway;

    public function __construct($api)
    {
        $this->api = $api;
        $this->gateway = new KTGateway($api->db);
    }

    // COMMON ********************************************************************************
    public function getTrList()
    {
        $result = $this->gateway->getTrList($this->api->user);
        $this->api->RespondOk($result);
    }

    public function getMdList()
    {
        $trid = $this->api->params['trid'];

        $result = $this->gateway->getMdList($this->api->user, $trid);
        $this->api->RespondOk($result);
    }
    // COMMON ********************************************************************************

    // TIPPS ********************************************************************************
    public function getTipOverview()
    {
        $trid = $this->api->params['trid'];
        $md = $this->api->params['md'];

        $result = $this->gateway->GetTipOverview($this->api->user, $trid, $md);
        $this->api->RespondOk($result);
    }

    public function getTipEdit()
    {
        $trid = $this->api->params['trid'];
        $md = $this->api->params['md'];

        $result = $this->gateway->GetTipEdit($this->api->user, $trid, $md);
        $this->api->RespondOk($result);
    }

    // MA 14.03.2021
    public function saveTips()
    {
        $trid = $this->api->params['trid'];
        $md = $this->api->params['md'];
        $tips = $this->api->params['tips'];

        $result = $this->gateway->SaveTipps($this->api->user, $trid, $md, $tips);
        $this->api->RespondOk($result);
    }

    // TIPPS ********************************************************************************

}
