-- Zusätzliche Tabellen, die manuell angelegt werden müssen
-- (werden nicht automatisch vom PHP-Code erstellt)

CREATE TABLE IF NOT EXISTS kt3_gamescores (
    tnid INT(10) UNSIGNED NOT NULL,
    game VARCHAR(20) NOT NULL,
    trid INT(10) UNSIGNED NOT NULL DEFAULT 0,
    md INT(10) UNSIGNED NOT NULL DEFAULT 0,
    score INT(11) NOT NULL DEFAULT 0,
    created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (tnid, game, trid, md)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kt3_pinnwand (
    id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
    tnid INT(10) UNSIGNED NOT NULL,
    nick VARCHAR(50) NOT NULL,
    `text` TEXT NOT NULL,
    image VARCHAR(255) DEFAULT NULL,
    sticky TINYINT(1) NOT NULL DEFAULT 0,
    created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_sticky_created (sticky, created)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
