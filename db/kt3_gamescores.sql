CREATE TABLE IF NOT EXISTS `kt3_gamescores` (
  `tnid` int(10) unsigned NOT NULL,
  `game` varchar(20) NOT NULL,
  `trid` int(10) unsigned NOT NULL DEFAULT 0,
  `md` int(10) unsigned NOT NULL DEFAULT 0,
  `score` int(11) NOT NULL DEFAULT 0,
  `kicks` int(10) unsigned NOT NULL DEFAULT 0,
  `clones` int(10) unsigned NOT NULL DEFAULT 0,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`tnid`, `game`, `trid`, `md`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
