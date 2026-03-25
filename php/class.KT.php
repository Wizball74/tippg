<?php

error_reporting(E_ALL & ~E_WARNING); // MA 14.03.2026

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require 'Mailer/Exception.php';
require 'Mailer/PHPMailer.php';
require 'Mailer/SMTP.php';

require_once('class.Status.php');
require_once('class.DB.php');
require_once('class.Web.php');

class KT
{
	public $db = null;

	public $user = null;
	public $menu = null;
	public $action = null;

	public $trid = 0;
	public $md = 0;
	public $trrow = null;
	public $rnds = null;

	public $bonus = null;
	public $teams = null;
	public $member = null;

	public $TABLE;

	function __construct()
	{
		//echo "__construct";
		include("config.php");
		//echo $host, $userid, $pw, $database;
		$this->db = new DB($host, $userid, $pw, $database);

		// Tabellen
		$prefix = 'kt3_';

		$this->TABLE['adminlog']            = $prefix . 'adminlog';
		$this->TABLE['teilnehmer']          = $prefix . 'teilnehmer';
		$this->TABLE['tipprunde']           = $prefix . 'tipprunde';
		$this->TABLE['spielplan']           = $prefix . 'spielplan';
		$this->TABLE['teams']               = $prefix . 'teams';
		$this->TABLE['tipps']               = $prefix . 'tipps';
		$this->TABLE['tr_teilnehmer']       = $prefix . 'tr_teilnehmer';
		$this->TABLE['ligaergebnis']        = $prefix . 'ligaergebnis';
		$this->TABLE['praemien']            = $prefix . 'praemien';
		$this->TABLE['remind']				= $prefix . 'remind'; // MA 03.10.2017
		$this->TABLE['gamescores']          = $prefix . 'gamescores';
		$this->TABLE['pinnwand']            = $prefix . 'pinnwand';

		// Tabellen gamescores und pinnwand muessen manuell in der DB angelegt werden (siehe db/setup.sql)
	}

	/*****************************************************************************************************************************
	 * Daten
	 *****************************************************************************************************************************/
	function initData()
	{
		if (isset($_POST['trid'])) {
			if ($this->trid != $_POST['trid']) {
				$this->trid = $_POST['trid'];
				$this->trrow = null;
			}
		}

		if (isset($_POST['md'])) $this->md = $_POST['md'];
		if (isset($_POST['menu'])) $this->menu = $_POST['menu'];
		if (isset($_POST['action'])) $this->action = $_POST['action'];

		if (!$this->teams) $this->loadTeams();

		if (!$this->trrow && $this->trid > 0) {
			$this->loadTr($this->trid);
			$this->loadMember($this->trid);
			$this->loadRnds();
		}
	}

	function loadTeams()
	{
		$teams = array();
		$data = $this->db->getData(sprintf("SELECT * FROM %s", $this->TABLE['teams']));
		foreach ($data as $row) {
			$teams[$row['tid']] = $row;
		}

		foreach ($teams as $i => $t) {
			$teams[$i]['Name'] = $t['Name'];
			$teams[$i]['kurz'] = $t['kurz'];
		}

		$this->teams = $teams;
	}

	private static function makeLaps(&$s, &$e, $trrow)
	{
		$rnd = $trrow['Runden'];
		$asp = $trrow['Runden'] > 0 ? $trrow['MaxST'] / $trrow['Runden'] : $trrow['MaxST'];

		$et = 0;
		for ($i = 1; $i <= $rnd; $i++) {
			$st = $et + 1;
			$et = $st + $asp - 1;

			$s[$i] = round($st);
			$e[$i] = round($et);
		} // for
	}

	function loadTr($trid)
	{
		unset($trrow);

		$trrow = $this->db->Query(sprintf("SELECT * FROM %s WHERE trid=%d", $this->TABLE['tipprunde'], $trid))->fetch_assoc();
		$anz = $this->db->Query(sprintf("SELECT max(sptag) AS sptag FROM %s WHERE trid=%d", $this->TABLE['spielplan'], $trid))->fetch_assoc();
		$trrow['MaxST'] = $anz['sptag'];

		// Wertungsrunden
		unset($s);
		$s[0] = 0;
		unset($e);
		$e[0] = 0;
		self::makeLaps($s, $e, $trrow);
		$trrow['s'] = $s;
		$trrow['e'] = $e;
		foreach ($s as $i => $x) $a[$i] = $e[$i] - $s[$i] + 1;
		$trrow['a'] = $a;

		// aktueller Spieltag
		$row = $this->db->Query(sprintf(
			"SELECT IF(min(sptag), min(sptag), 34) AS sptag
											FROM %s WHERE trid=%d AND Ergebnis='-:-' AND (Datum > curdate() - INTERVAL 3 day)",
			$this->TABLE['spielplan'],
			$trid
		))->fetch_assoc();
		$trrow['AktST'] = $row['sptag'];

		// aktuelle Wertungsrunde +
		// Anz. Spielttage +  aktuelle Wertungsrunde
		$row = $this->db->Query(sprintf("SELECT max(sptag) as sptag FROM %s where trid=%d", $this->TABLE['spielplan'], $trid))->fetch_assoc();
		$trrow['AnzST'] = $row['sptag'];
		if (!isset($trrow['AktST'])) $trrow['AktST'] = $trrow['AnzST'];

		unset($_rnd);
		for ($j = 1; $j <= $row['sptag']; $j++) {
			foreach ($s as $i => $d) {
				if (($s[$i] <= $j) && ($e[$i] >= $j)) $_rnd[$j] = $i;
			}
		} // for
		//$trrow['AktRnd'] = $_rnd[$trrow['AktST']];
		$trrow['STRND'] = $_rnd;


		// Prämien
		unset($bonus);
		$data = $this->db->getData(sprintf("SELECT * FROM %s WHERE trid=%d", $this->TABLE['praemien'], $trid));
		foreach ($data as $row) {
			$bonus[$row['LRnd']][$row['Liga']][$row['platz']] = $row['betrag'];
		} // while
		$this->bonus = $bonus;
		$this->trrow = $trrow;
	}

	function loadMember($trid)
	{
		unset($member);

		// MA 30.01.2021 ... AND tr.Liga > 0
		$sql = sprintf(
			"SELECT tr.*, tn.name as name FROM  %s tn, %s tr
							WHERE tr.trid = %d AND tr.tnid=tn.tnid AND tn.userlevel > 0 AND tr.Liga > 0
							ORDER BY tr.LRnd, tn.name",
			$this->TABLE['teilnehmer'],
			$this->TABLE['tr_teilnehmer'],
			$trid
		);

		$data = $this->db->getData($sql);
		foreach ($data as $row) {
			$member[$row['LRnd']][$row['tnid']] = $row;
			$member[$row['LRnd']][$row['tnid']]['name'] = $row['name'];
		}

		// MA 26.09.2009 komplette Liste
		$sql = sprintf("SELECT tnid, name FROM %s ORDER BY name", $this->TABLE['teilnehmer']);

		$data = $this->db->getData($sql);
		foreach ($data as $row) {
			$member[-1][$row['tnid']] = $row;
			$member[-1][$row['tnid']]['name'] = $row['name'];
		}

		$this->member = $member;
	}

	function loadRnds()
	{
		$trrow = $this->trrow;
		$member = $this->member;
		$lcnt = $trrow['Ligen'];

		$results = [];
		for ($i = 1; $i <= $trrow['Runden']; $i++) {
			$lcount = [];

			//print_r($member[$i]);
			if (isset($member[$i]) && is_array($member[$i])) foreach ($member[$i] as $m) {
				$lcount[$m['Liga']] = ($lcount[$m['Liga']] ?? 0) + 1;
			}

			$results[$i] = array(
				'trid' => $trrow['trid'],
				'rnd' => $i,
				'Name' => sprintf('Runde %d (Spieltag %d - %d)', $i, $trrow['s'][$i], $trrow['e'][$i]),
				'MemberCount' => count($member[$i]),
				'LMembers' => $lcount,
				'LCount' => count($lcount),
				'MDCount' => $trrow['a'][$i],
			);
		}

		$this->rnds = $results;
	}

	function GetMenu()
	{
		if (!$this->user) {
			$menu['main'][] =   array('title' => 'Anmelden',           'smenu' => 'login',       'action' => 'login',    'cls' => 'full');
		} else {
			$menu['main'][] =   array('title' => 'Tipps',               'smenu' => 'Tipps', 	    'action' => 'Uebersicht', 'cls' => 'left');
			$menu['main'][] =   array('title' => 'Ligasystem',          'smenu' => 'Liga',  	    'action' => 'Spielplan',  'cls' => 'right');
			$menu['main'][] =   array('title' => 'Spielplan / Tabelle', 'smenu' => 'Spielplan',   'action' => 'Spielplan',  'cls' => 'right');
			$menu['main'][] =   array('title' => 'Prämien',	            'smenu' => 'Praemien',    'action' => 'Uebersicht', 'cls' => 'left');
			$menu['main'][] =   array('title' => 'Statistiken',         'smenu' => 'Stat',        'action' => 'Dashboard', 'cls' => 'left');
			$menu['main'][] =   array('title' => 'Admin',	            'smenu' => 'Admin',       'action' => 'Profil',     'cls' => 'right');
			$menu['main'][] =   array('title' => 'Pinnwand',            'smenu' => 'Pinnwand',    'action' => 'Anzeigen',   'cls' => 'left');
			$menu['main'][] =   array('title' => 'Abmelden',            'smenu' => 'login',       'action' => 'logout',    'cls' => 'full');


			$menu['Tipps'][] =   array('title' => 'Übersicht',           'smenu' => 'Tipps',       'action' => 'Uebersicht');
			$menu['Tipps'][] =   array('title' => 'Tippabgabe',          'smenu' => 'Tipps',       'action' => 'Tippabgabe');
			$menu['Tipps'][] =   array('title' => 'Gesamtstand',         'smenu' => 'Tipps',       'action' => 'Gesamtstand');

			$menu['Liga'][] =    array('title' => 'Spielplan',           'smenu' => 'Liga',        'action' => 'Spielplan');
			$menu['Liga'][] =    array('title' => 'Tabellen',            'smenu' => 'Liga',        'action' => 'Tabellen');

			$menu['Praemien'][] = array('title' => 'aktuell',            'smenu' => 'Praemien',    'action' => 'Uebersicht');
			$menu['Praemien'][] = array('title' => 'Information',        'smenu' => 'Praemien',    'action' => 'Info');

			$menu['Spielplan'][] = array('title' => 'Spielplan',        'smenu' => 'Spielplan',   'action' => 'Spielplan');
			$menu['Spielplan'][] = array('title' => 'Tabelle',          'smenu' => 'Spielplan',   'action' => 'Tabelle');

			$menu['Stat'][] =   array('title' => 'Dashboard',           'smenu' => 'Stat',        'action' => 'Dashboard');
			$menu['Stat'][] =   array('title' => 'Punkteverlauf',       'smenu' => 'Stat',        'action' => 'Punkteverlauf');
			$menu['Stat'][] =   array('title' => 'Trefferquote',        'smenu' => 'Stat',        'action' => 'Trefferquote');
			$menu['Stat'][] =   array('title' => 'Punkteverteilung',   'smenu' => 'Stat',        'action' => 'Punkteverteilung');
			$menu['Stat'][] =   array('title' => 'Tabellen',            'smenu' => 'Stat',        'action' => 'Tabellen');
			$menu['Stat'][] =   array('title' => 'Breakout',            'smenu' => 'Stat',        'action' => 'Breakout');

			$menu['Admin'][] =   array('title' => 'Einstellungen',          'smenu' => 'Admin',       'action' => 'Einstellungen');
			$menu['Admin'][] =   array('title' => 'Profil', 	   	        'smenu' => 'Admin',       'action' => 'Profil');
			if ($this->user['userlevel'] == 100) {
				$menu['Admin'][] = array('title' => 'Spielplan/Ergebnisse',  'smenu' => 'Admin', 'action' => 'Spielplan',    'level' => 100);
				$menu['Admin'][] = array('title' => 'Tipps ändern',          'smenu' => 'Admin', 'action' => 'Tipps',        'level' => 100);
				$menu['Admin'][] = array('title' => 'Tipprunden',            'smenu' => 'Admin', 'action' => 'Tipprunden',   'level' => 100);
				$menu['Admin'][] = array('title' => 'Benutzerverwaltung',    'smenu' => 'Admin', 'action' => 'Benutzer',     'level' => 100);
				$menu['Admin'][] = array('title' => 'Ligasystem',            'smenu' => 'Admin', 'action' => 'Liga',         'level' => 100);
				$menu['Admin'][] = array('title' => 'Prämien',   	        'smenu' => 'Admin', 'action' => 'Praemien',     'level' => 100);
				$menu['Admin'][] = array('title' => 'Spielplan-Import',      'smenu' => 'Admin', 'action' => 'importSP',     'level' => 100);
			}
		}

		$this->jsonout(array('menu' => $menu));
	}

	/*****************************************************************************************************************************
	 * Login
	 *****************************************************************************************************************************/
	function checkLogin()
	{
		/* Check if user has been remembered via token */
		if (isset($_COOKIE['remember_token']) && !isset($_SESSION['username'])) {
			try {
				$token = $_COOKIE['remember_token'];
				$sql = sprintf("SELECT user FROM %s WHERE remember_token = ?", $this->TABLE['teilnehmer']);
				$result = $this->db->prepare($sql, 's', [$token]);
				if ($result && $result->num_rows > 0) {
					$row = $result->fetch_assoc();
					$_SESSION['username'] = $row['user'];
				}
			} catch (\Exception $e) { /* Spalte existiert evtl. noch nicht */ }
		}

		/* Username has been set in session */
		if (isset($_SESSION['username'])) {
			$this->setUser($_SESSION['username']);
			if (!$this->user) {
				unset($_SESSION['username']);
				return false;
			}

			$sql = sprintf("UPDATE %s SET lastLogin = ? WHERE tnid = ?", $this->TABLE['teilnehmer']);
			$this->db->prepareExecute($sql, 'si', [date("YmdHis"), $this->user['tnid']]);

			return true;
		}

		return false;
	}

	function confirmUser($username, $password)
	{
		/* Verify that user is in database */
		$sql = sprintf("SELECT tnid, password FROM %s WHERE user = ?", $this->TABLE['teilnehmer']);
		$result = $this->db->prepare($sql, 's', [$username]);
		if (!$result || ($result->num_rows < 1)) {
			return 1; // Username not found
		}

		$dbarray = $result->fetch_array();
		$dbPassword = $dbarray['password'];

		/* Support both bcrypt and MD5 */
		if (password_get_info($dbPassword)['algo'] !== null && password_get_info($dbPassword)['algoName'] !== 'unknown') {
			// bcrypt hash
			return password_verify($password, $dbPassword) ? 0 : 2;
		} else {
			// MD5 hash
			return (md5($password) === $dbPassword) ? 0 : 2;
		}
	}

	function setUser($username)
	{
		$sql = sprintf("SELECT tnid, name, userlevel FROM %s WHERE user = ?", $this->TABLE['teilnehmer']);
		$result = $this->db->prepare($sql, 's', [$username]);
		if ($result && $result->num_rows > 0) {
			$this->user = $result->fetch_assoc();
			$sql = sprintf("UPDATE %s SET lastLogin2 = CURRENT_TIMESTAMP WHERE tnid = ?", $this->TABLE['teilnehmer']);
			$this->db->prepareExecute($sql, 'i', [$this->user['tnid']]);
		} else {
			$this->user = null;
		}
	}

	function generateRememberToken($tnid)
	{
		$token = bin2hex(random_bytes(32));
		try {
			$sql = sprintf("UPDATE %s SET remember_token = ? WHERE tnid = ?", $this->TABLE['teilnehmer']);
			$this->db->prepareExecute($sql, 'si', [$token, $tnid]);
		} catch (\Exception $e) { /* Spalte existiert evtl. noch nicht */ }
		return $token;
	}

	function logout()
	{
		// Remember-Token loeschen
		if ($this->user) {
			try {
				$sql = sprintf("UPDATE %s SET remember_token = NULL WHERE tnid = ?", $this->TABLE['teilnehmer']);
				$this->db->prepareExecute($sql, 'i', [$this->user['tnid']]);
			} catch (\Exception $e) { /* Spalte existiert evtl. noch nicht */ }
		}

		$cookieOptions = ['expires' => time() - 3600, 'path' => '/', 'httponly' => true, 'samesite' => 'Strict'];
		if (isset($_COOKIE['remember_token'])) setcookie("remember_token", "", $cookieOptions);
		if (isset($_COOKIE['cookname']))        setcookie("cookname", "", $cookieOptions);
		if (isset($_COOKIE['cookpass']))        setcookie("cookpass", "", $cookieOptions);
		if (isset($_COOKIE['cooktoken']))       setcookie("cooktoken", "", $cookieOptions);

		unset($_SESSION['username']);
		$this->user = null;

		$_SESSION = array();
		session_destroy();
		return false;
	}

	/*****************************************************************************************************************************
	 * Select-Boxen
	 *****************************************************************************************************************************/
	function getTrList()
	{
		$rows = [];
		if ($this->user) {
			// Tipprunde
			$sql = sprintf(
				"SELECT t.*, IF(st.sptag,st.sptag,34) as curmd FROM %s t
								LEFT JOIN ( select trid, min(sptag) as sptag FROM %s where Ergebnis='-:-'
								and  (Datum > (curdate() - INTERVAL 3 day))
								and  (Datum < (curdate() + INTERVAL 3 day))
								group by trid) st ON t.trid = st.trid",
				$this->TABLE['tipprunde'],
				$this->TABLE['spielplan']
			);
			if ($this->user['userlevel'] < 100) $sql = $sql . " WHERE t.aktiv ='J'"; // TODO: nur wenn eingeloggter Benutzer Teilnehmer ist
			$sql = $sql . " ORDER BY t.trid DESC";

			$rows = $this->db->getData($sql);
		}

		$this->jsonoutRows($rows);
	}

	function getMdList()
	{
		$rows = [];
		if ($this->user && isset($_POST['trid'])) {
			// Spieltag
			$trid = $_POST['trid'];
			$sql = sprintf(
				"SELECT *, DATE_FORMAT(Datum, '%%d.%%m.%%Y') AS DatumF
								FROM %s WHERE trid=%d ORDER BY sptag",
				$this->TABLE['spielplan'],
				$trid
			);
			$data = $this->db->getData($sql);
			unset($sptaglist);
			foreach ($data as $idx => $d) {
				if ($d['Ergebnis'] <> '-:-') $_sptaglist[$d['sptag']] = 1;
				else $_sptaglist[$d['sptag']] = 0;
				if (!isset($_sptagdatum[$d['sptag']])) $_sptagdatum[$d['sptag']] = $d['DatumF'];
			}

			if (isset($_sptaglist)) {
				foreach ($_sptaglist as $_sptag => $_komplett) {
					$sptaglist[] = array(
						'sptag' => $_sptag,
						'Anzeige' => sprintf("%02u. Spieltag (%s)", $_sptag, $_sptagdatum[$_sptag])
					);
				} // foreach
			} // if

			$rows = $sptaglist;
		}

		$this->jsonoutRows($rows);
	}

	function getRndList()
	{
		if ($this->rnds) {
			$rows = $this->rnds;
		}

		$this->jsonoutRows($rows);
	}

	function getTnList()
	{
		if ($this->user) {
			$trid = $_POST['trid'];
			$md = $_POST['md'];
			$rnd = $this->trrow['STRND'][$md];
			$member = $this->member[$rnd];

			$data[] = array('tnid' => 0, 'Name' => 'Bitte wählen.');

			if (is_array($member))
				foreach ($member as $m) $data[] = array('tnid' => $m['tnid'], 'Name' => $m['name']);

			$rows = $data;
		}

		$this->jsonoutRows($rows);
	}

	/*****************************************************************************************************************************
	 * Hilfsfunktionen
	 *****************************************************************************************************************************/
	function jsonout($json)
	{
		header('Cache-Control: no-cache, must-revalidate');
		header('Expires: Mon, 26 Jul 1997 05:00:00 GMT');
		header('Content-type: application/json');
		echo json_encode($json);
	}

	function jsonoutRows($rows)
	{
		if (!isset($rows)) $rows = array();

		// Ausgabe
		$data = array('Records' => count($rows), 'Rows' => $rows);
		$json = array('ok' => true, 'data' => $data);
		$this->jsonout($json);
	}

	function jsonoutGrid($colModel, $rows, $sort = null, $sortorder = null, $ud = null)
	{
		if (!isset($rows)) $rows = array();

		// MA 10.01.2017 Grid verkleinern bei Bedarf
		$vw = isset($_POST['_w']) ? intval($_POST['_w']) : 1024;
		$w = 0;
		foreach ($colModel as $c) {
			if (!$c['hidden']) $w += $c['width'];
		}

		// Auf Mobile: Name-Spalte verkleinern
		if ($vw < 768) {
			foreach ($colModel as $i => $c) {
				if (isset($c['classes']) && $c['classes'] == 'Name' && $c['width'] > 128)
					$colModel[$i]['width'] = 128;
			}
		}
		// Auf Tablet/Desktop verkleinern wenn noetig
		if ($w > $vw && $vw >= 768) {
			foreach ($colModel as $i => $c) {
				if ($c['classes'] == 'Team') $colModel[$i]['width'] -= 20;
				if ($c['classes'] == 'Name') $colModel[$i]['width'] -= 50;
				if ($c['classes'] == 'Result') $colModel[$i]['width'] -= 20;
			}
		}

		// Ausgabe
		$data = array('Records' => count($rows), 'Rows' => $rows);
		$json = array('colModel' => $colModel, 'data' => $data, 'sortname' => $sort, 'sortorder' => $sortorder, 'userdata' =>  $ud);

		$this->jsonout($json);
	}

	/*function jsonResult_alt($status, $message)
		{
			$json = array('ok' => $status);
			if ($message) $json['message'] = $message;
			$this->jsonout($json);
		}*/

	// MA 04.11.2017 $type
	function jsonResult2($status, $type, $message)
	{
		$json = array('ok' => $status, 'type' => $type);
		if ($message) {
			$json['message'] = $message;
		} else {
			$json['type'] = Status::NoMsg;
		}

		$this->jsonout($json);
	}

	function getLeagueOpponent($trid, $matchday)
	{
		// 	Gegner Ligasystem
		$tnid = $this->user['tnid'];
		if ($tnid > 0) {
			$sql = sprintf("SELECT * FROM %s WHERE trid=%d AND sptag=%d AND ((tnid1=%d) or (tnid2=%d))", $this->TABLE['ligaergebnis'], $trid, $matchday, $tnid, $tnid);
			$row = $this->db->Query($sql)->fetch_assoc();
			if ($row['tnid1'] == $tnid) $result = $row['tnid2'];
			else $result = $row['tnid1'];
		} else {
			$result = 0;
		}

		return $result;
	}

	function matchdaySummary($trid, $matchday)
	{
		unset($ret);

		$sql = sprintf(
			"SELECT sp.sid as sid, Ergebnis, Tipp, t.tnid as tnid, sp.Datum as Datum, sp.Uhrzeit
							FROM %s sp, %s t WHERE sp.trid=%d AND sp.sptag=%d AND sp.sid=t.sid ORDER BY t.tnid, sp.sid",
			$this->TABLE['spielplan'],
			$this->TABLE['tipps'],
			$trid,
			$matchday
		);

		$deadline = $this->checkDeadline($trid, $matchday);

		$result = $this->db->Query($sql);
		while ($row = $result->fetch_assoc()) {
			if ($deadline) {
				$ret[$row['tnid']]['Tips'][$row['sid']]['Tip'] = $row['Tipp'];
				if ($row['Ergebnis'] <> '-:-') {
					$ret[$row['tnid']]['Tips'][$row['sid']]['Points'] =  $this->evaluateTip($row['Tipp'], $row['Ergebnis']);
					if (!isset($ret[$row['tnid']]['Points'])) $ret[$row['tnid']]['Points'] = 0;
					$ret[$row['tnid']]['Points'] += $ret[$row['tnid']]['Tips'][$row['sid']]['Points'];
				} // if
			} else {
				$ret[$row['tnid']]['Tips'][$row['sid']]['Tip'] = '-:-';
				$ret[$row['tnid']]['Tips'][$row['sid']]['Points'] = '?';
				$ret[$row['tnid']]['DL'] = 1;
			}
		} // while

		return $ret;
	}

	function checkDeadline($trid, $matchday)
	{
		return ($this->getDeadline($trid, $matchday) < time());
	}

	function getDeadline($trid, $matchday)
	{
		$row = $this->db->Query(sprintf(
			"SELECT *, DATE_FORMAT(Datum, '%%d.%%m.%%Y') AS DatumF FROM %s
											WHERE trid=%d AND sptag=%d ORDER BY Datum, Uhrzeit",
			$this->TABLE['spielplan'],
			$trid,
			$matchday
		))->fetch_assoc();
		if (!$row || empty($row['DatumF']) || empty($row['Uhrzeit'])) return 0;
		$d = preg_split('/\./', $row['DatumF']);
		$z = preg_split('/:/', $row['Uhrzeit']);

		return mktime($z[0] - $this->trrow['deadline'], $z[1], 0, $d[1], $d[0], $d[2]); // Deadline für Tippabgabe
	}

	function evaluateTip($tip, $result)
	{
		$trrow = $this->trrow;
		$P1 = $trrow['P1'];
		$P2 = $trrow['P2'];
		$P3 = $trrow['P3'];

		$pts = 0;

		if (($result <> '-:-') && ($tip <> '-:-') && (!empty($tip))) {
			if ($result == $tip) $pts = $P1;
			else {
				$_t = preg_split('/:/', $tip);
				$_r = preg_split('/:/', $result);

				$t = intval($_t[0]) - intval($_t[1]); // MA 14.03.2026
				$r = intval($_r[0]) - intval($_r[1]); // MA 14.03.2026

				if ($t == $r) $pts = $P2;
				else
						if ($t * $r > 0) $pts = $P3;
			} // if
		} // if

		return $pts;
	}

	function getBonus($rnd, $league, $pts)
	{
		unset($bonus);
		if (!is_array($pts)) return null;
		unset($pts[0]);
		//print_r($pts);
		if (sizeof($pts) > 0) {
			$b = $this->bonus;
			//print_r($b);
			$b = $b[$rnd][$league];

			unset($b[0]);
			if (isset($b)) ksort($b);
			$anz = sizeof($b);
			unset($tmp);

			foreach ($pts as $tnid => $p) $tmp[$p][] = $tnid;
			unset($tmp[0]); // keine Präme für 0 Punkte
			krsort($tmp);
			$pl = 1;
			while (($anz > 0) && (sizeof($tmp) > 0)) {
				$t = array_shift($tmp);
				$st = sizeof($t);
				$anz = $anz - $st;
				$betrag = 0;
				for ($i = $pl; $i < $pl + $st; $i++) $betrag = $betrag + $b[$i];
				for ($i = 0; $i < $st; $i++) $bonus[$t[$i]] = $betrag / $st;
				$pl = $pl + $st;
			} // while
		} // if
		return $bonus;
	}

	function format_Date($date)
	{
		$d = preg_split('/-/', $date);
		return $d[2] . '.' . $d[1] . '.' . $d[0];
	}

	function convertDate($date)
	{
		$d = strtotime($date);
		if ($d) return date('Y-m-d', $d);
		return $date;
	}

	function defValue($val, $default = '')
	{
		return (isset($val)) ? $val : $default;
	}

	function calcLeague($trid, $matchday)
	{
		$tips = $this->matchdaySummary($trid, $matchday);
		if (is_array($tips)) {
			foreach ($tips as $tnid => $t) {
				$pts[$tnid] = $t['Points'];
			}
		}
		$sql = sprintf("SELECT * FROM %s WHERE trid=%d AND sptag=%d", $this->TABLE['ligaergebnis'], $trid, $matchday);
		$data = $this->db->getData($sql);
		foreach ($data as $row) {
			$tn1 = $row['tnid1'];
			$tn2 = $row['tnid2'];
			$p1 = isset($pts[$tn1]) ? $pts[$tn1] : 0;
			$p2 = isset($pts[$tn2]) ? $pts[$tn2] : 0;

			$sql = sprintf(
				"REPLACE INTO %s (trid,sptag,liga,tnid1,tnid2,Ergebnis) VALUES(%d,%d,%d,%d,%d,'%s')",
				$this->TABLE['ligaergebnis'],
				$trid,
				$matchday,
				$row['Liga'],
				$tn1,
				$tn2,
				$p1 . ':' . $p2
			);

			$this->db->Query($sql);
		}
	}

	/*****************************************************************************************************************************
	 * Tipps
	 *****************************************************************************************************************************/

	/**/	function GetTippsUebersichtData()
	{
		$colModel = array();
		$data = array(); // MA 14.03.2026

		if (isset($_POST['trid']) && isset($_POST['md'])) {

			$trid = $_POST['trid'];
			$md = $_POST['md'];
			$json = array();
			$teams = $this->teams;
			$member = $this->member;

			// Datenmodell
			$colModel[] = array('label' => "Name", 'width' => 200, 'name' => "Name", 'classes' => 'Name');

			$sql = sprintf("SELECT s.* FROM %s s WHERE s.trid=%d AND s.sptag=%d ORDER BY s.sid", $this->TABLE['spielplan'], $trid, $md);
			$data = $this->db->getData($sql);
			foreach ($data as $row) {
				$hdr = sprintf(
					'%s<p class="hdrRes">%s</p>%s',
					$teams[$row['tid1']]['kurz'],
					$row['Ergebnis'],
					$teams[$row['tid2']]['kurz']
				);

				$ttip = sprintf(
					"%s\r\n\t%s\r\n%s",
					$teams[$row['tid1']]['Name'],
					$row['Ergebnis'],
					$teams[$row['tid2']]['Name']
				);

				$colModel[] = array(
					'label' => $hdr, 'width' => 50, 'name' => 't' . $row['sid'], 'align' => 'center', 'sortable' => false, 'resizable' => false,
					'classes' => 'Tipps', 'hdrtooltip' =>  $ttip
				);
				$colModel[] = array(
					'label' => ' ', 'width' => 20, 'name' => 'p' . $row['sid'], 'align' => 'center', 'sortable' => false,  'resizable' => false,
					'classes' => 'Pts1', 'formatter' => 'html'
				);
			}

			$colModel[] = array('label' => "Pkt.", 'width' => 40, 'name' => "Pts", 'align' => 'right', 'sorttype' => 'int', 'classes' => 'Pts');
			$colModel[] = array(
				'label' => "Prämie", 'width' => 80, 'name' => "Bonus", 'align' => 'right', 'formatter' => 'currency', 'sorttype' => 'currency',
				'formatoptions' => array("defaultValue" => ""), 'classes' => 'Bonus'
			);
			$colModel[] = array('name' => "id", 'key' => true, 'hidden' => true);
			$colModel[] = array('name' => "cls", 'hidden' => true);

			// Spiel-IDs sammeln für Standardwerte
			$gameIds = array();
			foreach ($data as $row) {
				$gameIds[] = $row['sid'];
			}

			// Daten
			$tnid = $this->user['tnid'];
			$tnidop = $this->getLeagueOpponent($trid, $md);

			unset($data);
			unset($pts);
			unset($cls);
			$cls[$tnid] = 'rowUser';
			$cls[$tnidop] = 'rowOpponent';

			$idx = 0;

			$rnd = $this->trrow['STRND'][$md];
			$tips = $this->matchdaySummary($trid, $md);
			unset($pts);
			if (is_array($tips)) {
				foreach ($tips as $tnid => $t) {
					if (isset($tips[$tnid]['Points'])) $pts[$tnid] = $tips[$tnid]['Points'];
				}
				$bonus = $this->getBonus($rnd, '-1', $pts);
			}

			foreach ($member[$rnd] as $m) {
				$data[$idx] = array(
					'Name' => $m['name'],
					'id' => $m['tnid'],
					'Pts' => isset($tips[$m['tnid']]['Points']) ? $tips[$m['tnid']]['Points'] : '',
					'Bonus' => isset($bonus[$m['tnid']]) ? sprintf("%3.2f", $bonus[$m['tnid']]) : '',
					'cls' => isset($cls[$m['tnid']]) ? $cls[$m['tnid']] : ''
				);

				// Standardwerte für alle Spiel-Spalten setzen (verhindert "undefined" in jqGrid)
				foreach ($gameIds as $sid) {
					$data[$idx]["t$sid"] = '';
					$data[$idx]["p$sid"] = '';
				}

				if (isset($tips[$m['tnid']]['Tips']) && is_array($tips[$m['tnid']]['Tips']))
					foreach ($tips[$m['tnid']]['Tips'] as $sid => $t) {
						$data[$idx]["t$sid"] = $t['Tip'];
						$p = $t['Points'];
						if ($p == $this->trrow['P1']) {
							$data[$idx]["p$sid"] = '<span class="pts-exact">' . $p . '</span>';
						} else if ($p == $this->trrow['P2']) {
							$data[$idx]["p$sid"] = '<span class="pts-diff">' . $p . '</span>';
						} else if ($p == $this->trrow['P3']) {
							$data[$idx]["p$sid"] = '<span class="pts-tend">' . $p . '</span>';
						} else {
							$data[$idx]["p$sid"] = '<span class="pts-zero">' . $p . '</span>';
						}
					}
				$idx++;
			}
		}

		// Spieltag komplett? Sieger mit Krone markieren
		if (is_array($data) && count($data) > 0) {
			// Pruefen ob alle Ergebnisse vorliegen
			$sql = sprintf("SELECT COUNT(*) as cnt FROM %s WHERE trid=%d AND sptag=%d AND (Ergebnis='' OR Ergebnis='-:-' OR Ergebnis IS NULL)", $this->TABLE['spielplan'], $trid, $md);
			$check = $this->db->getData($sql);
			$allComplete = (isset($check[0]) && $check[0]['cnt'] == 0);

			if ($allComplete) {
				// Hoechste Punktzahl ermitteln
				$maxPts = 0;
				foreach ($data as $row) {
					if (isset($row['Pts']) && $row['Pts'] > $maxPts) $maxPts = $row['Pts'];
				}
				if ($maxPts > 0) {
					foreach ($data as &$row) {
						if (isset($row['Pts']) && $row['Pts'] == $maxPts) {
							$row['Name'] = "\xF0\x9F\x91\x91 " . $row['Name'];
						}
					}
					unset($row);
				}
			}
		}

		$this->jsonoutGrid($colModel, $data, 'Pts', 'desc');
	}

	function GetTippsTippabgabeData()
	{
		$colModel = array();

		if (isset($_POST['trid']) && isset($_POST['md'])) {
			// Datenmodell
			$colModel[] = array('label' => " ", 'width' => 24, 'name' => "HLogo", 'formatter' => 'logo');
			$colModel[] = array('label' => "Heim", 'width' => 200, 'name' => "HTeam", 'formatter' => 'html', 'classes' => 'Team');
			$colModel[] = array('label' => " ", 'width' => 24, 'name' => "ALogo", 'formatter' => 'logo');
			$colModel[] = array('label' => "Ausw.", 'width' => 200, 'index' => "ATeam", 'name' => "ATeam", 'formatter' => 'html', 'classes' => 'Team');
			$colModel[] = array('label' => "Datum", 'width' => 70, 'name' => "DateTime", 'align' => 'center', 'formatter' => 'html', 'classes' => 'DateTime');
			$colModel[] = array(
				'label' => "Tipp", 'width' => 70, 'name' => "Tip", 'align' => 'center', 'classes' => "Result",
				'editable' => true, 'editoptions' => array('size' => 5, 'maxlength' => 5, 'class' => 'gradient')
			);

			// Nach Deadline: Ergebnis und Punkte anzeigen
			$deadlinePassed = $this->checkDeadline($_POST['trid'], $_POST['md']);
			if ($deadlinePassed) {
				$colModel[] = array('label' => "Erg.", 'width' => 55, 'name' => "Result", 'align' => 'center', 'classes' => 'Result tipSep');
				$colModel[] = array('label' => "Pkt.", 'width' => 50, 'name' => "Pts", 'align' => 'center', 'formatter' => 'html', 'classes' => 'Pts');
			}

			$colModel[] = array('width' => 90, 'name' => "editable", 'hidden' => true);
			$colModel[] = array('width' => 90, 'name' => "sid", 'key' => true, 'hidden' => true);
			$colModel[] = array('width' => 90, 'name' => "id", 'key' => true, 'hidden' => true);
			$colModel[] = array('width' => 90, 'name' => "tnid", 'hidden' => true);
			$colModel[] = array('width' => 90, 'name' => "deadline", 'hidden' => true);
			$colModel[] = array('width' => 90, 'name' => "tidH", 'hidden' => true);
			$colModel[] = array('width' => 90, 'name' => "tidA", 'hidden' => true);

			// Daten
			$userid = $this->user['tnid'];
			$trid = $_POST['trid'];
			$md = $_POST['md'];

			$sql = sprintf(
				"SELECT s.*, t.Tipp, %d AS tnid FROM %s s LEFT JOIN %s t ON s.sid=t.sid AND (t.tnid=%d OR t.tnid IS NULL)
								WHERE s.trid=%d AND s.sptag=%d ORDER BY Datum, Uhrzeit",
				$userid,
				$this->TABLE['spielplan'],
				$this->TABLE['tipps'],
				$userid,
				$trid,
				$md
			);

			$data = $this->db->getData($sql);
			unset($tips);
			$teams = $this->teams;

			$ed = !$this->checkDeadline($trid, $md);
			$dl = date('d.m.Y H:i', $this->getDeadline($trid, $md));
			foreach ($data as $row) {
				$tipRow = array(
					'sid' => $row['sid'],
					'id' => $row['sid'],
					'HTeam' => $teams[$row['tid1']]['Name'],
					'ATeam' => $teams[$row['tid2']]['Name'],
					'HLogo' => $row['tid1'],
					'ALogo' => $row['tid2'],
					'DateTime' => date('d.m.', strtotime($row['Datum'])) . '<br>' . substr($row['Uhrzeit'], 0, 5),
					'Tip' => $row['Tipp'],
					'editable' => $ed,
					'deadline' => $dl,
					'tnid' => $row['tnid'],
					'tidH' => $row['tid1'],
					'tidA' => $row['tid2']
				);
				if (!$ed) {
					$tipRow['Result'] = $row['Ergebnis'];
					$pts = ($row['Ergebnis'] != '-:-' && !empty($row['Tipp']))
						? $this->evaluateTip($row['Tipp'], $row['Ergebnis'])
						: '';
					if ($pts == $this->trrow['P1']) {
						$tipRow['Pts'] = '<span class="pts-exact">' . $pts . '</span>';
					} else if ($pts == $this->trrow['P2']) {
						$tipRow['Pts'] = '<span class="pts-diff">' . $pts . '</span>';
					} else if ($pts == $this->trrow['P3']) {
						$tipRow['Pts'] = '<span class="pts-tend">' . $pts . '</span>';
					} else {
						$tipRow['Pts'] = '<span class="pts-zero">' . $pts . '</span>';
					}
				}
				$tips[] = $tipRow;
			}
		}

		$this->jsonoutGrid($colModel, $tips);
	}

	function SaveTipps()
	{
		if (isset($_POST['data'])) {

			$trid = $_POST['trid'];
			$md = $_POST['md'];

			$editable = !$this->checkDeadline($trid, $md);
			$pat = '/^\d{1,2}\:\d{1,2}$/';

			if ($editable) {
				$data = $_POST['data'];

				// MA 09.02.2015
				unset($t);
				foreach ($data as $d) $t[$d['Tip']]++;
				unset($t['']);
				foreach ($t as $cnt) {
					if ($cnt >= 5) {
						$this->jsonResult2(false, Status::Error, 'Es sind maximal 4 gleiche Tipps erlaubt!');
						return;
					}
				}

				$savecnt = 0; // MA 04.11.2017
				foreach ($data as $d) {
					// Eingabe prüfen
					$valid = false;
					$tip = $d['Tip'];
					if ($tip == '') $valid = true;
					else {
						$valid = preg_match($pat, $tip);
					}

					if ($valid) {
						if ($tip != '') $savecnt++;
						$sql = sprintf("REPLACE INTO %s (sid,tnid,Tipp) VALUES (?, ?, ?)", $this->TABLE['tipps']);
						$this->db->prepareExecute($sql, 'iis', [(int)$d['sid'], (int)$d['tnid'], $d['Tip']]);
					}
				}

				if ($savecnt >= count($data)) {
					$this->jsonResult2(true, Status::OK, 'Tipps gespeichert!');
				} else {
					$this->jsonResult2(true, Status::Warning, "Es wurden nur $savecnt Tipps gespeichert!");
				}
				return;
			} else {
				$this->jsonResult2(false, Status::Error, 'Abgabefrist überschritten!');
				return;
			}
		} else {
			$this->jsonResult2(true);
		}
	}

	function getTippInfo()
	{
		$html = '';

		if (isset($_POST['tidH'])) {
			$tidH = $_POST['tidH'];
			$tidA = $_POST['tidA'];
			$teams = $this->teams;
			$limit = 6;

			$sql = sprintf("SELECT * FROM %s WHERE (tid1=%d OR tid2=%d) AND Ergebnis <>'-:-' ORDER BY Datum DESC LIMIT %d", $this->TABLE['spielplan'], $tidH, $tidH, $limit);
			$html .= $this->getTable($sql, 'letzte Spiele von <b>' . $teams[$tidH]['Name'] . '</b>');

			$sql = sprintf("SELECT * FROM %s WHERE (tid1=%d OR tid2=%d) AND Ergebnis <>'-:-' ORDER BY Datum DESC LIMIT %d", $this->TABLE['spielplan'], $tidA, $tidA, $limit);
			$html .= $this->getTable($sql, 'letzte Spiele von <b>' . $teams[$tidA]['Name'] . '</b>');

			$sql = sprintf("SELECT * FROM %s WHERE ((tid1=%d AND tid2=%d) OR (tid1=%d AND tid2=%d)) AND Ergebnis <>'-:-' ORDER BY Datum DESC LIMIT %d", $this->TABLE['spielplan'], $tidH, $tidA, $tidA, $tidH, $limit);
			$html .= $this->getTable($sql, 'letzte Spiele gegeneinander');
		} else {
			$html = '<div class="kttable rounded shadow tipinfo" style="padding:10px">' .
				'<p>Tippabgabe bitte wie folgt: <b>1:0</b>, <b>2:1</b>, <b>2:2</b>, ...</p>' .
				'<p style="color:#888;font-size:0.9em">Markieren Sie ein Spiel, um Statistiken zur Partie anzuzeigen.</p></div>';
		}

		$json = array('ok' => true, 'html' => $html);
		$this->jsonout($json);
	}

	function getTable($sql, $title = '')
	{
		$teams = $this->teams;

		$html = '<table class="kttable rounded shadow tipinfo"><tr class="row3"><th colspan="4">' . $title . '</th></tr>';
		$data = $this->db->getData($sql);
		$cls = 'row2';
		foreach ($data as $row) {
			$styleH = '';
			$styleA = '';
			$r = preg_split('/:/', $row['Ergebnis']);
			if ($r[0] > $r[1]) {
				$styleH = ' bold';
			} else if ($r[0] < $r[1]) {
				$styleA = ' bold';
			}

			$cls = ($cls == 'row1') ? 'row2' : 'row1';
			$html .= '<tr class="' . $cls . '">';
			$html .= '<td class="Date">' . $this->format_Date($row['Datum']) . '</td>';
			$html .= '<td class="Team' . $styleH . '">' . $teams[$row['tid1']]['Name'] . '</td>';
			$html .= '<td class="Team' . $styleA . '">' . $teams[$row['tid2']]['Name'] . '</td>';
			$html .= '<td class="Result">' . $row['Ergebnis'] . '</td>';
			$html .= '</tr>';
		}
		$html .= '</table>';
		return $html;
	}

	/**/
	function GetTippsGesamtstandData()
	{
		$colModel = array();
		$data = array(); // MA 14.03.2026

		if (isset($_POST['trid']) && isset($_POST['md'])) {
			$trid = $_POST['trid'];
			$md = $_POST['md'];
			$json = array();
			$member = $this->member;
			$rnd = $this->trrow['STRND'][$md];
			$start = $this->trrow['s'][$rnd];
			$end = $this->trrow['e'][$rnd];

			// Datenmodell
			$colModel[] = array('label' => "#", 'width' => 25, 'name' => "Pos", 'align' => 'right', 'sorttype' => 'int', 'classes' => 'Pos');
			$colModel[] = array('label' => "Name", 'width' => 200, 'name' => "Name", 'align' => 'left', 'classes' => 'Name');
			$colModel[] = array('label' => "Pkt.", 'width' => 40, 'name' => "Pts", 'align' => 'right', 'sorttype' => 'int', 'classes' => 'Pts');
			for ($i = $start; $i <= $end; $i++) {
				$colModel[] = array('label' => $i, 'width' => 30, 'name' => 's' . $i, 'align' => 'right', 'sortable' => false, 'classes' => '');
			}

			$colModel[] = array(
				'label' => "Prämie", 'width' => 70, 'name' => "Bonus", 'align' => 'right', 'formatter' => 'currency', 'sorttype' => 'currency',
				'formatoptions' => array("defaultValue" => ""), 'classes' => 'Bonus'
			);
			$colModel[] = array('name' => "id", 'key' => true, 'hidden' => true);
			$colModel[] = array('name' => "cls", 'hidden' => true);

			// Daten
			unset($data);

			unset($cls);
			$tnid = $this->user['tnid'];
			$cls[$tnid] = 'rowUser';

			unset($pts);
			//print_r($_SESSION['member']);
			//echo $rnd;
			//print_r($member[$rnd]);
			foreach ($member[$rnd] as $m) {
				$pts[$m['tnid']] = 0;
			}

			for ($i = $start; $i <= $end; $i++) {
				$tips[$i] = $this->matchdaySummary($trid, $i);

				foreach ($member[$rnd] as $m) {
					$pts[$m['tnid']] += isset($tips[$i][$m['tnid']]['Points']) ? $tips[$i][$m['tnid']]['Points'] : 0;
				}
			}

			arsort($pts);

			$bonus = $this->getBonus($rnd, 0, $pts);

			$idx = 0;
			foreach ($pts as $tnid => $p) {
				$m = $member[$rnd][$tnid];
				$data[$idx] = array(
					'Pos' => $idx + 1,
					'Name' => $m['name'],
					'id' => $m['tnid'],
					'Pts' => $p,
					'Bonus' => isset($bonus[$tnid]) ? sprintf("%3.2f", $bonus[$tnid]) : '',
					'cls' => isset($cls[$m['tnid']]) ? $cls[$m['tnid']] : ''
				);
				for ($i = $start; $i <= $end; $i++) {
					$data[$idx]["s$i"] = isset($tips[$i][$tnid]['Points']) ? $tips[$i][$tnid]['Points'] : '';
				}
				$idx++;
			}
		}

		$this->jsonoutGrid($colModel, $data, 'Pts', 'desc');
	}

	/*****************************************************************************************************************************
	 * Liga-Modus
	 *****************************************************************************************************************************/

	function GetLigaSpielplanData()
	{
		$colModel = array();

		if (isset($_POST['trid']) && isset($_POST['md'])) {
			$trid = $_POST['trid'];
			$md = $_POST['md'];
			$league = $_POST['lnr'];
			$json = array();
			$member = $this->member;
			$rnd = $this->trrow['STRND'][$md];

			$colModel[] = array('label' => "Spieler 1", 'width' => 200, 'name' => "M1", 'classes' => 'Name');
			$colModel[] = array('label' => "Spieler 2", 'width' => 200, 'name' => "M2", 'classes' => 'Name');
			$colModel[] = array('label' => "Ergebnis", 'width' => 90, 'name' => "Result", 'align' => 'center', 'classes' => 'Result');
			$colModel[] = array('name' => "id", 'key' => true, 'hidden' => true);
			$colModel[] = array('name' => "cls", 'hidden' => true);

			$sql = sprintf("SELECT * FROM %s WHERE trid=%d AND sptag=%d AND Liga=%d", $this->TABLE['ligaergebnis'], $trid, $md, $league);
			$data = $this->db->getData($sql);
			unset($schedule);

			unset($cls);
			$tnid = $this->user['tnid'];
			$cls[$tnid] = 'rowUser';

			$id = 0;
			foreach ($data as $row) {
				$schedule[] = array(
					'trid' => $row['trid'],
					'md' => $row['sptag'],
					'League' => $row['Liga'],
					'M1' => $member[$rnd][$row['tnid1']]['name'],
					'M2' => $member[$rnd][$row['tnid2']]['name'],
					'Result' => $row['Ergebnis'],
					'cls' => (isset($cls[$row['tnid1']]) ? $cls[$row['tnid1']] : '') . (isset($cls[$row['tnid2']]) ? $cls[$row['tnid2']] : ''),
					'id' => $id++
				);
			}
		}

		$this->jsonoutGrid($colModel, $schedule);
	}

	function GetLigaTabelleData()
	{
		$colModel = array();

		if (isset($_POST['trid']) && isset($_POST['md'])) {
			$trid = $_POST['trid'];
			$md = $_POST['md'];
			$lnr = $_POST['lnr'];

			$json = array();
			$rnd = $this->trrow['STRND'][$md];
			$member = $this->member[$rnd];

			unset($league);

			if (is_array($member)) {
				foreach ($member as $m) {
					$league[$m['Liga']][] = array('tnid' => $m['tnid'], 'LNr' => $m['LNr']);
				}

				$l = $league[$lnr];
				if (is_array($l)) {
					$colModel[] = array('label' => "Platz", 'width' => 40, 'name' => "Pos", 'align' => 'right', 'sorttype' => 'int', 'classes' => 'Pos');
					$colModel[] = array('label' => "Name", 'width' => 190, 'name' => "Name", 'classes' => 'Name');
					$colModel[] = array('label' => "Pkt", 'width' => 35, 'name' => "Pts", 'align' => 'right', 'sorttype' => 'int', 'classes' => 'Pts');

					if ($l[0]['LNr'] > 0) {
						$colModel[] = array('label' => "Tore", 'width' => 75, 'name' => "Goals", 'align' => 'right');
						$colModel[] = array('label' => "Diff", 'width' => 40, 'name' => "Diff", 'align' => 'right', 'sorttype' => 'int');
						$colModel[] = array('label' => "Sp.", 'width' => 30, 'name' => "Matches", 'align' => 'right', 'sorttype' => 'int');
						$colModel[] = array('label' => "S", 'width' => 30, 'name' => "Win", 'align' => 'right', 'sorttype' => 'int');
						$colModel[] = array('label' => "U", 'width' => 30, 'name' => "Draw", 'align' => 'right', 'sorttype' => 'int');
						$colModel[] = array('label' => "N", 'width' => 30, 'name' => "Loss", 'align' => 'right', 'sorttype' => 'int');

						$result[$lnr] = $this->createLeagueTable($league[$lnr], $trid, $rnd, $lnr);
					} else {
						$result[$lnr] = $this->createSimpleTable($league[$lnr], $trid, $rnd);
					}

					$colModel[] = array('name' => "tnid", 'key' => true, 'hidden' => true);
					$colModel[] = array('name' => "cls", 'hidden' => true);
				}
			}

			$rows = $result[$lnr];
		}

		$this->jsonoutGrid($colModel, $rows);
	}

	function createLeagueTable($league, $trid, $rnd, $leaguenr)
	{
		$start = $this->trrow['s'][$rnd];
		$end = $this->trrow['e'][$rnd];
		$member = $this->member[$rnd];

		$cls = array();
		$tnid = $this->user['tnid'];
		$cls[$tnid] = 'rowUser';

		$sql = sprintf(
			"SELECT * FROM %s sp WHERE sp.trid=%d AND Liga=%d AND sptag BETWEEN %d AND %d",
			$this->TABLE['ligaergebnis'],
			$trid,
			$leaguenr,
			$start,
			$end
		);
		$data = $this->db->getData($sql);

		$_sp = array();
		foreach ($data as $row) {
			$t1 = $row['tnid1'];
			$t2 = $row['tnid2'];
			$res = preg_split('/:/', $row['Ergebnis']);
			if (!isset($_sp[$t1])) $_sp[$t1] = array('Matches'=>0,'Win'=>0,'Draw'=>0,'Loss'=>0,'gf'=>0,'ga'=>0);
			if (!isset($_sp[$t2])) $_sp[$t2] = array('Matches'=>0,'Win'=>0,'Draw'=>0,'Loss'=>0,'gf'=>0,'ga'=>0);
			if ($res[0] <> '-') {
				$_sp[$t1]['Matches']++;
				$_sp[$t2]['Matches']++; {
					$_sp[$t1]['gf'] += $res[0];
					$_sp[$t1]['ga'] += $res[1];
				} {
					$_sp[$t2]['gf'] += $res[1];
					$_sp[$t2]['ga'] += $res[0];
				}

				if ($res[0] > $res[1]) {
					$_sp[$t1]['Win']++;
					$_sp[$t2]['Loss']++;
				} else
						if ($res[0] < $res[1]) {
					$_sp[$t1]['Loss']++;
					$_sp[$t2]['Win']++;
				} else {
					$_sp[$t1]['Draw']++;
					$_sp[$t2]['Draw']++;
				}
			} // if
		} // while

		if (isset($_sp)) {
			unset($_sort);
			foreach ($_sp as $idx => $s) {
				//$_sp[$idx][Name]  = $_spname[$idx];
				$_sp[$idx]['tnid'] = $idx;
				$_sp[$idx]['Pts']   = 3 * $s['Win'] + $s['Draw'];
				$_sp[$idx]['Diff']  = $s['gf'] - $s['ga'];
				$_sp[$idx]['Goals']  = $s['gf'] . ':' . $s['ga'];

				$_sort['idx'][$idx]  = $idx;
				$_sort['Pts'][$idx]  = $_sp[$idx]['Pts'];
				$_sort['Diff'][$idx] = $_sp[$idx]['Diff'];
				$_sort['Tore'][$idx] = $_sp[$idx]['Tore'];
			} // foreach

			array_multisort(
				$_sort['Pts'],
				SORT_DESC,
				SORT_NUMERIC,
				$_sort['Diff'],
				SORT_DESC,
				SORT_NUMERIC,
				$_sort['Tore'],
				SORT_DESC,
				SORT_STRING,
				$_sort['idx']
			);
		} // if

		unset($data);
		if (isset($_sort['idx'])) {
			$idx = 0;
			foreach ($_sort['idx'] as $i) {
				$s = $_sp[$i];
				//$s[Platz] = $_nr++;
				$m = $member[$s['tnid']];

				$data[$idx] = array(
					'Pos' => $idx + 1,
					'Name' => $m['name'],
					'Pts' => $s['Pts'],
					'Diff' => $s['Diff'],
					'Goals' => $s['Goals'],
					'Matches' => $s['Matches'],
					'Win' => $s['Win'],
					'Draw' => $s['Draw'],
					'Loss' => $s['Loss'],
					'tnid' => $s['tnid'],
					'cls' => isset($cls[$s['tnid']]) ? $cls[$s['tnid']] : ''
				);
				$idx++;
			} // foreach
		}
		return $data;
	}

	function createSimpleTable($league, $trid, $rnd)
	{
		$start = $this->trrow['s'][$rnd];
		$end = $this->trrow['e'][$rnd];
		$member = $this->member[$rnd];

		$cls = array();
		$tnid = $this->user['tnid'];
		$cls[$tnid] = 'rowUser';

		$pts = array();
		foreach ($league as $l) $pts[$l['tnid']] = 0;

		for ($i = $start; $i <= $end; $i++) {
			$tips[$i] = $this->matchdaySummary($trid, $i);

			foreach ($league as $l) {
				$pts[$l['tnid']] += isset($tips[$i][$l['tnid']]['Points']) ? $tips[$i][$l['tnid']]['Points'] : 0;
			}
		}

		arsort($pts);

		unset($data);
		$idx = 0;
		foreach ($pts as $tnid => $p) {
			$m = $member[$tnid];
			$data[$idx] = array(
				'Pos' => $idx + 1,
				'Name' => $m['name'],
				'Pts' => $p,
				'tnid' => $tnid,
				'cls' => isset($cls[$m['tnid']]) ? $cls[$m['tnid']] : ''
			);
			$idx++;
		}

		return ($data);
	}

	function createLeagueTableComplete($leaguenr)
	{
		$member = $this->member[-1];
		$cls = array();
		$tnid = $this->user['tnid'];
		$cls[$tnid] = 'rowUser';

		$sql = sprintf("SELECT * FROM %s sp WHERE Liga=%d AND trid IN (SELECT trid FROM %s WHERE Aktiv='J')", $this->TABLE['ligaergebnis'], $leaguenr, $this->TABLE['tipprunde']);
		$data = $this->db->getData($sql);

		$_sp = array();
		foreach ($data as $row) {
			$t1 = $row['tnid1'];
			$t2 = $row['tnid2'];
			$res = preg_split('/:/', $row['Ergebnis']);
			if (!isset($_sp[$t1])) $_sp[$t1] = array('Matches'=>0,'Win'=>0,'Draw'=>0,'Loss'=>0,'gf'=>0,'ga'=>0);
			if (!isset($_sp[$t2])) $_sp[$t2] = array('Matches'=>0,'Win'=>0,'Draw'=>0,'Loss'=>0,'gf'=>0,'ga'=>0);
			if ($res[0] <> '-') {
				$_sp[$t1]['Matches']++;
				$_sp[$t2]['Matches']++; {
					$_sp[$t1]['gf'] += $res[0];
					$_sp[$t1]['ga'] += $res[1];
				} {
					$_sp[$t2]['gf'] += $res[1];
					$_sp[$t2]['ga'] += $res[0];
				}

				if ($res[0] > $res[1]) {
					$_sp[$t1]['Win']++;
					$_sp[$t2]['Loss']++;
				} else
						if ($res[0] < $res[1]) {
					$_sp[$t1]['Loss']++;
					$_sp[$t2]['Win']++;
				} else {
					$_sp[$t1]['Draw']++;
					$_sp[$t2]['Draw']++;
				}
			} // if
		} // while

		if (isset($_sp)) {
			unset($_sort);
			foreach ($_sp as $idx => $s) {
				//$_sp[$idx][Name]  = $_spname[$idx];
				$_sp[$idx]['tnid'] = $idx;
				$_sp[$idx]['Pts']   = 3 * $s['Win'] + $s['Draw'];
				$_sp[$idx]['Diff']  = $s['gf'] - $s['ga'];
				$_sp[$idx]['Goals']  = $s['gf'] . ':' . $s['ga'];

				$_sort['idx'][$idx]  = $idx;
				$_sort['Pts'][$idx]  = $_sp[$idx]['Pts'];
				$_sort['Diff'][$idx] = $_sp[$idx]['Diff'];
				$_sort['Tore'][$idx] = $_sp[$idx]['Tore'];
			} // foreach

			array_multisort(
				$_sort['Pts'],
				SORT_DESC,
				SORT_NUMERIC,
				$_sort['Diff'],
				SORT_DESC,
				SORT_NUMERIC,
				$_sort['Tore'],
				SORT_DESC,
				SORT_STRING,
				$_sort['idx']
			);
		} // if

		unset($data);
		if (isset($_sort['idx'])) {
			$idx = 0;
			foreach ($_sort['idx'] as $i) {
				$s = $_sp[$i];
				//$s[Platz] = $_nr++;
				$m = $member[$s['tnid']];

				$data[$idx] = array(
					'Pos' => $idx + 1,
					'Name' => $m['name'],
					'Pts' => $s['Pts'],
					'Diff' => $s['Diff'],
					'Goals' => $s['Goals'],
					'Matches' => $s['Matches'],
					'Win' => $s['Win'],
					'Draw' => $s['Draw'],
					'Loss' => $s['Loss'],
					'tnid' => $s['tnid'],
					'cls' => isset($cls[$s['tnid']]) ? $cls[$s['tnid']] : ''
				);
				$idx++;
			} // foreach
		}
		return $data;
	}

	/*****************************************************************************************************************************
	 * Prämien
	 *****************************************************************************************************************************/

	/**/	function GetPraemienUebersichtData()
	{
		$colModel = array();

		if (isset($_POST['trid']) && isset($_POST['md'])) {
			$trid = $_POST['trid'];
			$md = $_POST['md'];
			$teams = $this->teams;
			$member = $this->member;
			$rnd = $this->trrow['STRND'][$md];

			$start = $this->trrow['s'][$rnd];
			$end = $this->trrow['e'][$rnd];

			$bon = $this->bonus[$rnd];

			// Datenmodell
			$colModel[] = array('label' => "Name", 'width' => 200, 'name' => "Name", 'align' => 'left', 'classes' => 'Name');
			$colModel[] = array('label' => "Spieltage", 'width' => 100, 'name' => "Matches", 'align' => 'right', 'formatter' => 'currency', 'sorttype' => 'currency', 'formatoptions' => array("defaultValue" => ""));
			$colModel[] = array('label' => "Gesamtwertung", 'width' => 100, 'name' => "Total", 'align' => 'right', 'formatter' => 'currency', 'sorttype' => 'currency', 'formatoptions' => array("defaultValue" => ""));
			$colModel[] = array('label' => "Ligawertung", 'width' => 100, 'name' => "League", 'align' => 'right', 'formatter' => 'currency', 'sorttype' => 'currency', 'formatoptions' => array("defaultValue" => ""));
			$colModel[] = array('label' => "Einsatz", 'width' => 100, 'name' => "Stake", 'align' => 'right', 'formatter' => 'currency', 'sorttype' => 'currency', 'formatoptions' => array("defaultValue" => ""));
			$colModel[] = array('label' => "Ligaeinsatz", 'width' => 100, 'name' => "StakeLeague", 'align' => 'right', 'formatter' => 'currency', 'sorttype' => 'currency', 'formatoptions' => array("defaultValue" => ""));
			$colModel[] = array('label' => "Summe", 'width' => 100, 'name' => "Sum", 'align' => 'right', 'formatter' => 'currency', 'sorttype' => 'currency', 'formatoptions' => array("defaultValue" => ""), 'classes' => 'Bonus');
			$colModel[] = array('name' => "id", 'key' => true, 'hidden' => true);
			$colModel[] = array('name' => "cls", 'hidden' => true);

			// data

			unset($cls);
			$tnid = $this->user['tnid'];
			$cls[$tnid] = 'rowUser';

			// matches
			for ($i = $start; $i <= $end; $i++) {
				$tips[$i] = $this->matchdaySummary($trid, $i);
				//print_r($tips[$i]);
				//unset($pts);
				foreach ($member[$rnd] as $m) {
					if (isset($tips[$i][$m['tnid']]['Points'])) {
						$pts[$i][$m['tnid']] = $tips[$i][$m['tnid']]['Points'];
						$pts[0][$m['tnid']] += $pts[$i][$m['tnid']]; //$tips[$i][$m['tnid']]['Points'];
					}
				}
				//print_r($pts[$i]);
				$b[$i] = $this->getBonus($rnd, '-1', $pts[$i]);
				//print_r($b[$i]);

				if (is_array($b[$i]))
					foreach ($b[$i] as $tnid => $bo) {
						$matches[$tnid] += $bo;
					}
			}

			// total
			$total = $this->getBonus($rnd, 0, $pts[0]);

			// Ligawertungen
			foreach ($member[$rnd] as $m) {
				$leagues[$m['Liga']][] = array(
					'tnid' => $m['tnid'],
					'LNr' => $m['LNr'],
				);
			}

			if (is_array($leagues)) {
				foreach ($leagues as $nr => $l) {
					unset($b);
					if ($l[0]['LNr'] > 0) {
						$result[$nr] = $this->createLeagueTable($l, $trid, $rnd, $nr);
						if (is_array($result[$nr])) {
							unset($pts);
							foreach ($result[$nr] as $r) $pts[$r['tnid']] = 100 * $r['Pts'] + $r['Diff'];
							$b = $this->getBonus($rnd, $nr, $pts);
						}
					} else {
						$result[$nr] = $this->createSimpleTable($l, $trid, $rnd);
						if (is_array($result[$nr])) {
							unset($pts);
							foreach ($result[$nr] as $r) $pts[$r['tnid']] = $r['Pts'];
							$b = $this->getBonus($rnd, $nr, $pts);
						}
					}

					if (is_array($b))
						foreach ($b as $tnid => $bo)	$league[$tnid] += $bo;
				}
			}

			foreach ($member[$rnd] as $m) {
				// stakes
				$stakesLeague[$m['tnid']] = $bon[$m['Liga']][0];

				$bonus[] = array(
					'Name'  => $m['name'],
					'id' => $m['tnid'],
					'cls' => isset($cls[$m['tnid']]) ? $cls[$m['tnid']] : '',
					'Matches' => isset($matches[$m['tnid']]) ? sprintf("%3.2f", $matches[$m['tnid']]) : '',
					'Total' => isset($total[$m['tnid']]) ? sprintf("%3.2f", $total[$m['tnid']]) : '',
					'League' => isset($league[$m['tnid']]) ? sprintf("%3.2f", $league[$m['tnid']]) : '',
					'Stake' => sprintf("-%3.2f", $bon[0][0]),
					'StakeLeague' => isset($stakesLeague[$m['tnid']]) ? sprintf("-%3.2f", $stakesLeague[$m['tnid']]) : '',
					'Sum' => sprintf("%3.2f", $matches[$m['tnid']] + $total[$m['tnid']] + $league[$m['tnid']]
						- $bon[0][0] - $stakesLeague[$m['tnid']])
				);
			}
		}

		$this->jsonoutGrid($colModel, $bonus, 'Sum', 'desc');
	}

	function GetPraemienInfoData()
	{
		$colModel = array();

		if (isset($_POST['trid']) && isset($_POST['md'])) {
			$rnd = $_POST['rnd'];
			if (!isset($rnd)) $rnd = 1;

			$lcnt = $this->trrow['Ligen'];

			$edit = ($this->user['userlevel'] == 100) && ($_POST['edit']);

			// Datenmodell
			$colModel[] = array('label' => " ", 'width' => 70, 'name' => "Desc", 'align' => 'left', 'sortable' => false);
			$colModel[] = array('name' => "idx", 'key' => true, 'hidden' => true);
			$colModel[] = array(
				'label' => "Tageswertung", 'width' => 110, 'name' => "Match", 'align' => 'right', 'formatter' => 'currency',
				'sortable' => false, 'formatoptions' => array("defaultValue" => ""),
				'editable' => $edit, 'editoptions' => array('size' => 6, 'maxlength' => 6, 'class' => 'gradient')
			);
			$colModel[] = array(
				'label' => "Gesamtwertung", 'width' => 120, 'name' => "Total", 'align' => 'right', 'formatter' => 'currency',
				'sortable' => false, 'formatoptions' => array("defaultValue" => "", 'decimalSeparator' => ','),
				'editoptions' => array('delimiter' => ','),
				'editable' => $edit, 'editoptions' => array('size' => 6, 'maxlength' => 6, 'class' => 'gradient')
			);

			for ($i = 1; $i <= $lcnt; $i++)
				$colModel[] = array(
					'label' => "Liga " . $i, 'width' => 80, 'name' => "L" . $i, 'align' => 'right', 'formatter' => 'currency',
					'sortable' => false, 'formatoptions' => array("defaultValue" => ""),
					'editable' => $edit, 'editoptions' => array('size' => 6, 'maxlength' => 6, 'class' => 'gradient')
				);

			// Daten
			$bon = $this->bonus[$rnd];

			$b = array(
				'idx' => 0,
				'Desc' => 'Einsatz',
				'Match' => $this->defValue($bon[-1][0]),
				'Total' => $this->defValue($bon[0][0]),
				'editable' => $edit
			);
			for ($i = 1; $i <= $lcnt; $i++) $b['L' . $i] = $this->defValue($bon[$i][0]);
			$bonus[] = $b;

			for ($i = 1; $i <= 20; $i++) {
				$b = array(
					'idx' => $i,
					'Desc' => "Platz $i",
					'Match' => $this->defValue($bon[-1][$i]),
					'Total' => $this->defValue($bon[0][$i]),
					'editable' => $edit
				);
				for ($j = 1; $j <= $lcnt; $j++) $b['L' . $j] = $this->defValue($bon[$j][$i]);
				$bonus[] = $b;
			}

			$ud = $this->rnds[$rnd];
		}

		$this->jsonoutGrid($colModel, $bonus, 'Sum', 'desc', $ud);
	}

	function SavePraemien()
	{
		if ($this->user['userlevel'] == 100) {
			if (isset($_POST['data']) && isset($_POST['trid'])) {
				$data = $_POST['data'];
				$trid = $_POST['trid'];
				$rnd = $_POST['rnd'];

				unset($result);
				foreach ($data as $d) {
					$result[] = array(
						'trid' => $trid,
						'LRnd' => $rnd,
						'Liga' => -1,
						'Platz' => $d['idx'],
						'betrag' => $d['Match']
					);
					$result[] = array(
						'trid' => $trid,
						'LRnd' => $rnd,
						'Liga' => 0,
						'Platz' => $d['idx'],
						'betrag' => $d['Total']
					);
					$result[] = array(
						'trid' => $trid,
						'LRnd' => $rnd,
						'Liga' => 1,
						'Platz' => $d['idx'],
						'betrag' => $d['L1']
					);
					$result[] = array(
						'trid' => $trid,
						'LRnd' => $rnd,
						'Liga' => 2,
						'Platz' => $d['idx'],
						'betrag' => $d['L2']
					);
				}

				foreach ($result as $r) {
					if ($r['betrag'] > 0)
						$sql = sprintf(
							"replace into %s (trid,LRnd,Liga,Platz,betrag) values (%d,%d,%d,%d,%01.2f)",
							$this->TABLE['praemien'],
							$r['trid'],
							$r['LRnd'],
							$r['Liga'],
							$r['Platz'],
							str_replace(',', '.', $r['betrag'])
						);
					else
						$sql = sprintf(
							"delete from %s where trid=%d AND LRnd=%d AND Liga=%d AND Platz=%d",
							$this->TABLE['praemien'],
							$r['trid'],
							$r['LRnd'],
							$r['Liga'],
							$r['Platz']
						);

					$this->db->Query($sql);
				}

				// Prämien neu laden
				unset($bonus);
				$sql = sprintf("SELECT * FROM %s WHERE trid=%d", $this->TABLE['praemien'], $trid);
				$data = $this->db->getData($sql);
				foreach ($data as $row) {
					$bonus[$row['LRnd']][$row['Liga']][$row['platz']] = $row['betrag'];
				} // while
				$this->bonus = $bonus;

				$this->jsonResult2(true, Status::OK, 'Daten gespeichert!');
				return;
			}
		}

		$this->jsonResult2(false, Status::Error, 'Keine Berechtigung!');
	}

	/*****************************************************************************************************************************
	 * Spielplan / Tabelle
	 *****************************************************************************************************************************/

	function GetSpielplanData()
	{
		$colModel = array();

		if (isset($_POST['trid']) && isset($_POST['md'])) {
			$edit = ($this->user['userlevel'] == 100) && ($_POST['edit']);

			// Datenmodell
			$colModel[] = array('label' => " ", 'width' => 20, 'name' => "HLogo", 'formatter' => 'logo');
			$colModel[] = array('label' => "Heimteam", 'width' => 200, 'name' => "HTeam", 'formatter' => 'html', 'classes' => 'Team');
			$colModel[] = array('label' => " ", 'width' => 20, 'name' => "ALogo", 'formatter' => 'logo');
			$colModel[] = array('label' => "Auswärtsteam", 'width' => 200, 'index' => "ATeam", 'name' => "ATeam", 'formatter' => 'html', 'classes' => 'Team');
			$colModel[] = array(
				'label' => "Datum", 'width' => $edit ? 120 : 90, 'name' => "Date", 'align' => 'right', 'formatter' => 'date',
				'editable' => $edit, 'editoptions' => array('size' => 10, 'maxlength' => 10, 'class' => 'gradient'), 'classes' => 'Date'
			);
			$colModel[] = array(
				'label' => "Zeit", 'width' => 60, 'name' => "Time", 'align' => 'center', 'formatter' => 'date',
				'formatoptions' => array('srcformat' => 'H:i:s', 'newformat' => 'H:i'),
				'editable' => $edit, 'editoptions' => array('size' => 5, 'maxlength' => 5, 'class' => 'gradient'), 'classes' => 'Time'
			);
			$colModel[] = array(
				'label' => "Ergebnis", 'width' => 90, 'name' => "Result", 'align' => 'center', 'classes' => "Result",
				'editable' => $edit, 'editoptions' => array('size' => 5, 'maxlength' => 5, 'class' => 'gradient')
			);
			$colModel[] = array('name' => "sid", 'hidden' => true, 'key' => true);

			// Daten

			$sql = sprintf(
				"SELECT *, DATE_FORMAT(Datum, '%%d.%%m.%%Y') AS DatumF FROM %s WHERE trid=%d AND sptag=%d ORDER BY Datum, Uhrzeit",
				$this->TABLE['spielplan'],
				$_POST['trid'],
				$_POST['md']
			);
			$data = $this->db->getData($sql);
			unset($schedule);
			$teams = $this->teams;
			foreach ($data as $row) {
				$schedule[] = array(
					'sid' => $row['sid'],
					'HTeam' => $teams[$row['tid1']]['Name'],
					'ATeam' => $teams[$row['tid2']]['Name'],
					'HLogo' => $row['tid1'],
					'ALogo' => $row['tid2'],
					'Date' => $row['Datum'],
					'Time' => $row['Uhrzeit'],
					'Result' => $row['Ergebnis'],
					'editable' => $edit
				);
			}
		}

		$this->jsonoutGrid($colModel, $schedule);
	}

	function GetTabelleData()
	{
		$colModel = array();

		if (isset($_POST['trid']) && isset($_POST['md'])) {
			// Datenmodell
			$colModel[] = array('label' => "Platz", 'width' => 40, 'name' => "Pos", 'align' => 'right', 'sorttype' => 'int', 'classes' => 'Pos');
			$colModel[] = array('label' => " ", 'width' => 20, 'name' => "Logo", 'formatter' => 'logo');
			$colModel[] = array('label' => "Mannschaft", 'width' => 200, 'name' => "Team");
			$colModel[] = array('label' => "Sp.", 'width' => 30, 'name' => "Matches", 'align' => 'right', 'sorttype' => 'int');
			$colModel[] = array('label' => "S", 'width' => 30, 'name' => "Win", 'align' => 'right', 'sorttype' => 'int');
			$colModel[] = array('label' => "U", 'width' => 30, 'name' => "Draw", 'align' => 'right', 'sorttype' => 'int');
			$colModel[] = array('label' => "N", 'width' => 30, 'name' => "Loss", 'align' => 'right', 'sorttype' => 'int');
			$colModel[] = array('label' => "Tore", 'width' => 60, 'name' => "Goals", 'align' => 'right');
			$colModel[] = array('label' => "Diff", 'width' => 40, 'name' => "Diff", 'align' => 'right', 'sorttype' => 'int');
			$colModel[] = array('label' => "Pkt", 'width' => 40, 'name' => "Pts", 'align' => 'right', 'sorttype' => 'int', 'classes' => 'Pts');

			// Daten
			$trid = $_POST['trid'];
			$md = $_POST['md'];
			$mode = $_POST['mode'];
			if (!isset($mode)) $mode = 't';
			$teams = $this->teams;

			$sql = sprintf("SELECT * FROM %s WHERE trid=%d AND sptag<=%d", $this->TABLE['spielplan'], $trid, $md);
			$data = $this->db->getData($sql);
			foreach ($data as $row) {
				$schedule[$row['sptag']][$row['sid']] = $row;
			}

			$data = array();
			for ($m = 1; $m <= $md; $m++) {
				if (is_array($schedule[$m]))
					foreach ($schedule[$m] as $row) {
						$t1 = $row['tid1'];
						$t2 = $row['tid2'];
						$result = preg_split('/:/', $row['Ergebnis']);

						if ($result[0] <> '-') {
							if (($mode == 't') || ($mode == 'h')) $data[$t1]['Matches']++;
							if (($mode == 't') || ($mode == 'a')) $data[$t2]['Matches']++;
							if (($mode == 't') || ($mode == 'h')) {
								$data[$t1]['gf'] += $result[0];
								$data[$t1]['ga'] += $result[1];
							}
							if (($mode == 't') || ($mode == 'a')) {
								$data[$t2]['gf'] += $result[1];
								$data[$t2]['ga'] += $result[0];
							}

							if ($result[0] > $result[1]) {
								if (($mode == 't') || ($mode == 'h')) $data[$t1]['Win']++;
								if (($mode == 't') || ($mode == 'a')) $data[$t2]['Loss']++;
							} else
									if ($result[0] < $result[1]) {
								if (($mode == 't') || ($mode == 'h')) $data[$t1]['Loss']++;
								if (($mode == 't') || ($mode == 'a')) $data[$t2]['Win']++;
							} else {
								if (($mode == 't') || ($mode == 'h')) $data[$t1]['Draw']++;
								if (($mode == 't') || ($mode == 'a')) $data[$t2]['Draw']++;
							}
						} // if
					} // foreach
			} // for

			if (is_array($data)) {
				unset($_sort);
				foreach ($data as $idx => $s) {
					$data[$idx]['Pts']   = 3 * $s['Win'] + $s['Draw'];
					$data[$idx]['Diff']  = $s['gf'] - $s['ga'];
					$data[$idx]['Goals'] = $s['gf'] . ':' . $s['ga'];
					$data[$idx]['Team']  = $teams[$idx]['Name'];
					$data[$idx]['Logo']  = $teams[$idx]['tid'];

					$_sort['idx'][$idx]  = $idx;
					$_sort['Pts'][$idx]  = $data[$idx]['Pts'];
					$_sort['Diff'][$idx] = $data[$idx]['Diff'];
					$_sort['Goals'][$idx] = $data[$idx]['Goals'];
				} // foreach

				if (is_array($_sort['Pts']))
					array_multisort(
						$_sort['Pts'],
						SORT_DESC,
						SORT_NUMERIC,
						$_sort['Diff'],
						SORT_DESC,
						SORT_NUMERIC,
						$_sort['Goals'],
						SORT_DESC,
						SORT_STRING,
						$_sort['idx']
					);
			} // if

			if (isset($_sort['idx'])) {
				$_nr = 0;
				foreach ($_sort['idx'] as $idx) {
					$table[$_nr] = $data[$idx];
					$table[$_nr]['Pos'] = $_nr + 1;
					$_nr++;
				} // foreach
			} // if

		}

		$this->jsonoutGrid($colModel, $table);
	}

	/*****************************************************************************************************************************
	 * Statistiken
	 *****************************************************************************************************************************/

	function GetStatTippanzahlData()
	{
		$colModel[] = array('label' => "Tipp", 'width' => 120, 'name' => "Tipp");
		$colModel[] = array('label' => "Anzahl", 'width' => 120, 'name' => "Anzahl", 'align' => 'right', 'sorttype' => 'int');
		$colModel[] = array(
			'label' => "%", 'width' => 120, 'name' => "Prozent", 'align' => 'right', 'sorttype' => 'float',
			'formatter' => 'number', 'formatoptions' => array('decimalSeparator' => ',')
		);

		$trid = $_POST['trid_s'];
		if (!isset($trid)) $trid = $_POST['trid'];

		if (isset($trid)) {
			$json = array();

			$sql = sprintf(
				"SELECT t.Tipp FROM %s t INNER JOIN %s s ON t.sid = s.sid where s.trid=%d AND s.Datum<='%s'",
				$this->TABLE['tipps'],
				$this->TABLE['spielplan'],
				$trid,
				date("Y-m-d")
			);

			$data = $this->db->getData($sql);
			$anz = count($data);
			//$anz = $result->num_rows;

			unset($tipps);
			foreach ($data as $row) {
				$tipps[$row['Tipp']]++;
			}

			unset($data);

			if (is_array($tipps)) {
				arsort($tipps);
				//print_r($tipps);

				$idx = 0;
				foreach ($tipps as $t => $a) {
					$data[$idx] = array(
						'Tipp' => $t,
						'Anzahl' => $a,
						'Prozent' => sprintf("%.2f", 100 * $a / $anz)
					);

					$idx++;
				}
			}
		}

		$this->jsonoutGrid($colModel, $data);
	}

	function GetStatPlace()
	{
		$out = '';

		if (isset($_POST['trid']) && isset($_POST['md'])) {
			$trid = $_POST['trid'];
			$md = $_POST['md'];

			$member = $this->member;
			$rnd = $this->trrow['STRND'][$md];

			$start = $this->trrow['s'][$rnd];
			$end = $this->trrow['e'][$rnd];

			// Data
			unset($data);

			$tnid = $this->user['tnid'];

			unset($pts);

			for ($i = $start; $i <= $end; $i++) {
				$tips[$i] = $this->matchdaySummary($trid, $i);
				//echo"<b>S$i</b><hr>";
				//print_r($tips[$i]);
				$calc = true;
				if (is_array($tips[$i]))
					foreach ($tips[$i] as $x => $y) {
						//echo "$x $y[DL]<br>";
						//print_r($y);echo"<br>";
						if (isset($y[DL])) $calc = false;
					}

				if ($calc) {
					foreach ($member[$rnd] as $m) {
						//echo $$tips[$i][$m['tnid']]['DL'];
						//if($tips[$i][$m['tnid']]['DL'] <> '1') //echo "X";
						$pt1[$i][$m['tnid']] = $tips[$i][$m['tnid']]['Points'];
						$pts[$i][$m['tnid']] = $pt1[$i][$m['tnid']] + $pts[$i - 1][$m['tnid']];
					}
					if (is_array($pts[$i])) arsort($pts[$i]);
				}
			}
			//echo"<pre>";
			//print_r($pts);
			//exit();
			unset($place);
			foreach ($pts as $s => $data) {
				//echo $s;
				$pl = 0;
				foreach ($data as $m => $_pt) {
					$pl++;
					//if ($m == $tnid)
					$place[$m][$s] = $pl;
				}
			}
			//print_r($place);

			$out = "<chart caption='eigene Tabellenplatzenwicklung'
			subcaption='(Gesamtstand)'
			PYAxisName='Punkte' SYAxisName='Platz' xAxisName='Spieltag'
			SYAxisMinValue='-" . count($member[$rnd]) . "' SYAxisMaxValue='-1'
			formatNumberScale='0'>";
			$out .= "<categories>";
			foreach ($place[$tnid] as $s => $pl)
				$out .= sprintf("<category label='%d' />", $s);
			$out .= "</categories>";

			$out .= "<dataset seriesName='Punkte'>";
			foreach ($place[$tnid] as $s => $pl)
				$out .= sprintf("<set value='%d' />", isset($pt1[$s][$tnid]) ? $pt1[$s][$tnid] : 0);
			$out .= "</dataset>";


			$out .= "<dataset seriesName='Platz' parentYAxis='S'>";
			foreach ($place[$tnid] as $s => $pl)
				$out .= sprintf("<set value='-%d' />", $pl);
			$out .= "</dataset>";

			$out .= "<styles>
				<definition>
					<style name='CanvasAnim' type='animation' param='_xScale' start='0' duration='1' />
				</definition>

				<application>
					<apply toObject='Canvas' styles='CanvasAnim' />
				</application>
			</styles>";
			$out .= "</chart>";
		}

		$this->jsonout(array('ok' => true, 'chart' => $out));
	}

	function GetStatPlaceLeague()
	{
		$out = '';

		if (isset($_POST['trid']) && isset($_POST['md'])) {

			$trid = $_POST['trid'];
			$md = $_POST['md'];

			$member = $this->member;
			$rnd = $this->trrow['STRND'][$md];

			$start = $this->trrow['s'][$rnd];
			$end = $this->trrow['e'][$rnd];

			$tnid = $this->user['tnid'];


			if (isset($member[$rnd][$tnid]['Liga']) && $member[$rnd][$tnid]['Liga'] == '1') {
				$sql = sprintf("SELECT * FROM %s sp WHERE sp.trid=%d AND Liga=1 AND sptag BETWEEN %d AND %d", $this->TABLE['ligaergebnis'], $trid, $start, $end);
				$data = $this->db->getData($sql);

				unset($_sp);
				unset($_diff);
				foreach ($data as $row) {
					$t1 = $row['tnid1'];
					$t2 = $row['tnid2'];
					$res = preg_split('/:/', $row['Ergebnis']);
					$sp = $row['sptag'];
					if ($res[0] <> '-') { {
							$_sp[$sp][$t1]['gf'] = (isset($_sp[$sp - 1][$t1]['gf']) ? $_sp[$sp - 1][$t1]['gf'] : 0) + $res[0];
							$_sp[$sp][$t1]['ga'] = (isset($_sp[$sp - 1][$t1]['ga']) ? $_sp[$sp - 1][$t1]['ga'] : 0) + $res[1];
							$_diff[$sp][$t1] = $res[0] - $res[1];
						} {
							$_sp[$sp][$t2]['gf'] = (isset($_sp[$sp - 1][$t2]['gf']) ? $_sp[$sp - 1][$t2]['gf'] : 0) + $res[1];
							$_sp[$sp][$t2]['ga'] = (isset($_sp[$sp - 1][$t2]['ga']) ? $_sp[$sp - 1][$t2]['ga'] : 0) + $res[0];
							$_diff[$sp][$t2] = $res[1] - $res[0];
						}

						if ($res[0] > $res[1]) {
							$_sp[$sp][$t1]['Pts'] = (isset($_sp[$sp - 1][$t1]['Pts']) ? $_sp[$sp - 1][$t1]['Pts'] : 0) + 3;
							$_sp[$sp][$t2]['Pts'] = (isset($_sp[$sp - 1][$t2]['Pts']) ? $_sp[$sp - 1][$t2]['Pts'] : 0) + 0;
						} else
								if ($res[0] < $res[1]) {
							$_sp[$sp][$t1]['Pts'] = (isset($_sp[$sp - 1][$t1]['Pts']) ? $_sp[$sp - 1][$t1]['Pts'] : 0) + 0;
							$_sp[$sp][$t2]['Pts'] = (isset($_sp[$sp - 1][$t2]['Pts']) ? $_sp[$sp - 1][$t2]['Pts'] : 0) + 3;
						} else {
							$_sp[$sp][$t1]['Pts'] = (isset($_sp[$sp - 1][$t1]['Pts']) ? $_sp[$sp - 1][$t1]['Pts'] : 0) + 1;
							$_sp[$sp][$t2]['Pts'] = (isset($_sp[$sp - 1][$t2]['Pts']) ? $_sp[$sp - 1][$t2]['Pts'] : 0) + 1;
						}
						$_sp[$sp][$t1]['Diff']  = $_sp[$sp][$t1]['gf'] - $_sp[$sp][$t1]['ga'];
						$_sp[$sp][$t2]['Diff']  = $_sp[$sp][$t2]['gf'] - $_sp[$sp][$t2]['ga'];
					} // if
				} // while

				unset($_place);
				if (is_array($_sp))
					foreach ($_sp as $s => $dat) {
						if (isset($dat)) {
							unset($_sort);
							foreach ($dat as $idx => $x) {
								$_sort['idx'][$idx]  = $idx;
								$_sort['Pts'][$idx]  = $dat[$idx]['Pts'];
								$_sort['Diff'][$idx] = $dat[$idx]['Diff'];
								$_sort['gf'][$idx]   = $dat[$idx]['gf'];
							} // foreach

							array_multisort(
								$_sort['Pts'],
								SORT_DESC,
								SORT_NUMERIC,
								$_sort['Diff'],
								SORT_DESC,
								SORT_NUMERIC,
								$_sort['gf'],
								SORT_DESC,
								SORT_NUMERIC,
								$_sort['idx']
							);

							foreach ($_sort['idx'] as $pl => $id) {
								if ($id == $tnid) $_place[$s] = $pl + 1;
							}
						} // if
					}

				$out = "<chart caption='eigene Tabellenplatzenwicklung'
				subcaption='(Liga 1)'
				PYAxisName='Tordiff.' SYAxisName='Platz' xAxisName='Spieltag'
				SYAxisMinValue='-18' SYAxisMaxValue='-1'
				formatNumberScale='0'>";
				$out .= "<categories>";

				if (is_array($_place))
					foreach ($_place as $s => $pl) $out .= sprintf("<category label='%d' />", $s);
				$out .= "</categories>";

				$out .= "<dataset seriesName='Tordiff.'>";
				if (is_array($_place))
					foreach ($_place as $s => $pl) $out .= sprintf("<set value='%d' />", $_diff[$s][$tnid]);
				$out .= "</dataset>";

				$out .= "<dataset seriesName='Platz' parentYAxis='S'>";
				if (is_array($_place))
					foreach ($_place as $s => $pl) $out .= sprintf("<set value='-%d' />", $pl);
				$out .= "</dataset>";

				$out .= "<styles>
				<definition>
					<style name='CanvasAnim' type='animation' param='_xScale' start='0' duration='1' />
				</definition>

				<application>
					<apply toObject='Canvas' styles='CanvasAnim' />
				</application>
			</styles>";

				$out .= "</chart>";
				$this->jsonout(array('ok' => true, 'chart' => $out));
				return;
			}

			$this->jsonout(array('ok' => true, 'chart' => ''));
			return;
		}
		$this->jsonout(array('ok' => true, 'chart' => ''));
	}

	function GetLigaTabelleGesamtData()
	{
		$lnr = $_POST['lnr'];

		$colModel[] = array('label' => "Platz", 'width' => 60, 'name' => "Pos", 'align' => 'right', 'sorttype' => 'int', 'classes' => 'Pos');
		$colModel[] = array('label' => "Name", 'width' => 200, 'name' => "Name", 'classes' => 'Name');
		$colModel[] = array('label' => "Pkt", 'width' => 40, 'name' => "Pts", 'align' => 'right', 'sorttype' => 'int', 'classes' => 'Pts');

		$colModel[] = array('label' => "Tore", 'width' => 100, 'name' => "Goals", 'align' => 'right');
		$colModel[] = array('label' => "Diff", 'width' => 60, 'name' => "Diff", 'align' => 'right', 'sorttype' => 'int');
		$colModel[] = array('label' => "Sp.", 'width' => 50, 'name' => "Matches", 'align' => 'right', 'sorttype' => 'int');
		$colModel[] = array('label' => "S", 'width' => 40, 'name' => "Win", 'align' => 'right', 'sorttype' => 'int');
		$colModel[] = array('label' => "U", 'width' => 40, 'name' => "Draw", 'align' => 'right', 'sorttype' => 'int');
		$colModel[] = array('label' => "N", 'width' => 40, 'name' => "Loss", 'align' => 'right', 'sorttype' => 'int');

		$colModel[] = array('name' => "tnid", 'key' => true, 'hidden' => true);
		$colModel[] = array('name' => "cls", 'hidden' => true);

		$result[$lnr] = $this->createLeagueTableComplete($lnr);
		unset($league);
		if (is_array($result)) {
			$idx = 0;
			foreach ($result as $lnr => $data) {
				if (is_array($data))
					foreach ($data as $d) {
						$league[$idx] = $d;
						$league[$idx]['League'] = $lnr;
						$idx++;
					}
			}
		}

		$this->jsonoutGrid($colModel, $league);
	}

	function GetStatGesamtstandData()
	{
		//$colModel[] = array('label' => "Platz", 'width' => 60, 'name' => "Pos", 'align' => 'right', 'sorttype' => 'int');
		$colModel[] = array('label' => "Name", 'width' => 200, 'name' => "Name", 'classes' => 'Name');
		$colModel[] = array('label' => "Pkt", 'width' => 50, 'name' => "Pts", 'align' => 'right', 'sorttype' => 'int', 'classes' => 'Pts');

		$colModel[] = array('label' => "3er", 'width' => 60, 'name' => "3er", 'align' => 'right', 'sorttype' => 'int');
		$colModel[] = array('label' => "2er", 'width' => 60, 'name' => "2er", 'align' => 'right', 'sorttype' => 'int');
		$colModel[] = array('label' => "Runden", 'width' => 70, 'name' => "Runden", 'align' => 'right', 'sorttype' => 'int');
		$colModel[] = array(
			'label' => "Pkt/Runde", 'width' => 90, 'name' => "PPR", 'align' => 'right', 'sorttype' => 'float',
			'formatter' => 'number', 'formatoptions' => array('decimalSeparator' => ',')
		);

		$colModel[] = array('name' => "tnid", 'key' => true, 'hidden' => true);
		$colModel[] = array('name' => "cls", 'hidden' => true);


		unset($cls);
		$tnid = $this->user['tnid'];
		$cls[$tnid] = 'rowUser';

		$sql = sprintf("SELECT s.sid, s.Ergebnis, t.Tipp, t.tnid, s.trid FROM %s s INNER JOIN %s t ON s.sid = t.sid
							WHERE s.Datum < '%s' AND s.Ergebnis <> '-:-' AND s.trid IN (SELECT trid FROM %s WHERE Aktiv='J')
							ORDER BY t.tnid, s.sid", $this->TABLE['spielplan'], $this->TABLE['tipps'], date("Y-m-d"), $this->TABLE['tipprunde']);

		$data = $this->db->getData($sql);
		//echo $sql;
		unset($pts);
		unset($cnt);
		foreach ($data as $row) {
			//print_r($row);
			//echo "<br>".$row['Tipp'].'#'.$row['Ergebnis'].'#'.evaluateTip($row['Tipp'],$row['Ergebnis']);
			$e = $this->evaluateTip($row['Tipp'], $row['Ergebnis']);
			$pts[$row['tnid']][$e]++;
			$pts[$row['tnid']]['sum'] += $e;
			$cnt[$row['tnid']][$row['trid']]++;
		}

		$member = $this->member[-1];

		$sql = sprintf("SELECT trid, Runden FROM %s WHERE Aktiv='J'", $this->TABLE['tipprunde']);
		$data = $this->db->getData($sql);
		unset($sprnd);
		foreach ($data as $row) $sprnd[$row['trid']] = 306 / $row['Runden']; // 306 = (18/2)*(18-1)*2

		foreach ($cnt as $m => $x) {
			foreach ($x as $s => $c) {
				$cnt[$m][$s] /= $sprnd[$s];
				$cnt[$m][$s] = ceil($cnt[$m][$s]);
				$cnt[$m]['sum'] += $cnt[$m][$s];
			}
		}
		//echo"<pre>";
		//print_r($member);
		//print_r($cnt);
		//echo $userid;
		//exit();
		unset($data);
		$pos = 1;
		foreach ($pts as $m => $d) {
			$data[] = array(
				//'Pos' => $pos++,
				'tnid' => $m,
				'Name' => $member[$m]['name'],
				'Pts' => $pts[$m]['sum'],
				'Runden' => $cnt[$m]['sum'],
				'3er' => $pts[$m][3],
				'2er' => $pts[$m][2],
				'PPR' => sprintf("%.2f", $pts[$m]['sum'] / $cnt[$m]['sum']),
				'cls' => isset($cls[$m]) ? $cls[$m] : ''
			);
		}

		$this->jsonoutGrid($colModel, $data, 'Pts', 'desc');
	}

	function GetTippTabelleData()
	{
		$colModel = array();

		if (isset($_POST['trid']) && isset($_POST['md'])) {
			// Datenmodell
			$colModel[] = array('label' => "Platz", 'width' => 40, 'name' => "Pos", 'align' => 'right', 'sorttype' => 'int', 'classes' => 'Pos');
			$colModel[] = array('label' => " ", 'width' => 20, 'name' => "Logo", 'formatter' => 'logo');
			$colModel[] = array('label' => "Mannschaft", 'width' => 190, 'name' => "Team");
			$colModel[] = array('label' => "Sp.", 'width' => 30, 'name' => "Matches", 'align' => 'right', 'sorttype' => 'int');
			$colModel[] = array('label' => "S", 'width' => 30, 'name' => "Win", 'align' => 'right', 'sorttype' => 'int');
			$colModel[] = array('label' => "U", 'width' => 30, 'name' => "Draw", 'align' => 'right', 'sorttype' => 'int');
			$colModel[] = array('label' => "N", 'width' => 30, 'name' => "Loss", 'align' => 'right', 'sorttype' => 'int');
			$colModel[] = array('label' => "Tore", 'width' => 60, 'name' => "Goals", 'align' => 'right');
			$colModel[] = array('label' => "Diff", 'width' => 35, 'name' => "Diff", 'align' => 'right', 'sorttype' => 'int');
			$colModel[] = array('label' => "Pkt", 'width' => 35, 'name' => "Pts", 'align' => 'right', 'sorttype' => 'int', 'classes' => 'Pts');

			// Daten
			$trid = $_POST['trid'];
			$md = $_POST['md'];
			$mode = $_POST['mode'];
			if (!isset($mode)) $mode = 't';
			$teams = $this->teams;

			$tnid = $this->user['tnid'];

			$sql = sprintf(
				"SELECT * FROM %s s INNER JOIN %s t ON s.sid = t.sid WHERE trid=%d and sptag<=%d AND tnid=%d",
				$this->TABLE['spielplan'],
				$this->TABLE['tipps'],
				$trid,
				$md,
				$tnid
			);
			$data = $this->db->getData($sql);
			foreach ($data as $row) {
				$schedule[$row['sptag']][$row['sid']] = $row;
			}

			$data = array();
			for ($m = 1; $m <= $md; $m++) {
				if (is_array($schedule[$m]))
					foreach ($schedule[$m] as $row) {
						$t1 = $row['tid1'];
						$t2 = $row['tid2'];
						$result = preg_split('/:/', $row['Tipp']);

						if ($result[0] <> '-') {
							if (($mode == 't') || ($mode == 'h')) $data[$t1]['Matches']++;
							if (($mode == 't') || ($mode == 'a')) $data[$t2]['Matches']++;
							if (($mode == 't') || ($mode == 'h')) {
								$data[$t1]['gf'] += $result[0];
								$data[$t1]['ga'] += $result[1];
							}
							if (($mode == 't') || ($mode == 'a')) {
								$data[$t2]['gf'] += $result[1];
								$data[$t2]['ga'] += $result[0];
							}

							if ($result[0] > $result[1]) {
								if (($mode == 't') || ($mode == 'h')) $data[$t1]['Win']++;
								if (($mode == 't') || ($mode == 'a')) $data[$t2]['Loss']++;
							} else
									if ($result[0] < $result[1]) {
								if (($mode == 't') || ($mode == 'h')) $data[$t1]['Loss']++;
								if (($mode == 't') || ($mode == 'a')) $data[$t2]['Win']++;
							} else {
								if (($mode == 't') || ($mode == 'h')) $data[$t1]['Draw']++;
								if (($mode == 't') || ($mode == 'a')) $data[$t2]['Draw']++;
							}
						} // if
					} // foreach
			} // for

			if (is_array($data)) {
				unset($_sort);
				foreach ($data as $idx => $s) {
					$data[$idx]['Pts']   = 3 * $s['Win'] + $s['Draw'];
					$data[$idx]['Diff']  = $s['gf'] - $s['ga'];
					$data[$idx]['Goals'] = $s['gf'] . ':' . $s['ga'];
					$data[$idx]['Team']  = $teams[$idx]['Name'];
					$data[$idx]['Logo']  = $teams[$idx]['tid'];

					$_sort['idx'][$idx]  = $idx;
					$_sort['Pts'][$idx]  = $data[$idx]['Pts'];
					$_sort['Diff'][$idx] = $data[$idx]['Diff'];
					$_sort['Goals'][$idx] = $data[$idx]['Goals'];
				} // foreach

				if (is_array($_sort['Pts']))
					array_multisort(
						$_sort['Pts'],
						SORT_DESC,
						SORT_NUMERIC,
						$_sort['Diff'],
						SORT_DESC,
						SORT_NUMERIC,
						$_sort['Goals'],
						SORT_DESC,
						SORT_STRING,
						$_sort['idx']
					);
			} // if

			if (isset($_sort['idx'])) {
				$_nr = 0;
				foreach ($_sort['idx'] as $idx) {
					$table[$_nr] = $data[$idx];
					$table[$_nr]['Pos'] = $_nr + 1;
					$_nr++;
				} // foreach
			} // if
		}

		$this->jsonoutGrid($colModel, $table);
	}

	/*****************************************************************************************************************************
	 * Admin
	 *****************************************************************************************************************************/

	/**/	function GetBenutzerData()
	{
		$colModel = array();

		$user = $this->user;
		if ($user) {
			$mode = $_POST['mode'];

			$colModel[] = array(
				'label' => "Name", 'width' => 180, 'name' => "name",
				'editable' => true, 'editoptions' => array('size' => 30, 'maxlength' => 30, 'class' => 'gradient')
			);
			$colModel[] = array(
				'label' => "Login-Name", 'width' => 180, 'name' => "user",
				'editable' => true, 'editoptions' => array('size' => 64, 'maxlength' => 64, 'class' => 'gradient')
			);
			$colModel[] = array(
				'label' => "Passwort", 'width' => 100, 'name' => "password",
				'editable' => true, 'editoptions' => array('size' => 30, 'maxlength' => 30, 'class' => 'gradient')
			);
			$colModel[] = array(
				'label' => "E-Mail", 'width' => 300, 'name' => "email",
				'editable' => true, 'editoptions' => array('size' => 64, 'maxlength' => 64, 'class' => 'gradient')
			);
			$colModel[] = array(
				'label' => "Erinnerung", 'width' => 100, 'name' => "remind",
				'editable' => true, 'editoptions' => array('size' => 3, 'maxlength' => 3, 'class' => 'gradient')
			);
			$colModel[] = array('label' => "id", 'name' => "tnid", 'key' => true, 'hidden' => true);

			unset($results);
			$sql = sprintf("SELECT * FROM %s", $this->TABLE['teilnehmer']);
			if (($mode == 'all') && ($user['userlevel'] == 100)) {
				$colModel[] = array(
					'label' => "Level", 'width' => 50, 'name' => "userlevel", 'align' => 'right', 'sorttype' => 'int',
					'editable' => true, 'editoptions' => array('size' => 3, 'maxlength' => 3, 'class' => 'gradient')
				);
			} else {
				$sql .= sprintf(" WHERE tnid=%d", $user['tnid']);
			}

			$data = $this->db->getData($sql);
			foreach ($data as $row) {
				unset($row['password']);
				$results[] = $row;
			}
		}

		$this->jsonoutGrid($colModel, $results, 'name');
	}

	function SaveBenutzerData($data)
	{
		$user = $this->user;
		if ($user && isset($data)) {
			if ($user['userlevel'] == 100 || $data['tnid'] == $user['tnid']) {
				switch ($data['oper']) {
					case 'add':
						if ($user['userlevel'] == 100) {
							$sql = sprintf(
								"INSERT INTO %s (user,email,name,userlevel,password,remind) values('%s','%s','%s',%d,'%s',%d)",
								$this->TABLE['teilnehmer'],
								$data['user'],
								$data['email'],
								$data['name'],
								$data['userlevel'],
								md5($data['password']),
								$data['remind']
							);
							$this->db->Query($sql);
							$this->jsonResult2(true, Status::OK, 'Benutzer angelegt!');
							return;
						}
						break;

					case 'edit':
						$sql = sprintf(
							"UPDATE %s SET user='%s', email='%s', name='%s', remind=%d",
							$this->TABLE['teilnehmer'],
							$data['user'],
							$data['email'],
							$data['name'],
							$data['remind']
						);
						if (!empty($data['password'])) $sql .= sprintf(", password='%s'", md5($data['password']));
						if (($user['userlevel'] == 100) && isset($data['userlevel'])) $sql .= sprintf(", userlevel=%d", $data['userlevel']);
						$sql .= sprintf(" WHERE tnid=%d", $data['tnid']);
						$this->db->Query($sql);
						$this->jsonResult2(true, Status::OK, 'Daten gespeichert!');
						return;
						break;

					case 'del':
						if ($user['userlevel'] == 100) {
							$sql = sprintf("DELETE FROM %s WHERE tnid=%d", $this->TABLE['teilnehmer'], $data['id']);
							$this->db->Query($sql);
							$this->jsonResult2(true, Status::OK, 'Benutzer gelöscht!');
							// TODO verknüpfte Daten?
							return;
						}
						break;
					default:
						$this->jsonResult2(false, Status::Error, $data[oper]);
						return;
						break;
				}
			}
		}

		$this->jsonResult2(true);
	}

	function GetTippsAdminData()
	{
		$colModel = array();

		// Datenmodell
		$colModel[] = array('label' => "Heimteam", 'width' => 200, 'name' => "HTeam", 'classes' => 'Team');
		$colModel[] = array('label' => "Auswärtsteam", 'width' => 200, 'index' => "ATeam", 'name' => "ATeam", 'classes' => 'Team');
		$colModel[] = array('label' => "Datum", 'width' => 90, 'name' => "Date", 'align' => 'right', 'formatter' => 'date', 'classes' => 'Date');
		$colModel[] = array(
			'label' => "Uhrzeit", 'width' => 90, 'name' => "Time", 'align' => 'center', 'formatter' => 'date',
			'formatoptions' => array('srcformat' => 'H:i:s', 'newformat' => 'H:i'), 'classes' => 'Time'
		);
		$colModel[] = array(
			'label' => "Tipp", 'width' => 90, 'name' => "Tip", 'align' => 'center', 'classes' => "Result",
			'editable' => true, 'editoptions' => array('size' => 5, 'maxlength' => 5, 'class' => 'gradient')
		);

		$colModel[] = array('name' => "editable", 'hidden' => true);
		$colModel[] = array('name' => "sid", 'key' => true, 'hidden' => true);
		$colModel[] = array('name' => "id", 'key' => true, 'hidden' => true);
		$colModel[] = array('name' => "tnid", 'hidden' => true);
		$colModel[] = array('name' => "Tip_old", 'hidden' => true);

		$rows = array();

		if (($this->user['userlevel'] == 100)
			&& isset($_POST['trid']) && isset($_POST['md']) && isset($_POST['tnid'])
		) {
			// Daten
			$userid = $_POST['tnid'];
			$trid = $_POST['trid'];
			$md = $_POST['md'];

			if ($userid > 0) {
				$sql = sprintf("SELECT s.*, t.Tipp, %d AS tnid FROM %s s LEFT JOIN %s t ON s.sid = t.sid AND (t.tnid = %d OR t.tnid IS NULL)
									WHERE s.trid=%d AND s.sptag=%d ORDER BY Datum, Uhrzeit", $userid, $this->TABLE['spielplan'], $this->TABLE['tipps'], $userid, $trid, $md);

				$data = $this->db->getData($sql);
				unset($tips);
				$teams = $this->teams;
				foreach ($data as $row) {
					$tips[] = array(
						'sid' => $row['sid'],
						'id' => $row['sid'],
						'HTeam' => $teams[$row['tid1']]['Name'],
						'ATeam' => $teams[$row['tid2']]['Name'],
						'Date' => $row['Datum'],
						'Time' => $row['Uhrzeit'],
						'Tip' => $row['Tipp'],
						'Tip_old' => $row['Tipp'],
						'editable' => true,
						'tnid' => $row['tnid']
					);
				}
			}
		}

		$this->jsonoutGrid($colModel, $tips);
	}

	function SaveTippsAdmin()
	{
		if (isset($_POST['data']) && ($this->user['userlevel'] == 100)) {
			$trid = $_POST['trid'];
			$md = $_POST['md'];

			$data = $_POST['data'];

			foreach ($data as $d) {

				if ($d['Tip'] != $d['Tip_old']) {
					$sql = sprintf(
						"INSERT INTO %s (uid, kommentar, sid, tnid, alt, neu)
								VALUES (%d,'%s',%d, %d, '%s','%s')",
						$this->TABLE['adminlog'],
						$this->user['tnid'],
						$_POST['comment'],
						$d['sid'],
						$d['tnid'],
						$d['Tip_old'],
						$d['Tip']
					);
					//echo $sql;
					$this->db->Query($sql);
					$sql = sprintf("replace into %s (sid,tnid,Tipp) values (%d,%d,'%s')", $this->TABLE['tipps'], $d['sid'], $d['tnid'], $d['Tip']);
					$this->db->Query($sql);
					//echo $sql;
				}
			}
			$this->jsonResult2(true, Status::OK, 'Tipps gespeichert!');
			return;
		} else {
			$this->jsonResult2(true);
		}
	}

	function GetTipprundenData()
	{
		$colModel = array();

		$user = $this->user;
		if ($user) {

			$colModel[] = array(
				'label' => "Name", 'width' => 200, 'name' => "Name",
				'editable' => true, 'editoptions' => array('size' => 50, 'maxlength' => 50, 'class' => 'gradient')
			);
			$colModel[] = array('label' => "trid", 'name' => "trid", 'key' => true, 'hidden' => true);
			$colModel[] = array(
				'label' => "Start", 'width' => 90, 'name' => "Start", 'align' => 'right', 'formatter' => 'date',
				'editable' => true, 'editoptions' => array('size' => 10, 'maxlength' => 10, 'class' => 'gradient')
			);
			$colModel[] = array(
				'label' => "Ende", 'width' => 90, 'name' => "End", 'align' => 'right', 'formatter' => 'date',
				'editable' => true, 'editoptions' => array('size' => 10, 'maxlength' => 10, 'class' => 'gradient')
			);
			$colModel[] = array(
				'label' => "Pkt.<br/>exakt. Erg", 'width' => 80, 'name' => "P1", 'align' => 'right', 'sorttype' => 'int',
				'editable' => true, 'editoptions' => array('size' => 2, 'maxlength' => 2, 'class' => 'gradient')
			);
			$colModel[] = array(
				'label' => "Pkt.<br/>Tordiff.", 'width' => 80, 'name' => "P2", 'align' => 'right', 'sorttype' => 'int',
				'editable' => true, 'editoptions' => array('size' => 2, 'maxlength' => 2, 'class' => 'gradient')
			);
			$colModel[] = array(
				'label' => "Pkt.<br/>Tendenz", 'width' => 80, 'name' => "P3", 'align' => 'right', 'sorttype' => 'int',
				'editable' => true, 'editoptions' => array('size' => 2, 'maxlength' => 2, 'class' => 'gradient')
			);
			$colModel[] = array(
				'label' => "Abgabefrist<br/>(in h)", 'width' => 80, 'name' => "Deadline", 'align' => 'right', 'sorttype' => 'int',
				'editable' => true, 'editoptions' => array('size' => 3, 'maxlength' => 3, 'class' => 'gradient')
			);
			$colModel[] = array(
				'label' => "Wertungsrunden", 'width' => 120, 'name' => "Rounds", 'align' => 'right', 'sorttype' => 'int',
				'editable' => true, 'editoptions' => array('size' => 1, 'maxlength' => 1, 'class' => 'gradient')
			);
			$colModel[] = array(
				'label' => "Ligen", 'width' => 60, 'name' => "Leagues", 'align' => 'right', 'sorttype' => 'int',
				'editable' => true, 'editoptions' => array('size' => 1, 'maxlength' => 1, 'class' => 'gradient')
			);
			$colModel[] = array(
				'label' => "sichtbar", 'width' => 60, 'name' => "Active", 'align' => 'right',
				'edittype' => 'checkbox', 'editoptions' => array('value' => "J:N"), //'formatter' => 'checkbox', 'formatoptions' => array ('value' => "J:N", 'disabled'=>false),
				'editable' => true
			);

			unset($results);

			if ($user['userlevel'] == 100) {
				$sql = sprintf("SELECT * FROM %s ORDER BY trid", $this->TABLE['tipprunde']);
				$data = $this->db->getData($sql);
				foreach ($data as $row) {
					$results[] = array(
						'trid' => $row['trid'],
						'Name' => $row['Name'],
						'Start' => $row['Beginn'],
						'End' => $row['Ende'],
						'Creator' => $row['Ersteller'],
						'Active' => $row['aktiv'],
						'P1' => $row['P1'],
						'P2' => $row['P2'],
						'P3' => $row['P3'],
						'Deadline' => $row['deadline'],
						'Rounds' => $row['Runden'],
						'Leagues' => $row['Ligen']
					);
				}
			}
		}

		$this->jsonoutGrid($colModel, $results);
	}

	function SaveTipprundenData($data)
	{
		$user = $this->user;
		//echo "X:".$user . "-".$user['userlevel']."-".$data['oper'];
		//print_r($data);
		if ($user && isset($data)) {
			if ($user['userlevel'] == 100) {
				switch ($data['oper']) {
					case 'add':
						$sql = sprintf(
							"INSERT INTO %s (Name,Beginn,Ende,Aktiv,P1,P2,P3,deadline,Runden,Ligen,Ersteller)
							        values('%s','%s','%s','%s',%d,%d,%d,%d,%d,%d,%d)",
							$this->TABLE['tipprunde'],
							$data['Name'],
							$this->convertDate($data['Start']),
							$this->convertDate($data['End']),
							$data['Active'],
							$data['P1'],
							$data['P2'],
							$data['P3'],
							$data['Deadline'],
							$data['Rounds'],
							$data['Leagues'],
							$user['tnid']
						);
						$this->db->Query($sql);
						$this->jsonResult2(true, Status::OK, 'Daten gespeichert!');
						return;
						break;
					case 'edit':
						$sql = sprintf(
							"UPDATE %s SET Name='%s', Beginn='%s', Ende='%s', Aktiv='%s',
									P1=%d, P2=%d, P3=%d, deadline=%d, Runden=%d, Ligen=%d",
							$this->TABLE['tipprunde'],
							$data['Name'],
							$this->convertDate($data['Start']),
							$this->convertDate($data['End']),
							$data['Active'],
							$data['P1'],
							$data['P2'],
							$data['P3'],
							$data['Deadline'],
							$data['Rounds'],
							$data['Leagues']
						);
						$sql .= sprintf(" WHERE trid=%d", $data['trid']);
						$this->db->Query($sql);
						if ($data['trid'] == $this->trrow['trid']) $this->trrow = null; // wenn aktuelle Runde geändert wurde neu laden...
						$this->jsonResult2(true, Status::OK, 'Daten gespeichert!');
						return;
						break;
					case 'del':
						// TODO
						break;
					default:
						$this->jsonResult2(false, Status::Error, $data[oper]);
						return;
						break;
				}
			}
		}

		$this->jsonResult2(true);
	}

	function GetLigaTeilnehmerData()
	{
		$colModel = array();

		$colModel[] = array('label' => "Name", 'width' => 180, 'name' => "Name"); //, summaryType=> 'count' , summaryTpl=> 'Anzahl: {0}' );
		$colModel[] = array('label' => "tnid", 'width' => 20, 'name' => "tnid", 'key' => true, 'hidden' => true);
		$colModel[] = array('label' => "Liga", 'width' => 40, 'name' => "League", 'sorttype' => 'int');
		$colModel[] = array(
			'label' => "LNr", 'width' => 40, 'name' => "LNr", 'sorttype' => 'int',
			'editable' => true, 'editoptions' => array('size' => 2, 'maxlength' => 2, 'class' => 'gradient')
		);
		$colModel[] = array('label' => " ", 'name' => "rnd", 'hidden' => true);

		$rnd = $_POST['rnd'];
		if (!isset($rnd)) $rnd = 1;

		//if (isset($_POST['rnd']))
		{
			$trid = $_POST['trid'];
			$lnr = $_POST['lnr'];

			$sql = sprintf(
				"SELECT tn.tnid AS tnid1, tn.name AS name, tr.* FROM %s tn LEFT JOIN %s tr ON (tn.tnid=tr.tnid AND trid=%d AND LRnd=%d)
								WHERE userlevel>0 AND IFNULL(tr.Liga,0)=%d ORDER BY tn.name",
				$this->TABLE['teilnehmer'],
				$this->TABLE['tr_teilnehmer'],
				$trid,
				$rnd,
				$lnr
			);

			$data = $this->db->getData($sql);
			foreach ($data as $row) {
				$member[] = array(
					'tnid' => $row['tnid1'],
					'Name' => $row['name'],
					'trid' => $trid,
					'League' => $row['Liga'],
					'LRnd' => $row['LRnd'],
					'LNr' => $row['LNr'],
					'editable' => true,
					'rnd' => $rnd
				);
			}
		}

		$this->jsonoutGrid($colModel, $member);
	}

	function SaveLigaTeilnehmer()
	{
		if ($this->user['userlevel'] == 100) {
			if (isset($_POST['data'])) {
				$data = $_POST['data'];
				$trid = $_POST['trid'];
				$rnd = $data[0]['rnd'];

				if (!empty($rnd)) {
					$this->db->Query(sprintf("DELETE FROM %s WHERE trid=%d AND LRnd=%d", $this->TABLE['tr_teilnehmer'], $trid, $rnd));
					foreach ($data as $d) {
						$nr = (isset($d['LNr'])) ? $d['LNr'] : 0;
						$sql = sprintf(
							"INSERT INTO %s (trid, tnid, Liga, LRnd, LNr) VALUES(%d,%d,%d,%d,%d)",
							$this->TABLE['tr_teilnehmer'],
							$trid,
							$d['tnid'],
							$d['League'],
							$rnd,
							$nr
						);
						$this->db->Query($sql);
					}
				}

				$this->jsonResult2(true, Status::OK, 'Daten gespeichert!');
				return;
			}

			$this->jsonResult2(true);
			return;
		}

		$this->jsonResult2(true);
	}

	function createLigaSpielplan()
	{
		if ($this->user['userlevel'] == 100) {
			if (isset($_POST['data'])  && isset($_POST['trid']) && isset($_POST['rnd'])) {
				$data = $_POST['data'];
				$trid = $_POST['trid'];
				$rnd = $_POST['rnd'];
				$start = $this->trrow['s'][$rnd];
				$end = $this->trrow['e'][$rnd];
				$league = $_POST['lnr'];

				// Umsetzungstabelle Teamid => Teilnehmerid
				foreach ($data as $d) $tnid[$d['LNr']] = $d['tnid'];
				//print_r($tnid);
				if (count($tnid) == 1) {
					unset($tnid);
					$i = 1;
					foreach ($data as $d) $tnid[$i++] = $d['tnid'];
				}
				//print_r($tnid);
				if (count($tnid) != 18) {
					$this->jsonResult2(false, Status::Error, 'Fehler bei der Spielernumerierung.');
					exit;
				}

				$sql = sprintf("SELECT DISTINCT tid1 FROM %s WHERE trid=%d AND sptag BETWEEN %d and %d", $this->TABLE['spielplan'], $trid, $start, $end);
				$idx = 1;
				$data = $this->db->getData($sql);
				foreach ($data as $row) {
					$transform[$row['tid1']] = $tnid[$idx];
					$idx++;
				}

				if (count($transform) != 18) {
					$this->jsonResult2(false, Status::Error, 'Fehler bei der Teamzuordnung. Spielplan richtig importiert?');
					exit;
				}

				// Spielplan generieren
				$sql = sprintf("SELECT tid1, tid2, sptag FROM %s WHERE trid=%d AND sptag BETWEEN %d AND %d ORDER BY sptag,sid", $this->TABLE['spielplan'], $trid, $start, $end);

				$data = $this->db->getData($sql);
				foreach ($data as $row) {
					$tn1 = $transform[$row['tid1']];
					$tn2 = $transform[$row['tid2']];

					$this->db->Query(sprintf(
						"INSERT INTO %s (trid,sptag,Liga,tnid1,tnid2,Ergebnis) VALUES(%d, %d, %d, %d, %d, '-:-')",
						$this->TABLE['ligaergebnis'],
						$trid,
						$row['sptag'],
						$league,
						$tn1,
						$tn2
					));
				}
				$this->jsonResult2(true, Status::OK, 'Spielplan erstellt!');
				exit;
			}

			$this->jsonResult2(false, Status::Error, 'Fehler bei der Datenübermittlung. Bitte noch mal versuchen.');
			exit;
		}
		$this->jsonResult2(false, Status::Error, 'Keine Berechtigung!');
	}

	function SaveSpielplan()
	{
		if ($this->user['userlevel'] == 100) {
			if (isset($_POST['data']) && isset($_POST['trid']) && isset($_POST['md'])) {
				$data = $_POST['data'];
				$trid = $_POST['trid'];
				$md = $_POST['md'];

				foreach ($data as $d) {
					$sql = sprintf(
						"UPDATE %s SET Datum='%s', Uhrzeit='%s', Ergebnis='%s' WHERE sid = %d",
						$this->TABLE['spielplan'],
						$this->convertDate($d['Date']),
						$d['Time'],
						$d['Result'],
						$d['sid']
					);
					$this->db->Query($sql);
				}

				//  Liga berechnen
				if ($this->checkDeadline($trid, $md)) $this->calcLeague($trid, $md);

				$this->jsonResult2(true, Status::OK, 'Spielplan gespeichert!');
				return;
			}
			$this->jsonResult2(true);
			return;
		}

		$this->jsonResult2(false, Status::Error, 'Keine Berechtigung!');
	}

	function getDFBErgebnisse()
	{
		$trid = $_POST['trid'];
		$md = $_POST['md'];
		$data = $this->parseResults($trid, $md);

		$json = array('ok' => true, 'data' => $data);
		$this->jsonout($json);
	}

	// Claude 21.03.2026 PHP 8.x Deprecated-Fixes
	function parseResults($trid, $md)
	{
		$wt = new Web($this);

		$sched = $wt->parseSchedule($trid, $md);

		// Spieltage laden
		$_sid = array();
		$sql = sprintf("SELECT * FROM %s where trid=%d AND sptag=%d", $this->TABLE['spielplan'], $trid, $md);
		$data = $this->db->getData($sql);
		foreach ($data as $row) {
			$_sid[$row['tid1']][$row['tid2']] = $row['sid'];
		}

		$results = array();
		$matches = $sched[$md] ?? array();
		foreach ($matches as $s) {
			$erg = explode(chr(160), $s['Result']);
			$sid = $_sid[$s['T1']][$s['T2']] ?? null;
			$results[] = array(
				'T1' => $s['T1'],
				'T2' => $s['T2'],
				'Res' => $erg[0],
				'sid' => $sid
			);
		}

		return $results;
	}

	function getDFBSpielplan($trid,	$mode)
	{
		$wt = new Web($this);
		//console_log($mode);

		if (isset($mode)) {
			//console_log(1);
			$html = $wt->outputSchedule($trid, $mode);
		} else {
			//console_log(2);
			$html = $wt->getSchedule($trid, -1);
			// TODO Output
		}

		//$html = utf8_decode($html);

		$json = array('ok' => true, 'html' => $html);
		$this->jsonout($json);
	}

	function createTeam($name, $kurz)
	{
		if ($name) {
			$sql = sprintf("INSERT INTO %s (Name, kurz) SELECT '%s', '%s' FROM DUAL WHERE NOT EXISTS
								(SELECT * FROM %s WHERE Name='%s' OR kurz='%s')", $this->TABLE['teams'], $name, $kurz, $this->TABLE['teams'], $name, $kurz);
			//$sql .= "LIMIT 1";
			$this->db->Query($sql);
		}
	}

	/*****************************************************************************************************************************
	 * Reminder MA 03.10.2017
	 *****************************************************************************************************************************/

	function SendRemindMail_old($from_mail, $mail_to, $mail_subject, $mail_message)
	{
		//echo "<br>$from_mail<br>$mail_to<br>$mail_subject<br>$mail_message";
		//return false;

		$encoding = "utf-8";
		$from_name = "Reminder";

		// Preferences for Subject field
		$subject_preferences = array(
			"input-charset" => $encoding,
			"output-charset" => $encoding,
			"line-length" => 76,
			"line-break-chars" => "\r\n"
		);

		// Mail header
		$header = "Content-type: text/html; charset=" . $encoding . " \r\n";
		$header .= "From: " . $from_name . " <" . $from_mail . "> \r\n";
		$header .= "MIME-Version: 1.0 \r\n";
		$header .= "Content-Transfer-Encoding: 8bit \r\n";
		$header .= "Date: " . date("r (T)") . " \r\n";
		$header .= iconv_mime_encode("Subject", $mail_subject, $subject_preferences);

		// Send mail
		return mail($mail_to, $mail_subject, $mail_message, $header);
	}

	// MA 10.11.2020 Versand mit PHPMailer
	function SendRemindMail($from_mail, $mail_to, $mail_subject, $mail_message)
	{
		$from_name = "Reminder";

		// Send mail
		$mail = new PHPMailer(true);
		try {
			//Server settings
			// Mail-Credentials aus .env laden
			$envFile = __DIR__ . '/../ktsvc/.env';
			$envVars = file_exists($envFile) ? parse_ini_file($envFile) : [];

			$mail->isSMTP();
			$mail->Host       = $envVars['MAIL_HOST'] ?? 'localhost';
			$mail->SMTPAuth   = true;
			$mail->Username   = $envVars['MAIL_USERNAME'] ?? '';
			$mail->Password   = $envVars['MAIL_PASSWORD'] ?? '';
			$mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
			$mail->Port       = intval($envVars['MAIL_PORT'] ?? 587);
			$mail->CharSet = 'UTF-8';

			//Recipients
			$mail->setFrom($from_mail, $from_name);
			$mail->addAddress($mail_to);

			// Content
			$mail->isHTML(true);
			$mail->Subject = $mail_subject;
			$mail->Body    = $mail_message;
			$mail->AltBody = $mail_message;

			$mail->send();
			return true;
		} catch (Exception $e) {
			echo "Message could not be sent. Mailer Error: {$mail->ErrorInfo}";
			return false;
		}
	}

	function Reminder()
	{
		$sql = sprintf(
			"SELECT R.*, TN.name, TN.email, TR.Name, TN.remind
							FROM v_remind R
							INNER JOIN %s TN ON R.tnid = TN.tnid
							INNER JOIN %s TR ON R.trid = TR.trid
							INNER JOIN %s S ON R.trid = S.trid AND R.sptag = S.sptag
							WHERE R.diff BETWEEN 0 AND TN.remind
							GROUP BY R.tnid, R.trid, R.sptag",
			$this->TABLE['teilnehmer'],
			$this->TABLE['tipprunde'],
			$this->TABLE['spielplan']
		);

		$data = $this->db->getData($sql);

		foreach ($data as $row) {
			//print_r($row);
			//echo "<br/>";

			//$n = split(',', $row['name']);
			$n = preg_split('/,/', $row['name']);

			$subject = sprintf("Erinnerung Tippabgabe: Spieltag %d (%s)", $row['sptag'], $row['Name']);
			$message = sprintf("Hallo %s %s,<br/><br/>
											Sie haben noch nicht alle Tipps für den %d. Spieltag abgegeben.<br/>
											<a href='http://tippg.de/'>Zur Tippapgabe</a><br/><br/>
											Viele Grüße<br/>
											Ihre Online-Tippgemeinschaft", $n[1], $n[0], $row['sptag']);

			if ($this->SendRemindMail("reminder@tippg.de", $row['email'], $subject, $message)) {
				$sql = sprintf(
					"REPLACE INTO %s VALUES(%d, %d, %d, '%s', CURRENT_TIMESTAMP)",
					$this->TABLE['remind'],
					$row['trid'],
					$row['tnid'],
					$row['sptag'],
					$row['email']
				);
				//echo "$sql<br>";
				$this->db->Query($sql);
			}

			//echo "<br/>";
		}
	}

	/*****************************************************************************************************************************
	 * Game-Scores (Breakout + Zahlen-Jagd)
	 *****************************************************************************************************************************/
	function SaveGameScore()
	{
		if (!$this->user) { $this->jsonResult2(false, Status::Error, 'Nicht eingeloggt.'); return; }

		$game  = $_POST['game'] ?? '';
		$score = intval($_POST['score'] ?? 0);
		$trid  = intval($_POST['trid'] ?? 0);
		$md    = intval($_POST['md'] ?? 0);

		if (!in_array($game, ['breakout', 'hunt'])) {
			$this->jsonResult2(false, Status::Error, 'Ungültiges Spiel.'); return;
		}
		if ($score < 1) {
			$this->jsonResult2(false, Status::Error, 'Ungültiger Score.'); return;
		}

		$tnid = $this->user['tnid'];
		$table = $this->TABLE['gamescores'];

		// Bestehenden Score laden
		$existing = $this->db->prepareGetData(
			"SELECT score FROM $table WHERE tnid = ? AND game = ? AND trid = ? AND md = ?",
			'isii', [$tnid, $game, $trid, $md]
		);

		if (empty($existing)) {
			// Neuer Eintrag
			$this->db->prepareExecute(
				"INSERT INTO $table (tnid, game, trid, md, score) VALUES (?, ?, ?, ?, ?)",
				'isiii', [$tnid, $game, $trid, $md, $score]
			);
		} elseif ($score > intval($existing[0]['score'])) {
			// Nur updaten wenn neuer Score höher
			$this->db->prepareExecute(
				"UPDATE $table SET score = ? WHERE tnid = ? AND game = ? AND trid = ? AND md = ?",
				'iisii', [$score, $tnid, $game, $trid, $md]
			);
		}

		$this->jsonout(array('ok' => true));
	}

	function GetGameScores()
	{
		$game = $_POST['game'] ?? ($_GET['game'] ?? '');
		$trid = intval($_POST['trid'] ?? ($_GET['trid'] ?? 0));
		$md   = intval($_POST['md'] ?? ($_GET['md'] ?? 0));
		$table = $this->TABLE['gamescores'];
		$tnTable = $this->TABLE['teilnehmer'];

		if ($game === 'breakout') {
			// All-Time: Gesamtscore über alle Spieltage
			$sql = "SELECT t.name, SUM(g.score) AS total, COUNT(g.score) AS matchdays, MAX(g.score) AS best
			        FROM $table g
			        JOIN $tnTable t ON t.tnid = g.tnid
			        WHERE g.game = 'breakout' AND g.trid = ? AND g.md > 0
			        GROUP BY g.tnid, t.name
			        ORDER BY total DESC
			        LIMIT 10";
			$alltime = $this->db->prepareGetData($sql, 'i', [$trid]);
	

			// Spieltag: Nur aktueller Spieltag
			$mdRows = [];
			if ($md > 0) {
				$sql = "SELECT t.name, g.score AS total
				        FROM $table g
				        JOIN $tnTable t ON t.tnid = g.tnid
				        WHERE g.game = 'breakout' AND g.trid = ? AND g.md = ?
				        ORDER BY g.score DESC
				        LIMIT 10";
				$mdRows = $this->db->prepareGetData($sql, 'ii', [$trid, $md]);
	
			}

			$this->jsonout(array('ok' => true, 'scores' => $alltime, 'matchday' => $mdRows));
			return;
		} elseif ($game === 'hunt') {
			// Zahlen-Jagd: globale Bestleistung pro Spieler (trid=0, md=0)
			$sql = "SELECT t.name, g.score AS best_round
			        FROM $table g
			        JOIN $tnTable t ON t.tnid = g.tnid
			        WHERE g.game = 'hunt'
			        ORDER BY g.score DESC
			        LIMIT 20";
			$rows = $this->db->getData($sql);
		} else {
			$rows = [];
		}

	
		$this->jsonout(array('ok' => true, 'scores' => $rows));
	}

	/*****************************************************************************************************************************
	 * Pinnwand
	 *****************************************************************************************************************************/

	function GetPinnwand()
	{
		$sql = sprintf("SELECT p.id, p.tnid, p.nick, p.`text`, p.image, p.sticky,
				p.pos_x, p.pos_y, p.rotation, p.color, p.card_style,
				DATE_FORMAT(p.created, '%%d.%%m.%%Y %%H:%%i') AS created_fmt
				FROM %s p
				ORDER BY p.sticky DESC, p.created DESC
				LIMIT 100",
			$this->TABLE['pinnwand']);

		$rows = $this->db->getData($sql);

		$this->jsonout(array(
			'ok' => true,
			'posts' => $rows,
			'isAdmin' => ($this->user['userlevel'] == 100),
			'tnid' => $this->user['tnid']
		));
	}

	function SavePinnwandPost($text, $color = '#fff9c4')
	{
		if (empty($text)) {
			$this->jsonout(array('ok' => false, 'message' => 'Text darf nicht leer sein.'));
			return;
		}

		$allowedColors = ['#fff9c4','#c8e6c9','#bbdefb','#f8bbd0','#e1bee7','#ffe0b2'];
		if (!in_array($color, $allowedColors)) $color = '#fff9c4';

		// Bild verarbeiten (falls in Session zwischengespeichert)
		$image = null;
		if (!empty($_SESSION['_pinnwand_upload'])) {
			$image = $_SESSION['_pinnwand_upload'];
			unset($_SESSION['_pinnwand_upload']);
		}

		$nick = $this->user['name'];
		$tnid = $this->user['tnid'];

		$sql = sprintf("INSERT INTO %s (tnid, nick, `text`, image, color) VALUES (?, ?, ?, ?, ?)", $this->TABLE['pinnwand']);
		$image = $image ?: '';
		$this->db->prepareExecute($sql, 'issss', [$tnid, $nick, $text, $image, $color]);

		$this->GetPinnwand();
	}

	function DeletePinnwandPost($id)
	{
		if ($id <= 0) {
			$this->jsonout(array('ok' => false, 'message' => 'Ungültige ID.'));
			return;
		}

		// Nur eigene Posts oder Admin
		$sql = sprintf("SELECT tnid, image FROM %s WHERE id = ?", $this->TABLE['pinnwand']);
		$result = $this->db->prepare($sql, 'i', [$id]);
		$row = $result ? $result->fetch_assoc() : null;

		if (!$row) {
			$this->jsonout(array('ok' => false, 'message' => 'Post nicht gefunden.'));
			return;
		}

		if ($row['tnid'] != $this->user['tnid'] && $this->user['userlevel'] != 100) {
			$this->jsonout(array('ok' => false, 'message' => 'Keine Berechtigung.'));
			return;
		}

		// Bild-Datei löschen falls vorhanden
		if ($row['image']) {
			$filepath = dirname(__DIR__) . '/' . $row['image'];
			if (file_exists($filepath)) unlink($filepath);
		}

		$sql = sprintf("DELETE FROM %s WHERE id = ?", $this->TABLE['pinnwand']);
		$this->db->prepareExecute($sql, 'i', [$id]);

		$this->GetPinnwand();
	}

	function TogglePinnwandSticky($id)
	{
		// Nur Admin
		if ($this->user['userlevel'] != 100) {
			$this->jsonout(array('ok' => false, 'message' => 'Keine Berechtigung.'));
			return;
		}

		if ($id <= 0) {
			$this->jsonout(array('ok' => false, 'message' => 'Ungültige ID.'));
			return;
		}

		$sql = sprintf("UPDATE %s SET sticky = NOT sticky WHERE id = ?", $this->TABLE['pinnwand']);
		$this->db->prepareExecute($sql, 'i', [$id]);

		$this->GetPinnwand();
	}

	function SavePinnwandPosition($id, $posX, $posY, $rotation)
	{
		if ($id <= 0) {
			$this->jsonout(array('ok' => false, 'message' => 'Ungueltige ID.'));
			return;
		}

		$sql = sprintf("SELECT tnid FROM %s WHERE id = ?", $this->TABLE['pinnwand']);
		$result = $this->db->prepare($sql, 'i', [$id]);
		$row = $result ? $result->fetch_assoc() : null;

		if (!$row) {
			$this->jsonout(array('ok' => false, 'message' => 'Post nicht gefunden.'));
			return;
		}

		if ($row['tnid'] != $this->user['tnid']) {
			$this->jsonout(array('ok' => false, 'message' => 'Nur eigene Karten verschieben.'));
			return;
		}

		$sql = sprintf("UPDATE %s SET pos_x = ?, pos_y = ?, rotation = ? WHERE id = ?", $this->TABLE['pinnwand']);
		$this->db->prepareExecute($sql, 'dddi', [$posX, $posY, $rotation, $id]);

		$this->jsonout(array('ok' => true));
	}

	function SavePinnwandStyle($id, $style)
	{
		$allowed = ['','polaroid','vintage','neon','doodle','frame','dark','glass','wobble','elegant','retro','tape','shadow'];
		if (!in_array($style, $allowed)) {
			$this->jsonout(array('ok' => false, 'message' => 'Ungueltiger Stil.'));
			return;
		}

		if ($id <= 0) {
			$this->jsonout(array('ok' => false, 'message' => 'Ungueltige ID.'));
			return;
		}

		$sql = sprintf("SELECT tnid FROM %s WHERE id = ?", $this->TABLE['pinnwand']);
		$result = $this->db->prepare($sql, 'i', [$id]);
		$row = $result ? $result->fetch_assoc() : null;

		if (!$row) {
			$this->jsonout(array('ok' => false, 'message' => 'Post nicht gefunden.'));
			return;
		}

		if ($row['tnid'] != $this->user['tnid']) {
			$this->jsonout(array('ok' => false, 'message' => 'Nur eigene Karten stylen.'));
			return;
		}

		$sql = sprintf("UPDATE %s SET card_style = ? WHERE id = ?", $this->TABLE['pinnwand']);
		$this->db->prepareExecute($sql, 'si', [$style, $id]);

		$this->jsonout(array('ok' => true));
	}

	function UploadPinnwandImage()
	{
		if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
			$this->jsonout(array('ok' => false, 'message' => 'Kein Bild hochgeladen.'));
			return;
		}

		$file = $_FILES['image'];
		$maxSize = 5 * 1024 * 1024; // 5 MB
		if ($file['size'] > $maxSize) {
			$this->jsonout(array('ok' => false, 'message' => 'Bild zu groß (max. 5 MB).'));
			return;
		}

		$allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
		$finfo = finfo_open(FILEINFO_MIME_TYPE);
		$mime = finfo_file($finfo, $file['tmp_name']);
		finfo_close($finfo);

		if (!in_array($mime, $allowed)) {
			$this->jsonout(array('ok' => false, 'message' => 'Ungültiges Bildformat.'));
			return;
		}

		$ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif', 'image/webp' => 'webp'];
		$uploadDir = dirname(__DIR__) . '/uploads/pinnwand/';
		if (!is_dir($uploadDir)) {
			mkdir($uploadDir, 0755, true);
		}

		$filename = uniqid('pw_') . '.' . $ext[$mime];
		$dest = $uploadDir . $filename;

		if (!move_uploaded_file($file['tmp_name'], $dest)) {
			$this->jsonout(array('ok' => false, 'message' => 'Fehler beim Speichern.'));
			return;
		}

		$relativePath = 'uploads/pinnwand/' . $filename;
		$_SESSION['_pinnwand_upload'] = $relativePath;

		$this->jsonout(array('ok' => true, 'image' => $relativePath));
	}
}