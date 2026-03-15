<?php

class Web
{
	private $kt = null;

	function __construct($kt)
	{
		$this->kt = $kt;
	}

	/*
		 * HTML-Dokument laden (von URL)
		 * MA 02.10.2014
		 */
	function file_get_contents_curl($url, $curlopt = array())
	{
		$ch = curl_init();
		$default_curlopt = array(
			CURLOPT_TIMEOUT => 30,
			CURLOPT_CONNECTTIMEOUT => 0,
			CURLOPT_RETURNTRANSFER => 1,
			CURLOPT_FOLLOWLOCATION => 1,
			CURLOPT_USERAGENT => "Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US; rv:1.9.2.13) Gecko/20101203 AlexaToolbar/alxf-1.54 Firefox/3.6.13 GTB7.1"
		);

		$curlopt = array(CURLOPT_URL => $url) + $curlopt + $default_curlopt;
		curl_setopt_array($ch, $curlopt);
		$response = curl_exec($ch);
		if ($response === false) trigger_error(curl_error($ch));
		curl_close($ch);
		return $response;
	}

	/*
		 * Jahreszahl des Saisonstarts
		 * MA 03.10.2014
		 */
	function getSeasonYear($trid)
	{
		$row = $this->kt->db->Query(sprintf("SELECT Beginn FROM %s WHERE trid=%d", $this->kt->TABLE[tipprunde], $trid))->fetch_assoc();

		// Jahreszahl des Saisonstarts
		return substr($row['Beginn'], 0, 4);
	}

	/*
		 * MA 02.10.2014 überarbeitet, Kicker-Spielplan statt DFB
		 * MA 11.08.2019 OpenLigaDB
		 */
	function getSchedule($trid, $md)
	{
		// Saison ermitteln
		$year = $this->getSeasonYear($trid);

		// MA 11.08.2019 OpenLigaDB
		$url = "https://www.openligadb.de/api/getmatchdata/bl1/$year";
		if ($md > 0) $url = $url . "/$md";
		$output = $this->file_get_contents_curl($url);
		return $output;
	}

	// MA 11.08.2019 OpenLigaDB-Anpassungen
	function parseSchedule($trid, $md)
	{
		// echo "<PRE>";

		// Teams laden
		unset($_teams);
		$data = $this->kt->db->getData(sprintf("SELECT * FROM %s", $this->kt->TABLE[teams]));
		//echo "----<br>";
		//print_r($data);
		//echo "----<br>";
		foreach ($data as $row) {
			$_teams[$row['Name']] = intval($row['tid']);
			$_teams[$row['alias']] = intval($row['tid']); // MA 03.10.2014
			//$_teams[$row['alias2']]=intval($row['tid']); // MA 26.01.2016

			//$_teams[utf8_decode($row['Name'])]=intval($row['tid']); // MA 06.01.2017
			$_teams[$row['Name']] = intval($row['tid']); // MA 06.01.2017
			$_teams[$row['alias']] = intval($row['tid']); // MA 06.01.2017
		}

		// print_r($_teams);
		//while ($row=$res->fetch_assoc()) { $_teams[($row['Name'])]=$row['tid']; }
		//echo "<pre>";print_r($_teams);

		$year = $this->getSeasonYear($trid);
		$schedule = $this->getSchedule($trid, $md);

		// echo "<pre>";
		// print_r($schedule);

		// Parser
		$matches = json_decode($schedule, true);
		// console_log($matches);
		// print_r($matches);

		$_nr = 1;
		foreach ($matches as $m) {
			//  print_r($m);
			// ["GroupName"]=>
			$_sptag = $m["group"]["groupOrderID"] ?? $m["Group"]["GroupOrderID"];
			//console_log($_sptag . " - ". $_nr ." : ". $m["MatchID"]);
			// echo $_sptag. "<br>";
			// echo "--------------------";

			if ($_sptag == 0 && $md > 0) $_sptag = $md; // Für Einzelspieltag-Abruf (z.B. Ergebnisse)
			if ($_sptag > 0) {
				$isodate = new DateTime($m["matchDateTime"] ?? $m["MatchDateTime"]);
				$datum = $isodate->format('d.m.Y');
				$zeit = $isodate->format('H:i:s');

				// Teams
				$t1 = $m["team1"]["teamName"] ?? $m["Team1"]["TeamName"];
				$t2 = $m["team2"]["teamName"] ?? $m["Team2"]["TeamName"];

				// Ergebnis
				$result = "-:-";
				$res = $m["matchResults"][0] ?? $m["MatchResults"][0];
				// echo "-------->". $res;
				// print_r($res);
				$resType = $res["resultTypeID"] ?? $res["ResultTypeID"];
				// echo "-------->". $resType;
				if ($resType != 2)
				{
					$res = $m["matchResults"][1] ?? $m["MatchResults"][1];
					// MA 31.08.2023
					$resType = $res["resultTypeID"] ?? $res["ResultTypeID"];
				} 			
				//  print_r($res);
				// echo "-------->". $resType;
				if ($resType == 2) // 2 == Endergebnis
				{
					// echo "--------1>". $result;
					$result = sprintf('%d:%d', $res["pointsTeam1"] ?? $res["PointsTeam1"], $res["pointsTeam2"] ?? $res["PointsTeam2"]);
					// echo "--------2>". $result;
				}

				$sched[$_sptag][$_nr++] = array(
					'D' => $datum,
					'Z' => $zeit,
					'T1n' => $t1,
					'T2n' => $t2,
					'T1' => $this->findTeam($_teams, $t1),
					'T2' => $this->findTeam($_teams, $t2),
					'Result' => $result
				);
			} // $_sptag > 0
		}
		//  print_r($sched);
		// echo "</PRE>";

		return $sched;
	}

	// MA 26.01.2016
	function findTeam($teams, $name)
	{
		//echo "$name<br>";
		$result = $teams[$name] ?? null;
		if ($result) return $result;

		// MA 29.10.2016 Fix/Workaround
		$name = trim(substr($name, 2));
		$result = $teams[$name] ?? null;
		if ($result) return $result;

		//echo "$name<br>";

		return "-";
	}

	/*
		 * MA 03.10.2014 intval
		 */
	function findSched($sptag, $t1, $t2, $sched)
	{
		unset($result);
		foreach ($sched[$sptag] as $s) {
			if ((intval($s['T1']) == intval($t1)) && (intval($s['T2']) == intval($t2))) $result = $s;
		}

		return $result;
	}


	function outputSchedule($trid, $mode)
	{
		// echo "$trid, $mode";
		$sched = $this->parseSchedule($trid, -1);
		// echo "<pre>";
		// print_r($sched);
		$result = '';
		switch ($mode) {
			case 'preview':
				$result = '<table class="kttable rounded shadow">';
				if (is_array($sched)) {
					foreach ($sched as $spid => $sptag) {
						$result .= sprintf('<tr><td colspan="5"><b>%d. Spieltag</b></td></tr>', $spid);
						foreach ($sched[$spid] as $spnr => $m) {
							if (!isset($m['T1']) || ($m['T1'] == '-')) {
								$form = '<br/><form action="php/createTeam.php" method="POST" target="_blank">';
								$form .= sprintf('Name: <input name="Name" value="%s" type="text">', $m['T1n']);
								$form .= sprintf('Kürzel: <input name="kurz" value="%s" maxlength="8" size="8" type="text">', $m['T1n']);
								$form .= '<input type="submit" value="Team anlegen">';
								$form .= "<form>";


								$m['T1'] = $form;
							}

							if (!isset($m['T2']) || ($m['T2'] == '-')) {
								$form = '<br/><form action="php/createTeam.php" method="POST" target="_blank">';
								$form .= sprintf('<input name="Name" value="%s" type="text">', $m['T2n']);
								$form .= sprintf('Kürzel: <input name="kurz" value="%s" maxlength="8" size="8" type="text">', $m['T2n']);
								$form .= '<input type="submit" value="Team anlegen">';
								$form .= "<form>";

								$m['T2'] = $form;
							}

							$result .= sprintf(
								"<tr><td><i>%d</i></td><td>%s</td><td>%s</td><td>%s(<b>%s</b>)</td><td>%s(<b>%s</b>)</td></tr>",
								$spnr,
								$m['D'],
								$m['Z'],
								$m['T1n'],
								$m['T1'],
								$m['T2n'],
								$m['T2']
							);
						}
					}
				}

				$result .= "</table>";
				break;

			case 'create':
				if (is_array($sched)) {
					// ggf. vorhandene Daten löschen // TODO !!
					$sql = sprintf("DELETE FROM %s WHERE trid=%d", $this->kt->TABLE[spielplan], $trid);
					// *** $this->kt->db->Query($sql);

					foreach ($sched as $spid => $sptag) {
						$result .= sprintf('<b>%d. Spieltag</b>&nbsp;', $spid);
						foreach ($sched[$spid] as $spnr => $m) {
							$_datum = $this->kt->convertDate($m['D']);
							$sql = sprintf(
								"INSERT INTO %s (trid,sptag,tid1,tid2,Datum,Uhrzeit,Ergebnis) VALUES(%d,%d,%d,%d,'%s','%s','-:-')",
								$this->kt->TABLE[spielplan],
								$trid,
								$spid,
								$m['T1'],
								$m['T2'],
								$_datum,
								$m['Z']
							);


							// *** $result .= $sql."<br>";
							$this->kt->db->Query($sql);
							$result .= ".";
						}

						$result .= "<br/>";
					}
				}
				break;

			case 'update':
				$result = '<table class="kttable rounded shadow">';
				$result .= '<tr><th>SpTag</th><th>Team1</th><th>Team2</th><th>SID</th><th>Datum alt</th><th>Zeit alt</th><th>Datum neu</th><th>Zeit neu</th></tr>';
				$sql = sprintf("SELECT * FROM %s WHERE trid=%d AND Ergebnis='-:-'", $this->kt->TABLE[spielplan], $trid);
				$data = $this->kt->db->getData($sql);
				foreach ($data as $row) {
					$s = $this->findSched($row['sptag'], $row['tid1'], $row['tid2'], $sched);
					if (isset($s)) {
						$_datum = $this->kt->convertDate($s['D']);
						$_zeit = $s['Z'] . ":00";

						if (($_datum <> $row['Datum']) || ($_zeit <> $row['Uhrzeit'])) {
							$result .= sprintf(
								'<tr><td>%d</td><td>%s</td><td>%s</td><td>%d</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>',
								$row['sptag'],
								$s['T1n'],
								$s['T2n'],
								$row['sid'],
								$row['Datum'],
								$row['Uhrzeit'],
								$_datum,
								$_zeit
							);

							$sql = sprintf(
								"UPDATE %s SET Datum='%s', Uhrzeit='%s' WHERE sid = %d",
								$this->kt->TABLE[spielplan],
								$_datum,
								$_zeit,
								$row['sid']
							);
							$this->kt->db->Query($sql);
							// *** $result .= "<tr><td>$sql</td></tr>";
						}
					} else {
						$result .= sprintf(
							'<tr><td><b>%d</b></td><td colspan="2">Paarung nicht gefunden (%s|%s)</td><td>%d</td><td>%s</td><td>%s</td><td colspan="2"><b>Fehler</b></td></tr>',
							$row['sptag'],
							$row['tid1'],
							$row['tid2'],
							$row['sid'],
							$row['Datum'],
							$row['Uhrzeit']
						);
					}
				}

				$result .= '</table>';
				break;
		}

		return $result;
	}
}
