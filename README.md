# tippg - Die Online-Tippgemeinschaft

Webanwendung zur Verwaltung einer Fußball-Tippgemeinschaft. Teilnehmer tippen Bundesliga-Ergebnisse, treten in einem internen Ligasystem gegeneinander an und vergleichen sich in Statistiken und Ranglisten.

## Features

- **Tippabgabe** mit Deadline-Kontrolle und Punkte-Berechnung
- **Tipp-Übersicht** mit Ergebnissen, Punkten und Prämien pro Spieltag
- **Ligasystem** mit automatisch generiertem Spielplan und Tabellen
- **Bundesliga-Integration** - Spielplan und Ergebnisse importieren
- **Statistiken** - Punkteverlauf, Trefferquote, Historische Tabellen (Chart.js)
- **Prämien-Verwaltung** mit Auszahlungsübersicht
- **Admin-Panel** - Benutzer, Tipprunden, Spielpläne, Ergebnis-Import
- **3 Themes** - Classic, Modern, Premium (Dark Mode)
- **Demo-Modus** - Vollständige UI ohne Backend
- **Easter Egg** - Fußball mit Breakout-Mechanik auf der Tipp-Übersicht

## Tech Stack

| Bereich | Technologie |
|---------|-------------|
| Frontend | jQuery, jQuery UI, jqGrid, Bootstrap 3, Chart.js |
| Backend | PHP 8.1+, MySQL/MariaDB |
| REST API | Eigene Router-Architektur (`ktsvc/`) |
| Mail | PHPMailer (Erinnerungen vor Deadline) |
| Pakete | npm (Chart.js), Composer (PHP) |

## Projektstruktur

```
tippg/
├── index.html              # Einstiegspunkt (SPA)
├── js/
│   ├── kt.js               # Init, Login, Navigation
│   ├── kt.funcs.js         # Alle Feature-Module
│   ├── kt.grids.js         # jqGrid-Konfiguration
│   ├── kt.charts.js        # Chart.js-Statistiken
│   ├── kt.ball.js          # Fußball-Easter-Egg
│   └── kt.demo.js          # Demo-Modus (Dummy-Daten)
├── css/
│   ├── style-classic.css    # Classic Theme
│   ├── style-modern.css     # Modern Theme
│   └── style-premium.css    # Premium/Dark Theme
├── php/                     # Legacy PHP-Endpunkte
│   ├── config.php           # DB-Config (liest ktsvc/.env)
│   ├── class.KT.php         # Business-Logik
│   ├── class.DB.php         # Datenbank-Abstraktion
│   └── Mailer/              # PHPMailer
└── ktsvc/                   # REST API
    ├── .env                 # Konfiguration (DB, Mail)
    ├── public/index.php     # API-Router
    └── src/
        ├── Controller/      # API-Endpunkte
        ├── TableGateways/   # Datenzugriff
        └── System/          # DB-Verbindung
```

## Lokale Einrichtung

### Voraussetzungen

- PHP 8.1+
- MySQL 5.7+ / MariaDB 10.2+
- Apache mit mod_rewrite (z.B. XAMPP)

### Installation

```bash
git clone <repo-url> tippg
cd tippg
npm install
cd ktsvc && composer install && cd ..
```

### Konfiguration

`ktsvc/.env` anlegen bzw. anpassen:

```env
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=tippgde_db1
DB_USERNAME=root
DB_PASSWORD=

MAIL_HOST=mail.example.de
MAIL_PORT=587
MAIL_USERNAME=reminder@example.de
MAIL_PASSWORD=
MAIL_FROM=reminder@example.de
MAIL_ENCRYPTION=tls
```

Die Tabellennamen werden ebenfalls in der `.env` konfiguriert (`T_TEILNEHMER`, `T_TIPPRUNDE`, etc.).

### Starten

Projekt in das XAMPP `htdocs/`-Verzeichnis legen und aufrufen:

```
http://localhost/tippg/
```

Falls kein Backend erreichbar ist, startet automatisch der **Demo-Modus** mit Dummy-Daten.

## Datenbank

Wichtigste Tabellen:

| Tabelle | Inhalt |
|---------|--------|
| `kt3_teilnehmer` | Benutzerkonten |
| `kt3_tipprunde` | Tipprunden/Saisons |
| `kt3_spielplan` | Spielpläne (Spieltag, Ergebnis, Datum) |
| `kt3_tipps` | Einzeltipps pro Spiel und Teilnehmer |
| `kt3_teams` | Bundesliga-Teams |
| `kt3_tr_teilnehmer` | Teilnehmer pro Runde |
| `kt3_ligaergebnis` | Liga-Ergebnisse |
| `kt3_praemien` | Prämien-Verteilung |

Migrationen liegen in `php/migrations/`.

## API-Endpunkte

### Authentifizierung
`login` | `logout` | `checkLogin`

### Tipps & Ergebnisse
`getTipOverview` | `getTipEdit` | `saveTips` | `getStandings`

### Liga
`getLeagueSchedule` | `getLeagueTable` | `getLeagueTableAll`

### Spielplan
`getMatchSchedule` | `getBundesligaTable`

### Statistiken
`getStatTipFrequency` | `getStatPlace` | `getStatPlaceLeague` | `getStatAllTime`

### Admin
`getUsers` | `saveUser` | `getRounds` | `saveRound` | `getAdminTips` | `saveAdminTips` | `importResults` | `importSchedule` | `savePrizes` | `sendReminders`

## Easter Egg

Auf der Tipp-Übersicht (Desktop, >= 992px) schwebt ein kleiner Fußball. Mit dem Cursor anstupsen -- die Punkte-Zellen sind unsichtbare Breakout-Blöcke. Highscores werden pro Spieler und Spieltag in localStorage gespeichert.

- Quaternion-basierte 3D-Rotation (Ikosaeder-Pentagone)
- Physik: Schwerkraft, Reibung, Abprall, Drehimpuls/Effet
- Partikel-Effekte und Glut-Animation bei zerstörten Zellen
- Score-Panel mit Live-Rangliste
