<?php

namespace Src\TableGateways;

class KTGateway
{

    private $db = null;


    public function __construct($db)
    {
        $this->db = $db->getConnection();
    }

    // COMMON ********************************************************************************
    public function getTrList($user): array
    {
        $sql = "SELECT * FROM v_rounds";

        // TODO: nur wenn eingeloggter Benutzer Teilnehmer ist
        if ($user['userlevel'] < 100) {
            $sql = $sql . " WHERE aktiv ='J'";
        }

        try {
            $statement = $this->db->query($sql);
            $result = $statement->fetchAll(\PDO::FETCH_ASSOC);
            return $result;
        } catch (\PDOException $e) {
            exit($e->getMessage());
        }
    }

    public function getMdList($user, $trid)
    {
        $sql = "SELECT * FROM v_matchdays WHERE trid = ? ORDER BY md";

        try {
            // Spieltag
            $statement = $this->db->prepare($sql);
            $statement->execute(array($trid));
            $result = $statement->fetchAll(\PDO::FETCH_ASSOC);
            return $result;
        } catch (\PDOException $e) {
            exit($e->getMessage());
        }
    }

    // 14.03.2021
    public function getMd($user, $trid, $md)
    {
        $sql = "SELECT * FROM v_matchdays WHERE trid = ? AND md = ?";

        try {
            $statement = $this->db->prepare($sql);
            $statement->execute(array($trid, $md));
            $result = $statement->fetchAll(\PDO::FETCH_ASSOC);
            return $result[0];
        } catch (\PDOException $e) {
            exit($e->getMessage());
        }
    }

    private function getSchedule($trid, $md)
    {
        $sql = "SELECT * FROM v_schedule WHERE trid = ? AND md = ? ORDER BY date"; // TODO ORDER sid?

        try {
            // Spieltag
            $statement = $this->db->prepare($sql);
            $statement->execute(array($trid, $md));
            $result = $statement->fetchAll(\PDO::FETCH_ASSOC);
            return $result;
        } catch (\PDOException $e) {
            exit($e->getMessage());
        }
    }

    private function getTips($trid, $md)
    {
        $sql = "SELECT * FROM v_tips WHERE trid = ? AND md = ? ORDER BY tnid, sid";

        try {
            $statement = $this->db->prepare($sql);
            $statement->execute(array($trid, $md));
            $result = $statement->fetchAll(\PDO::FETCH_ASSOC);
            return $result;
        } catch (\PDOException $e) {
            exit($e->getMessage());
        }
    }

    private function getTipsEdit($trid, $md, $tnid)
    {
        $sql = "SELECT * FROM v_tipsEdit WHERE trid = ? AND md = ? AND tnid = ? ORDER BY date, sid";

        try {
            $statement = $this->db->prepare($sql);
            $statement->execute(array($trid, $md, $tnid));
            $result = $statement->fetchAll(\PDO::FETCH_ASSOC);
            return $result;
        } catch (\PDOException $e) {
            exit($e->getMessage());
        }
    }

    private function getMemberRnd($trid, $round)
    {
        $sql = "SELECT * FROM v_member WHERE trid = ? AND round = ? ORDER BY name";

        try {
            $statement = $this->db->prepare($sql);
            $statement->execute(array($trid, $round));
            $result = $statement->fetchAll(\PDO::FETCH_ASSOC);
            return $result;
        } catch (\PDOException $e) {
            exit($e->getMessage());
        }
    }

    private function getMember($trid, $md)
    {
        $sql = "SELECT * FROM v_memberMd WHERE trid = ? AND md = ? ORDER BY name";

        try {
            $statement = $this->db->prepare($sql);
            $statement->execute(array($trid, $md));
            $result = $statement->fetchAll(\PDO::FETCH_ASSOC);
            return $result;
        } catch (\PDOException $e) {
            exit($e->getMessage());
        }
    }

    private function getResults($trid, $md)
    {
        $sql = "SELECT * FROM v_results WHERE trid = ? AND md = ? ORDER BY points DESC, name";

        try {
            $statement = $this->db->prepare($sql);
            $statement->execute(array($trid, $md));
            $result = $statement->fetchAll(\PDO::FETCH_ASSOC);
            return $result;
        } catch (\PDOException $e) {
            exit($e->getMessage());
        }
    }

    private function getBonus($trid, $division)
    {
        $sql = "SELECT * FROM v_bonus WHERE trid = ? AND division = ? ORDER BY pos";

        try {
            $statement = $this->db->prepare($sql);
            $statement->execute(array($trid, $division));
            $result = $statement->fetchAll(\PDO::FETCH_ASSOC);
            return $result;
        } catch (\PDOException $e) {
            exit($e->getMessage());
        }
    }

    function calcBonus($results, $division)
    {
        $trid = $results[0]['trid'];
        $rnd = $results[0]['round'];
        $_bonus = $this->getBonus($trid, $division);
        foreach ($_bonus as $key => $value) {
            $b[$value['round']][$value['pos']] = $value['value'];
        }
        $b = $b[$rnd];
        unset($b[0]);

        $anz = sizeof($b);

        unset($pts);
        foreach ($results as $key => $r) {
            $pts[$r['tnid']] = $r['points'];
        }

        arsort($pts);

        unset($tmp);
        foreach ($pts as $tnid => $p) $tmp[$p][] = $tnid;

        unset($bonus);
        $pl = 1;
        while (($anz > 0) && (sizeof($tmp) > 0)) {
            $t = array_shift($tmp);
            $st = sizeof($t);
            $anz = $anz - $st;
            $betrag = 0;
            for ($i = $pl; $i < $pl + $st; $i++) {
                if ($i <= sizeof($b)) $betrag = $betrag + floatval($b[$i]);
                // $betrag = $betrag + ($i < sizeof($b)) ? $b[$i] : 0;
            }

            for ($i = 0; $i < $st; $i++) $bonus[$t[$i]] = $betrag / $st;
            $pl = $pl + $st;
        } // while

        return $bonus;
    }

    function getLeagueOpponent($trid, $md, $tnid)
    {
        // 	Gegner Ligasystem
        $sql = "SELECT * FROM v_divisionresult WHERE trid = ? AND md = ? AND (tnid1 = ? or tnid2 = ?)";

        try {
            $statement = $this->db->prepare($sql);
            $statement->execute(array($trid, $md, $tnid, $tnid));
            $result = $statement->fetchAll(\PDO::FETCH_ASSOC);
            $data = $result[0];

            if ($data['tnid1'] == $tnid) $result = $data['tnid2'];
            else $result = $data['tnid1'];

            return $result;
        } catch (\PDOException $e) {
            exit($e->getMessage());
        }
    }

    // COMMON ********************************************************************************

    // TIPPS ********************************************************************************
    function GetTipOverview($user, $trid, $md)
    {
        try {
            $tnid = $user['tnid'];
            $tnidop = $this->getLeagueOpponent($trid, $md, $tnid);

            $games = $this->getSchedule($trid, $md);
            $results = $this->getResults($trid, $md);
            $tips = $this->getTips($trid, $md);
            $bonus = $this->calcBonus($results, '-1');

            foreach ($results as $key => $value) {
                $id = $value['tnid'];
                if (array_key_exists($id, $bonus)) $results[$key]['bonus'] = $bonus[$id];
            }

            $result = array(
                'trid' => $trid,
                'md' => $md,
                'games' => $games,
                'results' => $results,
                'tips' => $tips,
                'tnid' => $tnid,
                'opid' => $tnidop
            );

            return $result;
        } catch (\PDOException $e) {
            exit($e->getMessage());
        }
    }

    function GetTipEdit($user, $trid, $md)
    {
        try {
            $tnid = $user['tnid'];
            $mday = $this->getMd($user, $trid, $md);
            $games = $this->getSchedule($trid, $md);
            $tips = $this->getTipsEdit($trid, $md, $tnid);

            $result = array(
                'trid' => $trid,
                'md' => $md,
                'tnid' => $tnid,
                'games' => $games,
                'tips' => $tips,
                'deadline' => $mday['deadline']
            );

            return $result;
        } catch (\PDOException $e) {
            exit($e->getMessage());
        }
    }

    function SaveTipps($user, $trid, $md, $tips)
    {
        $tnid = $user['tnid'];
        $mday = $this->getMd($user, $trid, $md);
        $dl = strtotime($mday['deadline']);
        if ($dl < time()) {
            return
                array(
                    'ok' => false,
                    'message' => 'Abgabefrist überschritten!'
                );
        }

        foreach ($tips as $d) {
            $data[$d['sid']] = $d['tip'];
        }

        // (MA 09.02.2015) Anzahl prüfen
        $cnts = array();
        foreach ($data as $i => $t) {
            if (!array_key_exists($t, $cnts)) $cnts[$t] = 1;
            else $cnts[$t]++;
        }
        unset($cnts['']);
        foreach ($cnts as $cnt) {
            if ($cnt >= 5) {
                return
                    array(
                        'ok' => false,
                        'message' => 'Es sind maximal 4 gleiche Tipps erlaubt!'
                    );
            }
        }

        // Speichern
        $savecnt = 0;
        $empty = 0;
        $error = 0;
        $pat = '/^\d{1,2}\:\d{1,2}$/';

        foreach ($data as $sid => $tip) {
            // Eingabe prüfen
            $valid = false;
            if (empty($tip)) $empty++;
            else {
                $valid = preg_match($pat, $tip);
            }

            if ($valid) {
                try {
                    $sql = "REPLACE INTO kt3_tipps (sid,tnid,Tipp) VALUES (:sid, :tnid, :tip)";
                    $statement = $this->db->prepare($sql);
                    $statement->execute(array(
                        'sid' => $sid,
                        'tnid' => $tnid,
                        'tip'  => $tip,
                    ));
                    // $statement->rowCount();
                    $savecnt += 1;
                } catch (\PDOException $e) {
                    $error++;
                }
            }
        }

        if (($savecnt + $empty) >= count($tips)) {
            return array(
                'ok' => true,
                'message' => 'Tipps gespeichert!'
            );
        } else {
            return array(
                'ok' => true,
                'message' => "Es wurden nur $savecnt Tipps gespeichert!"
            );
        }
    }
    // TIPPS ********************************************************************************

}
