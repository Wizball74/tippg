<?php
	class DB
	{
		public $host;
		public $userid;
		public $pw;
		public $database;
		private $db = null;

		function __construct($host, $userid, $pw, $database) {
			$this->host = $host;
			$this->userid = $userid;
			$this->pw = $pw;
			$this->database = $database;
		}

		private function getConnection()
		{
			$needReconnect = !$this->db || !($this->db instanceof mysqli) || $this->db->connect_errno;
			if (!$needReconnect) {
				try { $this->db->query('SELECT 1'); } catch (\Error $e) { $needReconnect = true; }
			}
			if ($needReconnect) {
				$this->db = new mysqli($this->host, $this->userid, $this->pw, $this->database);
				if ($this->db->connect_error) {
					error_log("DB Connect Error: " . $this->db->connect_error);
					die('Datenbankverbindung fehlgeschlagen.');
				}
				$this->db->set_charset('utf8');
			}
			return $this->db;
		}

		function Query($sql)
		{
			$db = $this->getConnection();

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
			$db = $this->getConnection();

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
			$db = $this->getConnection();

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