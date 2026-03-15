# Code Review: tippg - Gesamtprojekt

Datum: 15.03.2026

---

## KRITISCH (13 Probleme)

| # | Bereich | Datei | Zeilen | Problem |
|---|---------|-------|--------|---------|
| 1 | PHP Sicherheit | `php/class.KT.php` | 2579–2593 | **SQL-Injection in `SaveTippsAdmin()`** — `$_POST['comment']`, `$d['Tip']`, `$d['Tip_old']` werden direkt per `sprintf('%s')` ohne Escaping in SQL eingebaut |
| 2 | PHP Sicherheit | `php/class.KT.php` | 2455–2483 | **SQL-Injection in `SaveBenutzerData()`** — Felder `user`, `email`, `name` direkt in INSERT/UPDATE ohne Escaping |
| 3 | PHP Sicherheit | `php/class.KT.php` | 2906–2914 | **SQL-Injection in `SaveSpielplan()`** — `Result`, `Time`, `Date` aus POST ohne Escaping im UPDATE |
| 4 | PHP Sicherheit | `php/class.KT.php` | 2690–2728 | **SQL-Injection in `SaveTipprundenData()`** — Rundenname und Datumsfelder ohne Escaping |
| 5 | PHP Sicherheit | `php/class.KT.php` | 2991–2996 | **SQL-Injection in `createTeam()`** — Teamname/Kuerzel aus POST ohne Escaping |
| 6 | PHP Sicherheit | `ktsvc/src/Controller/AuthController.php` | 93, 130 | **Klartext-Passwortvergleich** — `$password == $data['password']` ohne `password_verify()`, umgeht bcrypt-Migration komplett |
| 7 | PHP Sicherheit | `ktsvc/src/Controller/AuthController.php` | 147–148 | **MD5-Passwort-Hash im persistenten Cookie** — kein `secure`-Flag, Cookie-Diebstahl = permanenter Zugang |
| 8 | Architektur | `ktsvc/public/index.php` | 14–15, 46–81 | **Fehlende Controller-Klassen** — `LeagueController`, `StatsController`, `AdminController`, `ScheduleController`, `ReminderController` existieren nicht. ~15 Routen erzeugen fatale Fehler |
| 9 | JS Fehler | `kt.js` | 282 | **`trdata()` als freie Funktion aufgerufen**, aber nur als `this.trdata` definiert — wirft `ReferenceError`, Navigation kaputt |
| 10 | JS Fehler | `kt.js` | 321 | **`setStyle()` aufgerufen, aber nirgends definiert** — Style-Umschalter komplett defekt |
| 11 | JS Fehler | `kt.js` | 442 | **`setTimeout` mit String-Argument** — ist effektiv `eval`, funktioniert nicht mit CSP |
| 12 | JS Fehler | `kt.grids.js` | 409–411 | **`setTimeout` mit unsanitisierten Serverdaten** — `sortname` aus JSON wird in eval-String eingesetzt, potenzielle Code-Injection |
| 13 | JS Fehler | `kt.funcs.js` | 648, 824 | **Falsche Variable in `onSelectRow`** — vergleicht Grid-Name `id` statt Zeilen-ID `rid`, Inline-Bearbeitung in Admin.Profil und Admin.Tipprunden defekt |

---

## HOCH (14 Probleme)

| # | Bereich | Datei | Zeilen | Problem |
|---|---------|-------|--------|---------|
| 14 | PHP Sicherheit | `php/class.KT.php` | 1004–1030 | **Stored XSS** — Teamnamen werden als rohes HTML ohne `htmlspecialchars()` ausgegeben |
| 15 | PHP Sicherheit | `php/SaveBenutzerData.php`, `createTeam.php`, `Reminder.php` | — | **Keine Authentifizierungspruefung** auf schreibenden Endpunkten |
| 16 | PHP Sicherheit | `php/class.KT.php` | 954–958 | **IDOR** — `SaveTipps()` nutzt `tnid` aus POST, Tipps koennen fuer beliebige Benutzer abgegeben werden |
| 17 | PHP Sicherheit | Alle `php/` POST-Endpunkte | — | **Kein CSRF-Schutz** im gesamten Legacy-Stack |
| 18 | Architektur | `ktsvc/src/System/DatabaseConnector.php` | 17–21 | **PDO ERRMODE_SILENT** — alle DB-Fehler werden stillschweigend verschluckt, catch-Bloecke greifen nie |
| 19 | Architektur | `ktsvc/src/TableGateways/*.php` | diverse | **Rohe `PDOException`-Meldung an Client** per `exit($e->getMessage())` — Datenbankschema wird offengelegt |
| 20 | Architektur | Beide Stacks | — | **Inkompatible Auth-Modelle** — Legacy nutzt `remember_token`, Modern nutzt `cookname/cookpass`. Eingeloggte Nutzer werden vom jeweils anderen Stack nicht erkannt |
| 21 | Architektur | `php/class.KT.php` | 105–118 | **Verschachtelte Funktion `makeLaps()`** — wird bei zweitem `loadTr()`-Aufruf erneut deklariert, verursacht fatalen Fehler |
| 22 | JS Fehler | `kt.js` | 59, 106, 113, 149 | **XSS ueber `.html(res.username)`** — Benutzername/Nachricht vom Server als HTML eingefuegt |
| 23 | JS Fehler | `kt.js` | 425 | **`Status` vor Definition verwendet** — `Status.NoMsg` wirft `ReferenceError` |
| 24 | JS Fehler | `kt.grids.js` | 161 | **`$j.extend(events, ...)` ueberschreibt** den vom Aufrufer mitgegebenen `loadComplete`-Handler |
| 25 | JS Fehler | `kt.grids.js` | 399 | **AJAX-Error-Handler greift auf `e.msg` zu**, das nicht existiert — Fehlertext immer `"undefined"` |
| 26 | JS Fehler | `kt.funcs.js` | 120 | **`rows[0].deadline` ohne Laengenpruefung** — TypeError bei leerem Grid |
| 27 | JS Fehler | `kt.funcs.js` | 1043, 29 | **`val.indexOf()` auf Nicht-String** — TypeError bei numerischen Grid-Zellen |

---

## MITTEL (13 Probleme)

| # | Bereich | Datei | Zeilen | Problem |
|---|---------|-------|--------|---------|
| 28 | PHP Sicherheit | `php/init.php`, `ktsvc/bootstrap.php` | — | Session-Cookie ohne `secure`/`SameSite`-Flags; kein `session_regenerate_id()` nach Login |
| 29 | PHP Sicherheit | `php/class.KT.php` | 2462, 2480 | Neue Benutzer werden mit **MD5-Passwort-Hashes** angelegt |
| 30 | Architektur | `php/class.DB.php` | 43–48 | `Query()` Error-Handler ruft `jsonout()` auf, aber **stoppt nicht die Ausfuehrung** — partiell korrupter Zustand moeglich |
| 31 | Architektur | `php/class.DB.php` | 51–62 | `getData()` ruft `->fetch_assoc()` auf `false`-Ergebnis auf — **fataler Fehler** |
| 32 | Architektur | `php/class.DB.php` / `DatabaseConnector.php` | — | **Zeichensatz-Mismatch** — Legacy nutzt `utf8` (3 Byte), Modern nutzt `utf8mb4`. Emoji-/CJK-Daten werden stackuebergreifend beschaedigt |
| 33 | Architektur | `ktsvc/src/TableGateways/KTGateway.php` | 334 | **Hart-kodierter Tabellenname** `kt3_tipps` statt `.env`-Konfiguration |
| 34 | Architektur | `ktsvc/src/Controller/KTController.php` | — | Routen `getStandings`, `getMenu`, `getPrizeOverview`, `getPrizeInfo` verweisen auf **nicht-existierende Methoden** |
| 35 | Architektur | `php/class.KT.php` | 2460, 2477 | **`utf8_decode()`** beschaedigt Zeichen ausserhalb von Latin-1 |
| 36 | JS Fehler | `kt.grids.js` | 359 | **Scroll-Listener wird nie entfernt** bei Grid-Refresh — Speicherleck |
| 37 | JS Fehler | `kt.funcs.js` | 295 | `.trigger('refresh', rparam, opt)` — **drittes Argument wird stillschweigend ignoriert** |
| 38 | JS Fehler | `kt.grids.js` | 386 | `$j.extend(ropt, opt)` **veraendert `ropt` direkt** statt ein neues Objekt zu erstellen |
| 39 | JS Fehler | `kt.demo.js` | 507 | `JSON.parse` auf URL-kodierten AJAX-Daten — **wirft immer Fehler**, Demo-Parameter gehen verloren |
| 40 | JS Fehler | `kt.grids.js` | 429–432 | **Druckfenster schreibt unsanitisiertes Grid-HTML** — XSS im Druckkontext |

---

## Empfohlene Massnahmen (nach Prioritaet)

### 1. SQL-Injection beheben (Probleme 1–5)
Alle `sprintf`-Queries im Legacy-Stack auf Prepared Statements umstellen (via `$this->db->prepareExecute()`). Das ist die wichtigste einzelne Aenderung. Jede Stelle, die Benutzerdaten per `'%s'` in SQL einbaut, muss auf parametrisierte Abfragen umgestellt werden.

### 2. Authentifizierung vereinheitlichen (Probleme 6–7, 20)
- `password_verify()` in `AuthController` verwenden
- Cookie-basiertes "Remember Me" durch Zufalls-Token ersetzen (wie es der Legacy-Stack bereits macht)
- `secure`- und `SameSite`-Flags auf allen Session-/Auth-Cookies setzen
- Beide Stacks muessen denselben Session-Zustand teilen

### 3. Fehlende Controller implementieren (Problem 8)
Entweder die fehlenden Controller-Klassen (`LeagueController`, `StatsController`, `AdminController`, `ScheduleController`, `ReminderController`) implementieren oder die toten Routen aus `index.php` entfernen, um fatale Fehler zu vermeiden.

### 4. JavaScript-ReferenceErrors beheben (Probleme 9–10, 13, 23)
Diese Fehler brechen Kernfunktionalitaet:
- `trdata()` Scoping korrigieren (z.B. `kt.trdata()` verwenden)
- `setStyle()` implementieren oder entfernen
- `id`/`rid`-Verwechslung in `onSelectRow` korrigieren
- `Status`-Scoping korrigieren

### 5. XSS-Luecken schliessen (Probleme 14, 22)
- `htmlspecialchars()` fuer alle HTML-Ausgaben in PHP verwenden
- `.text()` statt `.html()` fuer Benutzerdaten in jQuery verwenden
- `setTimeout`-Aufrufe mit Strings durch Closures ersetzen

### 6. PDO Error-Mode setzen (Problem 18)
`PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION` im `DatabaseConnector`-Konstruktor ergaenzen. Ohne diese Einstellung ignoriert der gesamte moderne Stack stillschweigend alle Datenbankfehler.

### 7. Endpunkt-Authentifizierung nachholen (Problem 15)
`SaveBenutzerData.php`, `createTeam.php` und `Reminder.php` muessen vor der Ausfuehrung `$kt->checkLogin()` aufrufen.

### 8. CSRF-Schutz einfuehren (Problem 17)
Token-basierter CSRF-Schutz fuer alle zustandsaendernden POST-Endpunkte im Legacy-Stack.

---

## Statistik

| Schweregrad | Anzahl |
|-------------|--------|
| Kritisch    | 13     |
| Hoch        | 14     |
| Mittel      | 13     |
| **Gesamt**  | **40** |
