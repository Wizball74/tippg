<?php
namespace Src\TableGateways;

class TeilnehmerGateway {

    private $db = null;

    private $table;

    public function __construct($db)
    {
        $this->db = $db->getConnection();
        $this->table = getenv('T_TEILNEHMER');
    }

    public function findByName($userName)
    {
        $statement = "
            SELECT *
            FROM {$this->table}
            WHERE user = ?;
        ";

        try {
            $statement = $this->db->prepare($statement);
            $statement->execute(array($userName));
            $result = $statement->fetchAll(\PDO::FETCH_ASSOC);
            return $result;
        } catch (\PDOException $e) {
            exit($e->getMessage());
        }    
    }

    public function findById($id)
    {
        $statement = "
            SELECT *
            FROM {$this->table}
            WHERE tnid = ?
        ";

        try {
            $statement = $this->db->prepare($statement);
            $statement->execute(array($id));
            $result = $statement->fetchAll(\PDO::FETCH_ASSOC);
            return $result;
        } catch (\PDOException $e) {
            exit($e->getMessage());
        }    
    }

    public function findByToken($token)
    {
        $statement = "
            SELECT *
            FROM {$this->table}
            WHERE token = ?
        ";

        try {
            $statement = $this->db->prepare($statement);
            $statement->execute(array($token));
            $result = $statement->fetchAll(\PDO::FETCH_ASSOC);
            return $result;
        } catch (\PDOException $e) {
            exit($e->getMessage());
        }    
    }

    public function updateLogin($userName)
    {
        $token = bin2hex(random_bytes(32));

        $statement = "
            UPDATE {$this->table}
            SET lastLogin = ?, lastLogin2=CURRENT_TIMESTAMP, token = ?
            WHERE user = ?
        ";
        try {
            $statement = $this->db->prepare($statement);
            $statement->execute(array(date("YmdHis"), $token, $userName));
            return true;
        } catch (\PDOException $e) {
            return false;
        }
    }

    public function updatePassword($userName, $hash)
    {
        $statement = "UPDATE {$this->table} SET password = ? WHERE user = ?";
        try {
            $statement = $this->db->prepare($statement);
            $statement->execute(array($hash, $userName));
            return true;
        } catch (\PDOException $e) {
            return false;
        }
    }

    public function insertRememberToken($userName, $token)
    {
        // tnid des Users holen
        $user = $this->findByName($userName);
        if (empty($user)) return false;
        $tnid = $user[0]['tnid'];

        try {
            $stmt = $this->db->prepare("INSERT INTO kt3_remember_tokens (tnid, token) VALUES (?, ?)");
            $stmt->execute(array($tnid, $token));

            // Alte Tokens aufraeumen: max. 10 pro User behalten
            $cleanup = $this->db->prepare("DELETE FROM kt3_remember_tokens WHERE tnid = ? AND id NOT IN (SELECT id FROM (SELECT id FROM kt3_remember_tokens WHERE tnid = ? ORDER BY created_at DESC LIMIT 10) AS keep)");
            $cleanup->execute(array($tnid, $tnid));

            return true;
        } catch (\PDOException $e) {
            return false;
        }
    }

    public function findByRememberToken($token)
    {
        $statement = "SELECT t.* FROM kt3_remember_tokens rt JOIN {$this->table} t ON rt.tnid = t.tnid WHERE rt.token = ?";
        try {
            $statement = $this->db->prepare($statement);
            $statement->execute(array($token));
            $result = $statement->fetch(\PDO::FETCH_ASSOC);
            return $result ?: null;
        } catch (\PDOException $e) {
            return null;
        }
    }

    public function deleteRememberToken($token)
    {
        try {
            $stmt = $this->db->prepare("DELETE FROM kt3_remember_tokens WHERE token = ?");
            $stmt->execute(array($token));
            return true;
        } catch (\PDOException $e) {
            return false;
        }
    }
}