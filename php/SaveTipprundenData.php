<?php
/*
 * KT
 * @author    M.Andreas
 * @copyright (c) 2017
 * @date      01/2017
 * @version   4.0
 */

require_once('init.php');
$data = $_POST;

if (empty($data)) 
{
	$data = file_get_contents('php://input'); // MA 24.07.2017
	$data = json_decode($data,true);
	$data = $data['data'];
}

$kt->SaveTipprundenData($data);

?>
