<?php
/*
 * Pinnwand API-Endpoint
 * Aktionen: load, save, delete, sticky
 */

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

require_once('init.php');

if (!$kt->user) {
	$kt->jsonout(array('ok' => false, 'message' => 'Nicht angemeldet.'));
	exit;
}

$action = isset($_POST['action']) ? $_POST['action'] : '';

switch ($action) {
	case 'load':
		$kt->GetPinnwand();
		break;
	case 'save':
		$text = isset($_POST['text']) ? trim($_POST['text']) : '';
		$kt->SavePinnwandPost($text);
		break;
	case 'delete':
		$id = isset($_POST['id']) ? intval($_POST['id']) : 0;
		$kt->DeletePinnwandPost($id);
		break;
	case 'sticky':
		$id = isset($_POST['id']) ? intval($_POST['id']) : 0;
		$kt->TogglePinnwandSticky($id);
		break;
	case 'upload':
		$kt->UploadPinnwandImage();
		break;
	default:
		$kt->jsonout(array('ok' => false, 'message' => 'Unbekannte Aktion.'));
}
?>
