-- Migration: Eigene Tabelle fuer Remember-Tokens (Multi-Device-Support)
-- Ersetzt die einzelne remember_token-Spalte in kt3_teilnehmer
-- Jedes Geraet bekommt seinen eigenen Token, Login auf Geraet B invalidiert nicht Geraet A

CREATE TABLE IF NOT EXISTS kt3_remember_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tnid INT NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_token (token),
    INDEX idx_tnid (tnid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bestehende Tokens migrieren
INSERT IGNORE INTO kt3_remember_tokens (tnid, token)
SELECT tnid, remember_token FROM kt3_teilnehmer WHERE remember_token IS NOT NULL;

-- Alte Spalte entfernen (optional, nach erfolgreichem Test)
-- ALTER TABLE kt3_teilnehmer DROP COLUMN remember_token;
