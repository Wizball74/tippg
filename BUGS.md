# Echte Bugs: tippg

Datum: 15.03.2026

---

## KRITISCH — Funktion komplett kaputt

### Bug 1: `trdata()` als freie Funktion aufgerufen — ReferenceError
- **Datei:** `js/kt.js` Zeile 282, `js/kt.funcs.js` Zeilen 226, 243
- **Auswirkung:** Navigation beim Wechsel der Tipprunde bricht komplett ab
- **Ursache:** `trdata()` ist als `this.trdata` definiert, wird aber als freie Funktion `trdata()` aufgerufen. Das ergibt `ReferenceError: trdata is not defined`.
- **Fix:** `trdata()` durch `kt.trdata()` ersetzen

### Bug 2: `setStyle()` existiert nicht — ReferenceError
- **Datei:** `js/kt.js` Zeile 321
- **Auswirkung:** Style-/Theme-Umschalter im Navbar funktioniert nicht
- **Ursache:** Der `cbstyle`-Change-Handler ruft `setStyle(id)` auf, diese Funktion existiert nirgends im Code.
- **Fix:** Funktion implementieren oder vorhandene Theme-Logik anbinden

### Bug 3: Falsche Variable in `onSelectRow` — Inline-Bearbeitung defekt
- **Datei:** `js/kt.funcs.js` Zeilen 648 (Admin.Profil), 824 (Admin.Tipprunden)
- **Auswirkung:** Inline-Editing in den Admin-Grids funktioniert nicht korrekt
- **Ursache:** `if (id && id !== lastSel)` vergleicht den Grid-Namen `id` (z.B. `'Benutzer'`) statt die Zeilen-ID `rid`. Dadurch wird `lastSel` immer auf den Grid-Namen gesetzt statt auf die aktuelle Zeile. Copy-Paste-Fehler — in `Admin.Benutzer` (Zeile 616) ist es korrekt mit `rid`.
- **Fix:** `id` durch `rid` ersetzen in den betroffenen Stellen

### Bug 4: Fehlende Controller-Klassen — ~15 API-Routen fatal
- **Datei:** `ktsvc/public/index.php` Zeilen 14–15, 46–81
- **Auswirkung:** Etwa die Haelfte aller REST-API-Routen erzeugt einen fatalen PHP-Fehler
- **Ursache:** `LeagueController`, `StatsController`, `AdminController`, `ScheduleController`, `ReminderController` werden importiert, existieren aber nicht als Dateien.
- **Fix:** Controller implementieren oder tote Routen entfernen

### Bug 5: Fehlende Methoden in `KTController`
- **Datei:** `ktsvc/src/Controller/KTController.php`; `ktsvc/public/index.php` Zeilen 37, 43, 51, 52
- **Auswirkung:** Routen `getStandings`, `getMenu`, `getPrizeOverview`, `getPrizeInfo` erzeugen `Call to undefined method` Fatal Error
- **Ursache:** Die Methoden sind im Router eingetragen, existieren aber nicht in der Controller-Klasse.
- **Fix:** Methoden implementieren oder Routen entfernen

---

## HOCH — Fehler im Normalbetrieb

### Bug 6: `Status` vor Definition verwendet — ReferenceError
- **Datei:** `js/kt.js` Zeile 425
- **Auswirkung:** `showMessage()` bricht beim ersten Aufruf ab
- **Ursache:** `Status.NoMsg`, `Status.OK` etc. werden als freie Variable referenziert, aber `Status` ist erst als `this.Status` ab Zeile 625 definiert. `Status` ist zum Zeitpunkt des Aufrufs `undefined`.
- **Fix:** `Status` durch `kt.Status` ersetzen oder Variable frueher definieren

### Bug 7: AJAX-Error-Handler zeigt immer "undefined"
- **Datei:** `js/kt.grids.js` Zeile 399
- **Auswirkung:** Bei AJAX-Fehlern steht im Fehlertext immer `"undefined"` statt der echten Fehlermeldung
- **Ursache:** `e.msg` wird aufgerufen, aber der jQuery-AJAX-Error-Callback hat die Signatur `(jqXHR, textStatus, errorThrown)` — `e` ist ein String, nicht ein Objekt mit `.msg`.
- **Fix:** `e.msg` durch `e` ersetzen (ist bereits der Fehlertext)

### Bug 8: `rows[0].deadline` ohne Laengenpruefung — TypeError
- **Datei:** `js/kt.funcs.js` Zeile 120
- **Auswirkung:** TypeError-Crash wenn ein Grid keine Daten zurueckliefert
- **Ursache:** `rows[0]` wird zugegriffen ohne zu pruefen ob `rows` leer ist.
- **Fix:** Guard einfuegen: `if (rows && rows.length && rows[0].deadline)`

### Bug 9: `val.indexOf()` auf Nicht-String — TypeError
- **Datei:** `js/kt.funcs.js` Zeilen 1043, 29
- **Auswirkung:** Crash bei numerischen Grid-Zellen in `createSchedule` und `getGridData`
- **Ursache:** `val.indexOf("input")` wird aufgerufen ohne `typeof`-Pruefung. Bei Zahlen oder `null` gibt es einen TypeError.
- **Fix:** `typeof val === 'string' && val.indexOf(...)` oder `String(val).indexOf(...)`

### Bug 10: `$j.extend(events, ...)` ueberschreibt Aufrufer-Events
- **Datei:** `js/kt.grids.js` Zeile 161–162
- **Auswirkung:** Jeder `loadComplete`-Handler der von einem Aufrufer an `autoGrid` uebergeben wird, wird stillschweigend ueberschrieben
- **Ursache:** `$j.extend(events, { loadComplete: ... })` kopiert auf das uebergebene Objekt, statt ein neues zu erzeugen.
- **Fix:** `events = $j.extend({}, events, { loadComplete: ... })` oder separate Callback-Kette

### Bug 11: Verschachtelte Funktion `makeLaps()` — Fatal Error bei Wiederaufruf
- **Datei:** `php/class.KT.php` Zeilen 105–118
- **Auswirkung:** Fataler Fehler `Cannot redeclare function makeLaps()` wenn `loadTr()` mehr als einmal aufgerufen wird
- **Ursache:** PHP-Funktionen die innerhalb einer Methode deklariert werden, landen im globalen Scope. Beim zweiten Aufruf existiert die Funktion bereits.
- **Fix:** Als private Methode der Klasse definieren oder als Closure in eine Variable

### Bug 12: PDO ERRMODE_SILENT — Datenbankfehler komplett unsichtbar
- **Datei:** `ktsvc/src/System/DatabaseConnector.php` Zeilen 17–21
- **Auswirkung:** Saemtliche Datenbankfehler im modernen Stack werden verschluckt. Alle `catch (PDOException)` Bloecke in den Gateways greifen nie.
- **Ursache:** PDO wird ohne `PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION` erstellt. Standard ist `ERRMODE_SILENT`.
- **Fix:** Option im Konstruktor setzen: `[PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]`

### Bug 13: `getData()` crasht bei fehlgeschlagener Query
- **Datei:** `php/class.DB.php` Zeilen 51–62
- **Auswirkung:** Fataler Fehler wenn eine SQL-Query fehlschlaegt
- **Ursache:** `Query()` gibt bei Fehler `false` zurueck, `getData()` ruft dann `->fetch_assoc()` auf `false` auf.
- **Fix:** Rueckgabewert von `Query()` pruefen bevor `fetch_assoc()` aufgerufen wird

### Bug 14: `Query()` Error-Handler stoppt Ausfuehrung nicht
- **Datei:** `php/class.DB.php` Zeilen 43–48
- **Auswirkung:** Nach einem DB-Fehler laeuft der Code weiter und kann korrupte Daten schreiben
- **Ursache:** `jsonout()` gibt JSON aus, macht aber kein `exit()`. Die Methode gibt danach `false` zurueck und der Aufrufer arbeitet weiter.
- **Fix:** `exit()` nach `jsonout()` einfuegen oder Exception werfen

---

## MITTEL — Fehler unter bestimmten Bedingungen

### Bug 15: `setTimeout` mit String-Argumenten (3 Stellen)
- **Dateien:** `js/kt.js` Zeile 442, `js/kt.grids.js` Zeilen 409–411, `js/kt.funcs.js` Zeile 659
- **Auswirkung:** Funktioniert nicht mit Content Security Policy (CSP), da String-`setTimeout` intern `eval` nutzt. In `kt.grids.js` werden zusaetzlich unsanitisierte Serverdaten (`sortname`) in den String eingebaut.
- **Fix:** Durch Closures ersetzen: `setTimeout(function() { ... }, delay)`

### Bug 16: `.trigger('refresh', rparam, opt)` — drittes Argument ignoriert
- **Datei:** `js/kt.funcs.js` Zeile 295
- **Auswirkung:** Grid-Optionen werden bei Refresh von Praemien.Info, Admin.Tipps und Admin.Liga nicht uebergeben
- **Ursache:** jQuery `.trigger()` akzeptiert nur 2 Parameter. Das dritte Argument `opt` wird stillschweigend verworfen.
- **Fix:** Parameter in ein Array packen: `.trigger('refresh', [rparam, opt])`

### Bug 17: `$j.extend(ropt, opt)` veraendert Quellobjekt
- **Datei:** `js/kt.grids.js` Zeile 386
- **Auswirkung:** Unerwarteter Zustand wenn dasselbe Options-Objekt wiederverwendet wird
- **Ursache:** `$j.extend(ropt, opt)` aendert `ropt` direkt statt ein neues Objekt zu erzeugen.
- **Fix:** `opt = $j.extend({}, ropt, opt)`

### Bug 18: Demo-Modus parst AJAX-Daten falsch
- **Datei:** `js/kt.demo.js` Zeile 507
- **Auswirkung:** Demo-Modus liefert immer leere Daten statt Mock-Daten
- **Ursache:** `JSON.parse(opts.data)` wird auf URL-kodierte Strings angewendet (z.B. `"trid=1&md=25"`), was immer einen Fehler wirft. Dadurch bleibt `params = {}` und kein Mock-Handler matcht.
- **Fix:** URL-Parameter parsen statt JSON: `new URLSearchParams(opts.data)` oder manuell splitten

### Bug 19: Scroll-Listener akkumulieren bei Grid-Refresh — Speicherleck
- **Datei:** `js/kt.grids.js` Zeile 359
- **Auswirkung:** Nach mehreren Grid-Refreshes haengen mehrere Scroll-Listener, Performance verschlechtert sich
- **Ursache:** Bei jedem `autoGrid`-Aufruf wird ein neuer `scroll.stickyHdr`-Listener angehaengt, aber der alte nie entfernt.
- **Fix:** Vor dem Binden `.off('scroll.stickyHdr' + id)` aufrufen

### Bug 20: `calcBonus()` crasht bei leerem Spieltag
- **Datei:** `ktsvc/src/TableGateways/KTGateway.php` Zeilen 165–172
- **Auswirkung:** PHP-Fehler wenn ein Spieltag keine Ergebnisse hat
- **Ursache:** `$results[0]['trid']` wird ohne Pruefung auf leeres Array zugegriffen.
- **Fix:** Leeres Array abfangen bevor auf Index 0 zugegriffen wird

### Bug 21: `getLeagueOpponent()` crasht ohne Ligagegner
- **Datei:** `ktsvc/src/TableGateways/KTGateway.php` Zeilen 206–224
- **Auswirkung:** PHP-Fehler wenn kein Ligagegner existiert
- **Ursache:** `$result[0]` ist `null` wenn kein Ergebnis, danach wird `$data['tnid1']` auf `null` zugegriffen.
- **Fix:** Rueckgabewert pruefen

### Bug 22: Zeichensatz-Mismatch zwischen Legacy und Modern Stack
- **Datei:** `php/class.DB.php` / `ktsvc/src/System/DatabaseConnector.php`
- **Auswirkung:** Emojis und CJK-Zeichen werden beschaedigt wenn ueber beide Stacks gelesen/geschrieben wird
- **Ursache:** Legacy nutzt `set_charset('utf8')` (3-Byte), Modern nutzt `charset=utf8mb4` (4-Byte).
- **Fix:** Legacy-Stack ebenfalls auf `utf8mb4` umstellen

### Bug 23: `utf8_decode()` beschaedigt Nicht-Latin-1-Zeichen
- **Datei:** `php/class.KT.php` Zeilen 2460, 2477
- **Auswirkung:** Benutzernamen mit Sonderzeichen (Umlaute tlw. ok, aber Kyrillisch, Arabisch etc.) werden korrumpiert
- **Ursache:** `utf8_decode()` wandelt UTF-8 nach ISO-8859-1 um, was bei der UTF-8 DB-Verbindung falsch ist.
- **Fix:** `utf8_decode()` entfernen

### Bug 24: `data[0]` ohne Guard in `createSummary`
- **Datei:** `js/kt.funcs.js` Zeilen 347–349
- **Auswirkung:** TypeError wenn Praemien-Grid keine Daten hat
- **Ursache:** `data[0].Total` wird ohne Laengenpruefung aufgerufen.
- **Fix:** `if (data && data.length)` voranstellen

### Bug 25: `logout()` im modernen Stack gibt nie eine Antwort
- **Datei:** `ktsvc/src/Controller/AuthController.php` Zeile 119
- **Auswirkung:** Client erhaelt HTTP 200 mit leerem Body, keine Bestaetigung ob Logout geklappt hat
- **Ursache:** Funktion gibt immer `false` zurueck ohne eine API-Response zu senden.
- **Fix:** `$this->api->RespondOk()` oder aehnliche Response senden

---

## Zusammenfassung

| Schweregrad | Anzahl |
|-------------|--------|
| Kritisch    | 5      |
| Hoch        | 9      |
| Mittel      | 11     |
| **Gesamt**  | **25** |
