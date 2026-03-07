<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2014
 * @date      10/2014
 * @version   3.1
 */


	if (isset($_POST['Name']))
	{
		require_once('../mysql.php');
		require_once('funcs.php');
				
		echo $Name = $_POST['Name'];
		echo $kurz = $_POST['kurz'];
			
		//$sql = "replace into $TABLE[teams] (Name,kurz) values ('$Name','$kurz')";
        
        $sql = "insert into $TABLE[teams] (Name, kurz) ";
        $sql .= "SELECT '$Name', '$kurz' FROM DUAL ";
        $sql .= "WHERE NOT EXISTS (SELECT * FROM $TABLE[teams] ";
        $sql .= "WHERE Name='$Name' OR kurz='$kurz') ";
        $sql .= "LIMIT 1";
        
		echo $sql;
		query($sql);
	}

?>