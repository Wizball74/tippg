<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
                    ***(saveRounds.php)
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
        require_once('funcs.php');
		
		$user = $_SESSION['user'];
			
		if ($user['userlevel'] == 100) 
		{
        
            switch($data['oper'])
			{
				case 'add':
                    $sql = sprintf("INSERT INTO $TABLE[tipprunde] (Name,Beginn,Ende,Aktiv,P1,P2,P3,deadline,Runden,Ligen,Ersteller)
							        values('%s','%s','%s','%s',%d,%d,%d,%d,%d,%d,%d)",
                            $data['Name'],convertDate($data['Start']),convertDate($data['End']),$data['Active'],
                            $data['P1'],$data['P2'],$data['P3'],$data['Deadline'],$data['Rounds'],$data['Leagues'], $user['tnid']);
                    //jsonout(array('ok' => false, 'message'=>$sql));
                    query($sql);
                    jsonout(array('ok' => true, 'message'=>'Daten gespeichert!'));
                    return;
                break;
                case 'edit':
                    $sql = sprintf("update $TABLE[tipprunde] SET Name='%s', Beginn='%s', Ende='%s', Aktiv='%s', 
									P1=%d, P2=%d, P3=%d, deadline=%d, Runden=%d, Ligen=%d", 
                            $data['Name'],convertDate($data['Start']),convertDate($data['End']),$data['Active'],
                            $data['P1'],$data['P2'],$data['P3'],$data['Deadline'],$data['Rounds'],$data['Leagues']);
					$sql.= sprintf(" WHERE trid=%d", $data['id']);	
					query($sql);
					//echo $sql;			
					//jsonout(array('ok' => false, 'message'=>$sql));
                    //exit;
					if ($data['id'] == $_SESSION['trrow']['trid']) unset($_SESSION['trrow']); // wenn aktuelle Runde geändert wurde neu laden...
					jsonout(array('ok' => true, 'message'=>'Daten gespeichert!'));
                    return;
                break;
                case 'del':
                    // TODO
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
