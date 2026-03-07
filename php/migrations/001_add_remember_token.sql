-- Migration: remember_token Spalte fuer sichere "Angemeldet bleiben"-Funktion
-- Ersetzt die unsichere Speicherung des Passwort-Hashes im Cookie
ALTER TABLE kt3_teilnehmer ADD COLUMN remember_token VARCHAR(64) DEFAULT NULL;
