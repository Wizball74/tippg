<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      08/2012
 * @version   3.0
					***(getUsers.php)
 */

	require_once('getBaseData.php');
    require_once('json.php');

    $colModel = array();
	$rows = array();

	if (isset($_SESSION['user']))
	{
		$mode = $_POST['mode'];
		$user = $_SESSION['user'];

        /*
        {header: "", width: , dataIndex: '', sortable: true, menuDisabled: true, hidden: !showLevel,
           	editor: new Ext.form.NumberField({   				allowBlank: false   				,minLength: 1   				,maxLength: 3
   				,allowDecimals: false   				,minValue : 0   				,maxValue : 100
			})
		}*/

        $colModel[] = array('label' => "Name", 'width' => 180, 'name' => "name", 
                        'editable' => true, 'editoptions' => array('size'=>30, 'maxlength'=>30, 'class'=>'gradient'));
        $colModel[] = array('label' => "Login-Name", 'width' => 180, 'name' => "user", 
                        'editable' => true, 'editoptions' => array('size'=>64, 'maxlength'=>64,'class'=>'gradient'));
        $colModel[] = array('label' => "Passwort", 'width' => 100, 'name' => "password", 
                        'editable' => true, 'editoptions' => array('size'=>30, 'maxlength'=>30,'class'=>'gradient'));
        $colModel[] = array('label' => "E-Mail", 'width' => 300, 'name' => "email", 
                        'editable' => true, 'editoptions' => array('size'=>64, 'maxlength'=>64,'class'=>'gradient'));
        $colModel[] = array('label' => "id", 'name' => "tnid", 'key' => true, 'hidden' => true);
        
		unset($results);
		if (($mode == 'all') && ($user['userlevel'] == 100))
		{
			$sql = "select * from $TABLE[teilnehmer]";
            $colModel[] = array('label' => "Level", 'width' => 50, 'name' => "userlevel", 'align' => 'right', 'sorttype'=>'int', 
                            'editable' => true, 'editoptions' => array('size'=>3, 'maxlength'=>3,'class'=>'gradient'));
		}
		else
		{
			$sql = "select * from $TABLE[teilnehmer] where tnid={$user['tnid']}";
		}

		$result = query($sql);
		while ($row=mysql_fetch_assoc($result)) 
		{
			unset($row['password']);
			$row['name'] = utf8_encode($row['name']);
			$results[] = $row;
		}
		
        $rows = $results;
		if (!isset($rows)) $rows = array();
	}

	// Ausgabe
	$data = array('Records' => count($rows), 'Rows' => $rows);
	$json = array('colModel' => $colModel, 'data' => $data, 'sortname' => 'name');
	jsonout($json);
?>
