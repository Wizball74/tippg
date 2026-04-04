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
		$style = isset($_POST['style']) ? trim($_POST['style']) : '';
		$replyTo = isset($_POST['reply_to']) ? intval($_POST['reply_to']) : null;
		$kt->SavePinnwandPost($text, $style, $replyTo);
		break;
	case 'savePosition':
		$id = isset($_POST['id']) ? intval($_POST['id']) : 0;
		$posX = isset($_POST['posX']) ? floatval($_POST['posX']) : 0;
		$posY = isset($_POST['posY']) ? floatval($_POST['posY']) : 0;
		$rotation = isset($_POST['rotation']) ? floatval($_POST['rotation']) : 0;
		$kt->SavePinnwandPosition($id, $posX, $posY, $rotation);
		break;
	case 'saveStyle':
		$id = isset($_POST['id']) ? intval($_POST['id']) : 0;
		$style = isset($_POST['style']) ? trim($_POST['style']) : '';
		$kt->SavePinnwandStyle($id, $style);
		break;
	case 'edit':
		$id = isset($_POST['id']) ? intval($_POST['id']) : 0;
		$text = isset($_POST['text']) ? trim($_POST['text']) : '';
		$kt->EditPinnwandPost($id, $text);
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
	case 'count':
		$kt->GetPinnwandCount();
		break;
	default:
		$kt->jsonout(array('ok' => false, 'message' => 'Unbekannte Aktion.'));
}
?>
