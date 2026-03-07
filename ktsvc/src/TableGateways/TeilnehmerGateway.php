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
}