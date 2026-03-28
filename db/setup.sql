-- Zusätzliche Tabellen und Spalten, die manuell angelegt werden müssen
-- (sind nicht im Hauptdump tippgde_db1.sql enthalten)

-- Gamescores-Tabelle (Breakout, Hunt)
CREATE TABLE IF NOT EXISTS kt3_gamescores (
    tnid INT(10) UNSIGNED NOT NULL,
    game VARCHAR(20) NOT NULL,
    trid INT(10) UNSIGNED NOT NULL DEFAULT 0,
    md INT(10) UNSIGNED NOT NULL DEFAULT 0,
    score INT(11) NOT NULL DEFAULT 0,
    kicks INT(10) UNSIGNED NOT NULL DEFAULT 0,
    clones INT(10) UNSIGNED NOT NULL DEFAULT 0,
    created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (tnid, game, trid, md)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Pinnwand-Tabelle (Social-Feed mit Posts, Bildern, Positionierung)
CREATE TABLE IF NOT EXISTS kt3_pinnwand (
    id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
    tnid INT(10) UNSIGNED NOT NULL,
    nick VARCHAR(50) NOT NULL,
    `text` TEXT NOT NULL,
    image VARCHAR(255) DEFAULT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#fff9c4',
    sticky TINYINT(1) NOT NULL DEFAULT 0,
    pos_x DOUBLE DEFAULT NULL,
    pos_y DOUBLE DEFAULT NULL,
    rotation DOUBLE DEFAULT NULL,
    card_style VARCHAR(20) DEFAULT '',
    created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_sticky_created (sticky, created)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- remember_token fuer sichere "Angemeldet bleiben"-Funktion
ALTER TABLE kt3_teilnehmer ADD COLUMN IF NOT EXISTS remember_token VARCHAR(64) DEFAULT NULL;
