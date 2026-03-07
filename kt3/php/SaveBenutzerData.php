<?php
 /*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
					***(saveUsers.php)
 */ 
   
	require_once('json.php');

	session_start();

	$data = $_POST;
	if (empty($data)) {
		$data = $HTTP_RAW_POST_DATA;
		$data = json_decode($data,true);
		$data = $data['data'];
	}

	if (isset($_SESSION['user']) && isset($data))
	{
		require_once('../mysql.php');
	
		$user = $_SESSION['user'];
				
		if ($user['userlevel'] == 100 || $data['id'] == $user['tnid'] ) 
		{
			switch($data['oper'])
			{
				case 'add':
					if ($user['userlevel'] == 100)
					{
						$sql = sprintf("INSERT INTO $TABLE[teilnehmer] (user,email,name,userlevel,password) values('%s','%s','%s',%d,'%s')",
							$data['user'],$data['email'],utf8_decode($data['name']),$data['userlevel'], md5($data['password']));				
						query($sql);
						//jsonout(array('ok' => true, 'message'=>$sql));
						jsonout(array('ok' => true, 'message'=>'Benutzer angelegt!'));
						return;
					}
				break;

				case 'edit':
					$sql = sprintf("UPDATE $TABLE[teilnehmer] SET user='%s', email='%s', name='%s'", 
						$data['user'],$data['email'],utf8_decode($data['name']));
					if (!empty($data['password'])) $sql.= sprintf(", password='%s'", md5($data['password']));
                    if ($user['userlevel'] == 100)  $sql.= sprintf(", userlevel=%d",$data['userlevel']);
					$sql.= sprintf(" WHERE tnid=%d", $data['id']);
					query($sql);
					//jsonout(array('ok' => true, 'message'=>$sql));
					jsonout(array('ok' => true, 'message'=>'Daten gespeichert!'. $sql));
					return;
				break;

				case 'del':
					if ($user['userlevel'] == 100)
					{
						$sql = "DELETE FROM $TABLE[teilnehmer]";
						$sql.= sprintf(" WHERE tnid=%d", $data['id']);
						query($sql);
						//jsonout(array('ok' => true, 'message'=>$sql));
						jsonout(array('ok' => true, 'message'=>'Benutzer gelöscht!'));
						// TODO verknüpfte Daten?
						return;
					}
				break;
				default:
					jsonout(array('ok' => false, 'message'=>$data[oper]));
					//jsonout(array('ok' => false, 'message'=>print_r($data,true)));
					return;
				break;
			}           
		}			        
	}

	jsonout(array('ok' => true));
?>
