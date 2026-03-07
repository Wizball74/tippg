<?php
	class DB
	{
		public $host;
		public $userid;
		public $pw;
		public $database;

		function __construct($host, $userid, $pw, $database) {
			$this->host = $host;
			$this->userid = $userid;
			$this->pw = $pw;
			$this->database = $database;
		}

		function Query($sql)
		{
			$db = new mysqli($this->host, $this->userid, $this->pw, $this->database);
			$db->select_db($this->database);

			if ($erg = $db->query($sql))
			{
				//if ($debug) echo '<i>Erfolg : '.$sql.'</i><br>';
			}
			else
			{
				error_log("DB Error: " . $db->error . " | SQL: " . $sql);
				$GLOBALS['kt']->jsonout(array('message' => 'Ein Datenbankfehler ist aufgetreten.'));
			}

			return $erg;
		}

		function getData($sql)
		{
			$result = $this->Query($sql);
			$data = array();

			while ($row = $result->fetch_assoc())
			{
				$data[] = $row;
			}

			return $data;
		}

		function prepare($sql, $types, $params)
		{
			$db = new mysqli($this->host, $this->userid, $this->pw, $this->database);

			$stmt = $db->prepare($sql);
			if (!$stmt) {
				error_log("DB Prepare Error: " . $db->error . " | SQL: " . $sql);
				$GLOBALS['kt']->jsonout(array('message' => 'Ein Datenbankfehler ist aufgetreten.'));
				return false;
			}

			$stmt->bind_param($types, ...$params);

			if (!$stmt->execute()) {
				error_log("DB Execute Error: " . $stmt->error . " | SQL: " . $sql);
				$GLOBALS['kt']->jsonout(array('message' => 'Ein Datenbankfehler ist aufgetreten.'));
				return false;
			}

			$result = $stmt->get_result();
			return $result;
		}

		function prepareGetData($sql, $types, $params)
		{
			$result = $this->prepare($sql, $types, $params);
			if (!$result) return array();

			$data = array();
			while ($row = $result->fetch_assoc()) {
				$data[] = $row;
			}

			return $data;
		}

		function prepareExecute($sql, $types, $params)
		{
			$db = new mysqli($this->host, $this->userid, $this->pw, $this->database);

			$stmt = $db->prepare($sql);
			if (!$stmt) {
				error_log("DB Prepare Error: " . $db->error . " | SQL: " . $sql);
				return false;
			}

			$stmt->bind_param($types, ...$params);
			return $stmt->execute();
		}

	}

?>