<?php
/*
 * KT
 * @author    M.Andreas
 * @copyright (c) 2017
 * @date      01/2017
 * @version   4.0
 */

require_once('init.php');

$allowed = [
	'TippsUebersicht', 'TippsTippabgabe', 'TippsGesamtstand',
	'LigaSpielplan', 'LigaTabelle', 'PraemienUebersicht', 'PraemienInfo',
	'Spielplan', 'Tabelle', 'StatTippanzahl', 'StatPlace', 'StatPlaceLeague',
	'LigaTabelleGesamt', 'StatGesamtstand', 'TippTabelle',
	'Benutzer', 'TippsAdmin', 'Tipprunden', 'LigaTeilnehmer'
];

$fn = isset($_POST['fn']) ? $_POST['fn'] : '';
if (!in_array($fn, $allowed)) {
	$kt->jsonout(array('message' => 'Ungültige Anfrage.'));
	return;
}

$method = 'Get' . $fn . 'Data';
$kt->$method();

?>
